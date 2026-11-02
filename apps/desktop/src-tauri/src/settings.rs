//! Application settings. Kept in memory for now; persistence arrives with the
//! settings service (#5), so changes last until FileHop quits.

use serde::{Deserialize, Serialize};

use crate::shares::{ShareError, ShareOptions};

pub const HTTP_PROFILE_ID: &str = "http";
pub const DEFAULT_PORT: u16 = 8765;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub port: u16,
    pub interface_id: Option<String>,
    pub default_lifetime_minutes: Option<u32>,
    pub default_download_limit: Option<u32>,
    pub confirm_before_sharing: bool,
    pub hide_codes: bool,
    pub theme: Theme,
    pub default_profile_id: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            interface_id: None,
            default_lifetime_minutes: Some(10),
            default_download_limit: None,
            confirm_before_sharing: true,
            hide_codes: false,
            theme: Theme::System,
            default_profile_id: HTTP_PROFILE_ID.to_owned(),
        }
    }
}

/// A partial update; `Some(None)` clears a nullable value.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsPatch {
    pub port: Option<u16>,
    #[serde(default, with = "double_option")]
    pub interface_id: Option<Option<String>>,
    #[serde(default, with = "double_option")]
    pub default_lifetime_minutes: Option<Option<u32>>,
    #[serde(default, with = "double_option")]
    pub default_download_limit: Option<Option<u32>>,
    pub confirm_before_sharing: Option<bool>,
    pub hide_codes: Option<bool>,
    pub theme: Option<Theme>,
    pub default_profile_id: Option<String>,
}

impl Settings {
    /// Returns the updated settings, or a user-safe reason the patch is invalid.
    pub fn apply(&self, patch: &SettingsPatch) -> Result<Settings, ShareError> {
        let mut next = self.clone();
        if let Some(port) = patch.port {
            if port == 0 {
                return Err(ShareError("Enter a port between 1 and 65535.".into()));
            }
            next.port = port;
        }
        if let Some(id) = &patch.interface_id {
            next.interface_id = id.clone();
        }
        if let Some(lifetime) = patch.default_lifetime_minutes {
            next.default_lifetime_minutes = lifetime;
        }
        if let Some(limit) = patch.default_download_limit {
            next.default_download_limit = limit;
        }
        if let Some(confirm) = patch.confirm_before_sharing {
            next.confirm_before_sharing = confirm;
        }
        if let Some(hide) = patch.hide_codes {
            next.hide_codes = hide;
        }
        if let Some(theme) = patch.theme {
            next.theme = theme;
        }
        if let Some(profile) = &patch.default_profile_id {
            validate_profile(profile)?;
            next.default_profile_id = profile.clone();
        }
        // Reuse the share option rules for the defaults.
        next.default_options(HTTP_PROFILE_ID).validate()?;
        Ok(next)
    }

    pub fn default_options(&self, profile_id: &str) -> ShareOptions {
        ShareOptions {
            lifetime_minutes: self.default_lifetime_minutes,
            download_limit: self.default_download_limit,
            profile_id: profile_id.to_owned(),
        }
    }
}

/// Only the built-in HTTP profile exists until link profiles land (#6).
pub fn validate_profile(id: &str) -> Result<(), ShareError> {
    if id == HTTP_PROFILE_ID {
        Ok(())
    } else {
        Err(ShareError("That profile no longer exists.".into()))
    }
}

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
mod tests {
    use super::*;

    fn patch(json: &str) -> SettingsPatch {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn applies_partial_updates() {
        let next = Settings::default()
            .apply(&patch(
                r#"{"theme":"dark","defaultLifetimeMinutes":null,"interfaceId":"en0"}"#,
            ))
            .unwrap();
        assert_eq!(next.theme, Theme::Dark);
        assert_eq!(next.default_lifetime_minutes, None);
        assert_eq!(next.interface_id.as_deref(), Some("en0"));
        assert_eq!(next.port, DEFAULT_PORT);
    }

    #[test]
    fn rejects_invalid_values() {
        let settings = Settings::default();
        assert!(settings.apply(&patch(r#"{"port":0}"#)).is_err());
        assert!(settings
            .apply(&patch(r#"{"defaultDownloadLimit":0}"#))
            .is_err());
        assert!(settings
            .apply(&patch(r#"{"defaultLifetimeMinutes":2000}"#))
            .is_err());
        assert!(settings
            .apply(&patch(r#"{"defaultProfileId":"other"}"#))
            .is_err());
        assert!(serde_json::from_str::<SettingsPatch>(r#"{"port":70000}"#).is_err());
        assert!(serde_json::from_str::<SettingsPatch>(r#"{"unknown":1}"#).is_err());
    }
}
