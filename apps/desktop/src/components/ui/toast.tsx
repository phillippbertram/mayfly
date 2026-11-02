import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/cn";

type Tone = "info" | "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside ToastProvider.");
  return push;
}

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = nextId++;
      setItems((current) =>
        [...current.filter((t) => t.message !== message), { id, message, tone }].slice(-3),
      );
      setTimeout(() => dismiss(id), tone === "error" ? 5200 : 3600);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext value={value}>
      {children}
      <section
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-12 z-[60] flex flex-col items-center gap-2"
      >
        <AnimatePresence initial={false}>
          {items.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
                role={toast.tone === "error" ? "alert" : "status"}
                className="pointer-events-auto flex max-w-[460px] items-center gap-2.5 rounded-xl border border-line bg-surface py-2 pr-2 pl-3 text-[13px] shadow-[var(--shadow-pop)]"
              >
                <Icon
                  aria-hidden="true"
                  size={16}
                  className={cn(
                    "shrink-0",
                    toast.tone === "error"
                      ? "text-danger"
                      : toast.tone === "success"
                        ? "text-accent"
                        : "text-muted",
                  )}
                />
                <span className="flex-1">{toast.message}</span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(toast.id)}
                  className="flex size-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-muted hover:text-fg"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>
    </ToastContext>
  );
}
