import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useToast } from "../../components/ui/toast";
import { useBackend } from "../../hooks/use-backend";
import type { DroppedFiles, Share, ShareFile, ShareOptions, StagedFiles } from "../../lib/backend";
import { splitFileName } from "../../lib/format";
import { copyQrImage, qrPng } from "../../lib/qr";
import { errorMessage, queryKeys, useSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";

/** All share commands, with errors reported as toasts. */
export function useShareActions() {
  const backend = useBackend();
  const toast = useToast();
  const client = useQueryClient();
  const settings = useSettings();

  return useMemo(() => {
    const run = async <T>(task: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await task();
      } catch (error) {
        toast(errorMessage(error), "error");
        return undefined;
      }
    };

    const defaults = (): ShareOptions => ({
      lifetimeMinutes: settings.defaultLifetimeMinutes,
      downloadLimit: settings.defaultDownloadLimit,
    });

    /** Select the newest share once the list contains it. */
    const reveal = async (shares: Share[]) => {
      await client.invalidateQueries({ queryKey: queryKeys.shares });
      const first = shares[0];
      if (first) useUi.getState().select(first.id);
      if (shares.length > 1) toast(`${shares.length} files are now shared.`, "success");
    };

    /** All files go behind one link unless `separate` asks for one link per file. */
    const createShares = async (stageIds: string[], options: ShareOptions, separate = false) => {
      const shares = await run(() => backend.createShares(stageIds, options, separate));
      if (shares) await reveal(shares);
      return Boolean(shares);
    };

    /**
     * Copies a direct download link. Chat apps fetch links to build previews, and
     * for a direct link that fetch is a counted download; say so when it matters.
     */
    const copyDirect = async (share: Share, link: string | null): Promise<boolean> => {
      if (!link) {
        toast("This link isn't available until the network is.", "error");
        return false;
      }
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        toast("The link couldn't be copied.", "error");
        return false;
      }
      if (share.downloadLimit !== null)
        toast(
          "Direct link copied. Link previews in chat apps can use up a download; the share page never counts.",
        );
      return true;
    };

    /** Adds staged files to a share; rejected items are reported. */
    const addStaged = async (share: Share, staged: StagedFiles | null | undefined) => {
      if (!staged) return;
      for (const item of staged.rejected) toast(`${item.name}: ${item.reason}`, "error");
      if (staged.files.length === 0) return;
      const ids = staged.files.map((f) => f.stageId);
      const updated = await run(() => backend.addFiles(share.id, ids));
      if (!updated) {
        await run(() => backend.discardStaged(ids));
        return;
      }
      await client.invalidateQueries({ queryKey: queryKeys.shares });
      toast(
        ids.length === 1 ? "Added 1 file to the link." : `Added ${ids.length} files to the link.`,
        "success",
      );
    };

    const handleStaged = async (staged: StagedFiles | null | undefined) => {
      if (!staged) return;
      for (const item of staged.rejected) toast(`${item.name}: ${item.reason}`, "error");
      if (staged.files.length === 0) return;
      if (settings.confirmBeforeSharing) useUi.getState().openComposer(staged);
      else
        await createShares(
          staged.files.map((f) => f.stageId),
          defaults(),
        );
    };

    const update = (share: Share, patch: Parameters<typeof backend.updateShare>[1]) =>
      run(() => backend.updateShare(share.id, patch));

    return {
      defaults,
      createShares,
      chooseFiles: async () => handleStaged(await run(() => backend.pickFiles())),
      drop: async (files: DroppedFiles) =>
        handleStaged(await run(() => backend.stageDropped(files))),
      addFiles: async (share: Share) => addStaged(share, await run(() => backend.pickFiles())),
      /** A share without files: open its link elsewhere first, fill it afterwards. */
      async newEmptyShare() {
        const share = await run(() => backend.createEmptyShare());
        if (share) await reveal([share]);
      },
      /** A blank title returns to the name derived from the files. */
      rename: (share: Share, title: string | null) =>
        update(share, { title: title?.trim() ? title.trim() : null }),
      dropInto: async (share: Share, files: DroppedFiles) =>
        addStaged(share, await run(() => backend.stageDropped(files))),
      async removeFile(share: Share, fileId: string) {
        const updated = await run(() => backend.removeFile(share.id, fileId));
        if (updated) await client.invalidateQueries({ queryKey: queryKeys.shares });
      },
      discardStaged: (ids: string[]) => run(() => backend.discardStaged(ids)),

      async copyLink(share: Share): Promise<boolean> {
        if (!share.link) {
          toast("This share has no link until the network is available.", "error");
          return false;
        }
        try {
          await navigator.clipboard.writeText(share.link);
          return true;
        } catch {
          toast("The link couldn't be copied.", "error");
          return false;
        }
      },
      copyFileLink: (share: Share, file: ShareFile) => copyDirect(share, file.link),
      copyZipLink: (share: Share) => copyDirect(share, share.zipLink),
      /** Copies the QR image of the share page, or of `link` (a file's direct link). */
      async copyQr(share: Share, link: string | null = share.link): Promise<boolean> {
        if (!link) return false;
        try {
          await copyQrImage(link);
          return true;
        } catch {
          toast("The QR image couldn't be copied.", "error");
          return false;
        }
      },
      async saveQr(share: Share) {
        if (!share.link) return;
        const link = share.link;
        const saved = await run(async () => {
          const png = await qrPng(link);
          await backend.savePng(`${splitFileName(share.fileName).base}-qr.png`, png);
          return true;
        });
        if (saved) toast("QR code saved.", "success");
      },

      extend: async (share: Share, minutes: number | null) => {
        const updated = await update(share, { extendMinutes: minutes });
        if (updated)
          toast(
            minutes === null ? "Shared until you stop it." : `Added ${minutes} minutes.`,
            "success",
          );
      },
      setLimit: (share: Share, downloadLimit: number | null) => update(share, { downloadLimit }),
      stop: (share: Share) => run(() => backend.stopShare(share.id)),
      stopAll: () => run(() => backend.stopAll()),
      remove: (share: Share) => run(() => backend.removeShare(share.id)),
      clearFinished: () => run(() => backend.clearFinished()),
      async shareAgain(share: Share) {
        const created = await run(() => backend.shareAgain(share.id));
        if (created) await reveal([created]);
      },
    };
  }, [backend, client, settings, toast]);
}

export type ShareActions = ReturnType<typeof useShareActions>;
