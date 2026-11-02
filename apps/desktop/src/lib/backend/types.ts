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

/** Built-in profile: links open the landing page. */
export const HTTP_PROFILE_ID = "http";
/** Built-in profile: links download the file, or a bundle's ZIP, without the page. */
export const DOWNLOAD_PROFILE_ID = "download";

/** Lifetime presets offered in the UI, in minutes. */
export const LIFETIME_PRESETS = [5, 10, 30, 60] as const;

/** Query topics; the backend announces which ones changed. */
export type Topic = "server" | "shares" | "settings" | "profiles" | "interfaces";

export type BackendEvent =
  | { kind: "changed"; topics: Topic[] }
  | { kind: "addressChanged"; address: string };

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
  /** `bundle` puts several files behind one link; otherwise each file gets its own. */
  createShares(stageIds: string[], options: ShareOptions, bundle: boolean): Promise<Share[]>;
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

  savePng(suggestedName: string, data: Blob): Promise<void>;
}
