import { cn } from "../lib/cn";

/** FileHop mark: a file with a dashed arc leaving its corner. */
export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  const glyph = Math.round(size * 0.64);
  return (
    <span
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27) }}
      className={cn(
        "flex items-center justify-center bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.2)_inset]",
        className,
      )}
    >
      <svg aria-hidden="true" width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <path
          d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M13 3v6h6" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
