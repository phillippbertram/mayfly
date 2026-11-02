import { FilePlus2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { DropTarget } from "../../hooks/use-file-drop";

export function DragOverlay({
  visible,
  enabled,
  lifetimeMinutes,
  target,
}: {
  visible: boolean;
  enabled: boolean;
  lifetimeMinutes: number | null;
  /** A collection under the pointer: the drop adds files to it instead. */
  target: DropTarget | null;
}) {
  if (visible && target) return <CollectionTarget target={target} />;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.16 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg/55 backdrop-blur-[3px]"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-[13px] h-[calc(100%-26px)] w-[calc(100%-26px)] overflow-visible"
          >
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              rx="16"
              fill="color-mix(in srgb, var(--accent) 6%, transparent)"
              strokeWidth="2"
              strokeDasharray="10 8"
              className={enabled ? "dash-march stroke-accent" : "stroke-line-strong"}
            />
          </svg>
          <motion.div
            initial={{ scale: 0.9, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-10 py-8 text-center shadow-[var(--shadow-dialog)]"
          >
            <span className="float-y flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <FilePlus2 aria-hidden="true" size={28} strokeWidth={1.6} />
            </span>
            <span className="text-[17px] leading-[22px] font-semibold">
              {enabled ? "Drop to share" : "Sharing is unavailable"}
            </span>
            <span className="max-w-[260px] text-[13px] text-muted">
              {enabled
                ? lifetimeMinutes === null
                  ? "Each file becomes its own share until you stop it."
                  : `Each file becomes its own share for ${lifetimeMinutes} minutes.`
                : "Files can be shared again once the server is online."}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Outlines the collection that will receive the dropped files. */
function CollectionTarget({ target }: { target: DropTarget }) {
  const { x, y, width, height } = target.rect;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 bg-bg/35">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        style={{ left: x - 6, top: y - 6, width: width + 12, height: height + 12 }}
        className="absolute flex items-end justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/40 pb-2"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-accent-fg shadow-[var(--shadow-pop)]">
          <FilePlus2 aria-hidden="true" size={13} />
          Drop to add to this link
        </span>
      </motion.div>
    </div>
  );
}
