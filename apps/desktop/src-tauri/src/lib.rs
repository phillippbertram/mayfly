mod app;
mod commands;
mod network;
pub mod server;
mod settings;
pub mod shares;

use std::sync::Arc;
use std::time::Duration;

use tauri::{DragDropEvent, Emitter, Manager, RunEvent, WindowEvent};

use app::App;

/// The single event channel the frontend listens to.
const EVENT: &str = "filehop://event";

pub fn run() -> tauri::Result<()> {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = App::new(Arc::new(move |event| {
                let _ = handle.emit(EVENT, event);
            }));
            app.manage(state.clone());

            tauri::async_runtime::spawn({
                let state = state.clone();
                async move { state.start().await }
            });
            // Status transitions for the UI. Requests enforce lifetimes on their own.
            tauri::async_runtime::spawn({
                let state = state.clone();
                async move {
                    let mut tick = tokio::time::interval(Duration::from_secs(1));
                    loop {
                        tick.tick().await;
                        state.registry.sweep();
                    }
                }
            });
            tauri::async_runtime::spawn({
                let state = state.clone();
                async move {
                    let mut tick = tokio::time::interval(Duration::from_secs(5));
                    loop {
                        tick.tick().await;
                        let state = state.clone();
                        let _ = tokio::task::spawn_blocking(move || state.refresh_network()).await;
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                window.state::<Arc<App>>().record_drop(paths.clone());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_server,
            commands::list_shares,
            commands::get_settings,
            commands::update_settings,
            commands::list_profiles,
            commands::list_interfaces,
            commands::pick_files,
            commands::stage_dropped,
            commands::discard_staged,
            commands::create_shares,
            commands::create_empty_share,
            commands::add_files,
            commands::remove_file,
            commands::share_again,
            commands::update_share,
            commands::stop_share,
            commands::stop_all,
            commands::remove_share,
            commands::clear_finished,
        ])
        .build(tauri::generate_context!())?;

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            // Revoke shares and stop the listener before the process ends.
            let state = handle.state::<Arc<App>>().inner().clone();
            tauri::async_runtime::block_on(state.shutdown());
        }
    });
    Ok(())
}
