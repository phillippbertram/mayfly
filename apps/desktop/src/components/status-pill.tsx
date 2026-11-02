import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ServerState } from "../lib/backend";
import { cn } from "../lib/cn";
import { Tooltip } from "./ui/tooltip";

type Tone = "accent" | "warning" | "danger" | "neutral";

function describe(server: ServerState): { tone: Tone; text: string; hint: string; busy: boolean } {
  switch (server.kind) {
    case "starting":
      return { tone: "neutral", text: "Starting…", hint: "Starting the local server", busy: true };
    case "online":
      return {
        tone: "accent",
        text: `${server.address}:${server.port}`,
        hint: `Online on ${server.interfaceName}. Open network settings`,
        busy: false,
      };
    case "noAddress":
      return {
        tone: "warning",
        text: "No network address",
        hint: "Connect to Wi‑Fi or Ethernet, then check network settings",
        busy: false,
      };
    case "bindFailed":
      return {
        tone: "danger",
        text: server.message,
        hint: "Change the port in network settings",
        busy: false,
      };
    case "stopping":
      return { tone: "neutral", text: "Stopping…", hint: "Stopping all shares", busy: true };
    case "unavailable":
      return { tone: "neutral", text: "Sharing unavailable", hint: server.message, busy: false };
  }
}

const DOT: Record<Tone, string> = {
  accent: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-faint",
};

export function StatusPill({ server, onOpen }: { server: ServerState; onOpen: () => void }) {
  const view = describe(server);
  const [pulse, setPulse] = useState(0);
  const previous = useRef(server.kind);

  useEffect(() => {
    if (previous.current !== server.kind) setPulse((p) => p + 1);
    previous.current = server.kind;
  }, [server.kind]);

  return (
    <Tooltip label={view.hint} side="bottom">
      <motion.button
        type="button"
        layout
        onClick={onOpen}
        aria-label={`Server status: ${view.text}. ${view.hint}`}
        whileTap={{ scale: 0.97 }}
        transition={{ layout: { type: "spring", stiffness: 500, damping: 38 } }}
        className={cn(
          "group flex h-7 items-center gap-2 overflow-hidden rounded-full border bg-surface pr-3 pl-2.5",
          "transition-[border-color,background-color,box-shadow] duration-200 hover:shadow-[var(--shadow-pop)]",
          view.tone === "danger"
            ? "border-danger/40"
            : view.tone === "warning"
              ? "border-warning/40"
              : "border-line hover:border-line-strong",
        )}
      >
        <motion.span
          layout="position"
          className="relative flex size-2.5 items-center justify-center"
        >
          {view.busy ? (
            <LoaderCircle aria-hidden="true" size={12} className="spin text-faint" />
          ) : (
            <>
              <span
                className={cn("size-2 rounded-full transition-colors duration-300", DOT[view.tone])}
              />
              <AnimatePresence>
                {pulse > 0 && (
                  <motion.span
                    key={pulse}
                    aria-hidden="true"
                    initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 3.2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    className={cn("absolute size-2 rounded-full", DOT[view.tone])}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </motion.span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={view.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className={cn("text-[12px] font-medium tnum", view.tone === "danger" && "text-danger")}
          >
            {view.text}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
}
