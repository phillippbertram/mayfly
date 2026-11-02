//! Streams several shared files as one uncompressed ZIP archive.
//!
//! Entries are stored (no compression), so the archive's exact length is known
//! before the first byte and browsers can show real progress. CRCs are computed
//! while streaming and written in data descriptors; nothing is buffered beyond
//! one file chunk and the small central directory. ZIP64 records are used only
//! when a size, offset, or entry count needs them.

use std::collections::HashSet;
use std::io;
use std::sync::Arc;

use axum::body::Bytes;
use futures_util::Stream;
use tokio_util::sync::CancellationToken;

use crate::shares::SharedFile;

const U16_MAX: u64 = 0xFFFF;
const U32_MAX: u64 = 0xFFFF_FFFF;
const LOCAL_HEADER: u64 = 30;
const CENTRAL_HEADER: u64 = 46;
const END_RECORD: u64 = 22;
const ZIP64_END_RECORD: u64 = 56;
const ZIP64_LOCATOR: u64 = 20;
/// Data descriptor, UTF-8 file names.
const FLAGS: u16 = 0x0008 | 0x0800;
/// Made by Unix, ZIP 4.5, so permissions below are honored.
const VERSION_MADE_BY: u16 = (3 << 8) | 45;
/// Regular file, rw-r--r--.
const EXTERNAL_ATTRIBUTES: u32 = 0o100644 << 16;
/// Extended timestamp field (0x5455) with the modification time in UTC. DOS
/// times have no time zone; extractors prefer this field when present.
const UNIX_TIME_EXTRA: u64 = 9;

struct Entry {
    name: Vec<u8>,
    file: Arc<SharedFile>,
    offset: u64,
}

impl Entry {
    fn size(&self) -> u64 {
        self.file.size()
    }

    fn zip64_size(&self) -> bool {
        self.size() >= U32_MAX
    }

    fn local_extra_len(&self) -> u64 {
        UNIX_TIME_EXTRA + if self.zip64_size() { 20 } else { 0 }
    }

    fn descriptor_len(&self) -> u64 {
        if self.zip64_size() {
            24
        } else {
            16
        }
    }

    fn central_extra_len(&self) -> u64 {
        UNIX_TIME_EXTRA + self.central_zip64_len()
    }

    fn central_zip64_len(&self) -> u64 {
        let mut fields = 0;
        if self.zip64_size() {
            fields += 16;
        }
        if self.offset >= U32_MAX {
            fields += 8;
        }
        if fields > 0 {
            4 + fields
        } else {
            0
        }
    }

    fn version_needed(&self) -> u16 {
        if self.zip64_size() || self.offset >= U32_MAX {
            45
        } else {
            20
        }
    }
}

/// The archive layout, computed before streaming.
pub struct ZipPlan {
    entries: Vec<Entry>,
    central_offset: u64,
    central_len: u64,
    total_len: u64,
    dos_time: u16,
    dos_date: u16,
    unix_time: u32,
}

impl ZipPlan {
    /// `wall_ms` stamps every entry with the time the archive was requested.
    pub fn new(files: Vec<Arc<SharedFile>>, wall_ms: u64) -> Self {
        let names = unique_names(files.iter().map(|f| f.name()));
        let mut offset = 0;
        let entries: Vec<Entry> = files
            .into_iter()
            .zip(names)
            .map(|(file, name)| {
                let entry = Entry {
                    name: name.into_bytes(),
                    file,
                    offset,
                };
                offset += LOCAL_HEADER
                    + entry.name.len() as u64
                    + entry.local_extra_len()
                    + entry.size()
                    + entry.descriptor_len();
                entry
            })
            .collect();
        let central_offset = offset;
        let central_len = entries
            .iter()
            .map(|e| CENTRAL_HEADER + e.name.len() as u64 + e.central_extra_len())
            .sum();
        let mut plan = Self {
            entries,
            central_offset,
            central_len,
            total_len: 0,
            dos_time: 0,
            dos_date: 0,
            unix_time: (wall_ms / 1000).min(u64::from(u32::MAX)) as u32,
        };
        plan.total_len = central_offset
            + central_len
            + if plan.needs_zip64_end() {
                ZIP64_END_RECORD + ZIP64_LOCATOR
            } else {
                0
            }
            + END_RECORD;
        // DOS fields are read as local time by Finder and Explorer.
        let local_ms = wall_ms as i64 + local_offset_secs((wall_ms / 1000) as i64) * 1000;
        (plan.dos_time, plan.dos_date) = dos_timestamp(local_ms.max(0) as u64);
        plan
    }

    /// Exact archive length in bytes.
    pub fn len(&self) -> u64 {
        self.total_len
    }

    fn needs_zip64_end(&self) -> bool {
        self.entries.len() as u64 >= U16_MAX
            || self.central_len >= U32_MAX
            || self.central_offset >= U32_MAX
    }

    fn local_header(&self, entry: &Entry) -> Bytes {
        let mut out = Vec::with_capacity(64 + entry.name.len());
        let size32 = if entry.zip64_size() { u32::MAX } else { 0 };
        put32(&mut out, 0x0403_4b50);
        put16(&mut out, entry.version_needed());
        put16(&mut out, FLAGS);
        put16(&mut out, 0); // stored
        put16(&mut out, self.dos_time);
        put16(&mut out, self.dos_date);
        put32(&mut out, 0); // CRC follows in the data descriptor
        put32(&mut out, size32);
        put32(&mut out, size32);
        put16(&mut out, entry.name.len() as u16);
        put16(&mut out, entry.local_extra_len() as u16);
        out.extend_from_slice(&entry.name);
        if entry.zip64_size() {
            put16(&mut out, 0x0001);
            put16(&mut out, 16);
            put64(&mut out, 0);
            put64(&mut out, 0);
        }
        self.put_unix_time(&mut out);
        Bytes::from(out)
    }

    fn put_unix_time(&self, out: &mut Vec<u8>) {
        put16(out, 0x5455);
        put16(out, 5);
        out.push(1); // modification time present
        put32(out, self.unix_time);
    }

    fn descriptor(&self, entry: &Entry, crc: u32) -> Bytes {
        let mut out = Vec::with_capacity(24);
        put32(&mut out, 0x0807_4b50);
        put32(&mut out, crc);
        if entry.zip64_size() {
            put64(&mut out, entry.size());
            put64(&mut out, entry.size());
        } else {
            put32(&mut out, entry.size() as u32);
            put32(&mut out, entry.size() as u32);
        }
        Bytes::from(out)
    }

    fn central_directory(&self, crcs: &[u32]) -> Bytes {
        let mut out = Vec::with_capacity((self.total_len - self.central_offset) as usize);
        for (entry, &crc) in self.entries.iter().zip(crcs) {
            let size = entry.size();
            put32(&mut out, 0x0201_4b50);
            put16(&mut out, VERSION_MADE_BY);
            put16(&mut out, entry.version_needed());
            put16(&mut out, FLAGS);
            put16(&mut out, 0);
            put16(&mut out, self.dos_time);
            put16(&mut out, self.dos_date);
            put32(&mut out, crc);
            put32(&mut out, clamp32(size, entry.zip64_size()));
            put32(&mut out, clamp32(size, entry.zip64_size()));
            put16(&mut out, entry.name.len() as u16);
            put16(&mut out, entry.central_extra_len() as u16);
            put16(&mut out, 0); // comment
            put16(&mut out, 0); // disk
            put16(&mut out, 0); // internal attributes
            put32(&mut out, EXTERNAL_ATTRIBUTES);
            put32(&mut out, clamp32(entry.offset, entry.offset >= U32_MAX));
            out.extend_from_slice(&entry.name);
            let zip64 = entry.central_zip64_len();
            if zip64 > 0 {
                put16(&mut out, 0x0001);
                put16(&mut out, (zip64 - 4) as u16);
                if entry.zip64_size() {
                    put64(&mut out, size);
                    put64(&mut out, size);
                }
                if entry.offset >= U32_MAX {
                    put64(&mut out, entry.offset);
                }
            }
            self.put_unix_time(&mut out);
        }
        let count = self.entries.len() as u64;
        if self.needs_zip64_end() {
            let record_offset = self.central_offset + self.central_len;
            put32(&mut out, 0x0606_4b50);
            put64(&mut out, ZIP64_END_RECORD - 12);
            put16(&mut out, VERSION_MADE_BY);
            put16(&mut out, 45);
            put32(&mut out, 0);
            put32(&mut out, 0);
            put64(&mut out, count);
            put64(&mut out, count);
            put64(&mut out, self.central_len);
            put64(&mut out, self.central_offset);
            put32(&mut out, 0x0706_4b50);
            put32(&mut out, 0);
            put64(&mut out, record_offset);
            put32(&mut out, 1);
        }
        put32(&mut out, 0x0605_4b50);
        put16(&mut out, 0);
        put16(&mut out, 0);
        put16(&mut out, count.min(U16_MAX) as u16);
        put16(&mut out, count.min(U16_MAX) as u16);
        put32(&mut out, self.central_len.min(U32_MAX) as u32);
        put32(&mut out, self.central_offset.min(U32_MAX) as u32);
        put16(&mut out, 0);
        Bytes::from(out)
    }
}

enum Step {
    Header(usize),
    Data { index: usize, offset: u64 },
    Central,
    Done,
}

struct State {
    plan: Arc<ZipPlan>,
    step: Step,
    hasher: crc32fast::Hasher,
    crcs: Vec<u32>,
    cancel: CancellationToken,
}

/// Streams the planned archive. Cancellation or a file that changed mid-way
/// ends the stream with an error, so the client never receives a corrupt
/// archive that looks complete.
pub fn stream(
    plan: Arc<ZipPlan>,
    cancel: CancellationToken,
) -> impl Stream<Item = io::Result<Bytes>> + Send {
    let state = State {
        crcs: Vec::with_capacity(plan.entries.len()),
        plan,
        step: Step::Header(0),
        hasher: crc32fast::Hasher::new(),
        cancel,
    };
    futures_util::stream::try_unfold(state, |mut state| async move {
        if state.cancel.is_cancelled() {
            return Err(io::Error::other("sharing stopped"));
        }
        let chunk = match state.step {
            Step::Header(index) => match state.plan.entries.get(index) {
                Some(entry) => {
                    state.step = Step::Data { index, offset: 0 };
                    state.plan.local_header(entry)
                }
                None => {
                    state.step = Step::Central;
                    return next_central(state);
                }
            },
            Step::Data { index, offset } => {
                let entry = &state.plan.entries[index];
                if offset >= entry.size() {
                    let crc = std::mem::take(&mut state.hasher).finalize();
                    state.crcs.push(crc);
                    state.step = Step::Header(index + 1);
                    state.plan.descriptor(entry, crc)
                } else {
                    let chunk = crate::shares::read_chunk(entry.file.clone(), offset).await?;
                    state.hasher.update(&chunk);
                    state.step = Step::Data {
                        index,
                        offset: offset + chunk.len() as u64,
                    };
                    chunk
                }
            }
            Step::Central => return next_central(state),
            Step::Done => return Ok(None),
        };
        Ok(Some((chunk, state)))
    })
}

fn next_central(mut state: State) -> io::Result<Option<(Bytes, State)>> {
    let chunk = state.plan.central_directory(&state.crcs);
    state.step = Step::Done;
    Ok(Some((chunk, state)))
}

/// Archive names are unique, case-insensitively: "a.txt", "a (2).txt", ...
fn unique_names<'a>(names: impl Iterator<Item = &'a str>) -> Vec<String> {
    let mut seen = HashSet::new();
    names
        .map(|name| {
            let clean: String = name
                .chars()
                .map(|c| {
                    if c == '/' || c == '\\' || c.is_control() {
                        '_'
                    } else {
                        c
                    }
                })
                .collect();
            // Header fields hold at most 65535 bytes; real names are far shorter.
            let clean = truncate_utf8(&clean, 255);
            let (base, ext) = match clean.rfind('.') {
                Some(i) if i > 0 => (&clean[..i], &clean[i..]),
                _ => (clean, ""),
            };
            let mut candidate = clean.to_owned();
            let mut n = 2;
            while !seen.insert(candidate.to_lowercase()) {
                candidate = format!("{base} ({n}){ext}");
                n += 1;
            }
            candidate
        })
        .collect()
}

fn truncate_utf8(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// The local time zone's offset from UTC at `unix_secs`.
#[cfg(unix)]
fn local_offset_secs(unix_secs: i64) -> i64 {
    let time = unix_secs as libc::time_t;
    // SAFETY: `localtime_r` only writes to the provided `tm`.
    let mut tm: libc::tm = unsafe { std::mem::zeroed() };
    if unsafe { libc::localtime_r(&time, &mut tm) }.is_null() {
        return 0;
    }
    tm.tm_gmtoff as i64
}

/// Without a time zone API the DOS fields stay in UTC; the extended timestamp
/// field still carries the exact time.
#[cfg(not(unix))]
fn local_offset_secs(_unix_secs: i64) -> i64 {
    0
}

/// MS-DOS time and date fields for a millisecond timestamp.
fn dos_timestamp(wall_ms: u64) -> (u16, u16) {
    let secs = wall_ms / 1000;
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (year, month, day) = civil_from_days(days);
    if year < 1980 {
        return (0, (1 << 5) | 1);
    }
    let time = ((rem / 3600) << 11) | (((rem % 3600) / 60) << 5) | ((rem % 60) / 2);
    let date = (((year - 1980).min(127) as u64) << 9) | ((month as u64) << 5) | day as u64;
    (time as u16, date as u16)
}

/// Days since 1970-01-01 to a proleptic Gregorian date (Howard Hinnant).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

fn clamp32(value: u64, overflow: bool) -> u32 {
    if overflow {
        u32::MAX
    } else {
        value as u32
    }
}

fn put16(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn put32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn put64(out: &mut Vec<u8>, v: u64) {
    out.extend_from_slice(&v.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::TryStreamExt;
    use std::io::{Cursor, Read};
    use std::path::Path;

    fn shared(dir: &Path, name: &str, contents: &[u8]) -> Arc<SharedFile> {
        let path = dir.join(name);
        std::fs::write(&path, contents).unwrap();
        Arc::new(SharedFile::open(&path).unwrap())
    }

    async fn collect(plan: Arc<ZipPlan>) -> Vec<u8> {
        stream(plan, CancellationToken::new())
            .try_fold(Vec::new(), |mut acc, chunk| async move {
                acc.extend_from_slice(&chunk);
                Ok(acc)
            })
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn round_trips_through_a_zip_reader() {
        let dir = tempfile::tempdir().unwrap();
        let big: Vec<u8> = (0..300_000u32).map(|i| (i % 251) as u8).collect();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        let files = vec![
            shared(dir.path(), "Bericht Ü 📄.pdf", b"pdf contents"),
            shared(dir.path(), "empty.txt", b""),
            shared(dir.path(), "big.bin", &big),
            // Same name from another folder, differently cased.
            shared(&sub, "BIG.bin", b"second"),
        ];
        let plan = Arc::new(ZipPlan::new(files, 1_793_000_000_000));
        let bytes = collect(plan.clone()).await;
        assert_eq!(bytes.len() as u64, plan.len());

        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert_eq!(archive.len(), 4);
        let expected: [(&str, &[u8]); 4] = [
            ("Bericht Ü 📄.pdf", b"pdf contents"),
            ("empty.txt", b""),
            ("big.bin", &big),
            ("BIG (2).bin", b"second"),
        ];
        for (i, (name, contents)) in expected.iter().enumerate() {
            let mut entry = archive.by_index(i).unwrap();
            assert_eq!(entry.name().unwrap(), *name);
            assert_eq!(entry.unix_mode(), Some(0o100644));
            let mut out = Vec::new();
            // Reading to the end verifies the CRC.
            entry.read_to_end(&mut out).unwrap();
            assert_eq!(&out, contents);
        }
    }

    #[tokio::test]
    async fn cancellation_ends_the_stream_with_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let files = vec![
            shared(dir.path(), "a.txt", b"a"),
            shared(dir.path(), "b.txt", b"b"),
        ];
        let cancel = CancellationToken::new();
        cancel.cancel();
        let result: io::Result<Vec<Bytes>> = stream(Arc::new(ZipPlan::new(files, 0)), cancel)
            .try_collect()
            .await;
        assert!(result.is_err());
    }

    #[test]
    fn deduplicates_and_sanitizes_names() {
        let names = unique_names(
            [
                "a.txt", "A.txt", "a.txt", ".env", ".env", "x/y", "noext", "noext",
            ]
            .into_iter(),
        );
        assert_eq!(
            names,
            [
                "a.txt",
                "A (2).txt",
                "a (3).txt",
                ".env",
                ".env (2)",
                "x_y",
                "noext",
                "noext (2)"
            ]
        );
    }

    #[test]
    fn converts_timestamps_to_dos_format() {
        // 2026-11-02 14:08:30 UTC
        let (time, date) = dos_timestamp(1_793_628_510_000);
        assert_eq!(date >> 9, 2026 - 1980);
        assert_eq!((date >> 5) & 0x0F, 11);
        assert_eq!(date & 0x1F, 2);
        assert_eq!(time >> 11, 14);
        assert_eq!((time >> 5) & 0x3F, 8);
        assert_eq!((time & 0x1F) * 2, 30);
    }

    /// Exercises ZIP64 with a sparse 4 GiB file. Slow in debug builds:
    /// `cargo test --release -- --ignored zip64`.
    #[tokio::test]
    #[ignore]
    async fn zip64_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("huge.bin");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(U32_MAX + 10).unwrap();
        drop(file);
        let files = vec![
            Arc::new(SharedFile::open(&path).unwrap()),
            shared(dir.path(), "after.txt", b"after"),
        ];
        let plan = Arc::new(ZipPlan::new(files, 1_793_000_000_000));
        assert!(plan.entries[0].zip64_size());
        assert!(plan.entries[1].offset >= U32_MAX);
        let out_path = dir.path().join("out.zip");
        let mut out = std::io::BufWriter::new(std::fs::File::create(&out_path).unwrap());
        let mut chunks = std::pin::pin!(stream(plan.clone(), CancellationToken::new()));
        while let Some(chunk) = chunks.try_next().await.unwrap() {
            std::io::Write::write_all(&mut out, &chunk).unwrap();
        }
        drop(out);
        assert_eq!(std::fs::metadata(&out_path).unwrap().len(), plan.len());
        let mut archive = zip::ZipArchive::new(std::fs::File::open(&out_path).unwrap()).unwrap();
        assert_eq!(archive.by_index(0).unwrap().size(), U32_MAX + 10);
        let mut after = String::new();
        archive
            .by_index(1)
            .unwrap()
            .read_to_string(&mut after)
            .unwrap();
        assert_eq!(after, "after");
    }
}
