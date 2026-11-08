import { Dices, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { cn } from "../../lib/cn";
import { CopyButton } from "./copy-button";
import { MAX_PASSWORD_CHARS } from "./password";

/**
 * A password input with deliberate reveal, generate, and copy actions. Hidden by
 * default; a generated password is shown so it can be passed on.
 */
export function PasswordField({
  id,
  value,
  onChange,
  onGenerate,
  invalid,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => Promise<string | undefined>;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-md border border-line bg-surface pr-0.5 pl-2.5 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
        invalid && "border-danger",
      )}
    >
      <input
        id={id}
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        maxLength={MAX_PASSWORD_CHARS}
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked for it.
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-fg outline-none placeholder:font-sans placeholder:text-faint"
        placeholder="Password"
      />
      <IconButton
        icon={revealed ? EyeOff : Eye}
        label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        onClick={() => setRevealed((r) => !r)}
      />
      <IconButton
        icon={Dices}
        label="Generate a password"
        onClick={async () => {
          const generated = await onGenerate();
          if (generated) {
            onChange(generated);
            setRevealed(true);
          }
        }}
      />
      <CopyButton
        iconOnly
        size="iconSm"
        variant="ghost"
        label="Copy password"
        copiedLabel="Password copied"
        disabled={!value}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(value);
            return true;
          } catch {
            return false;
          }
        }}
      />
    </div>
  );
}
