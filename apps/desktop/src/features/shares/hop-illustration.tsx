import { motion } from "motion/react";

/**
 * Laptop, phone, and a dashed arc. While `active` (hover or drag), a file hops
 * along the arc from the laptop to the phone.
 */
export function HopIllustration({ active }: { active: boolean }) {
  // Sample points along the arc path M62 44 C90 6 160 -2 198 34.
  const xs = [62, 84, 110, 138, 166, 186, 198];
  const ys = [44, 22, 10, 6, 12, 22, 34];
  return (
    <svg
      aria-hidden="true"
      width="240"
      height="120"
      viewBox="0 0 240 120"
      fill="none"
      className="overflow-visible"
    >
      <rect x="14" y="44" width="96" height="58" rx="6" className="stroke-faint" strokeWidth="2" />
      <rect x="22" y="52" width="80" height="42" rx="2" className="fill-surface-muted" />
      <path d="M4 108h116" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
      <rect x="186" y="34" width="38" height="74" rx="8" className="stroke-faint" strokeWidth="2" />
      <path d="M199 102h12" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
      <motion.path
        d="M62 44C90 6 160 -2 198 34"
        className="stroke-accent"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 6"
        animate={{ strokeDashoffset: active ? [0, -40] : 0, opacity: active ? 1 : 0.7 }}
        transition={
          active
            ? {
                strokeDashoffset: {
                  duration: 1.2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                },
              }
            : { duration: 0.3 }
        }
      />
      <motion.g
        initial={false}
        animate={
          active
            ? {
                x: xs.map((x) => x - 130),
                y: ys.map((y) => y - 14),
                rotate: [-12, -6, 0, 4, 8, 10, 0],
                scale: [0.9, 1, 1.05, 1.05, 1, 0.95, 0.85],
                opacity: [0, 1, 1, 1, 1, 1, 0],
              }
            : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
        }
        transition={
          active
            ? {
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.25,
                ease: "easeInOut",
              }
            : { type: "spring", stiffness: 300, damping: 24 }
        }
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <path
          d="M122 4h12l6 6v16a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          className="fill-accent-soft stroke-accent"
          strokeWidth="2"
        />
        <path d="M134 4v6h6" className="stroke-accent" strokeWidth="2" />
      </motion.g>
      <motion.circle
        cx="205"
        cy="66"
        r="10"
        className="fill-accent"
        initial={false}
        animate={active ? { scale: [0, 0, 1.6], opacity: [0, 0, 0] } : { scale: 0, opacity: 0 }}
        transition={
          active ? { duration: 1.75, repeat: Number.POSITIVE_INFINITY, times: [0, 0.8, 1] } : {}
        }
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
