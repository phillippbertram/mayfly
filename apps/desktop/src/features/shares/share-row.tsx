import {
  Clock,
  Copy,
  Ellipsis,
  FilePlus2,
  Hash,
  ImageDown,
  Infinity as InfinityIcon,
  Link2,
  Lock,
  Pencil,
  QrCode,
  RotateCcw,
  Square,
  TimerReset,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { type KeyboardEvent, memo, type ReactNode, useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../../components/ui/menu";
import { Tooltip } from "../../components/ui/tooltip";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import {
  describeType,
  displayStatus,
  formatBytes,
  formatClock,
  formatCountdown,
  formatDownloads,
  formatRemaining,
  remainingMs,
  STATUS_LABEL,
} from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { CopyButton } from "./copy-button";
import { DownloadMeter } from "./download-meter";
import { FileName } from "./file-name";
import { LifetimeRing } from "./lifetime-ring";
import { EXTEND_OPTIONS, limitOptions } from "./menu-options";
import type { ShareActions } from "./use-share-actions";

const ENDED_TEXT = {
  expired: "Gone",
  stopped: "Stopped",
  limitReached: "Limit reached",
} as const;

function focusSibling(current: HTMLElement, step: number | "first" | "last") {
  const rows = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-share-row]"));
  const index = rows.indexOf(current as HTMLButtonElement);
  const target = step === "first" ? rows[0] : step === "last" ? rows.at(-1) : rows[index + step];
  target?.focus();
  target?.click();
}

const rowMotion = {
  layout: "position" as const,
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    x: 28,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
  },
  transition: { type: "spring" as const, stiffness: 420, damping: 34 },
};

/** Invisible full-row button: selection, arrow-key navigation, and context menu. */
function RowButton({
  share,
  label,
  selected,
  onSelect,
  onMenu,
}: {
  share: Share;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onMenu?: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number | "first" | "last"> = {
      ArrowDown: 1,
      ArrowUp: -1,
      Home: "first",
      End: "last",
    };
    const step = keys[event.key];
    if (step !== undefined) {
      event.preventDefault();
      focusSibling(event.currentTarget, step);
    } else if (onMenu && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
      event.preventDefault();
      onMenu();
    }
  };
  return (
    <button
      type="button"
      data-share-row
      data-share-id={share.id}
      aria-current={selected ? "true" : undefined}
      aria-label={label}
      onClick={() => onSelect(share.id)}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect(share.id);
        onMenu?.();
      }}
      className="absolute inset-0 rounded-[12px] outline-offset-[-2px]"
    />
  );
}

function SelectionBar({ selected }: { selected: boolean }) {
  return selected ? (
    <motion.span
      layoutId="row-selection"
      aria-hidden="true"
      className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-accent"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    />
  ) : null;
}

function TimerPill({ share, now, warning }: { share: Share; now: number; warning: boolean }) {
  const left = remainingMs(share, now);
  const content: ReactNode =
    left === null ? (
      <>
        <InfinityIcon aria-hidden="true" size={13} strokeWidth={2} />
        Until stopped
      </>
    ) : (
      <>
        <Clock aria-hidden="true" size={12} strokeWidth={2} />
        {left < 3_600_000 ? formatCountdown(left) : formatRemaining(left)}
      </>
    );
  return (
    <Tooltip
      label={
        share.expiresAt === null
          ? "Shared until you stop it"
          : `Lives until ${formatClock(share.expiresAt)}`
      }
      hotkey={appHotkeys["share.extend"].hotkey}
    >
      <span
        className={cn(
          "relative z-[1] inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap tnum transition-colors duration-500",
          left === null
            ? "bg-surface-muted text-muted"
            : warning
              ? "bg-warning-soft text-warning-strong"
              : "bg-accent-soft text-accent-strong",
        )}
      >
        {content}
      </span>
    </Tooltip>
  );
}

function ActiveActions({
  share,
  actions,
  revealed,
  menuOpen,
  setMenuOpen,
  onShowQr,
}: {
  share: Share;
  actions: ShareActions;
  revealed: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onShowQr: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "relative z-[1] flex items-center gap-0.5 border-l border-line pl-1.5 transition-[opacity,translate] duration-200 ease-out",
        revealed
          ? "translate-x-0 opacity-100"
          : "translate-x-1 opacity-0 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100",
      )}
    >
      <CopyButton
        iconOnly
        variant="ghost"
        label="Copy link"
        copiedLabel="Link copied"
        hotkey={appHotkeys["share.copyLink"].hotkey}
        disabled={!share.link}
        onCopy={() => actions.copyLink(share)}
      />
      <IconButton
        icon={QrCode}
        label="Show QR code"
        hotkey={appHotkeys["share.showQr"].hotkey}
        onClick={() => onShowQr(share.id)}
      />
      <MenuRoot modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <Tooltip label="More actions">
          <MenuTrigger asChild>
            <Button aria-label="More actions" size="iconSm" variant="ghost">
              <Ellipsis aria-hidden="true" size={16} strokeWidth={1.6} />
            </Button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem
            icon={Copy}
            hotkey={appHotkeys["share.copyLink"].hotkey}
            onSelect={() => actions.copyLink(share)}
          >
            Copy link
          </MenuItem>
          <MenuItem
            icon={QrCode}
            hotkey={appHotkeys["share.copyQr"].hotkey}
            disabled={!share.link}
            onSelect={() => actions.copyQr(share)}
          >
            Copy QR image
          </MenuItem>
          <MenuItem
            icon={ImageDown}
            hotkey={appHotkeys["share.savePng"].hotkey}
            disabled={!share.link}
            onSelect={() => actions.saveQr(share)}
          >
            Save QR as PNG…
          </MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger icon={TimerReset}>Lifetime</MenuSubTrigger>
            <MenuSubContent>
              {EXTEND_OPTIONS.map((option) => (
                <MenuItem
                  key={option.minutes}
                  {...(option.minutes === 10 ? { hotkey: appHotkeys["share.extend"].hotkey } : {})}
                  onSelect={() => actions.extend(share, option.minutes)}
                >
                  {option.label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => actions.extend(share, null)}>Keep until stopped</MenuItem>
            </MenuSubContent>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger icon={Hash}>Download limit</MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup
                value={share.downloadLimit === null ? "none" : String(share.downloadLimit)}
                onValueChange={(v) => actions.setLimit(share, v === "none" ? null : Number(v))}
                options={limitOptions(share)}
              />
            </MenuSubContent>
          </MenuSub>
          <MenuSeparator />
          <MenuItem icon={FilePlus2} onSelect={() => actions.addFiles(share)}>
            Add files…
          </MenuItem>
          <MenuItem
            icon={Pencil}
            hotkey={appHotkeys["share.rename"].hotkey}
            onSelect={() => {
              useUi.getState().select(share.id);
              useUi.getState().startRename();
            }}
          >
            Rename…
          </MenuItem>
          <MenuItem
            icon={Link2}
            disabled={!share.zipLink || share.files.length < 2}
            onSelect={() => actions.copyZipLink(share)}
          >
            Copy ZIP link
          </MenuItem>
          {share.appLinks.map((app) => (
            <MenuItem
              key={app.profileId}
              icon={Link2}
              disabled={!app.link}
              onSelect={() => actions.copyAppLink(share, app.profileId)}
            >
              Copy link for {app.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            icon={Square}
            danger
            hotkey={appHotkeys["share.stop"].hotkey}
            onSelect={() => actions.stop(share)}
          >
            Stop sharing
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  );
}

interface RowProps {
  share: Share;
  now: number;
  position: number;
  selected: boolean;
  fresh: boolean;
  actions: ShareActions;
  onSelect: (id: string) => void;
  onShowQr: (id: string) => void;
}

/** An active share: lifetime ring, timer pill, download meter, and hover actions. */
export const ActiveShareRow = memo(function ActiveShareRow({
  share,
  now,
  position,
  selected,
  fresh,
  actions,
  onSelect,
  onShowQr,
}: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = displayStatus(share, now);
  const warning = status === "expiring";
  const left = remainingMs(share, now);
  const lifetime = share.expiresAt === null ? null : share.expiresAt - share.createdAt;
  const progress = left === null || !lifetime ? null : left / lifetime;
  const timeText = left === null ? "until stopped" : `${formatRemaining(left)} left`;

  return (
    <motion.li {...rowMotion} className="mb-1.5">
      <div
        // Files dragged onto an active row join that share.
        data-drop-share={share.id}
        className={cn(
          "group relative flex h-16 items-center gap-3.5 rounded-[12px] border pr-3 pl-3",
          "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out",
          selected
            ? "border-transparent bg-surface shadow-[inset_0_0_0_1px_var(--accent),0_6px_18px_-10px_hsl(var(--shadow-color)/0.35)]"
            : "border-line bg-surface hover:-translate-y-px hover:border-line-strong hover:shadow-[0_6px_18px_-10px_hsl(var(--shadow-color)/0.3)]",
          fresh && "row-arrive",
        )}
      >
        <SelectionBar selected={selected} />
        <RowButton
          share={share}
          label={`${share.fileName}, ${formatBytes(share.byteSize)}, ${share.protected ? "password protected, " : ""}${timeText}, ${STATUS_LABEL[status]}, ${formatDownloads(share)}`}
          selected={selected}
          onSelect={onSelect}
          onMenu={() => setMenuOpen(true)}
        />
        <span className="pointer-events-none relative">
          <LifetimeRing kind={share.kind} progress={progress} warning={warning} />
          {position <= 9 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -left-1 flex size-4 items-center justify-center rounded-[5px] border border-line bg-surface text-[10px] font-semibold text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              {position}
            </span>
          )}
        </span>
        <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
          <FileName name={share.fileName} className="text-[14px] leading-5 font-semibold" />
          <span className="flex min-w-0 items-center gap-1 text-[12px] leading-4 text-muted tnum">
            {share.protected && (
              <Lock aria-hidden="true" size={11} strokeWidth={2} className="shrink-0 text-accent" />
            )}
            <span className="truncate">
              {formatBytes(share.byteSize)} · {describeType(share)}
              {share.protected ? " · Password" : ""}
            </span>
          </span>
        </div>
        <TimerPill share={share} now={now} warning={warning} />
        <Tooltip label="Downloads started. A download counts when it begins, not when the device saves it.">
          <span className="relative z-[1]">
            <DownloadMeter share={share} warning={warning} />
          </span>
        </Tooltip>
        <ActiveActions
          share={share}
          actions={actions}
          revealed={selected || menuOpen}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onShowQr={onShowQr}
        />
      </div>
    </motion.li>
  );
});

const DOT = { expired: "bg-faint", stopped: "bg-faint", limitReached: "bg-danger" } as const;

/** A finished share: compact, muted, with Share again and Remove. */
export const FinishedShareRow = memo(function FinishedShareRow({
  share,
  position,
  selected,
  actions,
  onSelect,
}: Pick<RowProps, "share" | "position" | "selected" | "actions" | "onSelect">) {
  if (share.status === "active") return null;
  const ended = ENDED_TEXT[share.status];
  const detail = [
    ended,
    share.downloadLimit === null
      ? formatDownloads(share)
      : `${share.downloadCount} of ${share.downloadLimit}`,
    share.endedAt ? formatClock(share.endedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li {...rowMotion} className="border-b border-line/70 last:border-b-0">
      <div
        className={cn(
          "group relative flex h-[42px] items-center gap-3 pr-2 pl-3.5 transition-colors duration-150",
          selected ? "bg-surface-muted" : "hover:bg-surface/70",
        )}
      >
        <SelectionBar selected={selected} />
        <RowButton
          share={share}
          label={`${share.fileName}, ${detail}`}
          selected={selected}
          onSelect={onSelect}
        />
        <span
          aria-hidden="true"
          className={cn("relative size-2 shrink-0 rounded-full", DOT[share.status])}
        >
          {position <= 9 && (
            <span className="absolute -top-2.5 -left-2.5 hidden size-4 items-center justify-center rounded-[5px] border border-line bg-surface text-[10px] font-semibold text-faint group-hover:flex">
              {position}
            </span>
          )}
        </span>
        <span className="pointer-events-none flex min-w-0 flex-1 items-baseline gap-2">
          <FileName name={share.fileName} className="text-[13px] text-muted" />
          <span className="shrink-0 text-[12px] text-faint tnum">
            {formatBytes(share.byteSize)}
          </span>
        </span>
        <span
          className={cn(
            "pointer-events-none shrink-0 text-[12px] tnum",
            share.status === "limitReached" ? "text-danger" : "text-faint",
          )}
        >
          {detail}
        </span>
        <div
          className={cn(
            "relative z-[1] flex items-center gap-0.5 transition-opacity duration-200",
            selected
              ? "opacity-100"
              : "opacity-60 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <Tooltip label="Share again" hotkey={appHotkeys["share.again"].hotkey}>
            <Button
              size="sm"
              variant="ghost"
              className="text-fg"
              onClick={() => actions.shareAgain(share)}
            >
              <RotateCcw aria-hidden="true" size={13} strokeWidth={1.8} />
              Share again
            </Button>
          </Tooltip>
          <IconButton icon={Trash2} label="Remove" onClick={() => actions.remove(share)} />
        </div>
      </div>
    </motion.li>
  );
});
