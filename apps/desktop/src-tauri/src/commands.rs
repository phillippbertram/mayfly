//! Thin Tauri command adapters. Errors are user-safe strings without paths.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::app::{App, LinkProfile, ServerState, ShareDto};
use crate::export;
use crate::network::NetworkInterface;
use crate::settings::{Settings, SettingsPatch};
use crate::shares::{ShareOptions, SharePatch, StagedFiles};

type AppState<'a> = State<'a, Arc<App>>;

#[derive(Serialize)]
pub struct AppInfo {
    name: String,
    version: String,
}

#[tauri::command]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
pub fn get_server(state: AppState) -> ServerState {
    state.server_state()
}

#[tauri::command]
pub fn list_shares(state: AppState) -> Vec<ShareDto> {
    state.list_shares()
}

#[tauri::command]
pub fn get_settings(state: AppState) -> Settings {
    state.settings()
}

#[tauri::command]
pub fn take_notice(state: AppState) -> Option<String> {
    state.take_notice()
}

#[tauri::command]
pub async fn update_settings(
    state: AppState<'_>,
    patch: SettingsPatch,
) -> Result<Settings, String> {
    state.update_settings(patch).await
}

#[tauri::command]
pub fn list_profiles(state: AppState) -> Vec<LinkProfile> {
    state.profiles()
}

#[tauri::command]
pub fn list_interfaces(state: AppState) -> Vec<NetworkInterface> {
    state.interfaces()
}

/// Opens the native picker from Rust, so the webview needs no dialog permission.
#[tauri::command]
pub async fn pick_files(
    app: AppHandle,
    state: AppState<'_>,
) -> Result<Option<StagedFiles>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Choose files to share")
        .pick_files(move |paths| {
            let _ = tx.send(paths);
        });
    let Some(paths) = rx
        .await
        .map_err(|_| "The file picker closed unexpectedly.".to_owned())?
    else {
        return Ok(None);
    };
    let paths: Vec<PathBuf> = paths
        .into_iter()
        .filter_map(|p| p.into_path().ok())
        .collect();
    let registry = state.registry.clone();
    let staged = tokio::task::spawn_blocking(move || registry.stage(paths))
        .await
        .map_err(|_| "FileHop couldn't read the selected files.".to_owned())?;
    Ok(Some(staged))
}

#[tauri::command]
pub async fn stage_dropped(
    state: AppState<'_>,
    paths: Vec<PathBuf>,
) -> Result<StagedFiles, String> {
    state.stage_dropped(paths).await
}

#[tauri::command]
pub fn discard_staged(state: AppState, stage_ids: Vec<String>) {
    state.registry.discard_staged(&stage_ids);
}

#[tauri::command]
pub fn create_shares(
    state: AppState,
    stage_ids: Vec<String>,
    options: ShareOptions,
    separate: bool,
) -> Result<Vec<ShareDto>, String> {
    state.create_shares(&stage_ids, &options, separate)
}

#[tauri::command]
pub fn create_empty_share(state: AppState) -> Result<ShareDto, String> {
    state.create_empty_share()
}

#[tauri::command]
pub fn add_files(state: AppState, id: String, stage_ids: Vec<String>) -> Result<ShareDto, String> {
    state.add_files(&id, &stage_ids)
}

#[tauri::command]
pub fn remove_file(state: AppState, id: String, file_id: String) -> Result<ShareDto, String> {
    state.remove_file(&id, &file_id)
}

#[tauri::command]
pub fn share_again(
    state: AppState,
    id: String,
    options: Option<ShareOptions>,
) -> Result<ShareDto, String> {
    state.share_again(&id, options)
}

#[tauri::command]
pub fn update_share(state: AppState, id: String, patch: SharePatch) -> Result<ShareDto, String> {
    state.update_share(&id, &patch)
}

#[tauri::command]
pub fn stop_share(state: AppState, id: String) -> Result<(), String> {
    state.registry.stop(&id).map_err(|e| e.0)
}

#[tauri::command]
pub fn stop_all(state: AppState) {
    state.registry.stop_all();
}

#[tauri::command]
pub fn remove_share(state: AppState, id: String) -> Result<(), String> {
    state.registry.remove(&id).map_err(|e| e.0)
}

#[tauri::command]
pub fn clear_finished(state: AppState) {
    state.registry.clear_finished();
}

/// Saves a PNG the interface generated (a QR code) where the user chooses in the
/// native save dialog. Returns `false` when the dialog is cancelled. The webview
/// never names a path; it only supplies the image and a suggested file name.
#[tauri::command]
pub async fn save_png(
    app: AppHandle,
    suggested_name: String,
    data: Vec<u8>,
) -> Result<bool, String> {
    export::validate_png(&data)?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Save QR code")
        .set_file_name(export::png_file_name(&suggested_name))
        .add_filter("PNG image", &["png"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(path) = rx
        .await
        .map_err(|_| "The save dialog closed unexpectedly.".to_owned())?
    else {
        return Ok(false);
    };
    let path = path
        .into_path()
        .map_err(|_| "FileHop can't save to that location.".to_owned())?;
    tokio::task::spawn_blocking(move || std::fs::write(path, data))
        .await
        .map_err(|_| "FileHop couldn't save the image.".to_owned())?
        .map_err(|_| "FileHop couldn't save the image there. Choose another folder.".to_owned())?;
    Ok(true)
}

/// Hides the window; sharing continues and the tray brings it back.
#[tauri::command]
pub fn hide_window(app: AppHandle) {
    crate::lifecycle::hide_main(&app);
}

/// Quits after the interface confirmed it. Shares stop during cleanup.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    crate::lifecycle::quit_now(&app);
}
