import type { FileKind, Share } from "./backend/types";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 s";
  if (ms < MINUTE) return `${Math.ceil(ms / SECOND)} s`;
  if (ms < HOUR) return `${Math.ceil(ms / MINUTE)} min`;
  const hours = Math.floor(ms / HOUR);
  const minutes = Math.ceil((ms - hours * HOUR) / MINUTE);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function formatClock(epochMs: number): string {
  return clock.format(epochMs);
}

/** Below this, an active share is shown as expiring. */
export const EXPIRING_THRESHOLD_MS = 2 * MINUTE;

export type DisplayStatus = "active" | "expiring" | "expired" | "stopped" | "limitReached";

export function displayStatus(share: Share, now: number): DisplayStatus {
  if (share.status !== "active") return share.status;
  if (share.expiresAt !== null && share.expiresAt - now < EXPIRING_THRESHOLD_MS) return "expiring";
  return "active";
}

export function remainingMs(share: Share, now: number): number | null {
  return share.expiresAt === null ? null : Math.max(0, share.expiresAt - now);
}

export function formatDownloads(share: Share): string {
  if (share.downloadLimit !== null) return `${share.downloadCount} of ${share.downloadLimit}`;
  return share.downloadCount === 1 ? "1 download" : `${share.downloadCount} downloads`;
}

export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

const KIND_LABEL: Record<FileKind, string> = {
  image: "Image",
  document: "Document",
  archive: "Archive",
  audio: "Audio",
  video: "Video",
  other: "File",
};

export function describeType(share: Share): string {
  const { ext } = splitFileName(share.fileName);
  const label = KIND_LABEL[share.kind];
  return ext ? `${ext.slice(1).toUpperCase()} ${label.toLowerCase()}` : label;
}
