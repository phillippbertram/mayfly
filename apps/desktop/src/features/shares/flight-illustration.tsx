import {
  AnimatePresence,
  type MotionValue,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { MARK } from "../../components/brand-mark";

/** Receiving devices, cycled once per flight. `cx`/`cy` is the screen centre. */
export const DEVICES = [
  { id: "phone", label: "phone", cx: 266, cy: 86 },
  { id: "tablet", label: "tablet", cx: 265, cy: 89 },
  { id: "laptop", label: "laptop", cx: 266, cy: 86 },
  { id: "monitor", label: "computer", cx: 266, cy: 80 },
] as const;
export type DeviceId = (typeof DEVICES)[number]["id"];

const P0 = { x: 112, y: 62 };
const P1 = { x: 150, y: -6 };
const P2 = { x: 226, y: -10 };
const P3 = { x: 262, y: 54 };
const ARC = `M${P0.x} ${P0.y}C${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y}`;

function bezier(t: number) {
  const u = 1 - t;
  return {
    x: u ** 3 * P0.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t ** 3 * P3.x,
    y: u ** 3 * P0.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t ** 3 * P3.y,
  };
}

/** Keyframes for one flight over a 0–1 cycle: lift off, fly the arc, land. */
function flightFrames(lag: number) {
  const start = 0.12 + lag;
  const end = 0.6 + lag;
  const frames = {
    t: [0, start] as number[],
    x: [P0.x, P0.x],
    y: [P0.y + 6, P0.y],
    rotate: [-8, -8],
    scale: [0.2, 1],
    opacity: [0, 1],
  };
  const steps = 22;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const eased = s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2;
    const p = bezier(eased);
    frames.t.push(start + (end - start) * s);
    frames.x.push(p.x);
    frames.y.push(p.y);
    frames.rotate.push(-8 + 20 * s);
    frames.scale.push(1 - Math.max(0, s - 0.75));
    frames.opacity.push(s > 0.92 ? 0.4 : 1);
  }
  frames.t.push(end + 0.05, 1);
  frames.x.push(P3.x, P3.x);
  frames.y.push(P3.y + 10, P3.y + 10);
  frames.rotate.push(12, 12);
  frames.scale.push(0.3, 0.3);
  frames.opacity.push(0, 0);
  return frames;
}

const FLIGHT = flightFrames(0);
const TRAILS = [flightFrames(0.05), flightFrames(0.025)];

function useFlight(t: MotionValue<number>, frames: ReturnType<typeof flightFrames>) {
  return {
    x: useTransform(t, frames.t, frames.x),
    y: useTransform(t, frames.t, frames.y),
    rotate: useTransform(t, frames.t, frames.rotate),
    scale: useTransform(t, frames.t, frames.scale),
    opacity: useTransform(t, frames.t, frames.opacity),
  };
}

function Device({ id }: { id: DeviceId }) {
  const frame = "fill-surface stroke-faint";
  const screen = "fill-surface-muted";
  switch (id) {
    case "phone":
      return (
        <>
          <rect x="244" y="46" width="44" height="84" rx="9" className={frame} strokeWidth="2" />
          <rect x="250" y="56" width="32" height="60" rx="3" className={screen} />
          <path d="M261 123h10" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "tablet":
      return (
        <>
          <rect x="220" y="52" width="90" height="74" rx="9" className={frame} strokeWidth="2" />
          <rect x="228" y="60" width="74" height="58" rx="3" className={screen} />
        </>
      );
    case "laptop":
      return (
        <>
          <rect x="218" y="56" width="96" height="60" rx="6" className={frame} strokeWidth="2" />
          <rect x="225" y="63" width="82" height="46" rx="2" className={screen} />
          <path d="M206 122h120" className="stroke-faint" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "monitor":
      return (
        <>
          <rect x="214" y="48" width="104" height="66" rx="6" className={frame} strokeWidth="2" />
          <rect x="221" y="55" width="90" height="51" rx="2" className={screen} />
          <path
            d="M260 114v10M246 126h40"
            className="stroke-faint"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
  }
}

export function FlightIllustration({
  active,
  dimmed,
  device,
  onCycle,
}: {
  active: boolean;
  dimmed?: boolean;
  /** Index into DEVICES of the current receiver. */
  device: number;
  /** Called when a flight completes, so the parent can move to the next device. */
  onCycle: () => void;
}) {
  const reduce = useReducedMotion();
  // One clock drives every part of the scene so they never drift apart.
  const t = useMotionValue(reduce ? 0.74 : 0);
  const dash = useMotionValue(0);
  const breath = useMotionValue(0);
  const onCycleRef = useRef(onCycle);
  onCycleRef.current = onCycle;

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const step = Math.min(delta, 64);
    const period = active ? 2300 : 4200;
    let next = t.get() + step / period;
    if (next >= 1) {
      next -= 1;
      onCycleRef.current();
    }
    t.set(next);
    dash.set(dash.get() - step * (active ? 0.05 : 0.018));
    breath.set(breath.get() + step / (active ? 2400 : 5000));
  });

  const flight = useFlight(t, FLIGHT);
  const trailA = useFlight(t, TRAILS[0] ?? FLIGHT);
  const trailB = useFlight(t, TRAILS[1] ?? FLIGHT);
  const lift = useTransform(t, [0, 0.03, 0.1, 0.16, 1], [0, 0, -5, 0, 0]);
  const receive = useTransform(t, [0, 0.6, 0.68, 0.9, 1], [0, 0, 1, 1, 0]);
  const check = useTransform(t, [0, 0.62, 0.76, 1], [0, 0, 1, 1]);
  const rippleScale = useTransform(t, [0, 0.6, 0.86, 1], [0.6, 0.6, 2.2, 2.2]);
  const rippleOpacity = useTransform(t, [0, 0.6, 0.86, 1], [0, 0.45, 0, 0]);
  const glowScale = useTransform(breath, (b) => 0.99 + 0.07 * Math.sin(b * Math.PI * 2));
  const glowOpacity = useTransform(
    breath,
    (b) => (active ? 0.9 : 0.55) + 0.15 * Math.sin(b * Math.PI * 2),
  );
  const trailOpacityA = useTransform(trailA.opacity, (o) => o * 0.25);
  const trailOpacityB = useTransform(trailB.opacity, (o) => o * 0.45);
  const markX = useTransform(flight.x, (v) => v - 18);
  const markY = useTransform(flight.y, (v) => v - 12);
  const receiver = DEVICES[device % DEVICES.length] ?? DEVICES[0];

  return (
    <div className="relative" style={{ width: 340, height: 170, opacity: dimmed ? 0.75 : 1 }}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-6 -inset-y-6 rounded-full"
        style={{
          scale: glowScale,
          opacity: glowOpacity,
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)",
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
        {/* Sender: laptop */}
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
          style={{ y: lift }}
        />
        <rect x="122" y="80" width="18" height="22" rx="3" className="fill-line" />
        <rect x="74" y="108" width="66" height="4" rx="2" className="fill-line" />
        <path d="M44 134h136" className="stroke-faint" strokeWidth="2.5" strokeLinecap="round" />

        {/* Receiver: changes with every flight */}
        <AnimatePresence initial={false}>
          <motion.g
            key={receiver.id}
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
          >
            <Device id={receiver.id} />
            <motion.circle
              cx={receiver.cx}
              cy={receiver.cy}
              r="14"
              className="fill-accent-soft"
              style={{ opacity: receive }}
            />
            <motion.circle
              cx={receiver.cx}
              cy={receiver.cy}
              r="12"
              className="stroke-accent"
              strokeWidth="1.5"
              style={{
                scale: rippleScale,
                opacity: rippleOpacity,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
            <motion.path
              d={`M${receiver.cx - 7} ${receiver.cy}l5 5 9-10`}
              className="stroke-accent"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pathLength: check, opacity: receive }}
            />
          </motion.g>
        </AnimatePresence>

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
          className="stroke-accent transition-opacity duration-300"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 7"
          style={{ strokeDashoffset: dash, opacity: active ? 1 : 0.65 }}
        />

        {/* Trail and the mayfly carrying the file */}
        <motion.circle
          r={2}
          cx={0}
          cy={0}
          className="fill-accent"
          style={{ x: trailA.x, y: trailA.y, opacity: trailOpacityA }}
        />
        <motion.circle
          r={3}
          cx={0}
          cy={0}
          className="fill-accent"
          style={{ x: trailB.x, y: trailB.y, opacity: trailOpacityB }}
        />
        <motion.g style={{ x: markX, y: markY }}>
          <motion.g
            style={{
              rotate: flight.rotate,
              scale: flight.scale,
              opacity: flight.opacity,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          >
            <g transform="scale(0.5)">
              <path d={MARK.wing} className="fill-accent" />
              <path d={MARK.body} className="stroke-fg" strokeWidth="4.5" strokeLinecap="round" />
              <path d={MARK.tails} className="stroke-fg" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
