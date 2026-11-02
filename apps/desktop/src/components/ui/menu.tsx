import type { Hotkey } from "@tanstack/react-hotkeys";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import { type ReactNode, useContext } from "react";
import { cn } from "../../lib/cn";
import { hotkeyLabel } from "../../lib/hotkeys";
import { PortalContainer } from "./modal";

export const MenuRoot = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuSub = M.Sub;

const panel =
  "pop z-50 min-w-48 overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-pop)] outline-none";
const item =
  "relative flex h-8 select-none items-center gap-2.5 rounded-md px-2 text-[13px] text-fg outline-none transition-colors duration-100 data-[highlighted]:bg-surface-muted data-[disabled]:opacity-45";

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <M.Portal container={useContext(PortalContainer)}>
      <M.Content align={align} sideOffset={6} collisionPadding={8} className={cn(panel, className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  hotkey,
  danger,
  onSelect,
  disabled,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  hotkey?: Hotkey | null;
  danger?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <M.Item
      {...(onSelect ? { onSelect } : {})}
      {...(disabled ? { disabled } : {})}
      className={cn(item, danger && "text-danger data-[highlighted]:bg-danger-soft")}
    >
      {Icon && <Icon aria-hidden="true" size={15} strokeWidth={1.6} className="opacity-80" />}
      <span className="flex-1">{children}</span>
      {hotkey && <span className="text-[11px] text-faint tnum">{hotkeyLabel(hotkey)}</span>}
    </M.Item>
  );
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <M.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted">{children}</M.Label>
  );
}

export function MenuSubTrigger({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <M.SubTrigger className={cn(item, "data-[state=open]:bg-surface-muted")}>
      {Icon && <Icon aria-hidden="true" size={15} strokeWidth={1.6} className="opacity-80" />}
      <span className="flex-1">{children}</span>
      <ChevronRight aria-hidden="true" size={14} className="text-faint" />
    </M.SubTrigger>
  );
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <M.Portal container={useContext(PortalContainer)}>
      <M.SubContent sideOffset={6} collisionPadding={8} className={panel}>
        {children}
      </M.SubContent>
    </M.Portal>
  );
}

export function MenuRadioGroup<T extends string>({
  value,
  onValueChange,
  options,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode }[];
}) {
  return (
    <M.RadioGroup value={value} onValueChange={(v) => onValueChange(v as T)}>
      {options.map((option) => (
        <M.RadioItem key={option.value} value={option.value} className={cn(item, "pl-8")}>
          <M.ItemIndicator className="absolute left-2 inline-flex text-accent">
            <Check aria-hidden="true" size={15} strokeWidth={2} />
          </M.ItemIndicator>
          <span className="flex-1">{option.label}</span>
          {option.hint && <span className="text-[11px] text-faint">{option.hint}</span>}
        </M.RadioItem>
      ))}
    </M.RadioGroup>
  );
}
