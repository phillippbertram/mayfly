import { ArrowUpRight, BookOpen, Bug, Copy, Heart, type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand-mark";
import { IconButton } from "../../components/ui/icon-button";
import { Modal } from "../../components/ui/modal";
import { Tooltip } from "../../components/ui/tooltip";
import { useBackend } from "../../hooks/use-backend";
import { useToast } from "../../hooks/use-toast";
import type { ExternalLink } from "../../lib/backend";
import { errorMessage, useAppInfo } from "../../lib/queries";
import { useUi } from "../../store/ui";

/** GitHub's mark; Lucide no longer ships brand icons. */
function GitHubMark({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const LINKS: { link: ExternalLink; label: string; detail: string; icon: LucideIcon | null }[] = [
  {
    link: "website",
    label: "Website & user manual",
    detail: "phillippbertram.github.io/mayfly",
    icon: BookOpen,
  },
  {
    link: "repository",
    label: "Source code",
    detail: "github.com/phillippbertram/mayfly",
    icon: null,
  },
  { link: "issues", label: "Report an issue", detail: "Bugs, ideas, and questions", icon: Bug },
];

export function AboutDialog() {
  const open = useUi((s) => s.overlay === "about");
  const setOverlay = useUi((s) => s.setOverlay);
  const backend = useBackend();
  const toast = useToast();
  const info = useAppInfo();
  const close = () => setOverlay(null);

  const visit = (link: ExternalLink) =>
    backend.openLink(link).catch((error) => toast(errorMessage(error)));

  // One line for bug reports: the version plus the commit it was built from.
  const copyVersion = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(
        `Mayfly ${info.version}${info.build ? ` (build ${info.build})` : ""}`,
      );
      toast("Version copied.", "success");
    } catch {
      toast("The version couldn't be copied.", "error");
    }
  };

  return (
    <Modal open={open} onClose={close} labelledBy="about-title" className="w-[400px] p-6">
      <div className="absolute top-3 right-3">
        <IconButton icon={X} label="Close" onClick={close} />
      </div>
      <div className="flex flex-col items-center text-center">
        <BrandMark size={56} className="shadow-[var(--shadow-pop)]" />
        <h2
          id="about-title"
          className="mt-4 text-[20px] leading-7 font-semibold tracking-[-0.01em]"
        >
          mayfly
        </h2>
        <Tooltip label="Copy version and build">
          <button
            type="button"
            onClick={copyVersion}
            disabled={!info}
            aria-label={
              info
                ? `Copy version ${info.version}${info.build ? `, build ${info.build}` : ""}`
                : undefined
            }
            className="group mt-1 flex items-center gap-1.5 rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted tabular-nums transition-colors hover:text-fg focus-visible:text-fg"
          >
            {info ? `Version ${info.version}` : "Version …"}
            {info?.build && (
              <>
                <span aria-hidden="true">·</span>
                {`Build ${info.build}`}
              </>
            )}
            <Copy
              aria-hidden="true"
              size={11}
              strokeWidth={1.8}
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
        </Tooltip>
        <p className="mt-4 text-[14px] font-medium">Files that live for a moment.</p>
        <p className="mt-1.5 max-w-[300px] text-[12.5px] leading-5 text-muted">
          Temporary file sharing from your desktop to any browser on the same network. No cloud, no
          account, no app on the other side.
        </p>
      </div>

      <ul className="mt-5 flex flex-col overflow-hidden rounded-lg border border-line">
        {LINKS.map((item) => (
          <li key={item.link} className="border-line not-first:border-t">
            <LinkRow
              icon={item.icon ? <item.icon size={15} strokeWidth={1.7} /> : <GitHubMark />}
              label={item.label}
              detail={item.detail}
              onClick={() => visit(item.link)}
              autoFocus={item.link === "website"}
            />
          </li>
        ))}
      </ul>

      <p className="mt-5 flex flex-wrap items-center justify-center gap-1 text-[12px] text-muted">
        Made with
        <Heart aria-label="love" size={12} strokeWidth={2} className="fill-accent text-accent" />
        by
        <button
          type="button"
          onClick={() => visit("author")}
          className="font-medium text-fg underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-accent"
        >
          Phillipp Bertram
        </button>
        <span aria-hidden="true">·</span>© {new Date().getFullYear()}
      </p>
    </Modal>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  onClick,
  autoFocus,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
  autoFocus: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={autoFocus || undefined}
      className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg transition-colors group-hover:bg-surface">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="truncate text-[11.5px] text-muted">{detail}</span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        size={14}
        strokeWidth={1.8}
        className="text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
      />
    </button>
  );
}
