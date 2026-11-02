//! The in-memory share registry: staging, lifetime, revocation, and download
//! reservations. The lock guards only short bookkeeping; it is never held while
//! a file is read or streamed.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use super::file::{FileKind, SharedFile};
use super::token;

/// Longest lifetime or extension, in minutes.
pub const MAX_LIFETIME_MINUTES: u32 = 24 * 60;
pub const MAX_DOWNLOAD_LIMIT: u32 = 999;
/// Upper bound for staged files plus files in one batch.
const MAX_STAGED: usize = 1_000;
/// Staged files the UI never shared or discarded are dropped after this.
const STAGE_TTL: Duration = Duration::from_secs(60 * 60);

pub trait Clock: Send + Sync {
    /// Monotonic time; authoritative for lifetimes.
    fn now(&self) -> Instant;
    /// Wall-clock milliseconds since the Unix epoch, for display only.
    fn wall_ms(&self) -> u64;
}

pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn wall_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_millis() as u64)
    }
}

/// A user-safe error message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShareError(pub String);

impl ShareError {
    fn new(message: &str) -> Self {
        Self(message.to_owned())
    }
}

impl std::fmt::Display for ShareError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareOptions {
    pub lifetime_minutes: Option<u32>,
    pub download_limit: Option<u32>,
    pub profile_id: String,
}

impl ShareOptions {
    pub fn validate(&self) -> Result<(), ShareError> {
        if self
            .lifetime_minutes
            .is_some_and(|m| m == 0 || m > MAX_LIFETIME_MINUTES)
        {
            return Err(ShareError::new(
                "Choose a lifetime between 1 minute and 24 hours.",
            ));
        }
        validate_limit(self.download_limit)
    }
}

/// Fields set to `Some` change; `Some(None)` clears a nullable value.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePatch {
    #[serde(default, with = "double_option")]
    pub extend_minutes: Option<Option<u32>>,
    #[serde(default, with = "double_option")]
    pub download_limit: Option<Option<u32>>,
    pub profile_id: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ShareStatus {
    Active,
    Expired,
    Stopped,
    LimitReached,
}

/// Why a public request can't be served.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unavailable {
    NotFound,
    Expired,
    Stopped,
    LimitReached,
    FileUnavailable,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedFile {
    pub stage_id: String,
    pub file_name: String,
    pub byte_size: u64,
    pub kind: FileKind,
}

#[derive(Clone, Debug, Serialize)]
pub struct RejectedItem {
    pub name: String,
    pub reason: String,
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct StagedFiles {
    pub files: Vec<StagedFile>,
    pub rejected: Vec<RejectedItem>,
}

#[derive(Clone, Debug)]
pub struct FileSnapshot {
    pub name: String,
    pub size: u64,
    pub kind: FileKind,
    pub downloads: u32,
}

/// Internal view of one share. Carries the token so callers can build links;
/// it must not be serialized as-is.
#[derive(Clone, Debug)]
pub struct ShareSnapshot {
    pub id: String,
    pub token: String,
    pub files: Vec<FileSnapshot>,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub download_limit: Option<u32>,
    pub status: ShareStatus,
    pub profile_id: String,
}

impl ShareSnapshot {
    /// Downloads started of the most-downloaded file.
    pub fn download_count(&self) -> u32 {
        self.files.iter().map(|f| f.downloads).max().unwrap_or(0)
    }
}

/// What a landing page shows. Availability is evaluated once per request.
#[derive(Clone, Debug)]
pub struct PageView {
    pub files: Vec<PageFile>,
    pub remaining: Option<Duration>,
    pub download_limit: Option<u32>,
}

#[derive(Clone, Debug)]
pub struct PageFile {
    pub name: String,
    pub size: u64,
    pub kind: FileKind,
    pub remaining_downloads: Option<u32>,
}

impl PageView {
    pub fn is_bundle(&self) -> bool {
        self.files.len() > 1
    }

    pub fn all_available(&self) -> bool {
        self.files.iter().all(|f| f.remaining_downloads != Some(0))
    }
}

/// Which part of a share a download request asks for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Target {
    /// `/d/{token}`: only valid for single-file shares.
    Single,
    /// `/d/{token}/{index}`.
    File(usize),
    /// `/z/{token}`: every file at once.
    All,
}

/// Download capacity taken before a response starts streaming.
#[derive(Debug)]
pub struct Reservation {
    share_id: String,
    indices: Vec<usize>,
    pub files: Vec<Arc<SharedFile>>,
    pub cancel: CancellationToken,
}

struct FileEntry {
    file: Arc<SharedFile>,
    downloads: u32,
}

struct Entry {
    id: String,
    token: String,
    files: Vec<FileEntry>,
    created_at: u64,
    deadline: Option<Instant>,
    expires_at: Option<u64>,
    download_limit: Option<u32>,
    stopped_at: Option<u64>,
    limit_reached_at: Option<u64>,
    profile_id: String,
    cancel: CancellationToken,
    /// Status last reported to the UI, to detect expiry transitions.
    reported: ShareStatus,
}

impl Entry {
    fn status(&self, now: Instant) -> ShareStatus {
        if self.stopped_at.is_some() {
            ShareStatus::Stopped
        } else if self.deadline.is_some_and(|d| now >= d) {
            ShareStatus::Expired
        } else if self.exhausted() {
            ShareStatus::LimitReached
        } else {
            ShareStatus::Active
        }
    }

    fn file_available(&self, file: &FileEntry) -> bool {
        self.download_limit.is_none_or(|l| file.downloads < l)
    }

    fn exhausted(&self) -> bool {
        self.files.iter().all(|f| !self.file_available(f))
    }

    fn max_downloads(&self) -> u32 {
        self.files.iter().map(|f| f.downloads).max().unwrap_or(0)
    }

    fn snapshot(&self, now: Instant) -> ShareSnapshot {
        let status = self.status(now);
        ShareSnapshot {
            id: self.id.clone(),
            token: self.token.clone(),
            files: self
                .files
                .iter()
                .map(|f| FileSnapshot {
                    name: f.file.name().to_owned(),
                    size: f.file.size(),
                    kind: f.file.kind(),
                    downloads: f.downloads,
                })
                .collect(),
            created_at: self.created_at,
            expires_at: self.expires_at,
            ended_at: match status {
                ShareStatus::Active => None,
                ShareStatus::Stopped => self.stopped_at,
                ShareStatus::Expired => self.expires_at,
                ShareStatus::LimitReached => self.limit_reached_at,
            },
            download_limit: self.download_limit,
            status,
            profile_id: self.profile_id.clone(),
        }
    }

    /// Unavailability for a new public request, or `None` when it may proceed.
    fn refusal(&self, now: Instant) -> Option<Unavailable> {
        match self.status(now) {
            ShareStatus::Active => None,
            ShareStatus::Stopped => Some(Unavailable::Stopped),
            ShareStatus::Expired => Some(Unavailable::Expired),
            ShareStatus::LimitReached => Some(Unavailable::LimitReached),
        }
    }
}

struct Staged {
    file: Arc<SharedFile>,
    at: Instant,
}

#[derive(Default)]
struct Inner {
    /// Newest first.
    shares: Vec<Entry>,
    staged: HashMap<String, Staged>,
}

type Notify = Arc<dyn Fn() + Send + Sync>;

pub struct Registry {
    inner: Mutex<Inner>,
    clock: Arc<dyn Clock>,
    notify: Notify,
}

impl Registry {
    /// `notify` runs after every change to share state, outside the lock.
    pub fn new(clock: Arc<dyn Clock>, notify: Notify) -> Self {
        Self {
            inner: Mutex::default(),
            clock,
            notify,
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A panic while holding the lock leaves only counters behind; keep serving.
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn changed(&self) {
        (self.notify)();
    }

    // ---- Staging -----------------------------------------------------------

    /// Validates selected paths and keeps them until they are shared or discarded.
    pub fn stage(&self, paths: Vec<PathBuf>) -> StagedFiles {
        let mut result = StagedFiles::default();
        let mut opened = Vec::new();
        for path in paths {
            match SharedFile::open(&path) {
                Ok(file) => opened.push(Arc::new(file)),
                Err(rejection) => result.rejected.push(RejectedItem {
                    name: path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                    reason: rejection.message().to_owned(),
                }),
            }
        }
        let now = self.clock.now();
        let mut inner = self.lock();
        inner
            .staged
            .retain(|_, s| now.duration_since(s.at) < STAGE_TTL);
        for file in opened {
            let Ok(stage_id) = token::generate_id() else {
                result
                    .rejected
                    .push(rejected(&file, "FileHop couldn't prepare this file."));
                continue;
            };
            if inner.staged.len() >= MAX_STAGED {
                result
                    .rejected
                    .push(rejected(&file, "Too many files are waiting to be shared."));
                continue;
            }
            result.files.push(StagedFile {
                stage_id: stage_id.clone(),
                file_name: file.name().to_owned(),
                byte_size: file.size(),
                kind: file.kind(),
            });
            inner.staged.insert(stage_id, Staged { file, at: now });
        }
        result
    }

    pub fn discard_staged(&self, stage_ids: &[String]) {
        let mut inner = self.lock();
        for id in stage_ids {
            inner.staged.remove(id);
        }
    }

    // ---- Share management --------------------------------------------------

    /// Turns staged files into shares: one bundle, or one share per file.
    pub fn create(
        &self,
        stage_ids: &[String],
        options: &ShareOptions,
        bundle: bool,
    ) -> Result<Vec<ShareSnapshot>, ShareError> {
        options.validate()?;
        if stage_ids.is_empty() {
            return Err(ShareError::new("Choose at least one file."));
        }
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        let snapshots = {
            let mut inner = self.lock();
            if stage_ids.iter().any(|id| !inner.staged.contains_key(id)) {
                return Err(ShareError::new(
                    "A file is no longer ready to share. Add it again.",
                ));
            }
            let files: Vec<Arc<SharedFile>> = stage_ids
                .iter()
                .filter_map(|id| inner.staged.remove(id).map(|s| s.file))
                .collect();
            let groups: Vec<Vec<Arc<SharedFile>>> = if bundle {
                vec![files]
            } else {
                files.into_iter().map(|f| vec![f]).collect()
            };
            let mut created = Vec::with_capacity(groups.len());
            for group in groups {
                created.push(new_entry(group, options, now, wall)?);
            }
            let snapshots: Vec<_> = created.iter().map(|e| e.snapshot(now)).collect();
            // Newest first, keeping the batch in selection order.
            created.reverse();
            for entry in created {
                inner.shares.insert(0, entry);
            }
            snapshots
        };
        self.changed();
        Ok(snapshots)
    }

    /// Shares the same files again under a new token; the old share is untouched.
    pub fn share_again(
        &self,
        id: &str,
        options: &ShareOptions,
    ) -> Result<ShareSnapshot, ShareError> {
        options.validate()?;
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        let snapshot = {
            let mut inner = self.lock();
            let files = find(&inner, id)?
                .files
                .iter()
                .map(|f| f.file.clone())
                .collect();
            let entry = new_entry(files, options, now, wall)?;
            let snapshot = entry.snapshot(now);
            inner.shares.insert(0, entry);
            snapshot
        };
        self.changed();
        Ok(snapshot)
    }

    pub fn update(&self, id: &str, patch: &SharePatch) -> Result<ShareSnapshot, ShareError> {
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        let snapshot = {
            let mut inner = self.lock();
            let entry = find_mut(&mut inner, id)?;
            if entry.status(now) != ShareStatus::Active {
                return Err(ShareError::new("Only active shares can be changed."));
            }
            if let Some(Some(limit)) = patch.download_limit {
                validate_limit(Some(limit))?;
                let started = entry.max_downloads();
                if limit <= started {
                    return Err(ShareError(format!(
                        "The limit must be higher than the {started} downloads already started."
                    )));
                }
            }
            if let Some(extend) = patch.extend_minutes {
                match extend {
                    None => {
                        entry.deadline = None;
                        entry.expires_at = None;
                    }
                    Some(minutes) => {
                        if minutes == 0 || minutes > MAX_LIFETIME_MINUTES {
                            return Err(ShareError::new("Extend by 1 minute to 24 hours."));
                        }
                        let add = Duration::from_secs(u64::from(minutes) * 60);
                        let base = entry.deadline.map_or(now, |d| d.max(now));
                        let remaining = base.duration_since(now);
                        entry.deadline = Some(base + add);
                        entry.expires_at = Some(wall + (remaining + add).as_millis() as u64);
                    }
                }
            }
            if let Some(limit) = patch.download_limit {
                entry.download_limit = limit;
                entry.limit_reached_at = None;
            }
            if let Some(profile_id) = &patch.profile_id {
                entry.profile_id = profile_id.clone();
            }
            entry.reported = entry.status(now);
            entry.snapshot(now)
        };
        self.changed();
        Ok(snapshot)
    }

    /// Revokes a share immediately and cancels its running transfers.
    pub fn stop(&self, id: &str) -> Result<(), ShareError> {
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        {
            let mut inner = self.lock();
            let entry = find_mut(&mut inner, id)?;
            if entry.stopped_at.is_none() {
                entry.stopped_at = Some(wall);
                entry.cancel.cancel();
                entry.reported = entry.status(now);
            }
        }
        self.changed();
        Ok(())
    }

    /// Revokes every share that is still active. Returns how many were stopped.
    pub fn stop_all(&self) -> usize {
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        let mut stopped = 0;
        {
            let mut inner = self.lock();
            for entry in inner.shares.iter_mut() {
                // Cancel transfers of ended shares too: quitting stops everything.
                entry.cancel.cancel();
                if entry.status(now) == ShareStatus::Active {
                    entry.stopped_at = Some(wall);
                    entry.reported = ShareStatus::Stopped;
                    stopped += 1;
                }
            }
        }
        self.changed();
        stopped
    }

    /// Removes an ended share from the list. Its links stop resolving at all.
    pub fn remove(&self, id: &str) -> Result<(), ShareError> {
        let now = self.clock.now();
        {
            let mut inner = self.lock();
            let entry = find(&inner, id)?;
            if entry.status(now) == ShareStatus::Active {
                return Err(ShareError::new("Stop the share before removing it."));
            }
            entry.cancel.cancel();
            inner.shares.retain(|e| e.id != id);
        }
        self.changed();
        Ok(())
    }

    pub fn clear_finished(&self) {
        let now = self.clock.now();
        {
            let mut inner = self.lock();
            inner.shares.retain(|e| {
                let keep = e.status(now) == ShareStatus::Active;
                if !keep {
                    e.cancel.cancel();
                }
                keep
            });
        }
        self.changed();
    }

    pub fn list(&self) -> Vec<ShareSnapshot> {
        let now = self.clock.now();
        self.lock().shares.iter().map(|e| e.snapshot(now)).collect()
    }

    pub fn get(&self, id: &str) -> Result<ShareSnapshot, ShareError> {
        let now = self.clock.now();
        Ok(find(&self.lock(), id)?.snapshot(now))
    }

    pub fn has_active(&self) -> bool {
        let now = self.clock.now();
        self.lock()
            .shares
            .iter()
            .any(|e| e.status(now) == ShareStatus::Active)
    }

    /// Records expiry transitions and drops stale staged files. Returns whether
    /// the UI should refresh. Correctness never depends on calling this.
    pub fn sweep(&self) -> bool {
        let now = self.clock.now();
        let mut changed = false;
        {
            let mut inner = self.lock();
            inner
                .staged
                .retain(|_, s| now.duration_since(s.at) < STAGE_TTL);
            for entry in inner.shares.iter_mut() {
                let status = entry.status(now);
                if status != entry.reported {
                    entry.reported = status;
                    changed = true;
                }
            }
        }
        if changed {
            self.changed();
        }
        changed
    }

    // ---- Public HTTP access ------------------------------------------------

    /// What the landing page for `token` should show. Never counts as a download.
    pub fn page(&self, token: &str) -> Result<PageView, Unavailable> {
        let now = self.clock.now();
        let inner = self.lock();
        let entry = find_token(&inner, token)?;
        if let Some(refusal) = entry.refusal(now) {
            return Err(refusal);
        }
        Ok(PageView {
            files: entry
                .files
                .iter()
                .map(|f| PageFile {
                    name: f.file.name().to_owned(),
                    size: f.file.size(),
                    kind: f.file.kind(),
                    remaining_downloads: entry
                        .download_limit
                        .map(|l| l.saturating_sub(f.downloads)),
                })
                .collect(),
            remaining: entry.deadline.map(|d| d.saturating_duration_since(now)),
            download_limit: entry.download_limit,
        })
    }

    /// Checks a download without reserving anything, for HEAD requests.
    pub fn peek(&self, token: &str, target: Target) -> Result<Vec<Arc<SharedFile>>, Unavailable> {
        let now = self.clock.now();
        let inner = self.lock();
        let entry = find_token(&inner, token)?;
        if let Some(refusal) = entry.refusal(now) {
            return Err(refusal);
        }
        let indices = resolve_target(entry, target)?;
        if indices
            .iter()
            .any(|&i| !entry.file_available(&entry.files[i]))
        {
            return Err(Unavailable::LimitReached);
        }
        Ok(indices
            .iter()
            .map(|&i| entry.files[i].file.clone())
            .collect())
    }

    /// Atomically takes one download from every targeted file, or none at all.
    pub fn reserve(&self, token: &str, target: Target) -> Result<Reservation, Unavailable> {
        let now = self.clock.now();
        let wall = self.clock.wall_ms();
        let reservation = {
            let mut inner = self.lock();
            let entry = find_token_mut(&mut inner, token)?;
            if let Some(refusal) = entry.refusal(now) {
                return Err(refusal);
            }
            let indices = resolve_target(entry, target)?;
            if indices
                .iter()
                .any(|&i| !entry.file_available(&entry.files[i]))
            {
                return Err(Unavailable::LimitReached);
            }
            for &i in &indices {
                entry.files[i].downloads += 1;
            }
            if entry.exhausted() {
                entry.limit_reached_at = Some(wall);
            }
            entry.reported = entry.status(now);
            Reservation {
                share_id: entry.id.clone(),
                files: indices
                    .iter()
                    .map(|&i| entry.files[i].file.clone())
                    .collect(),
                indices,
                cancel: entry.cancel.clone(),
            }
        };
        self.changed();
        Ok(reservation)
    }

    /// Returns capacity for a download that failed before its first byte.
    pub fn release(&self, reservation: Reservation) {
        let now = self.clock.now();
        {
            let mut inner = self.lock();
            let Ok(entry) = find_mut(&mut inner, &reservation.share_id) else {
                return;
            };
            for &i in &reservation.indices {
                if let Some(file) = entry.files.get_mut(i) {
                    file.downloads = file.downloads.saturating_sub(1);
                }
            }
            if !entry.exhausted() {
                entry.limit_reached_at = None;
            }
            entry.reported = entry.status(now);
        }
        self.changed();
    }
}

fn new_entry(
    files: Vec<Arc<SharedFile>>,
    options: &ShareOptions,
    now: Instant,
    wall: u64,
) -> Result<Entry, ShareError> {
    let unavailable = || ShareError::new("FileHop couldn't create a secure link.");
    let lifetime = options
        .lifetime_minutes
        .map(|m| Duration::from_secs(u64::from(m) * 60));
    Ok(Entry {
        id: token::generate_id().map_err(|_| unavailable())?,
        token: token::generate().map_err(|_| unavailable())?,
        files: files
            .into_iter()
            .map(|file| FileEntry { file, downloads: 0 })
            .collect(),
        created_at: wall,
        deadline: lifetime.map(|l| now + l),
        expires_at: lifetime.map(|l| wall + l.as_millis() as u64),
        download_limit: options.download_limit,
        stopped_at: None,
        limit_reached_at: None,
        profile_id: options.profile_id.clone(),
        cancel: CancellationToken::new(),
        reported: ShareStatus::Active,
    })
}

fn validate_limit(limit: Option<u32>) -> Result<(), ShareError> {
    if limit.is_some_and(|l| l == 0 || l > MAX_DOWNLOAD_LIMIT) {
        return Err(ShareError::new(
            "Choose a download limit between 1 and 999.",
        ));
    }
    Ok(())
}

fn rejected(file: &SharedFile, reason: &str) -> RejectedItem {
    RejectedItem {
        name: file.name().to_owned(),
        reason: reason.to_owned(),
    }
}

fn resolve_target(entry: &Entry, target: Target) -> Result<Vec<usize>, Unavailable> {
    let count = entry.files.len();
    match target {
        Target::Single if count == 1 => Ok(vec![0]),
        Target::File(i) if i < count => Ok(vec![i]),
        Target::All if count > 1 => Ok((0..count).collect()),
        _ => Err(Unavailable::NotFound),
    }
}

const NO_SHARE: &str = "This share no longer exists.";

fn find<'a>(inner: &'a Inner, id: &str) -> Result<&'a Entry, ShareError> {
    inner
        .shares
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| ShareError::new(NO_SHARE))
}

fn find_mut<'a>(inner: &'a mut Inner, id: &str) -> Result<&'a mut Entry, ShareError> {
    inner
        .shares
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| ShareError::new(NO_SHARE))
}

fn find_token<'a>(inner: &'a Inner, token: &str) -> Result<&'a Entry, Unavailable> {
    if !token::is_well_formed(token) {
        return Err(Unavailable::NotFound);
    }
    inner
        .shares
        .iter()
        .find(|e| e.token == token)
        .ok_or(Unavailable::NotFound)
}

fn find_token_mut<'a>(inner: &'a mut Inner, token: &str) -> Result<&'a mut Entry, Unavailable> {
    if !token::is_well_formed(token) {
        return Err(Unavailable::NotFound);
    }
    inner
        .shares
        .iter_mut()
        .find(|e| e.token == token)
        .ok_or(Unavailable::NotFound)
}

/// Distinguishes an absent field from an explicit `null`.
mod double_option {
    use serde::{Deserialize, Deserializer};

    pub fn deserialize<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
    where
        D: Deserializer<'de>,
        T: Deserialize<'de>,
    {
        Option::<T>::deserialize(deserializer).map(Some)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A clock tests can move forward.
    pub struct ManualClock {
        base: Instant,
        offset: Mutex<Duration>,
    }

    impl ManualClock {
        pub fn new() -> Arc<Self> {
            Arc::new(Self {
                base: Instant::now(),
                offset: Mutex::new(Duration::ZERO),
            })
        }

        pub fn advance(&self, by: Duration) {
            *self.offset.lock().unwrap() += by;
        }
    }

    impl Clock for ManualClock {
        fn now(&self) -> Instant {
            self.base + *self.offset.lock().unwrap()
        }

        fn wall_ms(&self) -> u64 {
            1_800_000_000_000 + self.offset.lock().unwrap().as_millis() as u64
        }
    }

    pub fn options(lifetime: Option<u32>, limit: Option<u32>) -> ShareOptions {
        ShareOptions {
            lifetime_minutes: lifetime,
            download_limit: limit,
            profile_id: "http".into(),
        }
    }

    struct Fixture {
        registry: Arc<Registry>,
        clock: Arc<ManualClock>,
        notified: Arc<AtomicUsize>,
        dir: tempfile::TempDir,
    }

    impl Fixture {
        fn new() -> Self {
            let clock = ManualClock::new();
            let notified = Arc::new(AtomicUsize::new(0));
            let counter = notified.clone();
            let registry = Arc::new(Registry::new(
                clock.clone(),
                Arc::new(move || {
                    counter.fetch_add(1, Ordering::SeqCst);
                }),
            ));
            Self {
                registry,
                clock,
                notified,
                dir: tempfile::tempdir().unwrap(),
            }
        }

        fn share(
            &self,
            names: &[&str],
            options: &ShareOptions,
            bundle: bool,
        ) -> Vec<ShareSnapshot> {
            let paths = names
                .iter()
                .map(|name| {
                    let path = self.dir.path().join(name);
                    std::fs::File::create(&path)
                        .unwrap()
                        .write_all(name.as_bytes())
                        .unwrap();
                    path
                })
                .collect();
            let staged = self.registry.stage(paths);
            assert!(staged.rejected.is_empty());
            let ids: Vec<_> = staged.files.into_iter().map(|f| f.stage_id).collect();
            self.registry.create(&ids, options, bundle).unwrap()
        }
    }

    #[test]
    fn creates_separate_shares_or_one_bundle() {
        let fx = Fixture::new();
        let separate = fx.share(&["a.txt", "b.txt"], &options(Some(10), None), false);
        assert_eq!(separate.len(), 2);
        assert_ne!(separate[0].token, separate[1].token);
        let bundle = fx.share(&["c.txt", "d.txt", "e.txt"], &options(Some(10), None), true);
        assert_eq!(bundle.len(), 1);
        assert_eq!(bundle[0].files.len(), 3);
        // Newest first, batch kept in selection order.
        let ids: Vec<_> = fx.registry.list().into_iter().map(|s| s.id).collect();
        assert_eq!(
            ids,
            vec![
                bundle[0].id.clone(),
                separate[0].id.clone(),
                separate[1].id.clone()
            ]
        );
        assert!(fx.notified.load(Ordering::SeqCst) >= 2);
    }

    #[test]
    fn staged_files_are_used_once() {
        let fx = Fixture::new();
        let path = fx.dir.path().join("a.txt");
        std::fs::write(&path, b"a").unwrap();
        let staged = fx.registry.stage(vec![path, fx.dir.path().to_path_buf()]);
        assert_eq!(staged.files.len(), 1);
        assert_eq!(staged.rejected.len(), 1);
        let ids = vec![staged.files[0].stage_id.clone()];
        fx.registry
            .create(&ids, &options(None, None), false)
            .unwrap();
        assert!(fx
            .registry
            .create(&ids, &options(None, None), false)
            .is_err());
    }

    #[test]
    fn rejects_invalid_options() {
        let fx = Fixture::new();
        let path = fx.dir.path().join("a.txt");
        std::fs::write(&path, b"a").unwrap();
        let ids: Vec<_> = fx
            .registry
            .stage(vec![path])
            .files
            .into_iter()
            .map(|f| f.stage_id)
            .collect();
        for bad in [
            options(Some(0), None),
            options(Some(1441), None),
            options(None, Some(0)),
            options(None, Some(1000)),
        ] {
            assert!(fx.registry.create(&ids, &bad, false).is_err());
        }
        assert!(fx
            .registry
            .create(&ids, &options(Some(1440), Some(999)), false)
            .is_ok());
    }

    #[test]
    fn expires_exactly_at_the_deadline() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(Some(5), None), false)
            .remove(0);
        fx.clock
            .advance(Duration::from_secs(5 * 60) - Duration::from_millis(1));
        assert!(fx.registry.page(&share.token).is_ok());
        assert!(fx.registry.reserve(&share.token, Target::Single).is_ok());
        fx.clock.advance(Duration::from_millis(1));
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::Expired
        );
        assert_eq!(
            fx.registry
                .reserve(&share.token, Target::Single)
                .unwrap_err(),
            Unavailable::Expired
        );
        assert!(fx.registry.sweep());
        assert!(!fx.registry.sweep());
        let snapshot = fx.registry.get(&share.id).unwrap();
        assert_eq!(snapshot.status, ShareStatus::Expired);
        assert_eq!(snapshot.ended_at, snapshot.expires_at);
    }

    #[test]
    fn unlimited_lifetime_never_expires() {
        let fx = Fixture::new();
        let share = fx.share(&["a.txt"], &options(None, None), false).remove(0);
        fx.clock.advance(Duration::from_secs(365 * 24 * 3600));
        assert!(fx.registry.page(&share.token).is_ok());
        assert_eq!(share.expires_at, None);
    }

    #[test]
    fn extending_adds_to_the_remaining_lifetime() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(Some(10), None), false)
            .remove(0);
        fx.clock.advance(Duration::from_secs(9 * 60));
        let patch = SharePatch {
            extend_minutes: Some(Some(5)),
            ..Default::default()
        };
        fx.registry.update(&share.id, &patch).unwrap();
        fx.clock.advance(Duration::from_secs(5 * 60));
        assert!(fx.registry.page(&share.token).is_ok());
        fx.clock.advance(Duration::from_secs(60));
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::Expired
        );
        // Ended shares can't be changed.
        assert!(fx.registry.update(&share.id, &patch).is_err());
    }

    #[test]
    fn stopping_revokes_and_cancels_transfers() {
        let fx = Fixture::new();
        let share = fx.share(&["a.txt"], &options(None, None), false).remove(0);
        let reservation = fx.registry.reserve(&share.token, Target::Single).unwrap();
        fx.registry.stop(&share.id).unwrap();
        assert!(reservation.cancel.is_cancelled());
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::Stopped
        );
        assert_eq!(
            fx.registry
                .reserve(&share.token, Target::Single)
                .unwrap_err(),
            Unavailable::Stopped
        );
        fx.registry.remove(&share.id).unwrap();
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::NotFound
        );
    }

    #[test]
    fn active_shares_cannot_be_removed() {
        let fx = Fixture::new();
        let share = fx.share(&["a.txt"], &options(None, None), false).remove(0);
        assert!(fx.registry.remove(&share.id).is_err());
        fx.registry.clear_finished();
        assert_eq!(fx.registry.list().len(), 1);
    }

    #[test]
    fn download_limit_is_enforced_and_released_on_failure() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(None, Some(2)), false)
            .remove(0);
        let first = fx.registry.reserve(&share.token, Target::Single).unwrap();
        let _second = fx.registry.reserve(&share.token, Target::Single).unwrap();
        assert_eq!(
            fx.registry
                .reserve(&share.token, Target::Single)
                .unwrap_err(),
            Unavailable::LimitReached
        );
        assert_eq!(
            fx.registry.get(&share.id).unwrap().status,
            ShareStatus::LimitReached
        );
        fx.registry.release(first);
        assert_eq!(
            fx.registry.get(&share.id).unwrap().status,
            ShareStatus::Active
        );
        assert!(fx.registry.reserve(&share.token, Target::Single).is_ok());
        // HEAD-style checks never take capacity.
        assert!(fx.registry.peek(&share.token, Target::Single).is_err());
    }

    #[test]
    fn raising_the_limit_reopens_but_must_exceed_started_downloads() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(None, Some(2)), false)
            .remove(0);
        fx.registry.reserve(&share.token, Target::Single).unwrap();
        let too_low = SharePatch {
            download_limit: Some(Some(1)),
            ..Default::default()
        };
        assert!(fx.registry.update(&share.id, &too_low).is_err());
        fx.registry.reserve(&share.token, Target::Single).unwrap();
        // A share that reached its limit is no longer active and can't be raised.
        let raise = SharePatch {
            download_limit: Some(Some(3)),
            ..Default::default()
        };
        assert!(fx.registry.update(&share.id, &raise).is_err());
    }

    #[test]
    fn concurrent_reservations_never_exceed_the_limit() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(None, Some(3)), false)
            .remove(0);
        let granted = Arc::new(AtomicUsize::new(0));
        let threads: Vec<_> = (0..50)
            .map(|_| {
                let registry = fx.registry.clone();
                let token = share.token.clone();
                let granted = granted.clone();
                std::thread::spawn(move || {
                    if registry.reserve(&token, Target::Single).is_ok() {
                        granted.fetch_add(1, Ordering::SeqCst);
                    }
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        assert_eq!(granted.load(Ordering::SeqCst), 3);
        assert_eq!(fx.registry.get(&share.id).unwrap().download_count(), 3);
    }

    #[test]
    fn bundle_limits_apply_per_file_and_zip_is_all_or_nothing() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt", "b.txt"], &options(None, Some(1)), true)
            .remove(0);
        assert_eq!(
            fx.registry
                .reserve(&share.token, Target::Single)
                .unwrap_err(),
            Unavailable::NotFound
        );
        assert_eq!(
            fx.registry
                .reserve(&share.token, Target::File(2))
                .unwrap_err(),
            Unavailable::NotFound
        );
        fx.registry.reserve(&share.token, Target::File(0)).unwrap();
        // One file is exhausted, so the ZIP can't be served and takes nothing.
        assert_eq!(
            fx.registry.reserve(&share.token, Target::All).unwrap_err(),
            Unavailable::LimitReached
        );
        let page = fx.registry.page(&share.token).unwrap();
        assert!(!page.all_available());
        assert_eq!(page.files[1].remaining_downloads, Some(1));
        fx.registry.reserve(&share.token, Target::File(1)).unwrap();
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::LimitReached
        );
    }

    #[test]
    fn zip_reservation_takes_one_download_of_every_file() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt", "b.txt", "c.txt"], &options(None, Some(1)), true)
            .remove(0);
        let reservation = fx.registry.reserve(&share.token, Target::All).unwrap();
        assert_eq!(reservation.files.len(), 3);
        assert_eq!(
            fx.registry.get(&share.id).unwrap().status,
            ShareStatus::LimitReached
        );
        fx.registry.release(reservation);
        let snapshot = fx.registry.get(&share.id).unwrap();
        assert_eq!(snapshot.status, ShareStatus::Active);
        assert!(snapshot.files.iter().all(|f| f.downloads == 0));
    }

    #[test]
    fn share_again_issues_a_new_token() {
        let fx = Fixture::new();
        let share = fx
            .share(&["a.txt"], &options(Some(5), None), false)
            .remove(0);
        fx.registry.stop(&share.id).unwrap();
        let again = fx
            .registry
            .share_again(&share.id, &options(Some(5), None))
            .unwrap();
        assert_ne!(again.token, share.token);
        assert!(fx.registry.page(&again.token).is_ok());
        assert_eq!(
            fx.registry.page(&share.token).unwrap_err(),
            Unavailable::Stopped
        );
    }

    #[test]
    fn stop_all_revokes_every_active_share() {
        let fx = Fixture::new();
        let shares = fx.share(&["a.txt", "b.txt"], &options(None, None), false);
        assert!(fx.registry.has_active());
        assert_eq!(fx.registry.stop_all(), 2);
        assert!(!fx.registry.has_active());
        for share in shares {
            assert_eq!(
                fx.registry.page(&share.token).unwrap_err(),
                Unavailable::Stopped
            );
        }
    }

    #[test]
    fn malformed_and_unknown_tokens_are_not_found() {
        let fx = Fixture::new();
        fx.share(&["a.txt"], &options(None, None), false);
        assert_eq!(
            fx.registry.page("../../etc/passwd").unwrap_err(),
            Unavailable::NotFound
        );
        let unknown = token::generate().unwrap();
        assert_eq!(
            fx.registry.page(&unknown).unwrap_err(),
            Unavailable::NotFound
        );
    }

    #[test]
    fn patches_distinguish_missing_and_null() {
        let patch: SharePatch = serde_json::from_str(r#"{"extendMinutes":null}"#).unwrap();
        assert_eq!(patch.extend_minutes, Some(None));
        assert_eq!(patch.download_limit, None);
        let patch: SharePatch = serde_json::from_str(r#"{"downloadLimit":4}"#).unwrap();
        assert_eq!(patch.download_limit, Some(Some(4)));
    }
}
