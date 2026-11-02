import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { formatBytes } from "../../lib/format";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";

/** The files behind a bundle link, with per-file download counts. */
export function BundleFiles({ share }: { share: Share }) {
  const ended = share.status !== "active";
  const limit = share.downloadLimit;
  return (
    <section aria-label="Files in this link" className="flex flex-col gap-1.5">
      <span className="text-[11px] text-muted">
        {limit === null
          ? "Recipients can download each file or a ZIP of all of them."
          : `Each file can be downloaded ${limit === 1 ? "once" : `${limit} times`}; a ZIP counts for every file.`}
      </span>
      <ul className="flex max-h-[176px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-line bg-bg/60 p-1">
        {share.files.map((file, index) => {
          const exhausted = limit !== null && file.downloadCount >= limit;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat within a bundle.
              key={index}
              className="flex h-10 items-center gap-2.5 rounded-lg px-1.5"
            >
              <FileGlyph
                kind={file.kind}
                muted={ended || exhausted}
                className="size-7 rounded-lg [&_svg]:size-4"
              />
              <FileName name={file.name} className="flex-1 text-[12.5px] font-medium" />
              <span className="text-[11px] text-muted tnum">{formatBytes(file.byteSize)}</span>
              <span
                className={cn(
                  "w-10 text-right text-[11px] tnum",
                  exhausted ? "text-danger" : "text-muted",
                )}
                title="Downloads started"
              >
                {limit === null ? `↓${file.downloadCount}` : `${file.downloadCount}/${limit}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
