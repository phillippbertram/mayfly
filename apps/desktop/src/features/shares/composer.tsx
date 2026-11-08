import { useHotkey } from "@tanstack/react-hotkeys";
import { CircleAlert, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { Modal } from "../../components/ui/modal";
import { Switch } from "../../components/ui/switch";
import type { ShareOptions } from "../../lib/backend";
import { formatBytes, formatClock } from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useSettings, useUpdateSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";
import { passwordProblem } from "./password";
import { PasswordField } from "./password-field";
import { LifetimeField, LimitField } from "./share-options";
import type { ShareActions } from "./use-share-actions";

/**
 * Options sheet shown before staged files become a share: how long it lasts,
 * how often each file may be downloaded, and an optional password. Files can
 * still be added or removed later. Enter shares right away.
 */
export function Composer({ actions }: { actions: ShareActions }) {
  const staged = useUi((s) => s.composer);
  const close = useUi((s) => s.closeComposer);
  const drop = useUi((s) => s.dropFromComposer);
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const [options, setOptions] = useState<ShareOptions>(actions.defaults);
  const [separate, setSeparate] = useState(false);
  const [protect, setProtect] = useState(false);
  // Plaintext only lives here until the share exists or the sheet closes.
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const open = staged !== null;
  const files = staged?.files ?? [];

  // Every new batch starts from the current defaults, with one link for all files.
  useEffect(() => {
    if (open) {
      setOptions(actions.defaults());
      setSeparate(false);
    }
    setProtect(false);
    setPassword("");
  }, [open, actions]);
  const many = files.length > 1;
  const split = many && separate;
  const problem = protect ? passwordProblem(password) : null;

  const cancel = () => {
    if (staged) actions.discardStaged(staged.files.map((f) => f.stageId));
    close();
  };

  const share = async () => {
    if (!staged || files.length === 0 || busy || problem) return;
    setBusy(true);
    const ok = await actions.createShares(
      files.map((f) => f.stageId),
      options,
      split,
      protect ? password : null,
    );
    setBusy(false);
    if (ok) {
      setPassword("");
      close();
    }
  };

  const [now] = useState(() => Date.now());
  const parts = [
    ...(split ? [`${files.length} separate links`] : []),
    options.lifetimeMinutes === null
      ? "until you stop it"
      : `until about ${formatClock(now + options.lifetimeMinutes * 60_000)}`,
    options.downloadLimit === null
      ? "unlimited downloads"
      : `${many && !split ? "each file " : ""}up to ${options.downloadLimit} ${options.downloadLimit === 1 ? "download" : "downloads"}`,
    ...(protect ? [split ? "one password for all links" : "password protected"] : []),
  ].join(" · ");
  const summary = parts.charAt(0).toUpperCase() + parts.slice(1);

  return (
    <Modal
      open={open}
      onClose={cancel}
      labelledBy="composer-title"
      className="flex w-[640px] flex-col"
    >
      <ComposerHotkeys onShare={share} />
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h2
            id="composer-title"
            className="text-[17px] leading-[22px] font-semibold tracking-[-0.01em]"
          >
            Share {files.length === 1 ? "1 file" : `${files.length} files`}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Choose how long the link works and how often it can be used.
          </p>
        </div>
      </div>

      <ul className="mx-6 mt-4 flex max-h-[148px] flex-col gap-1 overflow-y-auto rounded-xl border border-line bg-bg/60 p-1.5">
        <AnimatePresence initial={false}>
          {files.map((file, i) => (
            <motion.li
              key={file.stageId}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              className="group flex h-11 items-center gap-2.5 rounded-lg px-2 hover:bg-surface"
            >
              <FileGlyph kind={file.kind} className="size-8 rounded-lg" />
              <FileName name={file.fileName} className="flex-1 text-[13px] font-medium" />
              <span className="text-[12px] text-muted tnum">{formatBytes(file.byteSize)}</span>
              {files.length > 1 && (
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`Don't share ${file.fileName}`}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => {
                    actions.discardStaged([file.stageId]);
                    drop(file.stageId);
                  }}
                >
                  <X aria-hidden="true" size={14} />
                </Button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {staged && staged.rejected.length > 0 && (
        <p className="mx-6 mt-2 flex items-center gap-1.5 text-[12px] text-warning-strong">
          <CircleAlert aria-hidden="true" size={13} />
          {staged.rejected.length === 1
            ? "1 item was skipped"
            : `${staged.rejected.length} items were skipped`}
          : folders and other non-files can't be shared.
        </p>
      )}

      <div className="grid grid-cols-[96px_1fr] items-start gap-x-4 gap-y-4 px-6 pt-5">
        <span className="pt-1.5 text-[13px] font-medium">Lifetime</span>
        <LifetimeField
          value={options.lifetimeMinutes}
          onChange={(lifetimeMinutes) => setOptions((o) => ({ ...o, lifetimeMinutes }))}
        />
        <span className="pt-1.5 text-[13px] font-medium">Downloads</span>
        <LimitField
          value={options.downloadLimit}
          onChange={(downloadLimit) => setOptions((o) => ({ ...o, downloadLimit }))}
        />
        <span className="pt-1.5 text-[13px] font-medium">Password</span>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="protect-share"
            className="flex h-8 items-center gap-2.5 text-[12px] text-muted"
          >
            <Switch id="protect-share" checked={protect} onCheckedChange={setProtect} />
            Protect with a password
          </label>
          <AnimatePresence initial={false}>
            {protect && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1.5 p-0.5">
                  <PasswordField
                    id="share-password"
                    value={password}
                    onChange={setPassword}
                    onGenerate={actions.generatePassword}
                    describedBy="share-password-hint"
                    invalid={password.length > 0 && problem !== null}
                    autoFocus
                  />
                  <p id="share-password-hint" className="text-[11.5px] text-muted">
                    {password.length > 0 && problem
                      ? problem
                      : "Send it separately from the link. Mayfly can't show it again later."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {many && (
        <label
          htmlFor="separate-links"
          className="mx-6 mt-4 flex items-center gap-2.5 text-[12px] text-muted"
        >
          <Switch id="separate-links" checked={separate} onCheckedChange={setSeparate} />
          <span>
            Give each file its own link
            <span className="text-faint"> — for different people or separate QR codes</span>
          </span>
        </label>
      )}

      <motion.p
        key={summary}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="mx-6 mt-5 rounded-lg bg-accent-soft/60 px-3 py-2 text-[12px] text-accent-strong tnum"
      >
        {summary}.
      </motion.p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <label
          htmlFor="ask-before-sharing"
          className="flex items-center gap-2.5 text-[12px] text-muted"
        >
          <Switch
            id="ask-before-sharing"
            checked={settings.confirmBeforeSharing}
            onCheckedChange={(confirmBeforeSharing) =>
              updateSettings.mutate({ confirmBeforeSharing })
            }
          />
          Ask before sharing
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={cancel}>Cancel</Button>
          <Button
            variant="primary"
            size="lg"
            disabled={files.length === 0 || busy || problem !== null}
            onClick={share}
            data-autofocus
          >
            <Send aria-hidden="true" size={15} strokeWidth={1.8} />
            Share
            <Kbd hotkey={appHotkeys["composer.share"].hotkey} inverted />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ComposerHotkeys({ onShare }: { onShare: () => void }) {
  useHotkey(appHotkeys["composer.share"], onShare, { ignoreInputs: false });
  return null;
}
