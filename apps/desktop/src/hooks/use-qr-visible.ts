import { useSettings } from "../lib/queries";
import { useUi } from "../store/ui";

/** Whether a share's QR code and link token are shown, honoring the hide-codes setting. */
export function useQrVisible(shareId: string | undefined): boolean {
  const { hideCodes } = useSettings();
  const override = useUi((s) => (shareId ? s.qrVisibility[shareId] : undefined));
  return override ?? !hideCodes;
}

/** Masks token-like runs in a link so it can be shown while codes are hidden. */
export function maskLink(link: string): string {
  return link.replace(/[A-Za-z0-9_-]{16,}/g, "••••••••••");
}
