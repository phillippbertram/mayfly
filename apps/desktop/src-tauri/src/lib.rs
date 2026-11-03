mod app;
mod commands;
mod config;
mod export;
mod lifecycle;
mod menu;
mod network;
mod profiles;
pub mod server;
mod settings;
pub mod shares;

use std::sync::Arc;
use std::time::Duration;

use tauri::{DragDropEvent, Emitter, Manager, RunEvent, WindowEvent};

use app::{App, BackendEvent, Topic};
use lifecycle::Lifecycle;

/// The single event channel the frontend listens to.
const EVENT: &str = "mayfly://event";

pub fn run() -> tauri::Result<()> {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Lifecycle::default())
        .setup(|app| {
            let handle = app.handle().clone();
            // Without a config directory, settings apply until Mayfly quits.
            let config_dir = app.path().app_config_dir().ok();
            let state = App::new(
                Arc::new(move |event: BackendEvent| {
                    let shares_changed = matches!(
                        &event,
                        BackendEvent::Changed { topics } if topics.contains(&Topic::Shares)
                    );
                    let _ = handle.emit(EVENT, event);
                    if shares_changed {
                        lifecycle::refresh_tray(&handle);
                    }
                }),
                config_dir,
            );
            app.manage(state.clone());
            lifecycle::setup_tray(app.handle());
            #[cfg(target_os = "macos")]
            app.set_menu(menu::app_menu(app.handle())?)?;

            tauri::async_runtime::spawn({
                let state = state.clone();
                async move { state.start().await }
            });
            // Status transitions for the UI and the tray. Requests enforce
            // lifetimes on their own.
            tauri::async_runtime::spawn({
                let state = state.clone();
                let handle = app.handle().clone();
                async move {
                    let mut tick = tokio::time::interval(Duration::from_secs(1));
                    loop {
                        tick.tick().await;
                        state.registry.sweep();
                        lifecycle::refresh_tray(&handle);
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
        .on_menu_event(|app, event| menu::on_menu_event(app, event.id.as_ref()))
        .on_window_event(|window, event| match event {
            WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
                window.state::<Arc<App>>().record_drop(paths.clone());
            }
            WindowEvent::CloseRequested { api, .. } => {
                // Sharing continues in the background; the tray brings it back.
                api.prevent_close();
                lifecycle::on_close_requested(window.app_handle());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_server,
            commands::list_shares,
            commands::get_settings,
            commands::take_notice,
            commands::update_settings,
            commands::list_profiles,
            commands::save_profile,
            commands::delete_profile,
            commands::preview_template,
            commands::list_interfaces,
            commands::pick_files,
            commands::stage_dropped,
            commands::discard_staged,
            commands::create_shares,
            commands::generate_password,
            commands::set_share_password,
            commands::create_empty_share,
            commands::add_files,
            commands::remove_file,
            commands::share_again,
            commands::update_share,
            commands::stop_share,
            commands::stop_all,
            commands::remove_share,
            commands::clear_finished,
            commands::save_png,
            commands::hide_window,
            commands::quit_app,
            commands::open_link,
        ])
        .build(tauri::generate_context!())?;

    app.run(|handle, event| match event {
        // Cmd/Ctrl+Q and other quit requests confirm first while shares are active.
        RunEvent::ExitRequested { api, .. } if !handle.state::<Lifecycle>().is_quitting() => {
            api.prevent_exit();
            lifecycle::request_quit(handle);
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => lifecycle::show_main(handle),
        RunEvent::Exit => {
            // Revoke shares, cancel transfers, and stop the listener before the
            // process ends.
            let state = handle.state::<Arc<App>>().inner().clone();
            tauri::async_runtime::block_on(state.shutdown());
        }
        _ => {}
    });
    Ok(())
}
