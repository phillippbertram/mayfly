import { Switch as S } from "radix-ui";
import { cn } from "../../lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <S.Root
      {...(id ? { id } : {})}
      {...(label ? { "aria-label": label } : {})}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-transparent p-[2px]",
        "bg-line-strong transition-colors duration-200 data-[state=checked]:bg-accent",
      )}
    >
      <S.Thumb className="block size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[var(--ease-out-soft)] data-[state=checked]:translate-x-4" />
    </S.Root>
  );
}
