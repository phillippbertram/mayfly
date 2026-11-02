import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { AnimatePresence, motion } from "motion/react";
import { createContext, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

/**
 * Where menus and tooltips portal to. A modal <dialog> sits in the browser's top
 * layer and makes the rest of the page inert, so popovers rendered into <body>
 * would be hidden behind it and unclickable; inside a dialog they portal into it.
 */
export const PortalContainer = createContext<HTMLElement | null>(null);

/**
 * Native modal <dialog> (focus containment, inert background, Escape) with
 * Motion-driven enter and exit. The dialog closes only after the exit animation.
 * Mark the element that should receive focus with `data-autofocus`.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  side = "center",
  align = "center",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  side?: "center" | "right";
  /** Vertical placement for centered dialogs; command palettes sit near the top. */
  align?: "center" | "top";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && mounted && dialog && !dialog.open) {
      dialog.showModal();
      // showModal() resets focus; hand it to the element the content asked for.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
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
      ref={(element) => {
        ref.current = element;
        setContainer(element);
      }}
      aria-labelledby={labelledBy}
      data-visible={open}
      className={cn(
        "modal",
        side === "right"
          ? "justify-end"
          : align === "top"
            ? "items-start justify-center pt-[12vh]"
            : "items-center justify-center",
      )}
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
            <HotkeysProvider scope={labelledBy} exclusive>
              <PortalContainer.Provider value={container}>{children}</PortalContainer.Provider>
            </HotkeysProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
