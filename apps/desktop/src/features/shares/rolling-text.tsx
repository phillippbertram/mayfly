import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/cn";

/**
 * Each changing character rolls in from below; unchanged characters stay still.
 * Slots are keyed from the right so "10:00" to "9:59" keeps the seconds in place.
 * Characters stack over an invisible sizer instead of using AnimatePresence's
 * popLayout mode, which injects a style element the strict CSP refuses.
 */
export function RollingText({ text, className }: { text: string; className?: string }) {
  const slots = Array.from(text).map((char, position, all) => ({
    char,
    slot: `slot-${all.length - position}`,
  }));
  return (
    <span className={cn("inline-flex whitespace-nowrap", className)}>
      <span className="sr-only">{text}</span>
      {slots.map(({ char, slot }) => (
        <span
          key={slot}
          aria-hidden="true"
          className="relative inline-block overflow-hidden align-bottom"
        >
          <span className="invisible whitespace-pre">{char}</span>
          <AnimatePresence initial={false}>
            <motion.span
              key={char}
              initial={{ y: "80%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-80%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 whitespace-pre"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
