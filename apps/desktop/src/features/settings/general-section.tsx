import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import type { Settings } from "../../lib/backend";
import { errorMessage, useSettings, useUpdateSettings } from "../../lib/queries";
import { LifetimeField, LimitField } from "../shares/share-options";
import { Field, SectionHeader } from "./field";

export function GeneralSection() {
  const settings = useSettings();
  const mutation = useUpdateSettings();
  const toast = useToast();
  const update = (patch: Partial<Settings>) =>
    mutation.mutate(patch, { onError: (error) => toast(errorMessage(error), "error") });

  return (
    <div>
      <SectionHeader
        title="General"
        description="Defaults for new shares. You can change them for each share."
      />
      <div className="flex flex-col gap-6">
        <Field label="Default lifetime" hint="Shares stop working on their own after this time.">
          <LifetimeField
            label="Default lifetime"
            value={settings.defaultLifetimeMinutes}
            onChange={(defaultLifetimeMinutes) => update({ defaultLifetimeMinutes })}
          />
        </Field>
        <Field
          label="Default download limit"
          hint="A share stops once this many downloads have started."
        >
          <LimitField
            label="Default download limit"
            value={settings.defaultDownloadLimit}
            onChange={(defaultDownloadLimit) => update({ defaultDownloadLimit })}
          />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="confirm-switch" className="text-[13px] font-medium">
              Ask before sharing
            </label>
            <p className="text-[12px] text-muted">
              Show lifetime, limit, and link options for every new file. Return shares right away.
            </p>
          </div>
          <Switch
            id="confirm-switch"
            checked={settings.confirmBeforeSharing}
            onCheckedChange={(confirmBeforeSharing) => update({ confirmBeforeSharing })}
          />
        </div>
      </div>
    </div>
  );
}
