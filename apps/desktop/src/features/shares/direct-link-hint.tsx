import { CircleAlert } from "lucide-react";
import { DOWNLOAD_PROFILE_ID } from "../../lib/backend/types";
import { cn } from "../../lib/cn";

/**
 * Chat apps fetch links to build previews. With a direct link that request is a
 * download, so it can use up a limit before the recipient taps anything.
 */
export function DirectLinkHint({
  profileId,
  downloadLimit,
  className,
}: {
  profileId: string;
  downloadLimit: number | null;
  className?: string;
}) {
  if (profileId !== DOWNLOAD_PROFILE_ID || downloadLimit === null) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-[12px] text-warning-strong", className)}>
      <CircleAlert aria-hidden="true" size={13} className="mt-0.5 shrink-0" />
      Link previews in chat apps can use up a download. Use the download page for tight limits.
    </p>
  );
}
