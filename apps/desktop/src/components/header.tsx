import { SlidersHorizontal } from "lucide-react";
import type { ServerState } from "../lib/backend";
import { cn } from "../lib/cn";
import { hasOverlayTitleBar } from "../lib/platform";
import { BrandMark } from "./brand-mark";
import { StatusPill } from "./status-pill";
import { IconButton } from "./ui/icon-button";

export function Header({
  server,
  onOpenSettings,
  onOpenNetwork,
}: {
  server: ServerState;
  onOpenSettings: () => void;
  onOpenNetwork: () => void;
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
          FileHop
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
      <IconButton
        icon={SlidersHorizontal}
        label="Settings"
        shortcut="Mod+,"
        size="icon"
        tooltipSide="bottom"
        onClick={onOpenSettings}
      />
    </header>
  );
}
