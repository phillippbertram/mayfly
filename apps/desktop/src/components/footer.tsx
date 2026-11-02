import { FlaskConical, ShieldAlert } from "lucide-react";
import { Tooltip } from "./ui/tooltip";

export function Footer({ preview }: { preview: boolean }) {
  return (
    <footer className="flex h-9 shrink-0 items-center gap-2 border-t border-line px-6 text-[12px] text-muted">
      <ShieldAlert aria-hidden="true" size={14} strokeWidth={1.6} />
      <span>HTTP is unencrypted. Use FileHop on trusted networks only.</span>
      <span className="flex-1" />
      {preview ? (
        <Tooltip label="This browser preview simulates the desktop backend. Nothing is shared.">
          <span className="flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning-strong">
            <FlaskConical aria-hidden="true" size={12} strokeWidth={1.8} />
            Browser preview · sample data
          </span>
        </Tooltip>
      ) : (
        <span>Shares live in memory and end when FileHop quits.</span>
      )}
    </footer>
  );
}
