import { useHotkey } from "@tanstack/react-hotkeys";
import { CircleAlert, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import type { ShareOptions } from "../../lib/backend";
import { HTTP_PROFILE_ID } from "../../lib/backend/types";
import { formatBytes, formatClock } from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useProfiles, useSettings, useUpdateSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";
import { FileGlyph } from "./file-glyph";
import { FileName } from "./file-name";
import { LifetimeField, LimitField } from "./share-options";
import type { ShareActions } from "./use-share-actions";

/** Options sheet shown before staged files become shares. Enter shares right away. */
export function Composer({ actions }: { actions: ShareActions }) {
  const staged = useUi((s) => s.composer);
  const close = useUi((s) => s.closeComposer);
  const drop = useUi((s) => s.dropFromComposer);
  const settings = useSettings();
  const profiles = useProfiles();
  const updateSettings = useUpdateSettings();
  const [options, setOptions] = useState<ShareOptions>(actions.defaults);
  const [busy, setBusy] = useState(false);
  const open = staged !== null;
  const files = staged?.files ?? [];

  // Every new batch starts from the current defaults.
  useEffect(() => {
    if (open) setOptions(actions.defaults());
  }, [open, actions]);

  const cancel = () => {
    if (staged) actions.discardStaged(staged.files.map((f) => f.stageId));
    close();
  };

  const share = async () => {
    if (!staged || files.length === 0 || busy) return;
    setBusy(true);
    const ok = await actions.createShares(
      files.map((f) => f.stageId),
      options,
    );
    setBusy(false);
    if (ok) close();
  };

  const [now] = useState(() => Date.now());
  const summary = [
    options.lifetimeMinutes === null
      ? "Until you stop it"
      : `Until about ${formatClock(now + options.lifetimeMinutes * 60_000)}`,
    options.downloadLimit === null
      ? "unlimited downloads"
      : `up to ${options.downloadLimit} ${options.downloadLimit === 1 ? "download" : "downloads"}`,
  ].join(" · ");

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
        <span className="pt-1.5 text-[13px] font-medium">Link</span>
        <Select
          label="Link profile"
          className="w-64"
          value={options.profileId}
          onValueChange={(profileId) => setOptions((o) => ({ ...o, profileId }))}
          options={profiles.map((p) => ({
            value: p.id,
            label: p.id === HTTP_PROFILE_ID ? "HTTP (download page)" : p.name,
          }))}
        />
      </div>

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
            disabled={files.length === 0 || busy}
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
