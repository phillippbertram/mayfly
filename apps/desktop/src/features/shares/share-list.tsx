import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { Tooltip } from "../../components/ui/tooltip";
import { useNow } from "../../hooks/use-now";
import type { Share } from "../../lib/backend";
import { formatRemaining, remainingMs } from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { ActiveShareRow, FinishedShareRow } from "./share-row";
import type { ShareActions } from "./use-share-actions";

/** Shares in display order: the active group first, then the finished group. */
export function ShareList({ shares, actions }: { shares: Share[]; actions: ShareActions }) {
  const now = useNow();
  const selectedId = useUi((s) => s.selectedId);
  const select = useUi((s) => s.select);
  const setOverlay = useUi((s) => s.setOverlay);
  const mountedAt = useRef(Date.now());

  const active = shares.filter((s) => s.status === "active");
  const finished = shares.filter((s) => s.status !== "active");
  const nextEnd = active
    .map((s) => remainingMs(s, now))
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b)[0];
  const summary =
    active.length === 0
      ? "Nothing is shared right now"
      : `${active.length === 1 ? "1 file" : `${active.length} files`} · ${
          nextEnd === undefined ? "until you stop them" : `next ends in ${formatRemaining(nextEnd)}`
        }`;

  const showQr = (id: string) => {
    select(id);
    useUi.getState().pulseQr();
  };

  return (
    <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
      <div className="flex h-9 shrink-0 items-center justify-between px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold">Sharing now</h2>
          <span className="text-[12px] text-muted tnum">{summary}</span>
        </div>
        <AnimatePresence initial={false}>
          {active.length > 0 && (
            <motion.div
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

      <ul aria-label="Active shares" className="pt-1">
        <AnimatePresence initial={false}>
          {active.map((share, index) => (
            <ActiveShareRow
              key={share.id}
              share={share}
              now={now}
              position={index + 1}
              selected={share.id === selectedId}
              fresh={share.createdAt > mountedAt.current}
              actions={actions}
              onSelect={select}
              onShowQr={showQr}
            />
          ))}
        </AnimatePresence>
      </ul>
      <AnimatePresence initial={false}>
        {active.length === 0 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <span className="flex items-center gap-1.5 rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-[12px] text-muted">
              Drop files or press <Kbd hotkey={appHotkeys["files.choose"].hotkey} /> to share
              something new.
            </span>
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {finished.length > 0 && (
          <motion.section
            key="finished"
            aria-label="Finished shares"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-5"
          >
            <div className="mb-1.5 flex h-7 items-center justify-between px-1">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase tnum">
                Finished · {finished.length}
              </span>
              <Tooltip
                label="Clear finished shares"
                hotkey={appHotkeys["shares.clearFinished"].hotkey}
              >
                <Button size="sm" variant="ghost" onClick={() => actions.clearFinished()}>
                  Clear
                </Button>
              </Tooltip>
            </div>
            <ul className="overflow-hidden rounded-[12px] border border-line">
              <AnimatePresence initial={false}>
                {finished.map((share, index) => (
                  <FinishedShareRow
                    key={share.id}
                    share={share}
                    position={active.length + index + 1}
                    selected={share.id === selectedId}
                    actions={actions}
                    onSelect={select}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
