import { OctagonX } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { useUi } from "../../store/ui";

export function StopAllDialog({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const open = useUi((s) => s.overlay === "stopAll");
  const setOverlay = useUi((s) => s.setOverlay);
  const close = () => setOverlay(null);
  return (
    <Modal open={open} onClose={close} labelledBy="stop-all-title" className="w-[380px] p-5">
      <div className="flex gap-3.5">
        <motion.span
          initial={{ scale: 0.6, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.05 }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
        >
          <OctagonX aria-hidden="true" size={20} strokeWidth={1.7} />
        </motion.span>
        <div className="flex flex-col gap-1">
          <h2 id="stop-all-title" className="text-[15px] font-semibold">
            Stop all shares?
          </h2>
          <p className="text-[13px] leading-5 text-muted">
            {count === 1 ? "1 active share stops" : `${count} active shares stop`} immediately.
            Their links and QR codes stop working for everyone.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={close}>Keep sharing</Button>
        <Button
          variant="dangerSolid"
          onClick={() => {
            onConfirm();
            close();
          }}
        >
          Stop all
        </Button>
      </div>
    </Modal>
  );
}
