import type { InvokeArgs } from "@tauri-apps/api/core";
import type { DragDropEvent } from "@tauri-apps/api/webview";
import { vi } from "vitest";
import { DEFAULT_SETTINGS, HTTP_PROFILE } from "../lib/backend/defaults";

// Mock only the native transport. Tests run the production desktop adapter,
// schema validation, queries, store, hooks and components, never the demo backend.
const native = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: InvokeArgs) => Promise<unknown>>(),
  events: new Set<(event: { payload: unknown }) => void>(),
  drops: new Set<(event: { payload: DragDropEvent }) => void>(),
  unlistenDrop: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke, isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (name: string, callback: (event: { payload: unknown }) => void) => {
    if (name !== "mayfly://event") throw new Error("Unexpected native event subscription.");
    native.events.add(callback);
    return () => native.events.delete(callback);
  },
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (callback: (event: { payload: DragDropEvent }) => void) => {
      native.drops.add(callback);
      return () => {
        native.drops.delete(callback);
        native.unlistenDrop();
      };
    },
  }),
}));

export const invokeMock = native.invoke;
export const unlistenDropMock = native.unlistenDrop;

export function emitBackend(payload: unknown) {
  for (const callback of native.events) callback({ payload });
}

export function emitDrop(payload: DragDropEvent) {
  for (const callback of native.drops) callback({ payload });
}

export function resetTauri() {
  native.events.clear();
  native.drops.clear();
  native.invoke.mockReset();
  native.unlistenDrop.mockReset();
}

export type CommandHandlers = Record<string, (args: InvokeArgs | undefined) => unknown>;

export function respondToCommands(handlers: CommandHandlers = {}) {
  const queries: CommandHandlers = {
    get_server: () => ({
      kind: "online",
      address: "192.0.2.1",
      port: 8765,
      interfaceName: "Test Wi-Fi",
    }),
    get_settings: () => ({ ...DEFAULT_SETTINGS }),
    list_profiles: () => [{ ...HTTP_PROFILE }],
    list_interfaces: () => [{ id: "test-interface", name: "Test Wi-Fi", address: "192.0.2.1" }],
    list_shares: () => [],
    get_app_info: () => ({ name: "Mayfly", version: "0.0.0-test", build: null }),
    take_notice: () => null,
    ...handlers,
  };
  invokeMock.mockImplementation(async (command, args) => {
    const handler = queries[command];
    if (!handler) throw new Error("Unexpected native command in test.");
    return handler(args);
  });
}
