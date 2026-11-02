import { getAppInfo } from "../desktop";
import { DEFAULT_SETTINGS, HTTP_PROFILE } from "./defaults";
import { createEmitter } from "./emitter";
import { type Backend, BackendError, type ServerState, type Settings } from "./types";

const NOT_YET = "Sharing isn't available in this build yet.";

const unavailable = (): Promise<never> => Promise.reject(new BackendError(NOT_YET));

/**
 * Desktop adapter. The Rust share, server, and network services do not exist yet,
 * so it reports that truthfully instead of pretending to be online. As each
 * backend issue lands, replace a method with `invoke(...)` and parse the result
 * with its schema from `./schemas`.
 */
export function createDesktopBackend(): Backend {
  const events = createEmitter();
  let settings: Settings = DEFAULT_SETTINGS;

  const server: Promise<ServerState> = getAppInfo().then(
    (): ServerState => ({ kind: "unavailable", message: NOT_YET }),
    (): ServerState => ({
      kind: "unavailable",
      message: "FileHop can't reach its desktop backend.",
    }),
  );

  return {
    mode: "desktop",
    subscribe: events.subscribe,
    getServer: () => server,
    listShares: async () => [],
    getSettings: async () => settings,
    listProfiles: async () => [HTTP_PROFILE],
    listInterfaces: async () => [],
    pickFiles: unavailable,
    stageDropped: unavailable,
    discardStaged: async () => {},
    createShares: unavailable,
    shareAgain: unavailable,
    updateShare: unavailable,
    stopShare: unavailable,
    stopAll: unavailable,
    removeShare: unavailable,
    clearFinished: unavailable,
    async updateSettings(patch) {
      // Only the theme is a pure UI preference; it applies for this session until
      // the Rust settings service persists it.
      const { theme, ...rest } = patch;
      if (Object.keys(rest).length > 0) throw new BackendError(NOT_YET);
      if (theme) settings = { ...settings, theme };
      events.emit({ kind: "changed", topics: ["settings"] });
      return settings;
    },
    saveProfile: unavailable,
    deleteProfile: unavailable,
    previewTemplate: async () => ({ ok: false, error: NOT_YET }),
    savePng: unavailable,
  };
}
