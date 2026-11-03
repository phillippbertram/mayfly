import { Command, SlidersHorizontal } from "lucide-react";
import type { ServerState } from "../lib/backend";
import { cn } from "../lib/cn";
import { appHotkeys } from "../lib/hotkeys";
import { hasOverlayTitleBar } from "../lib/platform";
import { BrandMark } from "./brand-mark";
import { StatusPill } from "./status-pill";
import { IconButton } from "./ui/icon-button";
import { Kbd } from "./ui/kbd";
import { Tooltip } from "./ui/tooltip";

export function Header({
  server,
  onOpenSettings,
  onOpenNetwork,
  onOpenPalette,
}: {
  server: ServerState;
  onOpenSettings: () => void;
  onOpenNetwork: () => void;
  onOpenPalette: () => void;
}) {
  return (
    <header
      data-tauri-drag-region
      className={cn(
        "relative z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-bg/80 pr-3 backdrop-blur-md",
        hasOverlayTitleBar ? "pl-[86px]" : "pl-4",
      )}
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <BrandMark />
        <span data-tauri-drag-region className="text-[15px] font-semibold tracking-[-0.01em]">
          mayfly
        </span>
      </div>
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 flex justify-center pointer-events-none"
      >
        <div className="pointer-events-auto">
          <StatusPill server={server} onOpen={onOpenNetwork} />
        </div>
      </div>
      <div data-tauri-drag-region className="flex-1" />
      <Tooltip label="Search shares and commands" side="bottom">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex h-7 items-center gap-2 rounded-md border border-line bg-surface pr-1.5 pl-2 text-[12px] text-muted transition-[border-color,color,box-shadow] duration-150 hover:border-line-strong hover:text-fg hover:shadow-[var(--shadow-pop)]"
        >
          <Command
            aria-hidden="true"
            size={13}
            strokeWidth={1.8}
            className="transition-transform duration-300 group-hover:rotate-90"
          />
          Commands
          <Kbd hotkey={appHotkeys["palette.open"].hotkey} />
        </button>
      </Tooltip>
      <IconButton
        icon={SlidersHorizontal}
        label="Settings"
        hotkey={appHotkeys["settings.open"].hotkey}
        size="icon"
        tooltipSide="bottom"
        onClick={onOpenSettings}
      />
    </header>
  );
}
