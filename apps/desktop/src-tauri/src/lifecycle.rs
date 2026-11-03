//! Desktop lifecycle: the tray, hiding the window instead of closing it, and
//! quitting with confirmation while shares are active.
//!
//! Quit policy: FileHop asks for confirmation when active shares would stop.
//! Once confirmed, `App::shutdown` (run on `RunEvent::Exit`) revokes every share
//! so new requests are refused, cancels running transfers within one chunk,
//! stops the listener with a short grace period, and the process exits.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

use crate::app::{App, BackendEvent};
use crate::menu;

const MAIN_WINDOW: &str = "main";

#[derive(Default)]
pub struct Lifecycle {
    /// Set right before exiting, so the exit request isn't intercepted again.
    quitting: AtomicBool,
    /// The informational tray line; `None` when no tray could be created.
    summary: Mutex<Option<MenuItem<Wry>>>,
    last_summary: Mutex<String>,
}

impl Lifecycle {
    pub fn tray_available(&self) -> bool {
        lock(&self.summary).is_some()
    }

    pub fn is_quitting(&self) -> bool {
        self.quitting.load(Ordering::SeqCst)
    }
}

/// Creates the tray. Returns `false` when the platform offers none, for example
/// a Linux desktop without an AppIndicator implementation.
pub fn setup_tray(app: &AppHandle) -> bool {
    let built = catch_unwind(AssertUnwindSafe(|| build_tray(app)));
    match built {
        Ok(Ok(summary)) => {
            *lock(&app.state::<Lifecycle>().summary) = Some(summary);
            refresh_tray(app);
            true
        }
        _ => false,
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<MenuItem<Wry>> {
    let open = MenuItem::with_id(app, "open", "Open FileHop", true, None::<&str>)?;
    let summary = MenuItem::with_id(app, "summary", "No active shares", false, None::<&str>)?;
    let settings = MenuItem::with_id(app, menu::SETTINGS, "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit FileHop", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &summary,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("FileHop")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => request_quit(app),
            _ => {}
        });
    // macOS tints a monochrome template for light and dark menu bars; other
    // platforms show the colored app icon.
    if cfg!(target_os = "macos") {
        tray = tray
            .icon(Image::from_bytes(include_bytes!(
                "../icons/tray-template.png"
            ))?)
            .icon_as_template(true);
    } else if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(summary)
}

/// Updates the tray's share summary when its text changes.
pub fn refresh_tray(app: &AppHandle) {
    let lifecycle = app.state::<Lifecycle>();
    let Some(summary) = lock(&lifecycle.summary).clone() else {
        return;
    };
    let text = app.state::<Arc<App>>().tray_summary();
    let mut last = lock(&lifecycle.last_summary);
    if *last != text && summary.set_text(&text).is_ok() {
        *last = text;
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
}

/// Closing the window hides it while the tray can bring it back. The first time,
/// the window stays open and the interface explains what happens. Without a tray
/// there is no way back, so closing means quitting.
pub fn on_close_requested(app: &AppHandle) {
    if !app.state::<Lifecycle>().tray_available() {
        request_quit(app);
        return;
    }
    let state = app.state::<Arc<App>>();
    if state.settings().show_close_notice {
        state.emit(BackendEvent::CloseRequested);
    } else {
        hide_main(app);
    }
}

/// Quits right away when nothing is shared; otherwise asks in the window first.
pub fn request_quit(app: &AppHandle) {
    let active = app.state::<Arc<App>>().active_share_count();
    if active == 0 {
        quit_now(app);
    } else {
        show_main(app);
        app.state::<Arc<App>>().emit(BackendEvent::QuitRequested {
            active_shares: active,
        });
    }
}

/// Exits after the user confirmed or nothing needs confirming. Cleanup runs on
/// `RunEvent::Exit`.
pub fn quit_now(app: &AppHandle) {
    app.state::<Lifecycle>()
        .quitting
        .store(true, Ordering::SeqCst);
    app.exit(0);
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}
