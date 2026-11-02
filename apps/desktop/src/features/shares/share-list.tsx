import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { useNow } from "../../hooks/use-now";
import type { LinkProfile, Share } from "../../lib/backend";
import { ShareRow } from "./share-row";
import type { ShareActions } from "./use-share-actions";

export function ShareList({
  shares,
  profiles,
  selectedId,
  actions,
  onSelect,
  onShowQr,
  onStopAll,
}: {
  shares: Share[];
  profiles: LinkProfile[];
  selectedId: string | null;
  actions: ShareActions;
  onSelect: (id: string) => void;
  onShowQr: (id: string) => void;
  onStopAll: () => void;
}) {
  const now = useNow();
  const mountedAt = useRef(Date.now());
  const active = shares.filter((s) => s.status === "active").length;
  const finished = shares.length - active;

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
                <Button size="sm" variant="ghost" onClick={() => actions.clearFinished()}>
                  Clear finished
                </Button>
              </motion.div>
            )}
            {active > 0 && (
              <motion.div
                key="stop"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
              >
                <Button size="sm" variant="danger" onClick={onStopAll}>
                  Stop all
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <ul aria-label="Shares" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-4">
        <AnimatePresence initial={false}>
          {shares.map((share) => (
            <ShareRow
              key={share.id}
              share={share}
              now={now}
              selected={share.id === selectedId}
              fresh={share.createdAt > mountedAt.current}
              profiles={profiles}
              actions={actions}
              onSelect={() => onSelect(share.id)}
              onShowQr={() => onShowQr(share.id)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
