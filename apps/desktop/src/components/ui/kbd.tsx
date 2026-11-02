import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Kbd({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 font-sans text-[11px] font-medium tnum",
        inverted ? "bg-bg/15 text-bg/80" : "border border-line bg-surface text-muted",
      )}
    >
      {children}
    </kbd>
  );
}
