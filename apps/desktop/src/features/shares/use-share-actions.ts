import { useMemo } from "react";
import { useToast } from "../../components/ui/toast";
import { useBackend } from "../../hooks/use-backend";
import type { Result, Share } from "../../lib/backend";
import { splitFileName } from "../../lib/format";
import { copyQrImage, qrPng } from "../../lib/qr";

export function useShareActions(onCreated?: (share: Share) => void) {
  const backend = useBackend();
  const toast = useToast();

  return useMemo(() => {
    const report = <T>(result: Result<T>): result is { ok: true; value: T } => {
      if (!result.ok) toast(result.error, "error");
      return result.ok;
    };

    return {
      async chooseFiles() {
        const result = await backend.chooseFiles();
        if (report(result) && result.value[0]) onCreated?.(result.value[0]);
      },
      async copyLink(share: Share): Promise<boolean> {
        if (!share.link) {
          toast(share.linkError ?? "This share has no link right now.", "error");
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
      async copyQr(share: Share): Promise<boolean> {
        if (!share.link) return false;
        try {
          await copyQrImage(share.link);
          return true;
        } catch {
          toast("The QR image couldn't be copied.", "error");
          return false;
        }
      },
      async saveQr(share: Share) {
        if (!share.link) return;
        try {
          const png = await qrPng(share.link);
          const result = await backend.savePng(`${splitFileName(share.fileName).base}-qr.png`, png);
          if (report(result)) toast("QR code saved.", "success");
        } catch {
          toast("The QR image couldn't be created.", "error");
        }
      },
      async stop(share: Share) {
        report(await backend.stopShare(share.id));
      },
      async stopAll() {
        report(await backend.stopAll());
      },
      async remove(share: Share) {
        report(await backend.removeShare(share.id));
      },
      async clearFinished() {
        report(await backend.clearFinished());
      },
      async shareAgain(share: Share) {
        const result = await backend.shareAgain(share.id);
        if (report(result)) onCreated?.(result.value);
      },
      async setProfile(share: Share, profileId: string) {
        report(await backend.setShareProfile(share.id, profileId));
      },
    };
  }, [backend, toast, onCreated]);
}

export type ShareActions = ReturnType<typeof useShareActions>;
