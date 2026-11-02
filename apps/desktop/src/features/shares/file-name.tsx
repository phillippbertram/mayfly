import { cn } from "../../lib/cn";
import { splitFileName } from "../../lib/format";

/** Truncates the middle of long names so the extension always stays visible. */
export function FileName({ name, className }: { name: string; className?: string }) {
  const { base, ext } = splitFileName(name);
  return (
    <span className={cn("flex min-w-0", className)} title={name}>
      <span className="truncate">{base}</span>
      {ext && <span className="shrink-0">{ext}</span>}
    </span>
  );
}
