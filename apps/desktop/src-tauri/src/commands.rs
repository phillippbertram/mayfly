use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    name: String,
    version: String,
}

#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
    }
}
