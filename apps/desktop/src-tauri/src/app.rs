//! Application state shared by Tauri commands and background tasks: the share
//! registry, the LAN listener, settings, and the advertised network address.
//! It reports changes through a callback and does not depend on Tauri itself.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::network::{self, NetworkInterface};
use crate::server::{HttpState, Listener};
use crate::settings::{self, Settings, SettingsPatch};
use crate::shares::{
    Clock, FileKind, Registry, ShareError, ShareOptions, SharePatch, ShareSnapshot, ShareStatus,
    StagedFiles, SystemClock,
};

/// How long open downloads may continue on a listener that is being replaced.
const REBIND_GRACE: Duration = Duration::from_secs(30);
/// Bounded cleanup on quit.
const QUIT_GRACE: Duration = Duration::from_secs(2);
/// Native drops older than this can't be staged anymore.
const DROP_TTL: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Topic {
    Server,
    Shares,
    Settings,
    Interfaces,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BackendEvent {
    Changed { topics: Vec<Topic> },
    AddressChanged { address: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ServerState {
    Starting,
    Online {
        address: String,
        port: u16,
        interface_name: String,
    },
    NoAddress {
        port: u16,
    },
    BindFailed {
        port: u16,
        message: String,
    },
    Stopping,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareFileDto {
    pub id: String,
    pub name: String,
    pub byte_size: u64,
    pub kind: FileKind,
    pub download_count: u32,
    /// Direct download of this file, `/d/{token}/{file}`.
    pub link: Option<String>,
}

/// What the UI receives for a share. The token appears only inside links.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareDto {
    pub id: String,
    /// Display name: the title if set, else the file name or "N files".
    pub file_name: String,
    /// The owner's title, or `None` when the name comes from the files.
    pub title: Option<String>,
    pub byte_size: u64,
    pub kind: FileKind,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub download_count: u32,
    pub download_limit: Option<u32>,
    pub status: ShareStatus,
    /// The share's page, `/s/{token}`; `None` while no address is usable.
    pub link: Option<String>,
    /// Everything in the share as one ZIP, `/z/{token}`.
    pub zip_link: Option<String>,
    pub files: Vec<ShareFileDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkProfile {
    pub id: &'static str,
    pub name: &'static str,
    pub template: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Phase {
    Starting,
    Listening(u16),
    Failed { port: u16, message: String },
    Stopping,
}

type Emit = Arc<dyn Fn(BackendEvent) + Send + Sync>;

pub struct App {
    pub registry: Arc<Registry>,
    clock: Arc<dyn Clock>,
    settings: Mutex<Settings>,
    interfaces: Mutex<Vec<NetworkInterface>>,
    phase: Mutex<Phase>,
    /// Serializes binding and stopping; held across awaits.
    listener: tokio::sync::Mutex<Option<Listener>>,
    dropped: Mutex<Option<(Instant, Vec<PathBuf>)>>,
    emit: Emit,
}

impl App {
    pub fn new(emit: Emit) -> Arc<Self> {
        Self::with_clock(Arc::new(SystemClock), emit, network::discover())
    }

    pub fn with_clock(
        clock: Arc<dyn Clock>,
        emit: Emit,
        interfaces: Vec<NetworkInterface>,
    ) -> Arc<Self> {
        let notify = emit.clone();
        let registry = Arc::new(Registry::new(
            clock.clone(),
            Arc::new(move || {
                notify(BackendEvent::Changed {
                    topics: vec![Topic::Shares],
                })
            }),
        ));
        Arc::new(Self {
            registry,
            clock,
            settings: Mutex::new(Settings::default()),
            interfaces: Mutex::new(interfaces),
            phase: Mutex::new(Phase::Starting),
            listener: tokio::sync::Mutex::new(None),
            dropped: Mutex::new(None),
            emit,
        })
    }

    fn changed(&self, topics: &[Topic]) {
        (self.emit)(BackendEvent::Changed {
            topics: topics.to_vec(),
        });
    }

    fn http_state(&self) -> HttpState {
        HttpState {
            registry: self.registry.clone(),
            clock: self.clock.clone(),
        }
    }

    // ---- Server ------------------------------------------------------------

    /// Binds the configured port. A failure is reported as state, not hidden.
    pub async fn start(&self) {
        let port = self.settings().port;
        let _ = self.bind(port).await;
        self.changed(&[Topic::Server, Topic::Shares]);
    }

    /// Binds `port` and replaces the current listener only after success.
    async fn bind(&self, port: u16) -> Result<(), String> {
        let mut current = self.listener.lock().await;
        if current.as_ref().is_some_and(|l| l.port() == port) {
            return Ok(());
        }
        match Listener::bind(port, self.http_state()).await {
            Ok(listener) => {
                *lock(&self.phase) = Phase::Listening(listener.port());
                if let Some(old) = current.replace(listener) {
                    tokio::spawn(old.stop(REBIND_GRACE));
                }
                Ok(())
            }
            Err(message) => {
                if current.is_none() {
                    *lock(&self.phase) = Phase::Failed {
                        port,
                        message: message.clone(),
                    };
                }
                Err(message)
            }
        }
    }

    pub fn server_state(&self) -> ServerState {
        let phase = lock(&self.phase).clone();
        match phase {
            Phase::Starting => ServerState::Starting,
            Phase::Stopping => ServerState::Stopping,
            Phase::Failed { port, message } => ServerState::BindFailed { port, message },
            Phase::Listening(port) => match self.selected_interface() {
                Some(interface) => ServerState::Online {
                    address: interface.address,
                    port,
                    interface_name: interface.name,
                },
                None => ServerState::NoAddress { port },
            },
        }
    }

    /// `address:port` that links currently use, if any.
    fn advertised(&self) -> Option<String> {
        match self.server_state() {
            ServerState::Online { address, port, .. } => Some(format!("{address}:{port}")),
            _ => None,
        }
    }

    fn selected_interface(&self) -> Option<NetworkInterface> {
        let preferred = self.settings().interface_id;
        let interfaces = lock(&self.interfaces);
        network::choose(&interfaces, preferred.as_deref()).cloned()
    }

    pub fn interfaces(&self) -> Vec<NetworkInterface> {
        lock(&self.interfaces).clone()
    }

    /// Re-reads local addresses and announces any change to the links.
    pub fn refresh_network(&self) {
        self.set_interfaces(network::discover());
    }

    pub fn set_interfaces(&self, interfaces: Vec<NetworkInterface>) {
        let before = self.advertised();
        {
            let mut current = lock(&self.interfaces);
            if *current == interfaces {
                return;
            }
            *current = interfaces;
        }
        self.announce(before);
        self.changed(&[Topic::Interfaces]);
    }

    fn announce(&self, before: Option<String>) {
        let after = self.advertised();
        if before != after {
            self.changed(&[Topic::Server, Topic::Shares]);
            if let (Some(_), Some(address)) = (before, after) {
                (self.emit)(BackendEvent::AddressChanged { address });
            }
        }
    }

    /// Revokes every share, then stops the listener with bounded cleanup.
    pub async fn shutdown(&self) {
        *lock(&self.phase) = Phase::Stopping;
        self.changed(&[Topic::Server]);
        self.registry.stop_all();
        if let Some(listener) = self.listener.lock().await.take() {
            listener.stop(QUIT_GRACE).await;
        }
    }

    // ---- Settings ----------------------------------------------------------

    pub fn settings(&self) -> Settings {
        lock(&self.settings).clone()
    }

    pub async fn update_settings(&self, patch: SettingsPatch) -> Result<Settings, String> {
        let current = self.settings();
        let next = current.apply(&patch).map_err(|e| e.0)?;
        if let Some(Some(id)) = &patch.interface_id {
            if !lock(&self.interfaces).iter().any(|i| &i.id == id) {
                return Err("That network interface isn't available anymore.".into());
            }
        }
        let before = self.advertised();
        if next.port != current.port || patch.port.is_some() {
            if let Err(message) = self.bind(next.port).await {
                if matches!(*lock(&self.phase), Phase::Listening(_)) {
                    return Err(format!("{message} Kept port {}.", current.port));
                }
                // Nothing was listening; remember the attempt so status is truthful.
                *lock(&self.settings) = next;
                self.changed(&[Topic::Settings, Topic::Server, Topic::Shares]);
                return Err(message);
            }
        }
        *lock(&self.settings) = next.clone();
        self.changed(&[Topic::Settings]);
        self.announce(before);
        Ok(next)
    }

    pub fn profiles(&self) -> Vec<LinkProfile> {
        vec![LinkProfile {
            id: settings::HTTP_PROFILE_ID,
            name: "Share page",
            template: None,
        }]
    }

    // ---- Shares ------------------------------------------------------------

    /// Remembers paths from a native drop so only those can be staged.
    pub fn record_drop(&self, paths: Vec<PathBuf>) {
        *lock(&self.dropped) = Some((self.clock.now(), paths));
    }

    /// Stages dropped paths, accepting only ones the native drop delivered. The
    /// webview can't name arbitrary files to share.
    pub async fn stage_dropped(&self, requested: Vec<PathBuf>) -> Result<StagedFiles, String> {
        // The native event and the webview event race; give the native side a moment.
        let mut native = None;
        for _ in 0..25 {
            if let Some((at, paths)) = lock(&self.dropped).take() {
                if self.clock.now().duration_since(at) < DROP_TTL {
                    native = Some(paths);
                }
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let native: HashSet<PathBuf> = native
            .ok_or_else(|| "Drop the files on the window again.".to_owned())?
            .into_iter()
            .collect();
        let accepted: Vec<PathBuf> = requested
            .into_iter()
            .filter(|p| native.contains(p))
            .collect();
        if accepted.is_empty() {
            return Err("Drop the files on the window again.".into());
        }
        let registry = self.registry.clone();
        tokio::task::spawn_blocking(move || registry.stage(accepted))
            .await
            .map_err(|_| "FileHop couldn't read the dropped files.".to_owned())
    }

    pub fn list_shares(&self) -> Vec<ShareDto> {
        let advertised = self.advertised();
        self.registry
            .list()
            .into_iter()
            .map(|s| to_dto(s, advertised.as_deref()))
            .collect()
    }

    pub fn create_shares(
        &self,
        stage_ids: &[String],
        options: &ShareOptions,
        separate: bool,
    ) -> Result<Vec<ShareDto>, String> {
        let advertised = self.advertised();
        Ok(self
            .registry
            .create(stage_ids, options, separate)
            .map_err(|e| e.0)?
            .into_iter()
            .map(|s| to_dto(s, advertised.as_deref()))
            .collect())
    }

    pub fn share_again(&self, id: &str, options: Option<ShareOptions>) -> Result<ShareDto, String> {
        let options = options.unwrap_or_else(|| self.settings().default_options());
        let snapshot = self.registry.share_again(id, &options).map_err(|e| e.0)?;
        Ok(to_dto(snapshot, self.advertised().as_deref()))
    }

    /// A share without files, using the default lifetime and limit.
    pub fn create_empty_share(&self) -> Result<ShareDto, String> {
        let options = self.settings().default_options();
        let snapshot = self.registry.create_empty(&options).map_err(|e| e.0)?;
        Ok(to_dto(snapshot, self.advertised().as_deref()))
    }

    pub fn add_files(&self, id: &str, stage_ids: &[String]) -> Result<ShareDto, String> {
        let snapshot = self.registry.add_files(id, stage_ids).map_err(|e| e.0)?;
        Ok(to_dto(snapshot, self.advertised().as_deref()))
    }

    pub fn remove_file(&self, id: &str, file_id: &str) -> Result<ShareDto, String> {
        let snapshot = self.registry.remove_file(id, file_id).map_err(|e| e.0)?;
        Ok(to_dto(snapshot, self.advertised().as_deref()))
    }

    pub fn update_share(&self, id: &str, patch: &SharePatch) -> Result<ShareDto, String> {
        let snapshot = self
            .registry
            .update(id, patch)
            .map_err(|e: ShareError| e.0)?;
        Ok(to_dto(snapshot, self.advertised().as_deref()))
    }
}

fn to_dto(snapshot: ShareSnapshot, advertised: Option<&str>) -> ShareDto {
    let download_count = snapshot.download_count();
    let base = advertised.map(|at| format!("http://{at}"));
    let token = &snapshot.token;
    let (derived, kind) = match snapshot.files.as_slice() {
        [file] => (file.name.clone(), file.kind),
        [] => ("No files yet".to_owned(), FileKind::Bundle),
        files => (format!("{} files", files.len()), FileKind::Bundle),
    };
    let file_name = snapshot.title.clone().unwrap_or(derived);
    ShareDto {
        id: snapshot.id,
        file_name,
        title: snapshot.title,
        byte_size: snapshot.files.iter().map(|f| f.size).sum(),
        kind,
        created_at: snapshot.created_at,
        expires_at: snapshot.expires_at,
        ended_at: snapshot.ended_at,
        download_count,
        download_limit: snapshot.download_limit,
        status: snapshot.status,
        link: base.as_ref().map(|b| format!("{b}/s/{token}")),
        zip_link: base.as_ref().map(|b| format!("{b}/z/{token}")),
        files: snapshot
            .files
            .into_iter()
            .map(|f| ShareFileDto {
                link: base.as_ref().map(|b| format!("{b}/d/{token}/{}", f.id)),
                id: f.id,
                name: f.name,
                byte_size: f.size,
                kind: f.kind,
                download_count: f.downloads,
            })
            .collect(),
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shares::FileSnapshot;

    fn snapshot(files: usize) -> ShareSnapshot {
        ShareSnapshot {
            id: "id".into(),
            token: "TOKEN".into(),
            files: (0..files)
                .map(|i| FileSnapshot {
                    id: format!("file-{i}"),
                    name: format!("file-{i}.txt"),
                    size: 10,
                    kind: FileKind::Document,
                    downloads: i as u32,
                })
                .collect(),
            created_at: 0,
            expires_at: None,
            ended_at: None,
            download_limit: None,
            status: ShareStatus::Active,
            title: None,
        }
    }

    #[test]
    fn every_share_has_a_page_a_zip_and_a_link_per_file() {
        let dto = to_dto(snapshot(2), Some("192.168.1.20:8765"));
        assert_eq!(
            dto.link.as_deref(),
            Some("http://192.168.1.20:8765/s/TOKEN")
        );
        assert_eq!(
            dto.zip_link.as_deref(),
            Some("http://192.168.1.20:8765/z/TOKEN")
        );
        assert_eq!(
            dto.files[1].link.as_deref(),
            Some("http://192.168.1.20:8765/d/TOKEN/file-1")
        );
        let offline = to_dto(snapshot(1), None);
        assert_eq!(offline.link, None);
        assert_eq!(offline.zip_link, None);
        assert_eq!(offline.files[0].link, None);
    }

    #[test]
    fn summaries_follow_the_file_count() {
        let one = to_dto(snapshot(1), None);
        assert_eq!(one.file_name, "file-0.txt");
        assert_eq!(one.kind, FileKind::Document);

        let many = to_dto(snapshot(3), None);
        assert_eq!(many.file_name, "3 files");
        assert_eq!(many.kind, FileKind::Bundle);
        assert_eq!(many.byte_size, 30);
        assert_eq!(many.download_count, 2);

        let empty = to_dto(snapshot(0), None);
        assert_eq!(empty.file_name, "No files yet");
        assert_eq!(empty.kind, FileKind::Bundle);
    }

    #[test]
    fn titles_replace_the_derived_name_but_keep_the_kind() {
        let mut titled = snapshot(1);
        titled.title = Some("Contract for Alex".into());
        let dto = to_dto(titled, None);
        assert_eq!(dto.file_name, "Contract for Alex");
        assert_eq!(dto.title.as_deref(), Some("Contract for Alex"));
        assert_eq!(dto.kind, FileKind::Document);
        assert_eq!(to_dto(snapshot(1), None).title, None);
    }
}
