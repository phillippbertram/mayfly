import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";
import { useNow } from "../../hooks/use-now";
import type { Share } from "../../lib/backend";
import { appHotkeys } from "../../lib/hotkeys";
import { useProfiles } from "../../lib/queries";
import { useUi } from "../../store/ui";
import { ShareRow } from "./share-row";
import type { ShareActions } from "./use-share-actions";

export function ShareList({ shares, actions }: { shares: Share[]; actions: ShareActions }) {
  const now = useNow();
  const profiles = useProfiles();
  const selectedId = useUi((s) => s.selectedId);
  const select = useUi((s) => s.select);
  const setOverlay = useUi((s) => s.setOverlay);
  const mountedAt = useRef(Date.now());
  const active = shares.filter((s) => s.status === "active").length;
  const finished = shares.length - active;

  const showQr = (id: string) => {
    select(id);
    useUi.getState().pulseQr();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold">Shares</h2>
          <motion.span
            key={`${active}-${finished}`}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="text-[12px] text-muted tnum"
          >
            {active} active{finished > 0 ? ` · ${finished} finished` : ""}
          </motion.span>
        </div>
        <div className="flex gap-1">
          <AnimatePresence initial={false}>
            {finished > 0 && (
              <motion.div
                key="clear"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
              >
                <Tooltip
                  label="Clear finished shares"
                  hotkey={appHotkeys["shares.clearFinished"].hotkey}
                >
                  <Button size="sm" variant="ghost" onClick={() => actions.clearFinished()}>
                    Clear finished
                  </Button>
                </Tooltip>
              </motion.div>
            )}
            {active > 0 && (
              <motion.div
                key="stop"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
              >
                <Tooltip label="Stop all shares" hotkey={appHotkeys["shares.stopAll"].hotkey}>
                  <Button size="sm" variant="danger" onClick={() => setOverlay("stopAll")}>
                    Stop all
                  </Button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <ul aria-label="Shares" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-4">
        <AnimatePresence initial={false}>
          {shares.map((share, index) => (
            <ShareRow
              key={share.id}
              share={share}
              now={now}
              position={index + 1}
              selected={share.id === selectedId}
              fresh={share.createdAt > mountedAt.current}
              profiles={profiles}
              actions={actions}
              onSelect={select}
              onShowQr={showQr}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
