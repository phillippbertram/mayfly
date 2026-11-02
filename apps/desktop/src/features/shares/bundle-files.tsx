import { FilePlus2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../../components/ui/button";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { formatBytes } from "../../lib/format";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";
import type { ShareActions } from "./use-share-actions";

/**
 * The files behind a bundle or collection link, with per-file download counts.
 * An active collection also lets the user add files (button or drop) and remove them.
 */
export function BundleFiles({ share, actions }: { share: Share; actions: ShareActions }) {
  const ended = share.status !== "active";
  const editable = share.collection && !ended;
  const limit = share.downloadLimit;
  return (
    <section
      aria-label="Files in this link"
      className="flex flex-col gap-1.5"
      {...(editable ? { "data-drop-share": share.id } : {})}
    >
      <span className="text-[11px] text-muted">
        {share.collection
          ? "Files can be added and removed while the link is active. Everyone with it sees the current files."
          : limit === null
            ? "Recipients can download each file or a ZIP of all of them."
            : `Each file can be downloaded ${limit === 1 ? "once" : `${limit} times`}; a ZIP counts for every file.`}
      </span>
      {share.files.length === 0 ? (
        <div className="flex h-16 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-[12px] text-muted">
          <span className="font-medium text-fg">No files yet</span>
          {editable && <span>Drop files here or add them below.</span>}
        </div>
      ) : (
        <ul className="flex max-h-[176px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-line bg-bg/60 p-1">
          <AnimatePresence initial={false}>
            {share.files.map((file) => {
              const exhausted = limit !== null && file.downloadCount >= limit;
              return (
                <motion.li
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 12, height: 0 }}
                  className="group flex h-10 items-center gap-2.5 rounded-lg px-1.5"
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
                  {editable && (
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={`Remove ${file.name} from this link`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => actions.removeFile(share, file.id)}
                    >
                      <X aria-hidden="true" size={14} />
                    </Button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {editable && (
        <Button size="sm" className="self-start" onClick={() => actions.addFiles(share)}>
          <FilePlus2 aria-hidden="true" size={14} />
          Add files…
        </Button>
      )}
    </section>
  );
}
