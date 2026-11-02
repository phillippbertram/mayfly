import { Plus, Upload } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/cn";

export function DropStrip({
  dragging,
  disabled,
  onChoose,
}: {
  dragging: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "group flex h-[60px] shrink-0 items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-dashed px-4",
        "transition-[border-color,background-color] duration-200",
        dragging
          ? "border-accent bg-accent-soft/50"
          : "border-line-strong hover:border-accent/60 hover:bg-surface/60",
      )}
    >
      <div className="flex items-center gap-2.5 text-muted">
        <motion.span
          animate={dragging ? { y: [0, -4, 0] } : { y: 0 }}
          transition={dragging ? { duration: 0.8, repeat: Number.POSITIVE_INFINITY } : {}}
          className={cn(
            "flex transition-colors duration-200 group-hover:text-accent",
            dragging && "text-accent",
          )}
        >
          <Upload aria-hidden="true" size={18} strokeWidth={1.6} />
        </motion.span>
        <span>{dragging ? "Release to share" : "Drop files anywhere to share them"}</span>
      </div>
      <Button disabled={disabled} onClick={onChoose}>
        <Plus aria-hidden="true" size={15} strokeWidth={1.8} />
        Choose files…
      </Button>
    </motion.div>
  );
}
