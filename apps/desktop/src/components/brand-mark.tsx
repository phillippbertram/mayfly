import { MARK } from "../lib/brand-mark";
import { cn } from "../lib/cn";

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
