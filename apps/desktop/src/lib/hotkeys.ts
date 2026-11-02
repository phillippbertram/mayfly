import { defineAppHotkeys, formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys";

/**
 * Every keyboard shortcut in FileHop. The shortcut overview and the command
 * palette are generated from this list, so a shortcut exists in one place.
 */
export const appHotkeys = defineAppHotkeys({
  "palette.open": { hotkey: "Mod+K", meta: { name: "Command palette", group: "General" } },
  "shortcuts.open": { hotkey: "Mod+/", meta: { name: "Keyboard shortcuts", group: "General" } },
  "files.choose": { hotkey: "Mod+O", meta: { name: "Choose files to share", group: "General" } },
  "settings.open": { hotkey: "Mod+,", meta: { name: "Settings", group: "General" } },
  "theme.toggle": {
    hotkey: "Mod+Shift+L",
    meta: { name: "Switch light and dark", group: "General" },
  },

  "share.next": { hotkey: "J", meta: { name: "Next share", group: "Navigate" } },
  "share.previous": { hotkey: "K", meta: { name: "Previous share", group: "Navigate" } },
  "share.first": {
    hotkey: ["G", "G"],
    meta: { name: "First share", group: "Navigate" },
    options: { timeout: 700 },
  },
  "share.last": { hotkey: "Shift+G", meta: { name: "Last share", group: "Navigate" } },
  "inspector.toggle": { hotkey: "I", meta: { name: "Show or hide details", group: "Navigate" } },
  "inspector.close": { hotkey: "Escape", meta: { name: "Close details", group: "Navigate" } },

  "share.copyLink": { hotkey: "Mod+C", meta: { name: "Copy link", group: "Share" } },
  "share.copyQr": { hotkey: "Mod+Shift+C", meta: { name: "Copy QR image", group: "Share" } },
  "share.savePng": { hotkey: "Mod+S", meta: { name: "Save QR as PNG", group: "Share" } },
  "share.showQr": { hotkey: "Q", meta: { name: "Highlight QR code", group: "Share" } },
  "share.extend": { hotkey: "E", meta: { name: "Add 10 minutes", group: "Share" } },
  "share.limit": { hotkey: "L", meta: { name: "Change download limit", group: "Share" } },
  "share.profile": { hotkey: "P", meta: { name: "Change link profile", group: "Share" } },
  "share.again": { hotkey: "R", meta: { name: "Share again", group: "Share" } },
  "share.stop": { hotkey: "Backspace", meta: { name: "Stop sharing", group: "Share" } },
  "shares.clearFinished": {
    hotkey: "Mod+Backspace",
    meta: { name: "Clear finished shares", group: "Share" },
  },
  "shares.stopAll": {
    hotkey: "Mod+Shift+Backspace",
    meta: { name: "Stop all shares", group: "Share" },
  },

  "composer.share": {
    hotkey: "Mod+Enter",
    meta: { name: "Share with these options", group: "Share options" },
  },
});

declare module "@tanstack/react-hotkeys" {
  interface Register {
    appHotkeys: typeof appHotkeys;
  }
}

export type AppHotkeyId = keyof typeof appHotkeys;

export function hotkeyLabel(hotkey: Hotkey | null | undefined): string {
  return hotkey ? formatForDisplay(hotkey) : "";
}

export function labelFor(id: AppHotkeyId): string {
  return hotkeyLabel(appHotkeys[id].hotkey);
}
