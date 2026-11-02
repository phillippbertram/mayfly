//! Thin Tauri command adapters. Errors are user-safe strings without paths.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::app::{App, LinkProfile, ServerState, ShareDto};
use crate::network::NetworkInterface;
use crate::settings::{Settings, SettingsPatch};
use crate::shares::{Grouping, ShareOptions, SharePatch, StagedFiles};

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
    grouping: Grouping,
) -> Result<Vec<ShareDto>, String> {
    state.create_shares(&stage_ids, &options, grouping)
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
