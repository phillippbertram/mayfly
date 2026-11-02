import { X } from "lucide-react";
import { IconButton } from "../../components/ui/icon-button";
import { Kbd } from "../../components/ui/kbd";
import { Modal } from "../../components/ui/modal";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { ShortcutList } from "./shortcut-list";

export function ShortcutsDialog() {
  const open = useUi((s) => s.overlay === "shortcuts");
  const setOverlay = useUi((s) => s.setOverlay);
  return (
    <Modal
      open={open}
      onClose={() => setOverlay(null)}
      labelledBy="shortcuts-title"
      className="w-[680px] p-6"
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 id="shortcuts-title" className="text-[17px] leading-[22px] font-semibold">
            Keyboard shortcuts
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
            Everything is also in the command palette{" "}
            <Kbd hotkey={appHotkeys["palette.open"].hotkey} />
          </p>
        </div>
        <IconButton icon={X} label="Close" onClick={() => setOverlay(null)} />
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <ShortcutList />
      </div>
    </Modal>
  );
}
