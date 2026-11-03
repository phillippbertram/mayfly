//! The macOS app menu and the few fixed web pages Mayfly links to.
//!
//! "About Mayfly" and "Settings…" open Mayfly's own dialogs in the window. The
//! frontend can only name a link; the URLs live here, so no arbitrary address
//! ever reaches the system browser.

use std::sync::Arc;

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::app::{App, BackendEvent};
use crate::lifecycle;

pub const ABOUT: &str = "about";
pub const SETTINGS: &str = "settings";

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExternalLink {
    Repository,
    Issues,
    Website,
    Author,
}

impl ExternalLink {
    pub fn url(self) -> &'static str {
        match self {
            Self::Repository => "https://github.com/phillippbertram/mayfly",
            Self::Issues => "https://github.com/phillippbertram/mayfly/issues",
            Self::Website => crate::server::WEBSITE_URL,
            Self::Author => "https://github.com/phillippbertram",
        }
    }
}

/// The standard macOS menu with Mayfly's own About and a Settings… item:
/// About, Settings…, Services, Hide, Quit.
#[cfg(target_os = "macos")]
pub fn app_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};

    let menu = Menu::default(app)?;
    if let Some(MenuItemKind::Submenu(first)) = menu.items()?.into_iter().next() {
        // Replace the native About panel, which can't show links.
        first.remove_at(0)?;
        let about = MenuItem::with_id(app, ABOUT, "About Mayfly", true, None::<&str>)?;
        let settings = MenuItem::with_id(app, SETTINGS, "Settings…", true, Some("CmdOrCtrl+,"))?;
        first.insert_items(
            &[&about, &PredefinedMenuItem::separator(app)?, &settings],
            0,
        )?;
    }
    Ok(menu)
}

/// Brings the window forward and opens the matching dialog.
pub fn on_menu_event(app: &AppHandle, id: &str) {
    let event = match id {
        ABOUT => BackendEvent::ShowAbout,
        SETTINGS => BackendEvent::OpenSettings,
        _ => return,
    };
    lifecycle::show_main(app);
    app.state::<Arc<App>>().emit(event);
}
