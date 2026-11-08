import { Switch } from "../../components/ui/switch";
import { useToast } from "../../hooks/use-toast";
import type { Settings } from "../../lib/backend";
import { errorMessage, useSettings, useUpdateSettings } from "../../lib/queries";
import { useUi } from "../../store/ui";
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
          hint="Each file can be downloaded this many times; a share stops once every file has."
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
              Show the lifetime and download limit before sharing. Return shares right away.
            </p>
          </div>
          <Switch
            id="confirm-switch"
            checked={settings.confirmBeforeSharing}
            onCheckedChange={(confirmBeforeSharing) => update({ confirmBeforeSharing })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="close-notice-switch" className="text-[13px] font-medium">
              Explain closing the window
            </label>
            <p className="text-[12px] text-muted">
              Closing the window keeps sharing in the background. Remind me before hiding it.
            </p>
          </div>
          <Switch
            id="close-notice-switch"
            checked={settings.showCloseNotice}
            onCheckedChange={(showCloseNotice) => update({ showCloseNotice })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="hide-codes-switch" className="text-[13px] font-medium">
              Hide QR codes and links
            </label>
            <p className="text-[12px] text-muted">
              Blur codes and mask link tokens until you reveal them, for screen sharing or
              presenting.
            </p>
          </div>
          <Switch
            id="hide-codes-switch"
            checked={settings.hideCodes}
            onCheckedChange={(hideCodes) => {
              useUi.getState().resetQrVisibility();
              update({ hideCodes });
            }}
          />
        </div>
      </div>
    </div>
  );
}
