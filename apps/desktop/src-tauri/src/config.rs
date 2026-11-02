//! The versioned settings file in the per-user configuration directory.
//!
//! Only settings are stored: never shares, tokens, or file paths. Writes go to a
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

use crate::settings::{Settings, SettingsPatch};

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
    pub notice: Option<String>,
}

#[derive(Serialize)]
struct Stored<'a> {
    version: u64,
    settings: &'a Settings,
}

impl ConfigStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn path(&self) -> PathBuf {
        self.dir.join(FILE_NAME)
    }

    pub fn load(&self) -> Loaded {
        let text =
            match fs::read_to_string(self.path()) {
                Ok(text) => text,
                Err(e) if e.kind() == io::ErrorKind::NotFound => {
                    return Loaded {
                        settings: Settings::default(),
                        notice: None,
                    }
                }
                Err(_) => return Loaded {
                    settings: Settings::default(),
                    notice: Some(
                        "FileHop couldn't read its settings file and is using defaults for now."
                            .into(),
                    ),
                },
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
                return self.recover("from a newer version of FileHop")
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
        let notice = (!reset.is_empty()).then(|| {
            format!(
                "Some saved settings were invalid and were reset to their defaults: {}.",
                reset.join(", ")
            )
        });
        Loaded { settings, notice }
    }

    /// Keeps the unreadable file next to the new one and starts from defaults.
    fn recover(&self, reason: &str) -> Loaded {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_millis());
        let backup = format!("settings.unreadable-{millis}.json");
        let kept = fs::rename(self.path(), self.dir.join(&backup)).is_ok();
        let notice = if kept {
            format!("Your settings file was {reason}. FileHop kept it as {backup} and started with defaults.")
        } else {
            format!("Your settings file was {reason}. FileHop started with defaults.")
        };
        Loaded {
            settings: Settings::default(),
            notice: Some(notice),
        }
    }

    /// Replaces the settings file atomically.
    pub fn save(&self, settings: &Settings) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let json = serde_json::to_vec_pretty(&Stored {
            version: SETTINGS_VERSION,
            settings,
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
        store.save(&settings).unwrap();
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
