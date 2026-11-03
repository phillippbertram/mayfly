import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FilePlus2,
  Hash,
  ImageDown,
  Info,
  Keyboard,
  Link2,
  type LucideIcon,
  Moon,
  OctagonX,
  PanelRight,
  Pencil,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  Square,
  SunMoon,
  TimerReset,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { useToast } from "../../components/ui/toast";
import type { Share } from "../../lib/backend";
import type { AppHotkeyId } from "../../lib/hotkeys";
import { useServer, useSettings, useUpdateSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";
import type { ShareActions } from "../shares/use-share-actions";

export interface AppCommand {
  id: string;
  label: string;
  group: "Share" | "Navigate" | "General";
  icon: LucideIcon;
  hotkeyId?: AppHotkeyId;
  keywords?: string[];
  enabled: boolean;
  run: () => void;
}

function revealRow(id: string) {
  requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`[data-share-id="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    row?.focus({ preventScroll: true });
  });
}

/**
 * Every user command in one list. Hotkeys, the command palette, and the shortcut
 * overview are all generated from it.
 */
export function useCommands(shares: Share[], actions: ShareActions): AppCommand[] {
  const ui = useUi();
  const toast = useToast();
  const server = useServer().data;
  const updateSettings = useUpdateSettings();
  const { hideCodes } = useSettings();
  const online = server?.kind === "online";
  const selected = shares.find((s) => s.id === ui.selectedId) ?? null;
  const active = selected?.status === "active" ? selected : null;
  const ended = selected && selected.status !== "active" ? selected : null;
  const anyActive = shares.some((s) => s.status === "active");
  const qrVisible = active ? (ui.qrVisibility[active.id] ?? !hideCodes) : true;
  const anyFinished = shares.some((s) => s.status !== "active");

  return useMemo(() => {
    const index = shares.findIndex((s) => s.id === ui.selectedId);
    const go = (target: Share | undefined) => {
      if (!target) return;
      ui.select(target.id, false);
      revealRow(target.id);
    };

    const commands: AppCommand[] = [
      {
        id: "files.choose",
        hotkeyId: "files.choose",
        label: "Choose files to share…",
        group: "General",
        icon: FilePlus2,
        keywords: ["add", "new", "upload", "open"],
        enabled: online,
        run: () => actions.chooseFiles(),
      },
      {
        id: "shares.newEmpty",
        hotkeyId: "shares.newEmpty",
        label: "New empty link",
        group: "General",
        icon: Link2,
        keywords: ["empty", "new", "drop", "collection", "folder"],
        enabled: online,
        run: () => actions.newEmptyShare(),
      },
      {
        id: "palette.open",
        hotkeyId: "palette.open",
        label: "Command palette",
        group: "General",
        icon: Search,
        enabled: true,
        run: () => ui.setOverlay(ui.overlay === "palette" ? null : "palette"),
      },
      {
        id: "shortcuts.open",
        hotkeyId: "shortcuts.open",
        label: "Keyboard shortcuts",
        group: "General",
        icon: Keyboard,
        keywords: ["help", "keys", "hotkeys"],
        enabled: true,
        run: () => ui.setOverlay("shortcuts"),
      },
      {
        id: "settings.open",
        hotkeyId: "settings.open",
        label: "Open settings",
        group: "General",
        icon: Settings2,
        keywords: ["preferences", "port", "network", "profiles"],
        enabled: true,
        run: () => ui.openSettings(),
      },
      {
        id: "about.open",
        label: "About FileHop",
        group: "General",
        icon: Info,
        keywords: ["version", "github", "help", "website"],
        enabled: true,
        run: () => ui.setOverlay("about"),
      },
      {
        id: "theme.toggle",
        hotkeyId: "theme.toggle",
        label: "Switch light and dark",
        group: "General",
        icon: SunMoon,
        keywords: ["theme", "appearance", "dark mode"],
        enabled: true,
        run: () =>
          updateSettings.mutate({
            theme: document.documentElement.dataset.theme === "dark" ? "light" : "dark",
          }),
      },
      {
        id: "theme.system",
        label: "Follow system appearance",
        group: "General",
        icon: Moon,
        keywords: ["theme", "auto"],
        enabled: true,
        run: () => updateSettings.mutate({ theme: "system" }),
      },
      {
        id: "share.next",
        hotkeyId: "share.next",
        label: "Next share",
        group: "Navigate",
        icon: ChevronDown,
        enabled: shares.length > 0,
        run: () => go(shares[Math.min(shares.length - 1, index + 1)] ?? shares[0]),
      },
      {
        id: "share.previous",
        hotkeyId: "share.previous",
        label: "Previous share",
        group: "Navigate",
        icon: ChevronUp,
        enabled: shares.length > 0,
        run: () => go(shares[Math.max(0, index - 1)] ?? shares[0]),
      },
      {
        id: "share.first",
        hotkeyId: "share.first",
        label: "First share",
        group: "Navigate",
        icon: ArrowUpToLine,
        enabled: shares.length > 0,
        run: () => go(shares[0]),
      },
      {
        id: "share.last",
        hotkeyId: "share.last",
        label: "Last share",
        group: "Navigate",
        icon: ArrowDownToLine,
        enabled: shares.length > 0,
        run: () => go(shares.at(-1)),
      },
      {
        id: "inspector.toggle",
        hotkeyId: "inspector.toggle",
        label: ui.inspectorOpen ? "Hide details" : "Show details",
        group: "Navigate",
        icon: PanelRight,
        enabled: selected !== null,
        run: () => ui.setInspectorOpen(!ui.inspectorOpen),
      },
      {
        id: "inspector.close",
        hotkeyId: "inspector.close",
        label: "Close details",
        group: "Navigate",
        icon: X,
        enabled: ui.inspectorOpen,
        run: () => ui.setInspectorOpen(false),
      },
      {
        id: "share.copyLink",
        hotkeyId: "share.copyLink",
        label: "Copy link",
        group: "Share",
        icon: Copy,
        enabled: Boolean(active?.link),
        run: async () => {
          if (active && (await actions.copyLink(active))) toast("Link copied.", "success");
        },
      },
      {
        id: "share.copyQr",
        hotkeyId: "share.copyQr",
        label: "Copy QR image",
        group: "Share",
        icon: QrCode,
        enabled: Boolean(active?.link),
        run: async () => {
          if (active && (await actions.copyQr(active))) toast("QR image copied.", "success");
        },
      },
      {
        id: "share.savePng",
        hotkeyId: "share.savePng",
        label: "Save QR as PNG…",
        group: "Share",
        icon: ImageDown,
        enabled: Boolean(active?.link),
        run: () => active && actions.saveQr(active),
      },
      {
        id: "share.showQr",
        hotkeyId: "share.showQr",
        label: "Highlight QR code",
        group: "Share",
        icon: QrCode,
        enabled: active !== null,
        run: () => ui.pulseQr(),
      },
      {
        id: "qr.toggle",
        hotkeyId: "qr.toggle",
        label: qrVisible ? "Hide QR code" : "Show QR code",
        group: "Share",
        icon: qrVisible ? EyeOff : Eye,
        keywords: ["blur", "privacy", "screen sharing", "reveal"],
        enabled: active?.link != null,
        run: () => active && ui.setQrVisible(active.id, !qrVisible),
      },
      {
        id: "qr.hideAll",
        hotkeyId: "qr.hideAll",
        label: hideCodes ? "Show QR codes and links by default" : "Hide all QR codes and links",
        group: "Share",
        icon: hideCodes ? Eye : EyeOff,
        keywords: ["blur", "privacy", "presenting", "screen sharing"],
        enabled: true,
        run: () => {
          ui.resetQrVisibility();
          updateSettings.mutate({ hideCodes: !hideCodes });
          toast(
            hideCodes ? "QR codes and links are visible." : "QR codes and links are hidden.",
            "success",
          );
        },
      },
      {
        id: "share.extend",
        hotkeyId: "share.extend",
        label: "Add 10 minutes",
        group: "Share",
        icon: TimerReset,
        keywords: ["extend", "longer", "time"],
        enabled: active?.expiresAt != null,
        run: () => active && actions.extend(active, 10),
      },
      {
        id: "share.limit",
        hotkeyId: "share.limit",
        label: "Change download limit…",
        group: "Share",
        icon: Hash,
        enabled: active !== null,
        run: () => ui.openLimitMenu(),
      },
      {
        id: "share.rename",
        hotkeyId: "share.rename",
        label: "Rename this link…",
        group: "Share",
        icon: Pencil,
        keywords: ["title", "name"],
        enabled: active !== null,
        run: () => ui.startRename(),
      },
      {
        id: "share.addFiles",
        hotkeyId: "share.addFiles",
        label: "Add files to this link…",
        group: "Share",
        icon: FilePlus2,
        keywords: ["add", "more", "drop"],
        enabled: active !== null && online,
        run: () => active && actions.addFiles(active),
      },
      {
        id: "share.copyZip",
        label: "Copy ZIP link",
        group: "Share",
        icon: Link2,
        keywords: ["zip", "all", "download"],
        enabled: active !== null && active.files.length > 1 && Boolean(active.zipLink),
        run: () => active && actions.copyZipLink(active),
      },
      {
        id: "share.again",
        hotkeyId: "share.again",
        label: "Share again",
        group: "Share",
        icon: RotateCcw,
        enabled: ended !== null && online,
        run: () => ended && actions.shareAgain(ended),
      },
      {
        id: "share.stop",
        hotkeyId: "share.stop",
        label: "Stop sharing…",
        group: "Share",
        icon: Square,
        keywords: ["revoke", "end", "delete"],
        enabled: active !== null,
        run: () => ui.armStop(),
      },
      {
        id: "shares.clearFinished",
        hotkeyId: "shares.clearFinished",
        label: "Clear finished shares",
        group: "Share",
        icon: Eraser,
        enabled: anyFinished,
        run: () => actions.clearFinished(),
      },
      {
        id: "shares.stopAll",
        hotkeyId: "shares.stopAll",
        label: "Stop all shares…",
        group: "Share",
        icon: OctagonX,
        enabled: anyActive,
        run: () => ui.setOverlay("stopAll"),
      },
    ];
    return commands;
  }, [
    shares,
    ui,
    actions,
    online,
    selected,
    active,
    ended,
    anyActive,
    anyFinished,
    toast,
    updateSettings,
    hideCodes,
    qrVisible,
  ]);
}
