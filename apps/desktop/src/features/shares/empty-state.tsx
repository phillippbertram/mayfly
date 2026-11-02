import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import type { ServerState } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { shortcutLabel } from "../../lib/platform";
import { HopIllustration } from "./hop-illustration";

export function EmptyState({
  server,
  dragging,
  onChoose,
}: {
  server: ServerState;
  dragging: boolean;
  onChoose: () => void;
}) {
  const [hover, setHover] = useState(false);
  const online = server.kind === "online";
  const active = online && (hover || dragging);
  const blocked =
    server.kind === "unavailable"
      ? server.message
      : server.kind === "starting"
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
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[14px] px-10 text-center transition-colors duration-300",
          active && "bg-accent-soft/40",
        )}
      >
        <motion.div
          animate={{ y: active ? -4 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <HopIllustration active={active} />
        </motion.div>
        <h1 className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
          {dragging ? "Drop to share" : "Share a file with your phone"}
        </h1>
        <p className="max-w-[380px] text-[13px] leading-5 text-muted">
          Drop files here or choose them. Nothing leaves your network, and every share ends on its
          own.
        </p>
        <Button
          variant="primary"
          size="lg"
          className="mt-1.5"
          disabled={!online}
          onClick={onChoose}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={2} />
          Choose files…
        </Button>
        {blocked ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="max-w-[360px] text-[12px] text-muted"
          >
            {blocked}
          </motion.p>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px] text-faint">
            or press <Kbd>{shortcutLabel("Mod+O")}</Kbd>
          </span>
        )}
      </div>
    </motion.div>
  );
}
