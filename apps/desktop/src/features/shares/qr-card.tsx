import { Ban, CircleStop, EyeOff, LoaderCircle, TimerOff } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { Tooltip } from "../../components/ui/tooltip";
import { useSignal } from "../../hooks/use-signal";
import type { Share } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { appHotkeys } from "../../lib/hotkeys";
import { QrCode } from "./qr-code";

const ENDED = {
  expired: { icon: TimerOff, label: "This link expired" },
  stopped: { icon: CircleStop, label: "Sharing stopped" },
  limitReached: { icon: Ban, label: "Download limit reached" },
} as const;

export function QrCard({
  share,
  link = share.link,
  pulse,
  visible,
  onToggleVisible,
  onCopy,
}: {
  share: Share;
  /** What the code encodes: the share page unless a file's direct link is shown. */
  link?: string | null;
  /** Incrementing this plays a short "look here" bounce. */
  pulse: number;
  /** `false` blurs the code, for screen sharing or presenting. */
  visible: boolean;
  onToggleVisible: () => void;
  onCopy: () => void;
}) {
  const ended = share.status === "active" ? null : ENDED[share.status];
  const size = 196;
  const hasCode = Boolean(link) && !ended;
  const hidden = hasCode && !visible;
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  useSignal(pulse, () => {
    if (scope.current)
      animate(scope.current, { scale: [1, 1.045, 0.99, 1] }, { duration: 0.5, ease: "easeOut" });
  });

  return (
    <div className="group/qr relative">
      <Tooltip
        label={hidden ? "Show QR code" : "Click to copy the QR image"}
        hotkey={hidden ? appHotkeys["qr.toggle"].hotkey : null}
      >
        <motion.button
          ref={scope}
          type="button"
          disabled={!hasCode}
          onClick={hidden ? onToggleVisible : onCopy}
          aria-label={hidden ? "Show QR code" : "Copy QR image"}
          whileHover={hasCode ? { y: -2 } : {}}
          whileTap={hasCode ? { scale: 0.98 } : {}}
          className={cn(
            "relative block overflow-hidden rounded-2xl border border-line bg-qr p-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
            "transition-shadow duration-300",
            hasCode && "hover:shadow-[0_10px_30px_-10px_hsl(var(--shadow-color)/0.35)]",
          )}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
          >
            <motion.div
              className="flex items-center justify-center"
              initial={false}
              animate={{
                filter: hidden ? "blur(14px)" : "blur(0px)",
                scale: hidden ? 1.06 : 1,
                opacity: hidden ? 0.55 : 1,
              }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="wait">
                {link ? (
                  <QrCode key={link} text={link} size={size} />
                ) : (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 px-6 text-center text-[12px] text-[#6b7280]"
                  >
                    <LoaderCircle aria-hidden="true" size={18} className="spin" />
                    Waiting for a network address
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <AnimatePresence>
              {hidden && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#17191d]"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgb(0_0_0/0.12)]">
                    <EyeOff aria-hidden="true" size={20} strokeWidth={1.7} />
                  </span>
                  <span className="text-[13px] font-semibold">QR code hidden</span>
                  <span className="text-[11px] text-[#4b5563]">Click to show</span>
                </motion.div>
              )}
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
      </Tooltip>
      {hasCode && !hidden && (
        <Tooltip label="Hide QR code" hotkey={appHotkeys["qr.toggle"].hotkey}>
          <button
            type="button"
            aria-label="Hide QR code"
            onClick={onToggleVisible}
            className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-[var(--shadow-pop)] transition-[opacity,color,transform] duration-200 group-hover/qr:opacity-100 hover:scale-110 hover:text-fg focus-visible:opacity-100"
          >
            <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
