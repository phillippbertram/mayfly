import { FlaskConical, Info, ShieldAlert, Timer } from "lucide-react";
import { useAppInfo } from "../lib/queries";
import { Tooltip } from "./ui/tooltip";

export function Footer({ preview, onOpenAbout }: { preview: boolean; onOpenAbout: () => void }) {
  const info = useAppInfo();
  return (
    <footer className="flex h-9 shrink-0 items-center gap-3 border-t border-line pr-3 pl-6 text-[12px] text-muted">
      <Tooltip label="Links travel over plain HTTP. Anyone on the same network who has a link can download until it ends.">
        <span className="flex min-w-0 items-center gap-1.5">
          <ShieldAlert aria-hidden="true" size={14} strokeWidth={1.6} className="shrink-0" />
          <span className="truncate">HTTP is unencrypted. Use trusted networks only.</span>
        </span>
      </Tooltip>
      <span className="flex-1" />
      {preview ? (
        <Tooltip label="This browser preview simulates the desktop backend. Nothing is shared.">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning-strong">
            <FlaskConical aria-hidden="true" size={12} strokeWidth={1.8} />
            Browser preview · sample data
          </span>
        </Tooltip>
      ) : (
        <Tooltip label="Shares live in memory only. Quitting FileHop stops every link.">
          <span className="hidden shrink-0 items-center gap-1.5 min-[820px]:flex">
            <Timer aria-hidden="true" size={13} strokeWidth={1.6} />
            Shares end when FileHop quits
          </span>
        </Tooltip>
      )}
      <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-line" />
      <Tooltip label="About FileHop">
        <button
          type="button"
          onClick={onOpenAbout}
          aria-label={info ? `About FileHop, version ${info.version}` : "About FileHop"}
          className="flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 font-mono text-[11px] tabular-nums transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <Info aria-hidden="true" size={13} strokeWidth={1.7} />
          {info ? `v${info.version}` : "About"}
        </button>
      </Tooltip>
    </footer>
  );
}
