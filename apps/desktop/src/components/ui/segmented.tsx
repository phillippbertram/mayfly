import { motion } from "motion/react";
import { RadioGroup } from "radix-ui";
import { useId } from "react";
import { cn } from "../../lib/cn";

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <RadioGroup.Root
      aria-label={label}
      orientation="horizontal"
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg bg-surface-muted p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              "relative h-7 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap outline-offset-0 transition-colors duration-150",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative tnum">{option.label}</span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
