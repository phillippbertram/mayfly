import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../../components/ui/button";
import { Segmented } from "../../components/ui/segmented";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import { useBackend } from "../../hooks/use-backend";
import { LIFETIME_OPTIONS, type LifetimeMinutes, type Settings } from "../../lib/backend/types";
import { Field, inputClass, SectionHeader } from "./field";

type LifetimeValue = "5" | "10" | "30" | "60" | "none";

const LIFETIME_LABEL: Record<LifetimeValue, string> = {
  "5": "5 min",
  "10": "10 min",
  "30": "30 min",
  "60": "1 h",
  none: "Until stopped",
};

export function GeneralSection({ settings }: { settings: Settings }) {
  const backend = useBackend();
  const toast = useToast();
  const limit = settings.defaultDownloadLimit;

  const update = async (patch: Partial<Settings>) => {
    const result = await backend.updateSettings(patch);
    if (!result.ok) toast(result.error, "error");
  };

  const lifetime: LifetimeValue =
    settings.defaultLifetimeMinutes === null
      ? "none"
      : (String(settings.defaultLifetimeMinutes) as LifetimeValue);

  return (
    <div>
      <SectionHeader
        title="General"
        description="Defaults for new shares. Existing shares keep their settings."
      />
      <div className="flex flex-col gap-6">
        <Field label="Default lifetime" hint="Shares stop working on their own after this time.">
          <Segmented
            label="Default lifetime"
            value={lifetime}
            onValueChange={(v) =>
              update({
                defaultLifetimeMinutes:
                  v === "none" ? null : (Number(v) as Exclude<LifetimeMinutes, null>),
              })
            }
            options={[
              ...LIFETIME_OPTIONS.map((m) => String(m) as LifetimeValue),
              "none" as const,
            ].map((v) => ({
              value: v,
              label: LIFETIME_LABEL[v],
            }))}
          />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="limit-switch" className="text-[13px] font-medium">
                Limit downloads per share
              </label>
              <p className="text-[12px] text-muted">
                A share stops once this many downloads have started.
              </p>
            </div>
            <Switch
              id="limit-switch"
              checked={limit !== null}
              onCheckedChange={(on) => update({ defaultDownloadLimit: on ? 1 : null })}
            />
          </div>
          <AnimatePresence initial={false}>
            {limit !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="iconSm"
                    aria-label="Fewer downloads"
                    disabled={limit <= 1}
                    onClick={() => update({ defaultDownloadLimit: Math.max(1, limit - 1) })}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </Button>
                  <input
                    aria-label="Download limit"
                    inputMode="numeric"
                    value={limit}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isInteger(n) && n > 0 && n < 1000)
                        update({ defaultDownloadLimit: n });
                    }}
                    className={`${inputClass} w-16 text-center tnum`}
                  />
                  <Button
                    size="iconSm"
                    aria-label="More downloads"
                    onClick={() => update({ defaultDownloadLimit: Math.min(999, limit + 1) })}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </Button>
                  <span className="ml-1 text-[12px] text-muted">
                    {limit === 1 ? "download" : "downloads"} per share
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
