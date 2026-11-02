import type { Hotkey } from "@tanstack/react-hotkeys";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";

/** Copies on click and confirms inside the button: the icon morphs into a check. */
export function CopyButton({
  onCopy,
  label,
  copiedLabel = "Copied",
  icon: Icon = Copy,
  iconOnly,
  variant = "secondary",
  size = "md",
  hotkey,
  className,
  disabled,
}: {
  onCopy: () => Promise<boolean>;
  label: string;
  copiedLabel?: string;
  icon?: LucideIcon;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  hotkey?: Hotkey | null;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const click = async () => {
    if (await onCopy()) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }
  };

  const glyph = (
    <span className="relative flex size-4 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "idle"}
          initial={{ scale: 0.4, opacity: 0, rotate: copied ? -45 : 0 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 700, damping: 26 }}
          className="flex"
        >
          {copied ? (
            <Check aria-hidden="true" size={iconOnly ? 15 : 16} strokeWidth={2.4} />
          ) : (
            <Icon aria-hidden="true" size={iconOnly ? 15 : 16} strokeWidth={1.6} />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );

  const button = (
    <Button
      layout={!iconOnly}
      variant={copied && variant === "ghost" ? "ghost" : variant}
      size={iconOnly ? (size === "icon" ? "icon" : "iconSm") : size}
      aria-label={copied ? copiedLabel : label}
      disabled={disabled}
      onClick={click}
      className={className}
      {...(copied && variant === "ghost" ? { style: { color: "var(--accent)" } } : {})}
    >
      {glyph}
      {!iconOnly && (
        <motion.span layout="position" className="relative">
          {copied ? copiedLabel : label}
        </motion.span>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </Button>
  );

  return iconOnly ? (
    <Tooltip label={copied ? copiedLabel : label} {...(hotkey ? { hotkey } : {})}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
