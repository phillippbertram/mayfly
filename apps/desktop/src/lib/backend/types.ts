/**
 * Transport types shared by the desktop adapter and the browser preview.
 *
 * Rust is authoritative for every value here: statuses, expiration, download
 * counters, generated links, and validation results. The UI renders them and
 * never derives security decisions on its own. No DTO carries a local path.
 */

export type FileKind = "image" | "document" | "archive" | "audio" | "video" | "other";

export type ShareStatus = "active" | "expired" | "stopped" | "limitReached";

export interface Share {
  id: string;
  fileName: string;
  byteSize: number;
  mediaType: string;
  kind: FileKind;
  /** Wall-clock milliseconds, display only. */
  createdAt: number;
  /** Wall-clock milliseconds, display only. `null` means the share lasts until stopped. */
  expiresAt: number | null;
  endedAt: number | null;
  downloadCount: number;
  downloadLimit: number | null;
  status: ShareStatus;
  profileId: string;
  /** Resolved link for the selected profile and current address; `null` while no address is usable. */
  link: string | null;
  linkError: string | null;
}

export type ServerState =
  | { kind: "starting" }
  | { kind: "online"; address: string; port: number; interfaceName: string }
  | { kind: "noAddress"; port: number }
  | { kind: "bindFailed"; port: number; message: string }
  | { kind: "stopping" }
  | { kind: "unavailable"; message: string };

export interface NetworkInterface {
  id: string;
  name: string;
  address: string;
}

export const LIFETIME_OPTIONS = [5, 10, 30, 60] as const;
export type LifetimeMinutes = (typeof LIFETIME_OPTIONS)[number] | null;

export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  port: number;
  interfaceId: string | null;
  defaultLifetimeMinutes: LifetimeMinutes;
  defaultDownloadLimit: number | null;
  theme: ThemePreference;
  defaultProfileId: string;
}

export const HTTP_PROFILE_ID = "http";

export interface LinkProfile {
  id: string;
  name: string;
  /** `null` for the built-in HTTP profile. */
  template: string | null;
}

export interface Snapshot {
  server: ServerState;
  shares: Share[];
  settings: Settings;
  profiles: LinkProfile[];
  interfaces: NetworkInterface[];
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export type TemplatePreview =
  | { ok: true; preview: string; customScheme: boolean }
  | { ok: false; error: string };

export type DroppedFiles =
  | { kind: "paths"; paths: string[] }
  | { kind: "preview"; files: { name: string; size: number; type: string }[] };

export interface ProfileInput {
  id?: string;
  name: string;
  template: string;
  makeDefault: boolean;
}

export type BackendEvent =
  | { kind: "addressChanged"; address: string }
  | { kind: "sharesExpired"; count: number };

export interface Backend {
  readonly mode: "desktop" | "preview";
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: BackendEvent) => void): () => void;

  chooseFiles(): Promise<Result<Share[]>>;
  shareDropped(files: DroppedFiles): Promise<Result<Share[]>>;
  shareAgain(id: string): Promise<Result<Share>>;
  stopShare(id: string): Promise<Result>;
  stopAll(): Promise<Result>;
  removeShare(id: string): Promise<Result>;
  clearFinished(): Promise<Result>;
  setShareProfile(id: string, profileId: string): Promise<Result>;

  updateSettings(patch: Partial<Settings>): Promise<Result>;
  saveProfile(input: ProfileInput): Promise<Result<LinkProfile>>;
  deleteProfile(id: string): Promise<Result>;
  previewTemplate(template: string): Promise<TemplatePreview>;

  savePng(suggestedName: string, data: Blob): Promise<Result>;
}
