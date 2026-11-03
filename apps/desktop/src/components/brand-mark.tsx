import { cn } from "../lib/cn";

/**
 * Mayfly mark on a 64-unit grid: an upright wing, a curved body, and two tails.
 * Shared with the empty-state flight; icons/source.svg draws the same paths.
 */
export const MARK = {
  wing: "M24 37C21 25 25 13 35 5C38 16 36 28 31 37Z",
  body: "M10 43C20 37 33 36 44 32",
  tails: "M44 32C49 28 53 23 57 15M44 32C50 30 55 27 60 22",
} as const;

export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  const glyph = Math.round(size * 0.78);
  return (
    <span
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27) }}
      className={cn(
        "flex items-center justify-center bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.2)_inset]",
        className,
      )}
    >
      <svg aria-hidden="true" width={glyph} height={glyph} viewBox="6 2 58 46" fill="none">
        <path d={MARK.wing} fill="currentColor" />
        <path d={MARK.body} stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
        {size >= 32 ? (
          <path d={MARK.tails} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        ) : null}
      </svg>
    </span>
  );
}
