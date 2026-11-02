import { FilePlus2, FolderInput } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { DropZone } from "../../hooks/use-file-drop";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";

/**
 * Shown while files are dragged over a window that already has shares. It splits
 * the window into large, unambiguous zones: the left half always creates a new
 * link; the right half adds to the selected share when it is active. The zone
 * under the pointer lights up, so the drop result is visible before releasing.
 */
export function DragOverlay({
  visible,
  enabled,
  lifetimeMinutes,
  addTarget,
  zone,
}: {
  visible: boolean;
  enabled: boolean;
  lifetimeMinutes: number | null;
  /** The active, selected share the right zone adds to; `null` shows one zone. */
  addTarget: Share | null;
  zone: DropZone;
}) {
  const lasting = lifetimeMinutes === null ? "until you stop it" : `for ${lifetimeMinutes} minutes`;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.16 }}
          className="pointer-events-none fixed inset-0 z-40 flex gap-3 bg-bg/70 p-[13px] backdrop-blur-[3px]"
        >
          {!enabled ? (
            <Zone
              active={false}
              icon={FilePlus2}
              title="Sharing is unavailable"
              detail="Files can be shared again once the server is online."
            />
          ) : (
            <>
              <Zone
                active={zone === "new" || !addTarget}
                icon={FilePlus2}
                title={addTarget ? "New link" : "Drop to share"}
                detail={`All files go behind one new link ${lasting}.`}
              />
              {addTarget && (
                <Zone
                  active={zone === "add"}
                  icon={FolderInput}
                  title={`Add to “${addTarget.fileName}”`}
                  detail="Joins the selected link. Everyone with it sees the new files."
                />
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Zone({
  active,
  icon: Icon,
  title,
  detail,
}: {
  active: boolean;
  icon: typeof FilePlus2;
  title: string;
  detail: string;
}) {
  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.75 }}
      transition={{ duration: 0.15 }}
      className="relative flex min-w-0 flex-1 items-center justify-center"
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="16"
          fill={active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent"}
          strokeWidth="2"
          strokeDasharray="10 8"
          className={cn(
            "transition-[stroke,fill] duration-200",
            active ? "dash-march stroke-accent" : "stroke-line-strong",
          )}
        />
      </svg>
      <motion.div
        animate={{ scale: active ? 1 : 0.96, y: active ? 0 : 4 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className={cn(
          "relative mx-6 flex max-w-[300px] flex-col items-center gap-3 rounded-2xl border px-8 py-7 text-center",
          active
            ? "border-line bg-surface shadow-[var(--shadow-dialog)]"
            : "border-transparent bg-surface/85",
        )}
      >
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl transition-colors duration-200",
            active ? "float-y bg-accent-soft text-accent" : "bg-surface-muted text-muted",
          )}
        >
          <Icon aria-hidden="true" size={24} strokeWidth={1.6} />
        </span>
        <span className="line-clamp-2 text-[16px] leading-[21px] font-semibold break-words">
          {title}
        </span>
        <span className="text-[12.5px] text-muted">{detail}</span>
      </motion.div>
    </motion.div>
  );
}
