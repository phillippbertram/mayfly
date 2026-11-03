import { EyeOff, Power } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Switch } from "../../components/ui/switch";
import { useBackend } from "../../hooks/use-backend";
import { isMac } from "../../lib/platform";
import { useUpdateSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";

const TRAY = isMac ? "the menu bar" : "the system tray";

function shareCount(count: number) {
  return count === 1 ? "1 active share" : `${count} active shares`;
}

/**
 * Shown the first time the window closes: Mayfly keeps sharing in the
 * background and returns from the tray. Hiding is the default action.
 */
export function CloseNoticeDialog({ activeShares }: { activeShares: number }) {
  const open = useUi((s) => s.overlay === "closeNotice");
  const setOverlay = useUi((s) => s.setOverlay);
  const backend = useBackend();
  const updateSettings = useUpdateSettings();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const close = () => setOverlay(null);

  const hide = async () => {
    if (dontShowAgain) updateSettings.mutate({ showCloseNotice: false });
    close();
    await backend.hideWindow();
  };

  return (
    <Modal open={open} onClose={close} labelledBy="close-notice-title" className="w-[420px] p-5">
      <div className="flex gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <EyeOff aria-hidden="true" size={19} strokeWidth={1.7} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="close-notice-title" className="text-[15px] font-semibold">
            Mayfly keeps sharing in the background
          </h2>
          <p className="text-[13px] leading-5 text-muted">
            Closing the window only hides it
            {activeShares > 0 ? `; ${shareCount(activeShares)} keep working` : ""}. Open Mayfly
            again from {TRAY}, and quit there to stop all shares.
          </p>
        </div>
      </div>
      <label
        htmlFor="close-notice-again"
        className="mt-4 flex items-center gap-2.5 text-[12px] text-muted"
      >
        <Switch
          id="close-notice-again"
          checked={dontShowAgain}
          onCheckedChange={setDontShowAgain}
        />
        Don't show this again
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => backend.quit()}>
          <Power aria-hidden="true" size={14} />
          Quit Mayfly
        </Button>
        <Button variant="primary" onClick={hide} data-autofocus>
          Hide window
        </Button>
      </div>
    </Modal>
  );
}

/** Confirms quitting while shares are active; their links stop working. */
export function QuitDialog({ activeShares }: { activeShares: number }) {
  const open = useUi((s) => s.overlay === "quit");
  const setOverlay = useUi((s) => s.setOverlay);
  const backend = useBackend();
  const close = () => setOverlay(null);

  return (
    <Modal open={open} onClose={close} labelledBy="quit-title" className="w-[380px] p-5">
      <div className="flex gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Power aria-hidden="true" size={19} strokeWidth={1.7} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="quit-title" className="text-[15px] font-semibold">
            Quit Mayfly?
          </h2>
          <p className="text-[13px] leading-5 text-muted">
            {activeShares > 0
              ? `${shareCount(activeShares)} stop immediately, and downloads in progress are cut off.`
              : "Nothing is being shared right now."}{" "}
            Links don't work again after a restart.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={close} data-autofocus>
          Keep sharing
        </Button>
        <Button variant="dangerSolid" onClick={() => backend.quit()}>
          Quit
        </Button>
      </div>
    </Modal>
  );
}
