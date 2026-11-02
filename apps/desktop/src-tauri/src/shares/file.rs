//! Validated shared files.
//!
//! Symlink and replacement policy: a selected path is resolved once, when the
//! user picks or drops it. FileHop then keeps the opened handle and serves every
//! download from that handle with positional reads. Renaming, replacing, or
//! re-linking the path afterwards cannot redirect a share to another file. If the
//! original file changes size, downloads report it as unavailable instead of
//! sending content that no longer matches the advertised length.

use std::fs::{File, OpenOptions};
use std::io;
use std::path::Path;
use std::sync::Arc;

use axum::body::Bytes;
use futures_util::Stream;
use serde::Serialize;
use tokio_util::sync::CancellationToken;

/// Bytes read per chunk while streaming. Memory per transfer stays bounded by this.
pub const CHUNK_SIZE: usize = 64 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Image,
    Document,
    Archive,
    Audio,
    Video,
    Other,
    /// Summary kind for a share that contains several files.
    Bundle,
}

/// Why a selected item can't be shared. Messages never contain paths.
#[derive(Debug, PartialEq, Eq)]
pub enum Rejection {
    Directory,
    NotRegular,
    Unreadable,
}

impl Rejection {
    pub fn message(&self) -> &'static str {
        match self {
            Rejection::Directory => "Folders can't be shared.",
            Rejection::NotRegular => "Only regular files can be shared.",
            Rejection::Unreadable => "FileHop can't read this file.",
        }
    }
}

/// A selected regular file, pinned by its open handle.
#[derive(Debug)]
pub struct SharedFile {
    name: String,
    size: u64,
    kind: FileKind,
    media_type: String,
    handle: File,
}

impl SharedFile {
    /// Validates and opens a user-selected path.
    pub fn open(path: &Path) -> Result<Self, Rejection> {
        let name = display_name(path);
        let canonical = path.canonicalize().map_err(|_| Rejection::Unreadable)?;
        let metadata = std::fs::metadata(&canonical).map_err(|_| Rejection::Unreadable)?;
        if metadata.is_dir() {
            return Err(Rejection::Directory);
        }
        if !metadata.is_file() {
            return Err(Rejection::NotRegular);
        }
        let handle = open_nonblocking(&canonical).map_err(|_| Rejection::Unreadable)?;
        // The path may have been swapped between the checks above and opening it;
        // only the opened handle's own metadata is authoritative.
        let opened = handle.metadata().map_err(|_| Rejection::Unreadable)?;
        if opened.is_dir() {
            return Err(Rejection::Directory);
        }
        if !opened.is_file() {
            return Err(Rejection::NotRegular);
        }
        let media_type = mime_guess::from_path(&name)
            .first_or_octet_stream()
            .essence_str()
            .to_owned();
        Ok(Self {
            kind: classify(&media_type, &name),
            size: opened.len(),
            name,
            media_type,
            handle,
        })
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn size(&self) -> u64 {
        self.size
    }

    pub fn kind(&self) -> FileKind {
        self.kind
    }

    /// Content type for downloads. Types a browser could execute or render as a
    /// document are downgraded to a generic binary type.
    pub fn download_media_type(&self) -> &str {
        let media_type = self.media_type.as_str();
        let active = media_type == "text/html"
            || media_type.contains("javascript")
            || media_type.ends_with("/xml")
            || media_type.ends_with("+xml");
        if active {
            "application/octet-stream"
        } else {
            &self.media_type
        }
    }

    /// Confirms the pinned file still has the size that was advertised.
    pub fn check_unchanged(&self) -> io::Result<()> {
        let len = self.handle.metadata()?.len();
        if len == self.size {
            Ok(())
        } else {
            Err(io::Error::other("the file changed after it was shared"))
        }
    }

    /// Reads up to `buf.len()` bytes at `offset` without moving a shared cursor,
    /// so concurrent downloads of one file never interfere.
    pub fn read_at(&self, buf: &mut [u8], offset: u64) -> io::Result<usize> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::FileExt;
            self.handle.read_at(buf, offset)
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::FileExt;
            self.handle.seek_read(buf, offset)
        }
    }
}

/// Reads the next chunk of `file` at `offset`. Ending early means the file shrank.
pub async fn read_chunk(file: Arc<SharedFile>, offset: u64) -> io::Result<Bytes> {
    tokio::task::spawn_blocking(move || {
        let remaining = file.size.saturating_sub(offset);
        let len = remaining.min(CHUNK_SIZE as u64) as usize;
        let mut buf = vec![0u8; len];
        let mut filled = 0;
        while filled < len {
            match file.read_at(&mut buf[filled..], offset + filled as u64) {
                Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Ok(n) => filled += n,
                Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
                Err(e) => return Err(e),
            }
        }
        Ok(Bytes::from(buf))
    })
    .await
    .map_err(io::Error::other)?
}

/// Cancellation for one transfer: it stops when any of its tokens is cancelled,
/// for example when the share is stopped or one of its files is removed.
#[derive(Clone, Debug, Default)]
pub struct Cancel(Vec<CancellationToken>);

impl Cancel {
    pub fn new(tokens: Vec<CancellationToken>) -> Self {
        Self(tokens)
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.iter().any(CancellationToken::is_cancelled)
    }
}

/// Streams the whole file in bounded chunks. Cancellation ends the stream with
/// an error so the client sees an incomplete transfer, never a short success.
pub fn stream(
    file: Arc<SharedFile>,
    cancel: Cancel,
) -> impl Stream<Item = io::Result<Bytes>> + Send {
    futures_util::stream::try_unfold(0u64, move |offset| {
        let file = file.clone();
        let cancel = cancel.clone();
        async move {
            if offset >= file.size {
                return Ok(None);
            }
            if cancel.is_cancelled() {
                return Err(io::Error::other("sharing stopped"));
            }
            let chunk = read_chunk(file, offset).await?;
            let next = offset + chunk.len() as u64;
            Ok(Some((chunk, next)))
        }
    })
}

fn display_name(path: &Path) -> String {
    let raw = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let cleaned: String = raw
        .chars()
        .map(|c| if c.is_control() { '_' } else { c })
        .collect();
    if cleaned.trim().is_empty() {
        "file".to_owned()
    } else {
        cleaned
    }
}

/// Opening must never block on a FIFO swapped in after validation.
fn open_nonblocking(path: &Path) -> io::Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NONBLOCK);
    }
    options.open(path)
}

fn classify(media_type: &str, name: &str) -> FileKind {
    let ext = name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .unwrap_or_default();
    let ext = ext.as_str();
    if media_type.starts_with("image/") || matches!(ext, "heic" | "heif") {
        FileKind::Image
    } else if media_type.starts_with("video/") || matches!(ext, "mov" | "mkv") {
        FileKind::Video
    } else if media_type.starts_with("audio/") || matches!(ext, "m4a") {
        FileKind::Audio
    } else if matches!(
        ext,
        "zip" | "tar" | "gz" | "tgz" | "bz2" | "xz" | "7z" | "rar" | "dmg" | "iso"
    ) {
        FileKind::Archive
    } else if media_type.starts_with("text/")
        || matches!(
            ext,
            "pdf"
                | "doc"
                | "docx"
                | "rtf"
                | "odt"
                | "xls"
                | "xlsx"
                | "ods"
                | "ppt"
                | "pptx"
                | "odp"
                | "key"
                | "pages"
                | "numbers"
                | "epub"
        )
    {
        FileKind::Document
    } else {
        FileKind::Other
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write(dir: &Path, name: &str, contents: &[u8]) -> std::path::PathBuf {
        let path = dir.join(name);
        std::fs::File::create(&path)
            .unwrap()
            .write_all(contents)
            .unwrap();
        path
    }

    #[test]
    fn opens_regular_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "Report Ü.pdf", b"hello");
        let file = SharedFile::open(&path).unwrap();
        assert_eq!(file.name(), "Report Ü.pdf");
        assert_eq!(file.size(), 5);
        assert_eq!(file.kind(), FileKind::Document);
        assert_eq!(file.download_media_type(), "application/pdf");
    }

    #[test]
    fn rejects_directories_and_missing_paths() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            SharedFile::open(dir.path()).unwrap_err(),
            Rejection::Directory
        );
        assert_eq!(
            SharedFile::open(&dir.path().join("missing")).unwrap_err(),
            Rejection::Unreadable
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_fifos_without_blocking() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pipe");
        let c_path = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(c_path.as_ptr(), 0o600) }, 0);
        assert_eq!(SharedFile::open(&path).unwrap_err(), Rejection::NotRegular);
    }

    #[cfg(unix)]
    #[test]
    fn follows_symlinks_at_selection_and_keeps_the_link_name() {
        let dir = tempfile::tempdir().unwrap();
        let target = write(dir.path(), "target.txt", b"original");
        let link = dir.path().join("link.txt");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let file = SharedFile::open(&link).unwrap();
        assert_eq!(file.name(), "link.txt");
        assert_eq!(file.size(), 8);
    }

    #[tokio::test]
    async fn replacing_the_path_keeps_serving_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "a.txt", b"original");
        let file = Arc::new(SharedFile::open(&path).unwrap());
        let other = write(dir.path(), "other.txt", b"SECRET!!");
        std::fs::rename(&other, &path).unwrap();
        file.check_unchanged().unwrap();
        let chunk = read_chunk(file, 0).await.unwrap();
        assert_eq!(&chunk[..], b"original");
    }

    #[tokio::test]
    async fn detects_changed_size() {
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "a.txt", b"original");
        let file = Arc::new(SharedFile::open(&path).unwrap());
        std::fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len(3)
            .unwrap();
        assert!(file.check_unchanged().is_err());
        assert!(read_chunk(file, 0).await.is_err());
    }

    #[test]
    fn downgrades_active_content_types() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["page.html", "image.svg", "script.js", "feed.xml"] {
            let file = SharedFile::open(&write(dir.path(), name, b"x")).unwrap();
            assert_eq!(file.download_media_type(), "application/octet-stream");
        }
    }

    #[test]
    fn strips_control_characters_from_names() {
        assert_eq!(display_name(Path::new("/tmp/a\r\nb.txt")), "a__b.txt");
    }
}
