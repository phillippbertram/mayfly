import { AnimatePresence, motion } from "motion/react";
import { Segmented } from "../../components/ui/segmented";
import { Stepper } from "../../components/ui/stepper";
import { LIFETIME_PRESETS } from "../../lib/backend/types";

type LifetimeChoice = "5" | "10" | "30" | "60" | "forever" | "custom";
type LimitChoice = "none" | "1" | "3" | "5" | "custom";

const LIMIT_PRESETS = [1, 3, 5] as const;

function lifetimeText(minutes: number | null): string {
  if (minutes === null) return "Until stopped";
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return minutes > 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function LifetimeField({
  value,
  onChange,
  label = "Lifetime",
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
  label?: string;
}) {
  const preset =
    value === null
      ? "forever"
      : (LIFETIME_PRESETS as readonly number[]).includes(value)
        ? String(value)
        : "custom";
  const choice = preset as LifetimeChoice;
  return (
    <div className="flex flex-col gap-2">
      <Segmented<LifetimeChoice>
        label={label}
        value={choice}
        onValueChange={(v) => {
          if (v === "forever") onChange(null);
          else if (v === "custom") onChange(value === null ? 15 : value === 5 ? 15 : value + 5);
          else onChange(Number(v));
        }}
        options={[
          ...LIFETIME_PRESETS.map((m) => ({
            value: String(m) as LifetimeChoice,
            label: lifetimeText(m),
          })),
          { value: "forever", label: "Until stopped" },
          { value: "custom", label: "Custom" },
        ]}
      />
      <AnimatePresence initial={false}>
        {choice === "custom" && value !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-0.5">
              <Stepper label="Minutes" value={value} min={1} max={1440} onChange={onChange} />
              <span className="text-[12px] text-muted">minutes · {lifetimeText(value)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LimitField({
  value,
  onChange,
  min = 1,
  label = "Download limit",
}: {
  value: number | null;
  onChange: (limit: number | null) => void;
  /** Smallest allowed limit, e.g. one more than downloads already started. */
  min?: number;
  label?: string;
}) {
  const choice: LimitChoice =
    value === null
      ? "none"
      : (LIMIT_PRESETS as readonly number[]).includes(value)
        ? (String(value) as LimitChoice)
        : "custom";
  return (
    <div className="flex flex-col gap-2">
      <Segmented<LimitChoice>
        label={label}
        value={choice}
        onValueChange={(v) => {
          if (v === "none") onChange(null);
          else if (v === "custom") onChange(Math.max(min, value === null ? 10 : value + 1));
          else onChange(Math.max(min, Number(v)));
        }}
        options={[
          { value: "none", label: "No limit" },
          ...LIMIT_PRESETS.filter((n) => n >= min).map((n) => ({
            value: String(n) as LimitChoice,
            label: String(n),
          })),
          { value: "custom", label: "Custom" },
        ]}
      />
      <AnimatePresence initial={false}>
        {choice === "custom" && value !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-0.5">
              <Stepper label="Downloads" value={value} min={min} max={999} onChange={onChange} />
              <span className="text-[12px] text-muted">
                {value === 1 ? "download" : "downloads"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
