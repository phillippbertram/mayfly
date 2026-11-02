import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  size = "iconSm",
  variant = "ghost",
  tooltipSide,
  ...props
}: Omit<ButtonProps, "children" | "size"> & {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  size?: "icon" | "iconSm";
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip
      label={label}
      {...(shortcut ? { shortcut } : {})}
      {...(tooltipSide ? { side: tooltipSide } : {})}
    >
      <Button aria-label={label} size={size} variant={variant} {...props}>
        <Icon aria-hidden="true" size={size === "icon" ? 18 : 16} strokeWidth={1.6} />
      </Button>
    </Tooltip>
  );
}
