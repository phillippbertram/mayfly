import { FilePlus2, FolderInput } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import type { DropTarget } from "../../lib/drop-targets";

/**
 * Shown while files are dragged over a window that already has shares. Nothing
 * is blurred: the target is outlined where it is, so the user sees exactly what
 * the drop will do. An active share's row or the inspector adds to that share;
 * anywhere else the whole window is outlined for a new link.
 */
export function DragOverlay({
  visible,
  enabled,
  lifetimeMinutes,
  target,
  targetShare,
}: {
  visible: boolean;
  enabled: boolean;
  lifetimeMinutes: number | null;
  target: DropTarget;
  /** The share an "add" target points at, if it still exists and is active. */
  targetShare: Share | null;
}) {
  const rect = enabled && target.kind === "add" && targetShare ? target.rect : null;
  const inset = 8;
  const frame = rect
    ? { left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }
    : {
        left: inset,
        top: inset,
        width: window.innerWidth - inset * 2,
        height: window.innerHeight - inset * 2,
      };
  const lasting = lifetimeMinutes === null ? "until you stop it" : `for ${lifetimeMinutes} minutes`;
  const label = !enabled
    ? "Sharing is unavailable until the server is online"
    : rect
      ? `Add to “${targetShare?.fileName}”`
      : `New link ${lasting}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-40 bg-bg/15"
        >
          <motion.div
            initial={false}
            animate={frame}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            className={cn(
              "absolute rounded-[14px] border-2 border-dashed",
              enabled ? "border-accent" : "border-line-strong",
              rect ? "bg-accent-soft/45" : "bg-accent-soft/10",
            )}
          />
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14 }}
            style={
              rect
                ? {
                    left: rect.left + rect.width / 2,
                    top: Math.min(rect.bottom - 14, window.innerHeight - 48),
                  }
                : { left: "50%", bottom: 28 }
            }
            className="absolute -translate-x-1/2"
          >
            <span
              className={cn(
                "flex max-w-[min(420px,80vw)] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap shadow-[var(--shadow-pop)]",
                enabled ? "bg-accent text-accent-fg" : "bg-surface text-muted",
              )}
            >
              {rect ? (
                <FolderInput aria-hidden="true" size={14} className="shrink-0" />
              ) : (
                <FilePlus2 aria-hidden="true" size={14} className="shrink-0" />
              )}
              <span className="truncate">{label}</span>
            </span>
          </motion.div>
          {enabled && !rect && (
            <span className="absolute bottom-[68px] left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-2 py-0.5 text-[12px] whitespace-nowrap text-muted">
              Drop on an active link in the list to add files to it instead.
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
