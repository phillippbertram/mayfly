import { useHotkeys } from "@tanstack/react-hotkeys";
import type { Share } from "../../lib/backend";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import type { AppCommand } from "./use-commands";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** A menu or listbox owns plain keys while it is open. */
const menuOpen = () => document.querySelector("[role=menu], [role=listbox]") !== null;

/** Registers every global shortcut from the command list. */
export function AppHotkeys({ commands, shares }: { commands: AppCommand[]; shares: Share[] }) {
  useHotkeys([
    ...commands.flatMap((command) =>
      command.hotkeyId
        ? [
            {
              hotkey: appHotkeys[command.hotkeyId],
              callback: () => {
                if (!menuOpen()) command.run();
              },
              options: { enabled: command.enabled },
            },
          ]
        : [],
    ),
    // Delete works like Backspace for stopping a share.
    {
      hotkey: "Delete",
      callback: () => {
        if (!menuOpen()) commands.find((c) => c.id === "share.stop" && c.enabled)?.run();
      },
    },
    ...DIGITS.map((digit, i) => ({
      hotkey: digit,
      callback: () => {
        const share = shares[i];
        if (share && !menuOpen()) {
          useUi.getState().select(share.id);
          document.querySelector<HTMLElement>(`[data-share-id="${CSS.escape(share.id)}"]`)?.focus();
        }
      },
      options: { enabled: i < shares.length, meta: { name: `Select share ${digit}` } },
    })),
  ]);
  return null;
}
