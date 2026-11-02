import { useEffect, useRef } from "react";
import { isMac } from "../lib/platform";

export interface Hotkey {
  /** For example "Mod+O", "Mod+Shift+C", "Escape", "Delete". */
  keys: string;
  handler: (event: KeyboardEvent) => void;
  /** Also fire while focus is in a text field. */
  allowInInput?: boolean;
}

function matches(hotkey: string, event: KeyboardEvent): boolean {
  const parts = hotkey.split("+");
  const key = parts.at(-1)?.toLowerCase();
  const mod = parts.includes("Mod");
  const shift = parts.includes("Shift");
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  if (mod !== modPressed || shift !== event.shiftKey || event.altKey) return false;
  return event.key.toLowerCase() === key || (key === "," && event.key === ",");
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const modalOpen = document.querySelector("dialog[open], [role=menu]") !== null;
      for (const hotkey of ref.current) {
        if (!matches(hotkey.keys, event)) continue;
        if (modalOpen && hotkey.keys !== "Mod+,") return;
        if (!hotkey.allowInInput && isTextInput(event.target)) return;
        if (window.getSelection()?.toString() && hotkey.keys === "Mod+C") return;
        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
