import { Ban, CircleStop, Clock, TimerOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";
import type { DisplayStatus } from "../../lib/format";

const STYLE: Record<DisplayStatus, string> = {
  active: "bg-accent-soft text-accent-strong",
  expiring: "bg-warning-soft text-warning-strong",
  expired: "bg-surface-muted text-muted",
  stopped: "bg-surface-muted text-muted",
  limitReached: "bg-danger-soft text-danger-strong",
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  stopped: "Stopped",
  limitReached: "Limit reached",
};

const ICON = {
  expiring: Clock,
  expired: TimerOff,
  stopped: CircleStop,
  limitReached: Ban,
} as const;

export function StatusChip({ status, className }: { status: DisplayStatus; className?: string }) {
  const Icon = status === "active" ? null : ICON[status];
  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 500, damping: 36 }}
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 overflow-hidden rounded-md px-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-300",
        STYLE[status],
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.14 }}
          className="flex items-center gap-1.5"
        >
          {Icon ? (
            <Icon aria-hidden="true" size={12} strokeWidth={2} />
          ) : (
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          )}
          {STATUS_LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
