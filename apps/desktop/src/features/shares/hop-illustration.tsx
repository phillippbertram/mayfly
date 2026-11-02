import { motion, type Transition } from "motion/react";
import { useMemo } from "react";

const P0 = { x: 112, y: 62 };
const P1 = { x: 150, y: -6 };
const P2 = { x: 226, y: -10 };
const P3 = { x: 262, y: 56 };

function bezier(t: number) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * P0.x + b * P1.x + c * P2.x + d * P3.x,
    y: a * P0.y + b * P1.y + c * P2.y + d * P3.y,
  };
}

const ARC = `M${P0.x} ${P0.y}C${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y}`;

/** Keyframes for one hop: pop out of the laptop, fly the arc, land in the phone. */
function useHop(lag: number) {
  return useMemo(() => {
    const steps = 22;
    const start = 0.12 + lag;
    const end = 0.62 + lag;
    const x: number[] = [P0.x, P0.x];
    const y: number[] = [P0.y + 6, P0.y];
    const rotate: number[] = [-8, -8];
    const scale: number[] = [0.2, 1];
    const opacity: number[] = [0, 1];
    const times: number[] = [lag, start];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const p = bezier(eased);
      x.push(p.x);
      y.push(p.y);
      rotate.push(-8 + 20 * t);
      scale.push(1 - 0.25 * Math.max(0, t - 0.75) * 4);
      opacity.push(t > 0.92 ? 0.4 : 1);
      times.push(start + (end - start) * t);
    }
    x.push(P3.x, P3.x);
    y.push(P3.y + 10, P3.y + 10);
    rotate.push(12, 12);
    scale.push(0.3, 0.3);
    opacity.push(0, 0);
    times.push(Math.min(0.99, end + 0.06), 1);
    if (lag > 0) {
      x.unshift(P0.x);
      y.unshift(P0.y + 6);
      rotate.unshift(-8);
      scale.unshift(0.2);
      opacity.unshift(0);
      times.unshift(0);
    }
    return { x, y, rotate, scale, opacity, times };
  }, [lag]);
}

export function HopIllustration({ active, dimmed }: { active: boolean; dimmed?: boolean }) {
  const duration = active ? 2.2 : 3.8;
  const hop = useHop(0);
  const trail1 = useHop(0.025);
  const trail2 = useHop(0.05);
  const loop = (times: number[]): Transition => ({
    duration,
    times,
    ease: "linear",
    repeat: Number.POSITIVE_INFINITY,
    repeatDelay: active ? 0.1 : 0.6,
  });
  const at = (values: number[], times: number[]) => ({ values, transition: loop(times) });
  const receive = at([0, 0, 1, 1, 0], [0, 0.6, 0.68, 0.9, 1]);
  const check = at([0, 0, 1, 1, 1], [0, 0.64, 0.78, 0.95, 1]);
  const ripple = {
    scale: at([0.6, 0.6, 2.1, 2.1], [0, 0.62, 0.86, 1]),
    opacity: at([0, 0.45, 0, 0], [0, 0.62, 0.86, 1]),
  };
  const lift = at([0, 0, -5, 0, 0], [0, 0.02, 0.1, 0.16, 1]);

  return (
    <div className="relative" style={{ width: 340, height: 170, opacity: dimmed ? 0.75 : 1 }}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-6 -inset-y-6 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)",
        }}
        animate={{ scale: [0.92, 1.06, 0.92], opacity: active ? [0.9, 1, 0.9] : [0.45, 0.7, 0.45] }}
        transition={{
          duration: active ? 2.4 : 5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <svg
        aria-hidden="true"
        width="340"
        height="170"
        viewBox="-10 -24 340 170"
        fill="none"
        className="relative overflow-visible"
      >
        {/* Laptop */}
        <rect
          x="58"
          y="62"
          width="108"
          height="66"
          rx="7"
          className="fill-surface stroke-faint"
          strokeWidth="2"
        />
        <rect x="66" y="70" width="92" height="50" rx="3" className="fill-surface-muted" />
        <rect x="74" y="80" width="18" height="22" rx="3" className="fill-line" />
        <motion.rect
          x="98"
          y="80"
          width="18"
          height="22"
          rx="3"
          className="fill-accent-soft stroke-accent"
          strokeWidth="1.5"
          animate={{ y: lift.values }}
          transition={lift.transition}
        />
        <rect x="122" y="80" width="18" height="22" rx="3" className="fill-line" />
        <rect x="74" y="108" width="66" height="4" rx="2" className="fill-line" />
        <path d="M44 134h136" className="stroke-faint" strokeWidth="2.5" strokeLinecap="round" />

        {/* Phone */}
        <rect
          x="244"
          y="46"
          width="44"
          height="84"
          rx="9"
          className="fill-surface stroke-faint"
          strokeWidth="2"
        />
        <rect x="250" y="56" width="32" height="60" rx="3" className="fill-surface-muted" />
        <motion.rect
          x="250"
          y="56"
          width="32"
          height="60"
          rx="3"
          className="fill-accent-soft"
          animate={{ opacity: receive.values }}
          transition={receive.transition}
        />
        <motion.circle
          cx="266"
          cy="86"
          r="12"
          className="stroke-accent"
          strokeWidth="1.5"
          animate={{ scale: ripple.scale.values, opacity: ripple.opacity.values }}
          transition={{ scale: ripple.scale.transition, opacity: ripple.opacity.transition }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <motion.path
          d="M259 86l5 5 9-10"
          className="stroke-accent"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ pathLength: check.values, opacity: receive.values }}
          transition={{ pathLength: check.transition, opacity: receive.transition }}
        />
        <path d="M261 123h10" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />

        {/* Arc */}
        <path
          d={ARC}
          className="stroke-line-strong"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
        <motion.path
          d={ARC}
          className="stroke-accent"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 7"
          animate={{ strokeDashoffset: [0, -48], opacity: active ? 1 : 0.65 }}
          transition={{
            strokeDashoffset: {
              duration: active ? 0.9 : 2.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            },
            opacity: { duration: 0.3 },
          }}
        />

        {/* Trail */}
        {[trail2, trail1].map((t, i) => (
          <motion.circle
            // biome-ignore lint/suspicious/noArrayIndexKey: two fixed trail dots.
            key={i}
            r={2 + i}
            className="fill-accent"
            animate={{ cx: t.x, cy: t.y, opacity: t.opacity.map((o) => o * (0.25 + i * 0.2)) }}
            transition={{ cx: loop(t.times), cy: loop(t.times), opacity: loop(t.times) }}
          />
        ))}

        {/* Travelling file */}
        <motion.g
          animate={{
            x: hop.x.map((v) => v - 12),
            y: hop.y.map((v) => v - 15),
            rotate: hop.rotate,
            scale: hop.scale,
            opacity: hop.opacity,
          }}
          transition={{
            x: loop(hop.times),
            y: loop(hop.times),
            rotate: loop(hop.times),
            scale: loop(hop.times),
            opacity: loop(hop.times),
          }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <path
            d="M3 0h12l6 6v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z"
            className="fill-surface stroke-accent"
            strokeWidth="2"
          />
          <path d="M15 0v6h6" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M5 14h10M5 19h7"
            className="stroke-accent"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.6"
          />
        </motion.g>
      </svg>
    </div>
  );
}
