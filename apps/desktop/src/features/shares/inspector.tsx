import {
  CalendarClock,
  Download,
  ImageDown,
  Info,
  Link2,
  QrCode,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Select } from "../../components/ui/select";
import { Tooltip } from "../../components/ui/tooltip";
import { useNow } from "../../hooks/use-now";
import type { LinkProfile, Share } from "../../lib/backend";
import { HTTP_PROFILE_ID } from "../../lib/backend/types";
import { cn } from "../../lib/cn";
import {
  describeType,
  displayStatus,
  formatBytes,
  formatClock,
  remainingMs,
} from "../../lib/format";
import { CopyButton } from "./copy-button";
import { CountdownRing } from "./countdown-ring";
import { FileGlyph } from "./file-glyph";
import { QrCard } from "./qr-card";
import { RollingText } from "./rolling-text";
import { StatusChip } from "./status-chip";
import { StopButton } from "./stop-button";
import type { ShareActions } from "./use-share-actions";

function countdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function InspectorBody({
  share,
  profiles,
  actions,
  qrPulse,
  stopSignal,
  onClose,
}: {
  share: Share;
  profiles: LinkProfile[];
  actions: ShareActions;
  qrPulse: number;
  stopSignal: number;
  onClose: () => void;
}) {
  const now = useNow();
  const status = displayStatus(share, now);
  const ended = share.status !== "active";
  const left = remainingMs(share, now);
  const total = share.expiresAt === null ? null : share.expiresAt - share.createdAt;
  const profile = profiles.find((p) => p.id === share.profileId);
  const customScheme = Boolean(profile?.template) && !/^https?:/i.test(profile?.template ?? "");

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
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="tnum">
              {formatBytes(share.byteSize)} · {describeType(share)}
            </span>
          </div>
        </div>
        <IconButton icon={X} label="Close details" shortcut="Escape" onClick={onClose} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <QrCard share={share} pulse={qrPulse} onCopy={() => actions.copyQr(share)} />
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <QrCode aria-hidden="true" size={13} strokeWidth={1.6} />
          {ended ? "This code no longer opens the file" : "Scan with your phone's camera"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Select
          label="Link profile"
          value={share.profileId}
          disabled={ended}
          onValueChange={(id) => actions.setProfile(share, id)}
          prefix={<span className="w-14 text-[12px] text-muted">Profile</span>}
          options={profiles.map((p) => ({
            value: p.id,
            label: p.id === HTTP_PROFILE_ID ? "HTTP (default)" : p.name,
          }))}
        />
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
                  : (share.link ?? share.linkError ?? "Waiting for the network…")
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
            disabled={ended || !share.link}
            onCopy={() => actions.copyLink(share)}
          />
        </div>
        <AnimatePresence initial={false}>
          {customScheme && !ended && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-[12px] text-muted"
            >
              <span className="flex items-start gap-1.5 pt-0.5">
                <Link2 aria-hidden="true" size={13} className="mt-0.5 shrink-0" />A compatible app
                must be installed on the phone to open this link.
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg/60 p-3">
        <div className="flex items-center gap-2.5">
          {left !== null && total !== null && !ended ? (
            <CountdownRing progress={left / total} warning={status === "expiring"} />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-muted">
              <CalendarClock aria-hidden="true" size={16} strokeWidth={1.6} />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] text-muted">{ended ? "Ended" : "Expires"}</span>
            {ended ? (
              <span className="text-[13px] font-medium tnum">
                {share.endedAt ? formatClock(share.endedAt) : "—"}
              </span>
            ) : left === null ? (
              <span className="text-[13px] font-medium">When you stop it</span>
            ) : (
              <>
                <RollingText
                  text={countdown(left)}
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
        <Tooltip label="A download counts when it starts. A phone may still cancel it.">
          <div className="flex min-w-0 flex-col justify-center gap-1">
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Download aria-hidden="true" size={11} />
              Downloads
            </span>
            <span className="text-[13px] font-medium tnum">
              {share.downloadLimit === null ? (
                <>
                  {share.downloadCount}{" "}
                  <span className="text-[11px] font-normal text-muted">· no limit</span>
                </>
              ) : (
                <>
                  {share.downloadCount} of {share.downloadLimit}
                  <span className="text-[11px] font-normal text-muted"> reserved</span>
                </>
              )}
            </span>
            {share.downloadLimit !== null && (
              <span className="h-1 overflow-hidden rounded-full bg-surface-muted">
                <motion.span
                  className={cn(
                    "block h-full rounded-full",
                    status === "limitReached" ? "bg-danger" : "bg-accent",
                  )}
                  initial={false}
                  animate={{
                    width: `${Math.min(100, (share.downloadCount / share.downloadLimit) * 100)}%`,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </span>
            )}
          </div>
        </Tooltip>
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
            <Button variant="primary" className="flex-1" onClick={() => actions.shareAgain(share)}>
              <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
              Share again
            </Button>
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
                shortcut="Mod+Shift+C"
                disabled={!share.link}
                onCopy={() => actions.copyQr(share)}
              />
              <IconButton
                icon={ImageDown}
                size="icon"
                variant="secondary"
                label="Save QR as PNG"
                shortcut="Mod+S"
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
            : "Anyone with this link on your network can download the file until it expires."}
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
