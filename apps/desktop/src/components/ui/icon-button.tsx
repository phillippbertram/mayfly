import type { Hotkey } from "@tanstack/react-hotkeys";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

export function IconButton({
  icon: Icon,
  label,
  hotkey,
  size = "iconSm",
  variant = "ghost",
  tooltipSide,
  ...props
}: Omit<ButtonProps, "children" | "size"> & {
  icon: LucideIcon;
  label: string;
  hotkey?: Hotkey | null;
  size?: "icon" | "iconSm";
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip
      label={label}
      {...(hotkey ? { hotkey } : {})}
      {...(tooltipSide ? { side: tooltipSide } : {})}
    >
      <Button aria-label={label} size={size} variant={variant} {...props}>
        <Icon aria-hidden="true" size={size === "icon" ? 18 : 16} strokeWidth={1.6} />
      </Button>
    </Tooltip>
  );
}
