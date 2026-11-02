import { Tooltip as T } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { shortcutLabel } from "../../lib/platform";
import { Kbd } from "./kbd";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={450} skipDelayDuration={250}>
    {children}
  </T.Provider>
);

export function Tooltip({
  label,
  shortcut,
  side = "top",
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="pop z-50 flex max-w-64 items-center gap-2 rounded-md bg-fg px-2 py-1 text-[12px] leading-4 text-bg shadow-[var(--shadow-pop)]"
        >
          {label}
          {shortcut && <Kbd inverted>{shortcutLabel(shortcut)}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
