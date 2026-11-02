import { invoke, isTauri } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
}

export function isDesktop(): boolean {
  return isTauri();
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}
