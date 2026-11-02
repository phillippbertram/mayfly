import { Ban, CircleStop, LoaderCircle, TimerOff } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { Tooltip } from "../../components/ui/tooltip";
import { useSignal } from "../../hooks/use-signal";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { QrCode } from "./qr-code";

const ENDED = {
  expired: { icon: TimerOff, label: "This link expired" },
  stopped: { icon: CircleStop, label: "Sharing stopped" },
  limitReached: { icon: Ban, label: "Download limit reached" },
} as const;

export function QrCard({
  share,
  pulse,
  onCopy,
}: {
  share: Share;
  /** Incrementing this plays a short "look here" bounce. */
  pulse: number;
  onCopy: () => void;
}) {
  const ended = share.status === "active" ? null : ENDED[share.status];
  const size = 196;
  const interactive = Boolean(share.link) && !ended;
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  useSignal(pulse, () => {
    if (scope.current)
      animate(scope.current, { scale: [1, 1.045, 0.99, 1] }, { duration: 0.5, ease: "easeOut" });
  });

  const body = (
    <motion.button
      ref={scope}
      type="button"
      disabled={!interactive}
      onClick={onCopy}
      aria-label="Copy QR image"
      whileHover={interactive ? { y: -2 } : {}}
      whileTap={interactive ? { scale: 0.98 } : {}}
      className={cn(
        "relative block rounded-2xl border border-line bg-qr p-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        "transition-shadow duration-300",
        interactive && "hover:shadow-[0_10px_30px_-10px_hsl(var(--shadow-color)/0.35)]",
      )}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <AnimatePresence mode="wait">
          {share.link ? (
            <QrCode key={share.link} text={share.link} size={size} />
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 px-6 text-center text-[12px] text-[#6b7280]"
            >
              <LoaderCircle aria-hidden="true" size={18} className="spin" />
              {share.linkError ?? "Waiting for a network address"}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {ended && (
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.35 }}
              className="absolute -inset-1 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 text-[#17191d]"
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
                className="flex size-10 items-center justify-center rounded-full bg-[#f0f1f3]"
              >
                <ended.icon aria-hidden="true" size={20} strokeWidth={1.7} />
              </motion.span>
              <span className="text-[13px] font-semibold">{ended.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );

  return interactive ? <Tooltip label="Click to copy the QR image">{body}</Tooltip> : body;
}
