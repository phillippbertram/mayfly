import { motion } from "motion/react";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";

/** Downloads as text plus segments for small limits, or a bar for large ones. */
export function DownloadMeter({ share, warning }: { share: Share; warning?: boolean }) {
  const { downloadCount: count, downloadLimit: limit } = share;
  const fill = warning ? "bg-warning" : share.status === "limitReached" ? "bg-danger" : "bg-accent";
  return (
    <span className="flex w-[76px] shrink-0 flex-col items-end gap-1">
      <span className="text-[12px] leading-4 font-medium whitespace-nowrap tnum">
        {limit === null ? (
          <>
            {count}{" "}
            <span className="font-normal text-faint">{count === 1 ? "download" : "downloads"}</span>
          </>
        ) : (
          <>
            {count}
            <span className="font-normal text-faint"> / {limit}</span>
          </>
        )}
      </span>
      {limit !== null && limit <= 10 ? (
        <span className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: limit }, (_, i) => (
            <motion.span
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional.
              key={i}
              initial={false}
              animate={{ scaleY: i < count ? 1 : 0.6 }}
              className={cn(
                "block h-1 rounded-full transition-colors duration-300",
                i < count ? fill : "bg-line-strong",
              )}
              style={{ width: Math.max(5, Math.min(16, 66 / limit - 3)) }}
            />
          ))}
        </span>
      ) : limit !== null ? (
        <span
          className="block h-1 w-[66px] overflow-hidden rounded-full bg-line-strong"
          aria-hidden="true"
        >
          <motion.span
            className={cn("block h-full rounded-full", fill)}
            initial={false}
            animate={{ width: `${Math.min(100, (count / limit) * 100)}%` }}
          />
        </span>
      ) : null}
    </span>
  );
}
