import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

/**
 * Native modal <dialog> (focus containment, inert background, Escape) with
 * Motion-driven enter and exit. The dialog closes only after the exit animation.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  side = "center",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  side?: "center" | "right";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && mounted && dialog && !dialog.open) dialog.showModal();
  }, [open, mounted]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the dialog element exists only while mounted.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    const pointer = (event: MouseEvent) => {
      if (event.target === dialog) onCloseRef.current();
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("click", pointer);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("click", pointer);
    };
  }, [mounted]);

  if (!mounted) return null;

  const motionProps =
    side === "center"
      ? {
          initial: { opacity: 0, scale: 0.96, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14 } },
        }
      : {
          initial: { x: "100%" },
          animate: { x: 0 },
          exit: { x: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
        };

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      data-visible={open}
      className={cn("modal", side === "center" ? "items-center justify-center" : "justify-end")}
    >
      <AnimatePresence
        onExitComplete={() => {
          ref.current?.close();
          setMounted(false);
        }}
      >
        {open && (
          <motion.div
            {...motionProps}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "relative bg-surface text-fg shadow-[var(--shadow-dialog)]",
              side === "center"
                ? "rounded-[14px] border border-line"
                : "h-full border-l border-line",
              className,
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
