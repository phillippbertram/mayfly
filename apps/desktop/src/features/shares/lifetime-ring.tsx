import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  Files,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";
import type { FileKind } from "../../lib/backend";
import { cn } from "../../lib/cn";

const ICONS: Record<FileKind, LucideIcon> = {
  image: FileImage,
  document: FileText,
  archive: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  other: File,
  bundle: Files,
};

const TINTS: Record<FileKind, string> = {
  image: "text-[#7c5cd6] dark:text-[#b7a4f5]",
  document: "text-[#3f6fd1] dark:text-[#8fb0f2]",
  archive: "text-[#a2641a] dark:text-[#e8b06a]",
  audio: "text-[#c2437b] dark:text-[#f19ac0]",
  video: "text-[#c24a3a] dark:text-[#f2998c]",
  other: "text-muted",
  bundle: "text-accent-strong",
};

/**
 * File icon inside a ring that empties as the share's lifetime runs out.
 * `progress` is the remaining fraction; `null` draws a calm full ring for
 * shares that last until stopped.
 */
export function LifetimeRing({
  kind,
  progress,
  warning,
  size = 44,
}: {
  kind: FileKind;
  progress: number | null;
  warning: boolean;
  size?: number;
}) {
  const stroke = 3;
  const r = (size - stroke) / 2 - 0.5;
  const c = 2 * Math.PI * r;
  const Icon = ICONS[kind];
  const value = progress === null ? 1 : Math.min(1, Math.max(0, progress));
  return (
    <span
      aria-hidden="true"
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className={cn(
            "transition-[stroke-dashoffset,stroke,opacity] duration-1000 ease-linear",
            warning ? "stroke-warning" : "stroke-accent",
            progress === null && "opacity-40",
          )}
        />
      </svg>
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-surface-muted transition-colors duration-200",
          TINTS[kind],
        )}
        style={{ inset: stroke + 3 }}
      >
        <Icon size={16} strokeWidth={1.7} />
      </span>
    </span>
  );
}
