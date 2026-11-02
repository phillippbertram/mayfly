import { Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";

/** Stop sharing with an inline confirmation instead of a dialog. */
export function StopButton({
  armedSignal,
  onStop,
}: {
  /** Changing this value arms the confirmation, e.g. from the Delete shortcut. */
  armedSignal: number;
  onStop: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (armedSignal > 0) setArmed(true);
  }, [armedSignal]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (armed) {
      confirmRef.current?.focus();
      timer.current = setTimeout(() => setArmed(false), 5000);
    }
    return () => clearTimeout(timer.current);
  }, [armed]);

  return (
    <motion.div
      layout
      className="flex items-center gap-1.5"
      transition={{ type: "spring", stiffness: 500, damping: 36 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {armed ? (
          <motion.div
            key="armed"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="flex items-center gap-1.5"
          >
            <Button
              ref={confirmRef}
              variant="dangerSolid"
              size="sm"
              onClick={() => {
                setArmed(false);
                onStop();
              }}
            >
              <Square aria-hidden="true" size={12} strokeWidth={2.2} fill="currentColor" />
              Stop sharing now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
              <X aria-hidden="true" size={13} />
              Keep
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
          >
            <Button variant="danger" size="sm" className="-ml-2" onClick={() => setArmed(true)}>
              Stop sharing
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
