import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { z } from "zod";
import { createEmitter } from "./emitter";
import {
  LinkProfileSchema,
  NetworkInterfaceSchema,
  ServerStateSchema,
  SettingsSchema,
  ShareSchema,
  StagedFilesSchema,
} from "./schemas";
import { type Backend, BackendError, type BackendEvent, type ServerState } from "./types";

/** The single channel Rust uses for change notifications. */
const EVENT = "filehop://event";

const NOT_YET = "This isn't available in this build yet.";

const unavailable = (message = NOT_YET): Promise<never> =>
  Promise.reject(new BackendError(message));

const BackendEventSchema: z.ZodType<BackendEvent> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("changed"),
    topics: z.array(z.enum(["server", "shares", "settings", "profiles", "interfaces"])),
  }),
  z.object({ kind: z.literal("addressChanged"), address: z.string() }),
]);

/**
 * Invokes a Rust command and validates its result. Rust errors are already
 * user-safe strings; anything else is replaced by a generic message.
 */
async function call<T>(command: string, schema: z.ZodType<T>, args?: InvokeArgs): Promise<T> {
  let result: unknown;
  try {
    result = await invoke(command, args);
  } catch (error) {
    throw new BackendError(typeof error === "string" ? error : "FileHop's backend didn't respond.");
  }
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new BackendError("FileHop received unexpected data from its backend.");
  return parsed.data;
}

const done = z.null();

/** Desktop adapter: every query and command goes to the Rust backend. */
export function createDesktopBackend(): Backend {
  const events = createEmitter();
  listen<unknown>(EVENT, (event) => {
    const parsed = BackendEventSchema.safeParse(event.payload);
    if (parsed.success) events.emit(parsed.data);
  }).catch(() => {
    // Without events the UI still refreshes after its own commands.
  });

  return {
    mode: "desktop",
    subscribe: events.subscribe,

    getServer: () =>
      call("get_server", ServerStateSchema).catch(
        (): ServerState => ({
          kind: "unavailable",
          message: "FileHop can't reach its desktop backend.",
        }),
      ),
    listShares: () => call("list_shares", z.array(ShareSchema)),
    getSettings: () => call("get_settings", SettingsSchema),
    listProfiles: () => call("list_profiles", z.array(LinkProfileSchema)),
    listInterfaces: () => call("list_interfaces", z.array(NetworkInterfaceSchema)),

    pickFiles: () => call("pick_files", StagedFilesSchema.nullable()),
    stageDropped(files) {
      if (files.kind !== "paths") return unavailable("Drop the files on the window again.");
      return call("stage_dropped", StagedFilesSchema, { paths: files.paths });
    },
    discardStaged: async (stageIds) => {
      await call("discard_staged", done, { stageIds });
    },
    createShares: (stageIds, options, grouping) =>
      call("create_shares", z.array(ShareSchema), { stageIds, options, grouping }),
    addFiles: (id, stageIds) => call("add_files", ShareSchema, { id, stageIds }),
    removeFile: (id, fileId) => call("remove_file", ShareSchema, { id, fileId }),
    shareAgain: (id, options) => call("share_again", ShareSchema, { id, options: options ?? null }),
    updateShare: (id, patch) => call("update_share", ShareSchema, { id, patch }),
    stopShare: async (id) => {
      await call("stop_share", done, { id });
    },
    stopAll: async () => {
      await call("stop_all", done);
    },
    removeShare: async (id) => {
      await call("remove_share", done, { id });
    },
    clearFinished: async () => {
      await call("clear_finished", done);
    },

    updateSettings: (patch) => call("update_settings", SettingsSchema, { patch }),
    saveProfile: () => unavailable("Custom link profiles aren't available in this build yet."),
    deleteProfile: () => unavailable("Custom link profiles aren't available in this build yet."),
    previewTemplate: async () => ({
      ok: false,
      error: "Custom link profiles aren't available in this build yet.",
    }),
    savePng: () => unavailable("Saving QR images isn't available in this build yet."),
  };
}
