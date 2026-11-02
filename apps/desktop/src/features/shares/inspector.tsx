import type { Hotkey } from "@tanstack/react-hotkeys";
import {
  CalendarClock,
  ChevronDown,
  Download,
  FileArchive,
  ImageDown,
  Info,
  QrCode,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { MenuContent, MenuItem, MenuRadioGroup, MenuSeparator } from "../../components/ui/menu";
import { Tooltip } from "../../components/ui/tooltip";
import { useNow } from "../../hooks/use-now";
import { maskLink, useQrVisible } from "../../hooks/use-qr-visible";
import { useSignal } from "../../hooks/use-signal";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import {
  describeType,
  displayStatus,
  formatBytes,
  formatClock,
  formatCountdown,
  remainingMs,
} from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { CopyButton } from "./copy-button";
import { CountdownRing } from "./countdown-ring";
import { FileGlyph } from "./file-glyph";
import { QrCard } from "./qr-card";
import { RollingText } from "./rolling-text";
import { ShareFiles } from "./share-files";
import { EXTEND_OPTIONS, limitOptions } from "./share-row";
import { StatusChip } from "./status-chip";
import { StopButton } from "./stop-button";
import type { ShareActions } from "./use-share-actions";

/** Opens when `signal` increments, so a shortcut can pop the menu open. */
function useSignalledOpen(signal: number) {
  const [open, setOpen] = useState(false);
  useSignal(signal, () => setOpen(true));
  return [open, setOpen] as const;
}

function DetailMenu({
  label,
  hotkey,
  open,
  onOpenChange,
  disabled,
  children,
}: {
  label: string;
  hotkey: Hotkey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Tooltip label={label} hotkey={hotkey}>
        <DropdownMenu.Trigger
          disabled={disabled}
          className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium text-accent-strong transition-colors hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-0 data-[state=open]:bg-accent-soft"
        >
          {label}
          <ChevronDown aria-hidden="true" size={12} />
        </DropdownMenu.Trigger>
      </Tooltip>
      <MenuContent align="start">{children}</MenuContent>
    </DropdownMenu.Root>
  );
}

export function InspectorBody({
  share,
  actions,
  onClose,
}: {
  share: Share;
  actions: ShareActions;
  onClose: () => void;
}) {
  const now = useNow();
  const qrPulse = useUi((s) => s.qrPulse);
  const stopSignal = useUi((s) => s.stopSignal);
  const [limitOpen, setLimitOpen] = useSignalledOpen(useUi((s) => s.limitMenuSignal));
  const [extendOpen, setExtendOpen] = useState(false);

  const status = displayStatus(share, now);
  const qrVisible = useQrVisible(share.id);
  const setQrVisible = useUi((s) => s.setQrVisible);
  const ended = share.status !== "active";
  const left = remainingMs(share, now);
  const total = share.expiresAt === null ? null : share.expiresAt - share.createdAt;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <FileGlyph kind={share.kind} size="lg" muted={ended} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <h2
            id="inspector-title"
            className="selectable line-clamp-2 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] break-all"
          >
            {share.fileName}
          </h2>
          <span className="text-[12px] text-muted tnum">
            {formatBytes(share.byteSize)} · {describeType(share)}
          </span>
        </div>
        <IconButton
          icon={X}
          label="Close details"
          hotkey={appHotkeys["inspector.close"].hotkey}
          onClick={onClose}
        />
      </div>

      <ShareFiles share={share} actions={actions} />

      <div className="flex flex-col items-center gap-2">
        <QrCard
          share={share}
          pulse={qrPulse}
          visible={qrVisible}
          onToggleVisible={() => setQrVisible(share.id, !qrVisible)}
          onCopy={() => actions.copyQr(share)}
        />
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <QrCode aria-hidden="true" size={13} strokeWidth={1.6} />
          {ended ? "This code no longer opens the file" : "Scan with any camera, or open the link"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className={cn(
            "flex h-8 items-center gap-2 rounded-md border border-line bg-surface pr-0.5 pl-2.5 transition-opacity",
            ended && "opacity-60",
          )}
        >
          <span className="w-14 shrink-0 text-[12px] text-muted">Link</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.input
              key={share.link ?? "none"}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15 }}
              readOnly
              aria-label="Share link"
              value={
                ended
                  ? "Link no longer works"
                  : share.link
                    ? qrVisible
                      ? share.link
                      : maskLink(share.link)
                    : "Waiting for the network…"
              }
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-fg outline-none"
            />
          </AnimatePresence>
          <CopyButton
            iconOnly
            variant="ghost"
            label="Copy link"
            copiedLabel="Link copied"
            hotkey={appHotkeys["share.copyLink"].hotkey}
            disabled={ended || !share.link}
            onCopy={() => actions.copyLink(share)}
          />
        </div>
        {!ended && share.files.length > 1 && (
          <CopyButton
            icon={FileArchive}
            variant="ghost"
            size="sm"
            className="self-start"
            label="Copy ZIP link"
            copiedLabel="ZIP link copied"
            disabled={!share.zipLink}
            onCopy={() => actions.copyZipLink(share)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg/60 p-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">{ended ? "Ended" : "Expires"}</span>
            <DetailMenu
              label="Extend"
              hotkey={appHotkeys["share.extend"].hotkey}
              open={extendOpen}
              onOpenChange={setExtendOpen}
              disabled={ended}
            >
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
            </DetailMenu>
          </div>
          <div className="flex items-center gap-2.5">
            {left !== null && total !== null && !ended ? (
              <CountdownRing progress={left / total} warning={status === "expiring"} />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted">
                <CalendarClock aria-hidden="true" size={16} strokeWidth={1.6} />
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              {ended ? (
                <span className="text-[13px] font-medium tnum">
                  {share.endedAt ? formatClock(share.endedAt) : "—"}
                </span>
              ) : left === null ? (
                <span className="text-[13px] font-medium">When you stop it</span>
              ) : (
                <>
                  <RollingText
                    text={formatCountdown(left)}
                    className={cn(
                      "text-[15px] leading-5 font-semibold tnum",
                      status === "expiring" && "text-warning",
                    )}
                  />
                  <span className="text-[11px] whitespace-nowrap text-muted tnum">
                    until {share.expiresAt ? formatClock(share.expiresAt) : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Download aria-hidden="true" size={11} />
              Downloads
            </span>
            <DetailMenu
              label="Limit"
              hotkey={appHotkeys["share.limit"].hotkey}
              open={limitOpen}
              onOpenChange={setLimitOpen}
              disabled={ended}
            >
              <MenuRadioGroup
                value={share.downloadLimit === null ? "none" : String(share.downloadLimit)}
                onValueChange={(v) => actions.setLimit(share, v === "none" ? null : Number(v))}
                options={limitOptions(share)}
              />
            </DetailMenu>
          </div>
          <Tooltip label="A download counts when it starts. A phone may still cancel it.">
            <div className="flex flex-col gap-1.5">
              <span className="text-[15px] leading-5 font-semibold tnum">
                <RollingText text={String(share.downloadCount)} />
                <span className="text-[11px] font-normal text-muted">
                  {share.downloadLimit === null ? " · no limit" : ` of ${share.downloadLimit}`}
                </span>
              </span>
              <span className="h-1 overflow-hidden rounded-full bg-surface-muted">
                <motion.span
                  className={cn(
                    "block h-full rounded-full",
                    status === "limitReached" ? "bg-danger" : "bg-accent",
                  )}
                  initial={false}
                  animate={{
                    width:
                      share.downloadLimit === null
                        ? "0%"
                        : `${Math.min(100, (share.downloadCount / share.downloadLimit) * 100)}%`,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </span>
            </div>
          </Tooltip>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {ended ? (
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2"
          >
            <Tooltip
              label="Share again with the default options"
              hotkey={appHotkeys["share.again"].hotkey}
            >
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => actions.shareAgain(share)}
              >
                <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
                Share again
              </Button>
            </Tooltip>
            <Button onClick={() => actions.remove(share)}>
              <Trash2 aria-hidden="true" size={15} strokeWidth={1.6} />
              Remove
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-1.5">
              <CopyButton
                variant="primary"
                className="flex-1"
                label="Copy link"
                copiedLabel="Link copied"
                disabled={!share.link}
                onCopy={() => actions.copyLink(share)}
              />
              <CopyButton
                iconOnly
                size="icon"
                icon={QrCode}
                label="Copy QR image"
                copiedLabel="QR image copied"
                hotkey={appHotkeys["share.copyQr"].hotkey}
                disabled={!share.link}
                onCopy={() => actions.copyQr(share)}
              />
              <IconButton
                icon={ImageDown}
                size="icon"
                variant="secondary"
                label="Save QR as PNG"
                hotkey={appHotkeys["share.savePng"].hotkey}
                disabled={!share.link}
                onClick={() => actions.saveQr(share)}
              />
            </div>
            <StopButton armedSignal={stopSignal} onStop={() => actions.stop(share)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-2 text-[12px] text-muted">
        <Info aria-hidden="true" size={14} strokeWidth={1.6} className="mt-px shrink-0" />
        <span>
          {ended
            ? "This link no longer works. Share again to create a new link."
            : "Anyone with this link on your network can download its files until it expires, including files you add later."}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span className="tnum">Created {formatClock(share.createdAt)}</span>
        <StatusChip status={status} />
      </div>
    </div>
  );
}

/** Wide windows: a 360-point panel that grows in beside the list. */
export function InspectorPanel(props: Parameters<typeof InspectorBody>[0]) {
  return (
    <motion.aside
      aria-labelledby="inspector-title"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="relative shrink-0 overflow-hidden border-l border-line bg-surface"
    >
      <div className="h-full w-[360px] overflow-y-auto px-5 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={props.share.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <InspectorBody {...props} />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
