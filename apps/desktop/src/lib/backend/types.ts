import type {
  LinkProfile,
  NetworkInterface,
  ProfileInput,
  ServerState,
  Settings,
  Share,
  ShareOptions,
  SharePatch,
  StagedFiles,
  TemplatePreview,
} from "./schemas";

export type * from "./schemas";

/** Built-in profile: the share page. Custom app templates arrive with #6. */
export const HTTP_PROFILE_ID = "http";

/** Lifetime presets offered in the UI, in minutes. */
export const LIFETIME_PRESETS = [5, 10, 30, 60] as const;

/** Query topics; the backend announces which ones changed. */
export type Topic = "server" | "shares" | "settings" | "profiles" | "interfaces";

export type BackendEvent =
  | { kind: "changed"; topics: Topic[] }
  | { kind: "addressChanged"; address: string }
  /** The window is closing; explain that sharing continues in the background. */
  | { kind: "closeRequested" }
  /** Quitting would stop active shares; confirm first. */
  | { kind: "quitRequested"; activeShares: number }
  /** The app or tray menu asked for the settings. */
  | { kind: "openSettings" }
  /** The app menu asked for the About dialog. */
  | { kind: "showAbout" };

/** FileHop's fixed web pages; Rust owns the URLs. */
export type ExternalLink = "repository" | "issues" | "website" | "author";

export interface AppInfo {
  name: string;
  version: string;
  /** Short commit hash the app was built from; null when unknown. */
  build: string | null;
}

export type DroppedFiles =
  | { kind: "paths"; paths: string[] }
  | { kind: "preview"; files: { name: string; size: number; type: string }[] };

/** Thrown by adapters. `message` is user-safe: no paths, tokens, or internals. */
export class BackendError extends Error {
  override readonly name = "BackendError";
}

/**
 * The frontend's whole view of the Rust backend: queries, commands, and a change
 * feed. Every method rejects with a BackendError on failure.
 */
export interface Backend {
  readonly mode: "desktop" | "preview";
  subscribe(listener: (event: BackendEvent) => void): () => void;

  getServer(): Promise<ServerState>;
  listShares(): Promise<Share[]>;
  getSettings(): Promise<Settings>;
  listProfiles(): Promise<LinkProfile[]>;
  listInterfaces(): Promise<NetworkInterface[]>;

  /** Opens the native picker. `null` when the user cancels. */
  pickFiles(): Promise<StagedFiles | null>;
  stageDropped(files: DroppedFiles): Promise<StagedFiles>;
  discardStaged(stageIds: string[]): Promise<void>;
  /**
   * One share for all files, or one per file when `separate`. With a password,
   * every created share needs it from the first request on.
   */
  createShares(
    stageIds: string[],
    options: ShareOptions,
    separate: boolean,
    password?: string | null,
  ): Promise<Share[]>;
  /** A random password to show in the composer; nothing is stored. */
  generatePassword(): Promise<string>;
  /** Sets, changes, or removes (`null`) a share's password; unlocked browsers sign out. */
  setSharePassword(id: string, password: string | null): Promise<Share>;
  /** A share without files, with the default lifetime and limit. */
  createEmptyShare(): Promise<Share>;
  /** Adds staged files to an active share. */
  addFiles(id: string, stageIds: string[]): Promise<Share>;
  /** Removes a file from a share and cuts off its running downloads. */
  removeFile(id: string, fileId: string): Promise<Share>;
  shareAgain(id: string, options?: ShareOptions): Promise<Share>;
  updateShare(id: string, patch: SharePatch): Promise<Share>;
  stopShare(id: string): Promise<void>;
  stopAll(): Promise<void>;
  removeShare(id: string): Promise<void>;
  clearFinished(): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  saveProfile(input: ProfileInput): Promise<LinkProfile>;
  deleteProfile(id: string): Promise<void>;
  previewTemplate(template: string): Promise<TemplatePreview>;

  /** Saves a PNG where the user chooses. `false` when they cancel the dialog. */
  savePng(suggestedName: string, data: Blob): Promise<boolean>;

  /** A message from startup, such as a repaired settings file; `null` once read. */
  takeNotice(): Promise<string | null>;
  /** Hides the window; sharing continues and the tray brings it back. */
  hideWindow(): Promise<void>;
  /** Quits after confirmation; all shares stop. */
  quit(): Promise<void>;

  getAppInfo(): Promise<AppInfo>;
  /** Opens one of FileHop's web pages in the default browser. */
  openLink(link: ExternalLink): Promise<void>;
}
