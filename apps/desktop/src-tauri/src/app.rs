//! Application state shared by Tauri commands and background tasks: the share
//! registry, the LAN listener, settings, and the advertised network address.
//! It reports changes through a callback and does not depend on Tauri itself.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::config::ConfigStore;
use crate::network::{self, NetworkInterface};
use crate::profiles::{self, Profile, MAX_PROFILES};
use crate::server::{HttpState, Listener};
use crate::settings::{self, Settings, SettingsPatch};
use crate::shares::password::{Password, Verifier};
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
    Profiles,
    Interfaces,
}

#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum BackendEvent {
    Changed {
        topics: Vec<Topic>,
    },
    AddressChanged {
        address: String,
    },
    /// The window is closing for the first time; explain background sharing.
    CloseRequested,
    /// Quitting would stop this many active shares; ask first.
    QuitRequested {
        active_shares: usize,
    },
    /// The app or tray menu asked for the settings.
    OpenSettings,
    /// The app menu asked for FileHop's About dialog.
    ShowAbout,
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
    /// The share link through each custom link profile, for compatible apps.
    pub app_links: Vec<AppLinkDto>,
    /// Recipients need a password; the password itself is never returned.
    pub protected: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLinkDto {
    pub profile_id: String,
    pub name: String,
    pub link: Option<String>,
    /// Opens an app rather than a web page; a compatible app must be installed.
    pub custom_scheme: bool,
}

/// A profile to create (no `id`) or update.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub id: Option<String>,
    pub name: String,
    pub template: String,
    pub make_default: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkProfile {
    pub id: String,
    pub name: String,
    /// `None` for the built-in share page.
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
    /// Custom link profiles; the built-in share page is implicit.
    profiles: Mutex<Vec<Profile>>,
    interfaces: Mutex<Vec<NetworkInterface>>,
    phase: Mutex<Phase>,
    /// Serializes binding and stopping; held across awaits.
    listener: tokio::sync::Mutex<Option<Listener>>,
    dropped: Mutex<Option<(Instant, Vec<PathBuf>)>>,
    /// Where settings persist; `None` keeps them in memory only.
    store: Option<ConfigStore>,
    /// A message for the user from startup, such as a repaired settings file.
    notice: Mutex<Option<String>>,
    emit: Emit,
}

impl App {
    /// Loads settings from `config_dir` when given.
    pub fn new(emit: Emit, config_dir: Option<PathBuf>) -> Arc<Self> {
        Self::with_clock(
            Arc::new(SystemClock),
            emit,
            network::discover(),
            config_dir.map(ConfigStore::new),
        )
    }

    pub fn with_clock(
        clock: Arc<dyn Clock>,
        emit: Emit,
        interfaces: Vec<NetworkInterface>,
        store: Option<ConfigStore>,
    ) -> Arc<Self> {
        let (settings, custom, notice) = match &store {
            Some(store) => {
                let loaded = store.load();
                (loaded.settings, loaded.profiles, loaded.notice)
            }
            None => (Settings::default(), Vec::new(), None),
        };
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
            settings: Mutex::new(settings),
            profiles: Mutex::new(custom),
            interfaces: Mutex::new(interfaces),
            phase: Mutex::new(Phase::Starting),
            listener: tokio::sync::Mutex::new(None),
            dropped: Mutex::new(None),
            store,
            notice: Mutex::new(notice),
            emit,
        })
    }

    fn changed(&self, topics: &[Topic]) {
        self.emit(BackendEvent::Changed {
            topics: topics.to_vec(),
        });
    }

    pub fn emit(&self, event: BackendEvent) {
        (self.emit)(event);
    }

    pub fn active_share_count(&self) -> usize {
        self.registry
            .list()
            .iter()
            .filter(|s| s.status == ShareStatus::Active)
            .count()
    }

    /// One line for the tray menu, such as "3 active shares · next ends in 4 min".
    pub fn tray_summary(&self) -> String {
        tray_summary(&self.registry.list(), self.clock.wall_ms())
    }

    fn http_state(&self) -> HttpState {
        HttpState::new(self.registry.clone(), self.clock.clone())
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

    /// The startup notice, once.
    pub fn take_notice(&self) -> Option<String> {
        lock(&self.notice).take()
    }

    /// Applies settings in memory and saves them. A failed save is reported, but
    /// the settings still apply until FileHop quits.
    fn commit_settings(&self, next: Settings) -> Result<(), String> {
        *lock(&self.settings) = next;
        self.persist()
    }

    /// Saves the current settings and profiles together.
    fn persist(&self) -> Result<(), String> {
        let Some(store) = &self.store else {
            return Ok(());
        };
        let settings = self.settings();
        let custom = lock(&self.profiles).clone();
        store.save(&settings, &custom).map_err(|_| {
            "FileHop couldn't save your settings. They apply until FileHop quits.".to_owned()
        })
    }

    pub async fn update_settings(&self, patch: SettingsPatch) -> Result<Settings, String> {
        let current = self.settings();
        let next = current.apply(&patch).map_err(|e| e.0)?;
        if let Some(id) = &patch.default_profile_id {
            if id != settings::HTTP_PROFILE_ID && !lock(&self.profiles).iter().any(|p| &p.id == id)
            {
                return Err("That profile no longer exists.".into());
            }
        }
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
                let _ = self.commit_settings(next);
                self.changed(&[Topic::Settings, Topic::Server, Topic::Shares]);
                return Err(message);
            }
        }
        let saved = self.commit_settings(next.clone());
        self.changed(&[Topic::Settings]);
        self.announce(before);
        saved.map(|()| next)
    }

    /// The built-in share page first, then custom profiles in creation order.
    pub fn profiles(&self) -> Vec<LinkProfile> {
        let mut list = vec![LinkProfile {
            id: settings::HTTP_PROFILE_ID.to_owned(),
            name: "Share page".to_owned(),
            template: None,
        }];
        list.extend(lock(&self.profiles).iter().map(|p| LinkProfile {
            id: p.id.clone(),
            name: p.name.clone(),
            template: Some(p.template.clone()),
        }));
        list
    }

    pub fn save_profile(&self, input: ProfileInput) -> Result<LinkProfile, String> {
        let name = profiles::validate_name(&input.name)?;
        profiles::validate_template(&input.template)?;
        let template = input.template.trim().to_owned();
        let id = {
            let mut custom = lock(&self.profiles);
            let id = match &input.id {
                Some(id) => {
                    let existing = custom
                        .iter_mut()
                        .find(|p| &p.id == id)
                        .ok_or_else(|| "That profile no longer exists.".to_owned())?;
                    existing.name = name.clone();
                    existing.template = template.clone();
                    id.clone()
                }
                None => {
                    if custom.len() >= MAX_PROFILES {
                        return Err("FileHop keeps up to 20 link profiles.".into());
                    }
                    let id = crate::shares::token::generate_id()
                        .map_err(|_| "FileHop couldn't create the profile.".to_owned())?;
                    custom.push(Profile {
                        id: id.clone(),
                        name: name.clone(),
                        template: template.clone(),
                    });
                    id
                }
            };
            id
        };
        {
            let mut settings = lock(&self.settings);
            if input.make_default {
                settings.default_profile_id = id.clone();
            } else if settings.default_profile_id == id {
                settings.default_profile_id = settings::HTTP_PROFILE_ID.to_owned();
            }
        }
        let saved = self.persist();
        self.changed(&[Topic::Profiles, Topic::Settings, Topic::Shares]);
        saved.map(|()| LinkProfile {
            id,
            name,
            template: Some(template),
        })
    }

    /// Deletes a custom profile; a deleted default falls back to the share page.
    pub fn delete_profile(&self, id: &str) -> Result<(), String> {
        if id == settings::HTTP_PROFILE_ID {
            return Err("The share page is always available.".into());
        }
        {
            let mut custom = lock(&self.profiles);
            let before = custom.len();
            custom.retain(|p| p.id != id);
            if custom.len() == before {
                return Err("That profile no longer exists.".into());
            }
        }
        {
            let mut settings = lock(&self.settings);
            if settings.default_profile_id == id {
                settings.default_profile_id = settings::HTTP_PROFILE_ID.to_owned();
            }
        }
        let saved = self.persist();
        self.changed(&[Topic::Profiles, Topic::Settings, Topic::Shares]);
        saved
    }

    /// Resolves a template against an example share for the profile editor.
    pub fn preview_template(&self, template: &str) -> Result<(String, bool), String> {
        let custom_scheme = profiles::validate_template(template)?;
        let at = self
            .advertised()
            .unwrap_or_else(|| format!("192.168.1.20:{}", self.settings().port));
        let token = "qY3xN8vLpW2dR7tK0mZcA5bHf1JsE9uGoXiTnVwBy4Q";
        let url = format!("http://{at}/s/{token}");
        let preview = profiles::resolve(
            template,
            &profiles::Values {
                url: &url,
                filename: "Quarterly report 2026.pdf",
                token,
            },
        );
        Ok((preview, custom_scheme))
    }

    // ---- Shares ------------------------------------------------------------

    fn dto(&self, snapshot: ShareSnapshot, advertised: Option<&str>) -> ShareDto {
        to_dto(snapshot, advertised, &lock(&self.profiles))
    }

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
            .map(|s| self.dto(s, advertised.as_deref()))
            .collect()
    }

    /// With a password, it is hashed before any share exists, so the shares are
    /// protected from their first request. One batch shares one verifier.
    pub async fn create_shares(
        &self,
        stage_ids: &[String],
        options: &ShareOptions,
        separate: bool,
        password: Option<Password>,
    ) -> Result<Vec<ShareDto>, String> {
        let verifier = match password {
            Some(password) => Some(hash(password).await?),
            None => None,
        };
        let advertised = self.advertised();
        Ok(self
            .registry
            .create(stage_ids, options, separate, verifier)
            .map_err(|e| e.0)?
            .into_iter()
            .map(|s| self.dto(s, advertised.as_deref()))
            .collect())
    }

    pub fn share_again(&self, id: &str, options: Option<ShareOptions>) -> Result<ShareDto, String> {
        let options = options.unwrap_or_else(|| self.settings().default_options());
        let snapshot = self.registry.share_again(id, &options).map_err(|e| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }

    /// A share without files, using the default lifetime and limit.
    pub fn create_empty_share(&self) -> Result<ShareDto, String> {
        let options = self.settings().default_options();
        let snapshot = self.registry.create_empty(&options).map_err(|e| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }

    /// Sets, changes, or removes (`None`) a share's password.
    pub async fn set_share_password(
        &self,
        id: &str,
        password: Option<Password>,
    ) -> Result<ShareDto, String> {
        let verifier = match password {
            Some(password) => Some(hash(password).await?),
            None => None,
        };
        let snapshot = self.registry.set_password(id, verifier).map_err(|e| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }

    pub fn add_files(&self, id: &str, stage_ids: &[String]) -> Result<ShareDto, String> {
        let snapshot = self.registry.add_files(id, stage_ids).map_err(|e| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }

    pub fn remove_file(&self, id: &str, file_id: &str) -> Result<ShareDto, String> {
        let snapshot = self.registry.remove_file(id, file_id).map_err(|e| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }

    pub fn update_share(&self, id: &str, patch: &SharePatch) -> Result<ShareDto, String> {
        let snapshot = self
            .registry
            .update(id, patch)
            .map_err(|e: ShareError| e.0)?;
        Ok(self.dto(snapshot, self.advertised().as_deref()))
    }
}

/// Argon2id runs on the blocking pool; the plaintext is dropped right after.
async fn hash(password: Password) -> Result<Arc<Verifier>, String> {
    password.validate().map_err(|e| e.0)?;
    tokio::task::spawn_blocking(move || Verifier::new(&password))
        .await
        .map_err(|_| "FileHop couldn't protect this share.".to_owned())?
        .map(Arc::new)
        .map_err(|e| e.0)
}

fn to_dto(snapshot: ShareSnapshot, advertised: Option<&str>, custom: &[Profile]) -> ShareDto {
    let download_count = snapshot.download_count();
    let base = advertised.map(|at| format!("http://{at}"));
    let token = &snapshot.token;
    let (derived, kind) = match snapshot.files.as_slice() {
        [file] => (file.name.clone(), file.kind),
        [] => ("No files yet".to_owned(), FileKind::Bundle),
        files => (format!("{} files", files.len()), FileKind::Bundle),
    };
    let file_name = snapshot.title.clone().unwrap_or(derived);
    let page = base.as_ref().map(|b| format!("{b}/s/{token}"));
    let app_links = custom
        .iter()
        .map(|profile| AppLinkDto {
            profile_id: profile.id.clone(),
            name: profile.name.clone(),
            link: page.as_ref().map(|url| {
                profiles::resolve(
                    &profile.template,
                    &profiles::Values {
                        url,
                        filename: &file_name,
                        token,
                    },
                )
            }),
            // Stored templates were validated when saved or loaded.
            custom_scheme: profiles::validate_template(&profile.template).unwrap_or(true),
        })
        .collect();
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
        link: page,
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
        app_links,
        protected: snapshot.protected,
    }
}

fn tray_summary(shares: &[ShareSnapshot], now_ms: u64) -> String {
    let active: Vec<_> = shares
        .iter()
        .filter(|s| s.status == ShareStatus::Active)
        .collect();
    let count = match active.len() {
        0 => return "No active shares".to_owned(),
        1 => "1 active share".to_owned(),
        n => format!("{n} active shares"),
    };
    let next = active.iter().filter_map(|s| s.expires_at).min();
    let when = match next {
        None => "until stopped".to_owned(),
        Some(at) => {
            let minutes = at.saturating_sub(now_ms).div_ceil(60_000);
            let prefix = if active.len() == 1 {
                "ends"
            } else {
                "next ends"
            };
            match minutes {
                0 | 1 => format!("{prefix} within a minute"),
                m if m < 90 => format!("{prefix} in {m} min"),
                m => format!("{prefix} in about {} h", (m + 30) / 60),
            }
        }
    };
    format!("{count} · {when}")
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
            protected: false,
        }
    }

    #[test]
    fn every_share_has_a_page_a_zip_and_a_link_per_file() {
        let dto = to_dto(snapshot(2), Some("192.168.1.20:8765"), &[]);
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
        let offline = to_dto(snapshot(1), None, &[]);
        assert_eq!(offline.link, None);
        assert_eq!(offline.zip_link, None);
        assert_eq!(offline.files[0].link, None);
    }

    #[test]
    fn summaries_follow_the_file_count() {
        let one = to_dto(snapshot(1), None, &[]);
        assert_eq!(one.file_name, "file-0.txt");
        assert_eq!(one.kind, FileKind::Document);

        let many = to_dto(snapshot(3), None, &[]);
        assert_eq!(many.file_name, "3 files");
        assert_eq!(many.kind, FileKind::Bundle);
        assert_eq!(many.byte_size, 30);
        assert_eq!(many.download_count, 2);

        let empty = to_dto(snapshot(0), None, &[]);
        assert_eq!(empty.file_name, "No files yet");
        assert_eq!(empty.kind, FileKind::Bundle);
    }

    #[tokio::test]
    async fn settings_survive_a_restart_but_shares_do_not() {
        let dir = tempfile::tempdir().unwrap();
        let start = || {
            App::with_clock(
                Arc::new(SystemClock),
                Arc::new(|_| {}),
                Vec::new(),
                Some(ConfigStore::new(dir.path().to_path_buf())),
            )
        };
        let first = start();
        let patch: SettingsPatch =
            serde_json::from_str(r#"{"theme":"dark","defaultLifetimeMinutes":30}"#).unwrap();
        first.update_settings(patch).await.unwrap();
        first
            .registry
            .create_empty(&first.settings().default_options())
            .unwrap();
        assert_eq!(first.active_share_count(), 1);

        let second = start();
        assert_eq!(second.settings().theme, crate::settings::Theme::Dark);
        assert_eq!(second.settings().default_lifetime_minutes, Some(30));
        assert!(second.take_notice().is_none());
        assert_eq!(second.active_share_count(), 0);
    }

    fn input(id: Option<&str>, name: &str, template: &str, make_default: bool) -> ProfileInput {
        ProfileInput {
            id: id.map(str::to_owned),
            name: name.into(),
            template: template.into(),
            make_default,
        }
    }

    #[tokio::test]
    async fn profiles_are_managed_persisted_and_fall_back() {
        let dir = tempfile::tempdir().unwrap();
        let start = || {
            App::with_clock(
                Arc::new(SystemClock),
                Arc::new(|_| {}),
                Vec::new(),
                Some(ConfigStore::new(dir.path().to_path_buf())),
            )
        };
        let app = start();
        assert!(app
            .save_profile(input(None, "Bad", "javascript:alert(1)", false))
            .is_err());
        assert!(app
            .save_profile(input(None, " ", "myapp://{url}", false))
            .is_err());

        let docs = app
            .save_profile(input(
                None,
                " Documents ",
                "myapp://import?url={encodedUrl}",
                true,
            ))
            .unwrap();
        assert_eq!(docs.name, "Documents");
        assert_eq!(app.settings().default_profile_id, docs.id);
        assert_eq!(app.profiles().len(), 2);

        let edited = app
            .save_profile(input(
                Some(&docs.id),
                "Docs",
                "myapp://open?u={encodedUrl}",
                true,
            ))
            .unwrap();
        assert_eq!(edited.id, docs.id);
        assert!(app
            .save_profile(input(
                Some("AAAAAAAAAAAAAAAA"),
                "Gone",
                "myapp://{url}",
                false
            ))
            .is_err());

        // A default pointing at a profile that doesn't exist is refused.
        let bad: SettingsPatch =
            serde_json::from_str(r#"{"defaultProfileId":"AAAAAAAAAAAAAAAA"}"#).unwrap();
        assert!(app.update_settings(bad).await.is_err());

        // Settings and profiles survive a restart together.
        let restarted = start();
        assert_eq!(restarted.settings().default_profile_id, docs.id);
        assert_eq!(
            restarted.profiles()[1].template.as_deref(),
            Some("myapp://open?u={encodedUrl}")
        );

        // Deleting the default falls back to the share page.
        restarted.delete_profile(&docs.id).unwrap();
        assert_eq!(
            restarted.settings().default_profile_id,
            settings::HTTP_PROFILE_ID
        );
        assert!(restarted.delete_profile(settings::HTTP_PROFILE_ID).is_err());
        assert_eq!(start().profiles().len(), 1);
    }

    #[test]
    fn app_links_resolve_each_profile_for_the_share() {
        let custom = [
            Profile {
                id: "AAAAAAAAAAAAAAAA".into(),
                name: "Docs".into(),
                template: "myapp://import?url={encodedUrl}&name={encodedFilename}".into(),
            },
            Profile {
                id: "BBBBBBBBBBBBBBBB".into(),
                name: "Web".into(),
                template: "https://example.com/open?u={encodedUrl}".into(),
            },
        ];
        let mut titled = snapshot(1);
        titled.title = Some("Für Alex".into());
        let dto = to_dto(titled, Some("192.168.1.20:8765"), &custom);
        assert_eq!(dto.app_links.len(), 2);
        assert_eq!(
            dto.app_links[0].link.as_deref(),
            Some("myapp://import?url=http%3A%2F%2F192.168.1.20%3A8765%2Fs%2FTOKEN&name=F%C3%BCr%20Alex")
        );
        assert!(dto.app_links[0].custom_scheme);
        assert!(!dto.app_links[1].custom_scheme);
        let offline = to_dto(snapshot(1), None, &custom);
        assert_eq!(offline.app_links[0].link, None);
    }

    #[test]
    fn tray_summaries_count_active_shares_and_the_next_expiry() {
        let at = |minutes: Option<u64>, status| {
            let mut share = snapshot(1);
            share.expires_at = minutes.map(|m| 1_000_000 + m * 60_000);
            share.status = status;
            share
        };
        let now = 1_000_000;
        assert_eq!(tray_summary(&[], now), "No active shares");
        assert_eq!(
            tray_summary(&[at(Some(5), ShareStatus::Stopped)], now),
            "No active shares"
        );
        assert_eq!(
            tray_summary(&[at(Some(4), ShareStatus::Active)], now),
            "1 active share · ends in 4 min"
        );
        assert_eq!(
            tray_summary(
                &[
                    at(None, ShareStatus::Active),
                    at(Some(30), ShareStatus::Active),
                    at(Some(9), ShareStatus::Active),
                ],
                now
            ),
            "3 active shares · next ends in 9 min"
        );
        assert_eq!(
            tray_summary(&[at(None, ShareStatus::Active)], now),
            "1 active share · until stopped"
        );
        assert_eq!(
            tray_summary(&[at(Some(0), ShareStatus::Active)], now),
            "1 active share · ends within a minute"
        );
        assert_eq!(
            tray_summary(&[at(Some(150), ShareStatus::Active)], now),
            "1 active share · ends in about 3 h"
        );
    }

    #[test]
    fn lifecycle_events_serialize_for_the_frontend() {
        let quit = serde_json::to_value(BackendEvent::QuitRequested { active_shares: 2 }).unwrap();
        assert_eq!(
            quit,
            serde_json::json!({"kind": "quitRequested", "activeShares": 2})
        );
        let close = serde_json::to_value(BackendEvent::CloseRequested).unwrap();
        assert_eq!(close, serde_json::json!({"kind": "closeRequested"}));
    }

    #[test]
    fn titles_replace_the_derived_name_but_keep_the_kind() {
        let mut titled = snapshot(1);
        titled.title = Some("Contract for Alex".into());
        let dto = to_dto(titled, None, &[]);
        assert_eq!(dto.file_name, "Contract for Alex");
        assert_eq!(dto.title.as_deref(), Some("Contract for Alex"));
        assert_eq!(dto.kind, FileKind::Document);
        assert_eq!(to_dto(snapshot(1), None, &[]).title, None);
    }
}
