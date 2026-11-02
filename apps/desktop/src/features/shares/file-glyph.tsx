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

export function FileGlyph({
  kind,
  muted,
  size = "md",
  className,
}: {
  kind: FileKind;
  muted?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-surface-muted transition-colors duration-200",
        size === "lg" ? "size-11 rounded-xl" : "size-9",
        muted ? "text-faint" : TINTS[kind],
        className,
      )}
    >
      <Icon size={size === "lg" ? 22 : 18} strokeWidth={1.6} />
    </span>
  );
}
