import { FilePlus2, Link2, QrCode, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../../components/ui/button";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { formatBytes } from "../../lib/format";
import { CopyButton } from "./copy-button";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";
import type { ShareActions } from "./use-share-actions";

/**
 * The files behind a share, each with its download count and direct link. While
 * the share is active, files can be added (button or drop) and removed.
 */
export function ShareFiles({
  share,
  actions,
  qrFileId,
  onToggleQr,
}: {
  share: Share;
  actions: ShareActions;
  /** The file whose direct link the inspector's QR code currently shows. */
  qrFileId: string | null;
  onToggleQr: (fileId: string) => void;
}) {
  const active = share.status === "active";
  const limit = share.downloadLimit;
  const many = share.files.length > 1;
  return (
    <section aria-label="Files in this link" className="flex flex-col gap-1.5">
      <div className="flex h-7 items-center justify-between">
        <span className="text-[11px] text-muted">
          {share.files.length === 1 ? "1 file" : `${share.files.length} files`}
          {limit !== null && many && ` · up to ${limit} per file`}
        </span>
        {active && (
          <Button size="sm" variant="ghost" onClick={() => actions.addFiles(share)}>
            <FilePlus2 aria-hidden="true" size={14} />
            Add files…
          </Button>
        )}
      </div>
      {share.files.length === 0 ? (
        <div className="flex h-16 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-[12px] text-muted">
          <span className="font-medium text-fg">No files yet</span>
          {active && <span>Add files, or drag them onto the right half of the window.</span>}
        </div>
      ) : (
        <ul className="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-line bg-bg/60 p-1">
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
                  className="group flex h-10 items-center gap-2 rounded-lg pr-0.5 pl-1.5"
                >
                  <FileGlyph
                    kind={file.kind}
                    muted={!active || exhausted}
                    className="size-7 rounded-lg [&_svg]:size-4"
                  />
                  <FileName name={file.name} className="flex-1 text-[12.5px] font-medium" />
                  <span className="text-[11px] text-muted tnum">{formatBytes(file.byteSize)}</span>
                  <span
                    className={cn(
                      "w-9 text-right text-[11px] tnum",
                      exhausted ? "text-danger" : "text-muted",
                    )}
                    title="Downloads started"
                  >
                    {limit === null ? `↓${file.downloadCount}` : `${file.downloadCount}/${limit}`}
                  </span>
                  {active && (
                    <span className="flex items-center opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <CopyButton
                        iconOnly
                        icon={Link2}
                        variant="ghost"
                        size="iconSm"
                        label={`Copy direct link to ${file.name}`}
                        copiedLabel="Direct link copied"
                        disabled={!file.link || exhausted}
                        onCopy={() => actions.copyFileLink(share, file)}
                      />
                      <Button
                        size="iconSm"
                        variant="ghost"
                        aria-label={`Show QR code for ${file.name}`}
                        aria-pressed={qrFileId === file.id}
                        disabled={!file.link || exhausted}
                        className={cn(qrFileId === file.id && "bg-accent-soft text-accent-strong")}
                        onClick={() => onToggleQr(file.id)}
                      >
                        <QrCode aria-hidden="true" size={14} />
                      </Button>
                      {/* The last file stays; "Stop sharing" ends the link instead. */}
                      {many && (
                        <Button
                          size="iconSm"
                          variant="ghost"
                          aria-label={`Remove ${file.name} from this link`}
                          onClick={() => actions.removeFile(share, file.id)}
                        >
                          <X aria-hidden="true" size={14} />
                        </Button>
                      )}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {active && share.files.length > 0 && (
        <span className="text-[11px] text-faint">
          Drag files onto the right half of the window to add them. Everyone with the link sees
          them.
        </span>
      )}
    </section>
  );
}
