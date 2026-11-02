import {
  Copy,
  Download,
  Ellipsis,
  Hash,
  ImageDown,
  Link2,
  QrCode,
  RotateCcw,
  Square,
  TimerReset,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import type { LinkProfile, Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import {
  displayStatus,
  formatBytes,
  formatClock,
  formatDownloads,
  formatRemaining,
  remainingMs,
} from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { CopyButton } from "./copy-button";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";
import { STATUS_LABEL, StatusChip } from "./status-chip";
import type { ShareActions } from "./use-share-actions";

function secondaryLine(share: Share, now: number): string {
  const size = formatBytes(share.byteSize);
  const at = share.endedAt ? formatClock(share.endedAt) : "";
  switch (share.status) {
    case "expired":
      return `${size} · Expired at ${at}`;
    case "stopped":
      return `${size} · Stopped at ${at}`;
    case "limitReached":
      return `${size} · Limit reached at ${at}`;
    case "active": {
      const left = remainingMs(share, now);
      return left === null ? `${size} · Until stopped` : `${size} · ${formatRemaining(left)} left`;
    }
  }
}

export function limitOptions(share: Share) {
  const min = share.downloadCount + 1;
  const values = [...new Set([1, 3, 5, 10, 25].map((n) => Math.max(n, min)))];
  return [
    { value: "none", label: "No limit" },
    ...values.map((n) => ({ value: String(n), label: n === 1 ? "1 download" : `${n} downloads` })),
  ];
}

export const EXTEND_OPTIONS = [
  { minutes: 5, label: "Add 5 minutes" },
  { minutes: 10, label: "Add 10 minutes" },
  { minutes: 30, label: "Add 30 minutes" },
  { minutes: 60, label: "Add 1 hour" },
] as const;

function focusSibling(current: HTMLElement, step: number | "first" | "last") {
  const rows = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-share-row]"));
  const index = rows.indexOf(current as HTMLButtonElement);
  const target = step === "first" ? rows[0] : step === "last" ? rows.at(-1) : rows[index + step];
  target?.focus();
  target?.click();
}

export const ShareRow = memo(function ShareRow({
  share,
  now,
  position,
  selected,
  fresh,
  profiles,
  actions,
  onSelect,
  onShowQr,
}: {
  share: Share;
  now: number;
  position: number;
  selected: boolean;
  fresh: boolean;
  profiles: LinkProfile[];
  actions: ShareActions;
  onSelect: (id: string) => void;
  onShowQr: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = displayStatus(share, now);
  const ended = share.status !== "active";
  const secondary = secondaryLine(share, now);
  const revealed = selected || menuOpen;
  const left = remainingMs(share, now);
  const lifetime = share.expiresAt === null ? null : share.expiresAt - share.createdAt;
  const progress =
    !ended && left !== null && lifetime ? Math.max(0, Math.min(1, left / lifetime)) : null;

  // The metadata column slides aside by exactly the width of the row's actions.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(96);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the actions change with the ended state.
  useLayoutEffect(() => {
    if (actionsRef.current) setActionsWidth(actionsRef.current.offsetWidth);
  }, [ended]);

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
    } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      setMenuOpen(true);
    }
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: 28,
        height: 0,
        marginBottom: 0,
        transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
      }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="mb-1"
    >
      <div
        className={cn(
          "group relative flex h-14 items-center gap-3 rounded-[10px] border px-3",
          "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out",
          selected
            ? "border-transparent bg-surface-muted shadow-[inset_0_0_0_1px_var(--border)]"
            : ended
              ? "border-transparent bg-transparent hover:bg-surface/70"
              : "border-line bg-surface hover:-translate-y-px hover:border-line-strong hover:shadow-[0_4px_14px_-6px_hsl(var(--shadow-color)/0.18)]",
          fresh && "row-arrive",
        )}
        style={{ "--actions-w": `${actionsWidth + 8}px` } as CSSProperties}
      >
        {selected && (
          <motion.span
            layoutId="row-selection"
            aria-hidden="true"
            className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-accent"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <button
          type="button"
          data-share-row
          data-share-id={share.id}
          aria-current={selected ? "true" : undefined}
          aria-label={`${share.fileName}, ${secondary}, ${STATUS_LABEL[status]}, ${formatDownloads(share)}`}
          onClick={() => onSelect(share.id)}
          onKeyDown={onKeyDown}
          onContextMenu={(event) => {
            event.preventDefault();
            onSelect(share.id);
            if (!ended) setMenuOpen(true);
          }}
          className="absolute inset-0 rounded-[10px] outline-offset-[-2px]"
        />
        <span className="pointer-events-none relative">
          <FileGlyph kind={share.kind} muted={ended} className={cn(selected && "bg-surface")} />
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
          <FileName
            name={share.fileName}
            className={cn("text-[13px] font-medium", ended ? "text-muted" : "text-fg")}
          />
          <span className="text-[12px] leading-4 text-muted tnum">{secondary}</span>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 transition-[margin] duration-300 ease-[var(--ease-out-soft)]",
            revealed
              ? "mr-[var(--actions-w)]"
              : "group-focus-within:mr-[var(--actions-w)] group-hover:mr-[var(--actions-w)]",
          )}
        >
          <Tooltip label="Downloads started. A download counts when it begins, not when the device saves it.">
            <span className="relative z-[1] flex w-[84px] items-center justify-end gap-1 text-[12px] whitespace-nowrap text-muted tnum">
              <Download aria-hidden="true" size={12} strokeWidth={1.8} className="opacity-70" />
              {formatDownloads(share)}
            </span>
          </Tooltip>
          <span className="pointer-events-none flex w-[108px] justify-end">
            <StatusChip status={status} />
          </span>
        </div>
        {progress !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 bottom-[5px] left-[60px] h-[2px] overflow-hidden rounded-full bg-line/60"
          >
            <span
              className={cn(
                "block h-full rounded-full transition-[width,background-color] duration-1000 ease-linear",
                status === "expiring" ? "bg-warning" : "bg-accent/70",
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        )}
        <div
          ref={actionsRef}
          className={cn(
            "absolute top-1/2 right-3 z-[1] flex -translate-y-1/2 items-center gap-0.5 transition-[opacity,translate] duration-200 ease-out",
            revealed
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-2 opacity-0 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100",
          )}
        >
          {ended ? (
            <>
              <Tooltip label="Share again" hotkey={appHotkeys["share.again"].hotkey}>
                <Button size="sm" variant="ghost" onClick={() => actions.shareAgain(share)}>
                  <RotateCcw aria-hidden="true" size={13} strokeWidth={1.8} />
                  Share again
                </Button>
              </Tooltip>
              <IconButton icon={Trash2} label="Remove" onClick={() => actions.remove(share)} />
            </>
          ) : (
            <>
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
                          {...(option.minutes === 10
                            ? { hotkey: appHotkeys["share.extend"].hotkey }
                            : {})}
                          onSelect={() => actions.extend(share, option.minutes)}
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem onSelect={() => actions.extend(share, null)}>
                        Keep until stopped
                      </MenuItem>
                    </MenuSubContent>
                  </MenuSub>
                  <MenuSub>
                    <MenuSubTrigger icon={Hash}>Download limit</MenuSubTrigger>
                    <MenuSubContent>
                      <MenuRadioGroup
                        value={share.downloadLimit === null ? "none" : String(share.downloadLimit)}
                        onValueChange={(v) =>
                          actions.setLimit(share, v === "none" ? null : Number(v))
                        }
                        options={limitOptions(share)}
                      />
                    </MenuSubContent>
                  </MenuSub>
                  <MenuSub>
                    <MenuSubTrigger icon={Link2}>Link profile</MenuSubTrigger>
                    <MenuSubContent>
                      <MenuRadioGroup
                        value={share.profileId}
                        onValueChange={(id) => actions.setProfile(share, id)}
                        options={profiles.map((p) => ({ value: p.id, label: p.name }))}
                      />
                    </MenuSubContent>
                  </MenuSub>
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
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
});
