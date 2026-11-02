import type { Hotkey } from "@tanstack/react-hotkeys";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { cn } from "../../lib/cn";

/** Renders a hotkey as platform-specific key caps, e.g. ⌘ K or Ctrl K. */
export function Kbd({
  hotkey,
  inverted,
  className,
}: {
  hotkey: Hotkey | null | undefined;
  inverted?: boolean;
  className?: string;
}) {
  if (!hotkey) return null;
  const steps = Array.isArray(hotkey)
    ? (formatForDisplay(hotkey, { parts: true }) as string[][])
    : [formatForDisplay(hotkey, { parts: true }) as string[]];
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
      {steps.map((parts, step) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: sequence steps are positional.
        <span key={step} className="inline-flex items-center gap-0.5">
          {parts.map((part, i) => (
            <kbd
              // biome-ignore lint/suspicious/noArrayIndexKey: key caps are positional.
              key={i}
              className={cn(
                "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 font-sans text-[11px] font-medium tnum",
                inverted
                  ? "bg-bg/15 text-bg/85"
                  : "border border-line bg-surface text-muted shadow-[0_1px_0_var(--border)]",
              )}
            >
              {part}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
