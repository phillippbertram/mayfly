import { type HTMLMotionProps, motion } from "motion/react";
import type { Ref } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "iconSm";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg border-accent hover:bg-accent-hover hover:border-accent-hover shadow-[0_1px_0_rgb(255_255_255/0.12)_inset]",
  secondary:
    "bg-surface text-fg border-line hover:bg-surface-hover hover:border-line-strong shadow-[0_1px_1px_rgb(0_0_0/0.03)]",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-muted hover:text-fg",
  danger: "bg-transparent text-danger border-transparent hover:bg-danger-soft",
  dangerSolid: "bg-danger text-white border-danger hover:brightness-110 dark:text-[#2a0b0b]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
  lg: "h-9 px-4 text-[13px] gap-2",
  icon: "size-8 p-0",
  iconSm: "size-7 p-0",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md border font-medium",
        "transition-[background-color,border-color,color,box-shadow,opacity,filter] duration-150 ease-out",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
