import { cn } from "../lib/cn";

/** FileHop mark: a file with a dashed arc leaving its corner. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-[22px] items-center justify-center rounded-[6px] bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.2)_inset]",
        className,
      )}
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
