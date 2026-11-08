import { Plus } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { Tooltip } from "../../components/ui/tooltip";
import type { ServerState } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { appHotkeys } from "../../lib/hotkeys";
import { DEVICES } from "./flight-devices";
import { FlightIllustration } from "./flight-illustration";

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export function EmptyState({
  server,
  dragging,
  onChoose,
  onNewEmpty,
}: {
  server: ServerState | undefined;
  dragging: boolean;
  onChoose: () => void;
  /** Creates a link without files, to open elsewhere first and fill later. */
  onNewEmpty: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [device, setDevice] = useState(0);
  const receiver = DEVICES[device % DEVICES.length] ?? DEVICES[0];
  const online = server?.kind === "online";
  const active = online && (hover || dragging);
  const blocked =
    server?.kind === "unavailable"
      ? server.message
      : !server || server.kind === "starting"
        ? "Starting the local server…"
        : !online
          ? "Sharing resumes when the server is back online."
          : null;

  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="relative flex flex-1 p-6"
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-[25px] h-[calc(100%-50px)] w-[calc(100%-50px)] overflow-visible"
      >
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="14"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="7 7"
          className={cn(
            "transition-[stroke] duration-300",
            active ? "dash-march stroke-accent" : "stroke-line-strong",
          )}
        />
      </svg>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-3 rounded-[14px] px-10 text-center transition-colors duration-500",
          active && "bg-accent-soft/35",
        )}
      >
        <motion.div variants={rise}>
          <motion.div
            animate={{ y: active ? -4 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <FlightIllustration
              active={active}
              dimmed={!online}
              device={device}
              onCycle={() => setDevice((d) => (d + 1) % DEVICES.length)}
            />
          </motion.div>
        </motion.div>
        <motion.h1
          variants={rise}
          className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.015em]"
        >
          {dragging ? (
            "Drop to share"
          ) : (
            <>
              <span className="sr-only">Share a file with any device on your network</span>
              <span aria-hidden="true" className="inline-flex items-baseline gap-[0.28em]">
                Share a file with your
                <span className="relative inline-flex overflow-hidden text-accent">
                  <span className="invisible">computer</span>
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={receiver.id}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                      className="absolute inset-y-0 left-0"
                    >
                      {receiver.label}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </>
          )}
        </motion.h1>
        <motion.p variants={rise} className="max-w-[400px] text-[13px] leading-5 text-muted">
          Phone, tablet, or another computer: anything with a browser on your network can download
          it. Nothing leaves your network, and each share lives only as long as you let it.
        </motion.p>
        <motion.div variants={rise} className="mt-1.5 flex items-center gap-2">
          <Button variant="primary" size="lg" disabled={!online} onClick={onChoose}>
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
            Choose files…
          </Button>
          <Tooltip
            label="Open the link on the other device first, then add files"
            hotkey={appHotkeys["shares.newEmpty"].hotkey}
          >
            <Button variant="ghost" size="lg" disabled={!online} onClick={onNewEmpty}>
              New empty link
            </Button>
          </Tooltip>
        </motion.div>
        <motion.div variants={rise}>
          {blocked ? (
            <p role="status" className="max-w-[360px] text-[12px] text-muted">
              {blocked}
            </p>
          ) : (
            <span className="flex items-center gap-2 text-[12px] text-faint">
              <span className="flex items-center gap-1.5">
                or press <Kbd hotkey={appHotkeys["files.choose"].hotkey} />
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                commands <Kbd hotkey={appHotkeys["palette.open"].hotkey} />
              </span>
            </span>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
