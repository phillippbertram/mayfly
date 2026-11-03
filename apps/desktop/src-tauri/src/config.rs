//! The versioned settings file in the per-user configuration directory.
//!
//! Only settings and link profiles are stored: never shares, tokens, or file paths. Writes go to a
//! temporary file that is synced and renamed over the old one, so a crash leaves
//! either the old or the new file. Reading is forgiving: unknown fields are
//! ignored, an invalid value falls back to its default without discarding the
//! rest, and an unreadable file is kept as a backup before starting from defaults.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::{Map, Value};

use crate::profiles::{self, Profile, MAX_PROFILES};
use crate::settings::{Settings, SettingsPatch, HTTP_PROFILE_ID};

/// Bump when the stored shape changes incompatibly, and migrate older versions.
pub const SETTINGS_VERSION: u64 = 1;
const FILE_NAME: &str = "settings.json";

pub struct ConfigStore {
    dir: PathBuf,
}

/// Settings read at startup, with a message for the user when something had to
/// be repaired.
pub struct Loaded {
    pub settings: Settings,
    pub profiles: Vec<Profile>,
    pub notice: Option<String>,
}

impl Loaded {
    fn defaults(notice: Option<String>) -> Self {
        Self {
            settings: Settings::default(),
            profiles: Vec::new(),
            notice,
        }
    }
}

#[derive(Serialize)]
struct Stored<'a> {
    version: u64,
    settings: &'a Settings,
    profiles: &'a [Profile],
}

impl ConfigStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn path(&self) -> PathBuf {
        self.dir.join(FILE_NAME)
    }

    pub fn load(&self) -> Loaded {
        let text = match fs::read_to_string(self.path()) {
            Ok(text) => text,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Loaded::defaults(None),
            Err(_) => {
                return Loaded::defaults(Some(
                    "Mayfly couldn't read its settings file and is using defaults for now.".into(),
                ))
            }
        };
        let parsed: Option<Map<String, Value>> = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|value| match value {
                Value::Object(root) => Some(root),
                _ => None,
            });
        let Some(root) = parsed else {
            return self.recover("damaged");
        };
        match root.get("version").and_then(Value::as_u64) {
            Some(SETTINGS_VERSION) => {}
            Some(version) if version > SETTINGS_VERSION => {
                return self.recover("from a newer version of Mayfly")
            }
            _ => return self.recover("damaged"),
        }
        let Some(Value::Object(fields)) = root.get("settings") else {
            return self.recover("damaged");
        };

        let mut settings = Settings::default();
        let mut reset = Vec::new();
        for (key, value) in fields {
            let mut single = Map::new();
            single.insert(key.clone(), value.clone());
            match serde_json::from_value::<SettingsPatch>(Value::Object(single)) {
                Ok(patch) => match settings.apply(&patch) {
                    Ok(next) => settings = next,
                    Err(_) => reset.push(key.clone()),
                },
                // Unknown keys come from other versions; they are not errors.
                Err(e) if e.to_string().contains("unknown field") => {}
                Err(_) => reset.push(key.clone()),
            }
        }

        let mut profiles: Vec<Profile> = Vec::new();
        let mut dropped = 0;
        if let Some(stored) = root.get("profiles") {
            let entries = stored.as_array().cloned().unwrap_or_default();
            if !stored.is_array() {
                dropped += 1;
            }
            for entry in entries {
                let valid = serde_json::from_value::<Profile>(entry)
                    .ok()
                    .and_then(|p| profiles::validate_profile(&p).ok())
                    .filter(|p| {
                        profiles.len() < MAX_PROFILES && !profiles.iter().any(|q| q.id == p.id)
                    });
                match valid {
                    Some(profile) => profiles.push(profile),
                    None => dropped += 1,
                }
            }
        }
        // A default that no longer exists falls back to the share page.
        if settings.default_profile_id != HTTP_PROFILE_ID
            && !profiles.iter().any(|p| p.id == settings.default_profile_id)
        {
            settings.default_profile_id = HTTP_PROFILE_ID.to_owned();
        }

        let mut problems = Vec::new();
        if !reset.is_empty() {
            problems.push(format!(
                "some settings were invalid and were reset to their defaults ({})",
                reset.join(", ")
            ));
        }
        if dropped > 0 {
            problems.push(format!(
                "{dropped} link {} invalid and {} left out",
                if dropped == 1 {
                    "profile was"
                } else {
                    "profiles were"
                },
                if dropped == 1 { "was" } else { "were" },
            ));
        }
        let notice = (!problems.is_empty()).then(|| {
            // The next save replaces the file, so keep the original first.
            let backup = self.backup_name("repaired");
            let kept = fs::copy(self.path(), self.dir.join(&backup)).is_ok();
            let mut message = problems.join("; ");
            message[..1].make_ascii_uppercase();
            if kept {
                format!("{message}. The original file was kept as {backup}.")
            } else {
                format!("{message}.")
            }
        });
        Loaded {
            settings,
            profiles,
            notice,
        }
    }

    fn backup_name(&self, kind: &str) -> String {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_millis());
        format!("settings.{kind}-{millis}.json")
    }

    /// Keeps the unreadable file next to the new one and starts from defaults.
    fn recover(&self, reason: &str) -> Loaded {
        let backup = self.backup_name("unreadable");
        let kept = fs::rename(self.path(), self.dir.join(&backup)).is_ok();
        let notice = if kept {
            format!("Your settings file was {reason}. Mayfly kept it as {backup} and started with defaults.")
        } else {
            format!("Your settings file was {reason}. Mayfly started with defaults.")
        };
        Loaded::defaults(Some(notice))
    }

    /// Replaces the settings file atomically.
    pub fn save(&self, settings: &Settings, profiles: &[Profile]) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let json = serde_json::to_vec_pretty(&Stored {
            version: SETTINGS_VERSION,
            settings,
            profiles,
        })
        .map_err(io::Error::other)?;
        let tmp = self.dir.join(format!("{FILE_NAME}.tmp"));
        write_synced(&tmp, &json)?;
        fs::rename(&tmp, self.path())
    }
}

fn write_synced(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut file = fs::File::create(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Theme;

    fn store() -> (tempfile::TempDir, ConfigStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::new(dir.path().join("config"));
        (dir, store)
    }

    fn write(store: &ConfigStore, text: &str) {
        fs::create_dir_all(&store.dir).unwrap();
        fs::write(store.path(), text).unwrap();
    }

    fn backups(store: &ConfigStore) -> Vec<String> {
        fs::read_dir(&store.dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.starts_with("settings.unreadable-"))
            .collect()
    }

    #[test]
    fn missing_file_means_defaults_without_a_notice() {
        let (_dir, store) = store();
        let loaded = store.load();
        assert_eq!(loaded.settings, Settings::default());
        assert!(loaded.notice.is_none());
    }

    #[test]
    fn saved_settings_round_trip_without_leftovers() {
        let (_dir, store) = store();
        let settings = Settings {
            port: 9000,
            theme: Theme::Dark,
            default_lifetime_minutes: None,
            default_download_limit: Some(3),
            interface_id: Some("en0".into()),
            show_close_notice: false,
            ..Default::default()
        };
        store.save(&settings, &[]).unwrap();
        let loaded = store.load();
        assert_eq!(loaded.settings, settings);
        assert!(loaded.notice.is_none());
        let names: Vec<_> = fs::read_dir(&store.dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, ["settings.json"]);
        let text = fs::read_to_string(store.path()).unwrap();
        assert!(text.contains("\"version\": 1"));
    }

    #[test]
    fn damaged_files_are_kept_and_defaults_used() {
        let (_dir, store) = store();
        write(&store, "{ not json");
        let loaded = store.load();
        assert_eq!(loaded.settings, Settings::default());
        assert!(loaded.notice.unwrap().contains("damaged"));
        let kept = backups(&store);
        assert_eq!(kept.len(), 1);
        assert!(!store.path().exists());
        assert_eq!(
            fs::read_to_string(store.dir.join(&kept[0])).unwrap(),
            "{ not json"
        );
    }

    #[test]
    fn files_from_newer_versions_are_kept_aside() {
        let (_dir, store) = store();
        write(&store, r#"{"version": 99, "settings": {"port": 9000}}"#);
        let loaded = store.load();
        assert_eq!(loaded.settings, Settings::default());
        assert!(loaded.notice.unwrap().contains("newer version"));
        assert_eq!(backups(&store).len(), 1);
    }

    fn profile(name: &str) -> Profile {
        Profile {
            id: crate::shares::token::generate_id().unwrap(),
            name: name.into(),
            template: "myapp://import?url={encodedUrl}".into(),
        }
    }

    #[test]
    fn profiles_and_the_default_round_trip() {
        let (_dir, store) = store();
        let app = profile("Documents");
        let settings = Settings {
            default_profile_id: app.id.clone(),
            ..Default::default()
        };
        store.save(&settings, std::slice::from_ref(&app)).unwrap();
        let loaded = store.load();
        assert_eq!(loaded.profiles, std::slice::from_ref(&app));
        assert_eq!(loaded.settings.default_profile_id, app.id);
        assert!(loaded.notice.is_none());
    }

    #[test]
    fn invalid_profiles_are_left_out_and_the_file_is_kept() {
        let (_dir, store) = store();
        let good = profile("Good");
        let text = serde_json::json!({
            "version": 1,
            "settings": { "defaultProfileId": "AAAAAAAAAAAAAAAA" },
            "profiles": [
                good,
                { "id": "AAAAAAAAAAAAAAAA", "name": "Bad", "template": "javascript:alert(1)" },
                { "id": "../x", "name": "Bad id", "template": "myapp://{url}" },
                { "name": "No id" },
                good,
            ],
        })
        .to_string();
        write(&store, &text);
        let loaded = store.load();
        assert_eq!(loaded.profiles, [good]);
        // The default pointed at a dropped profile, so it falls back.
        assert_eq!(loaded.settings.default_profile_id, HTTP_PROFILE_ID);
        let notice = loaded.notice.unwrap();
        assert!(notice.contains("4 link profiles were invalid"), "{notice}");
        let repaired: Vec<_> = fs::read_dir(&store.dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|n| n.starts_with("settings.repaired-"))
            .collect();
        assert_eq!(repaired.len(), 1);
        assert_eq!(
            fs::read_to_string(store.dir.join(&repaired[0])).unwrap(),
            text
        );
    }

    #[test]
    fn invalid_values_reset_individually() {
        let (_dir, store) = store();
        write(
            &store,
            r#"{"version": 1, "settings": {
                "port": 0,
                "theme": "dark",
                "defaultDownloadLimit": "lots",
                "defaultLifetimeMinutes": 30,
                "somethingFromLater": true
            }}"#,
        );
        let loaded = store.load();
        assert_eq!(loaded.settings.theme, Theme::Dark);
        assert_eq!(loaded.settings.default_lifetime_minutes, Some(30));
        assert_eq!(loaded.settings.port, Settings::default().port);
        assert_eq!(loaded.settings.default_download_limit, None);
        let notice = loaded.notice.unwrap();
        assert!(notice.contains("port") && notice.contains("defaultDownloadLimit"));
        assert!(!notice.contains("somethingFromLater"));
        // The file itself is left for the next save to replace.
        assert!(store.path().exists());
        assert!(backups(&store).is_empty());
    }
}
