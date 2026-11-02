import { getAppInfo } from "../desktop";
import { DEFAULT_SETTINGS, HTTP_PROFILE } from "./defaults";
import { SnapshotStore } from "./store";
import type { Backend, Result, Settings, TemplatePreview } from "./types";

const NOT_YET = "Sharing isn't available in this build yet.";

function unavailable<T>(): Promise<Result<T>> {
  return Promise.resolve({ ok: false, error: NOT_YET });
}

/**
 * Desktop adapter. The Rust share, server, and network services do not exist yet,
 * so this adapter reports that truthfully instead of pretending to be online.
 * Replace each method with its Tauri command as the backend issues land.
 */
export function createDesktopBackend(): Backend {
  const store = new SnapshotStore({
    server: { kind: "starting" },
    shares: [],
    settings: DEFAULT_SETTINGS,
    profiles: [HTTP_PROFILE],
    interfaces: [],
  });

  getAppInfo()
    .then(() => {
      store.set((s) => ({ ...s, server: { kind: "unavailable", message: NOT_YET } }));
    })
    .catch(() => {
      store.set((s) => ({
        ...s,
        server: { kind: "unavailable", message: "FileHop can't reach its desktop backend." },
      }));
    });

  return {
    mode: "desktop",
    getSnapshot: store.get,
    subscribe: store.subscribe,
    onEvent: store.onEvent,
    chooseFiles: unavailable,
    shareDropped: unavailable,
    shareAgain: unavailable,
    stopShare: unavailable,
    stopAll: unavailable,
    removeShare: unavailable,
    clearFinished: unavailable,
    setShareProfile: unavailable,
    async updateSettings(patch: Partial<Settings>): Promise<Result> {
      // Only the theme is a pure UI preference; it applies for this session until
      // the Rust settings service persists it.
      const { theme, ...rest } = patch;
      if (Object.keys(rest).length > 0) return { ok: false, error: NOT_YET };
      if (theme) store.set((s) => ({ ...s, settings: { ...s.settings, theme } }));
      return { ok: true, value: undefined };
    },
    saveProfile: unavailable,
    deleteProfile: unavailable,
    previewTemplate: (): Promise<TemplatePreview> => Promise.resolve({ ok: false, error: NOT_YET }),
    savePng: unavailable,
  };
}
