import { ChevronsUpDown } from "lucide-react";
import { DropdownMenu as M } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { MenuContent, MenuRadioGroup } from "./menu";

/**
 * A select built on an accessible radio menu. Radix Select would inject style
 * elements, which the app's strict CSP refuses.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  prefix,
  className,
  disabled,
  id,
  open,
  onOpenChange,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string; hint?: ReactNode }[];
  label: string;
  prefix?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <M.Root
      modal={false}
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <M.Trigger
        {...(id ? { id } : {})}
        disabled={disabled}
        aria-label={`${label}: ${current?.label ?? "None"}`}
        className={cn(
          "group flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] text-fg",
          "transition-[border-color,background-color,box-shadow] duration-150 hover:border-line-strong data-[state=open]:border-accent data-[state=open]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
          "disabled:opacity-45",
          className,
        )}
      >
        {prefix}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? "None"}</span>
        <ChevronsUpDown
          aria-hidden="true"
          size={14}
          className="text-faint transition-transform duration-200 group-data-[state=open]:scale-110 group-data-[state=open]:text-accent"
        />
      </M.Trigger>
      <MenuContent align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <MenuRadioGroup value={value} onValueChange={onValueChange} options={options} />
      </MenuContent>
    </M.Root>
  );
}
