import { cn } from "../../lib/cn";

/** Remaining-lifetime ring. The stroke glides between one-second updates. */
export function CountdownRing({
  progress,
  warning,
  size = 36,
}: {
  progress: number;
  warning: boolean;
  size?: number;
}) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-surface-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        className={cn(
          "transition-[stroke-dashoffset,stroke] duration-1000 ease-linear",
          warning ? "stroke-warning" : "stroke-accent",
        )}
      />
    </svg>
  );
}
