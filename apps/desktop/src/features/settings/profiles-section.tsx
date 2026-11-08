import { ArrowLeft, Check, Globe, Link2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Switch } from "../../components/ui/switch";
import { Tooltip } from "../../components/ui/tooltip";
import { useBackend } from "../../hooks/use-backend";
import { useToast } from "../../hooks/use-toast";
import type { LinkProfile, TemplatePreview } from "../../lib/backend";
import { cn } from "../../lib/cn";
import { errorMessage, useProfiles, useSettings, useUpdateSettings } from "../../lib/queries";
import { Field, InlineMessage, SectionHeader } from "./field";
import { inputClass } from "./input-class";

const PLACEHOLDERS = ["{url}", "{encodedUrl}", "{filename}", "{encodedFilename}", "{token}"];

export function ProfilesSection() {
  const settings = useSettings();
  const profiles = useProfiles();
  const [editing, setEditing] = useState<LinkProfile | "new" | null>(null);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {editing ? (
        <motion.div
          key="editor"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="h-full"
        >
          <ProfileEditor
            profile={editing === "new" ? null : editing}
            isDefault={editing !== "new" && settings.defaultProfileId === editing.id}
            onDone={() => setEditing(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        >
          <ProfileList
            defaultProfileId={settings.defaultProfileId}
            profiles={profiles}
            onEdit={setEditing}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileList({
  defaultProfileId,
  profiles,
  onEdit,
}: {
  defaultProfileId: string;
  profiles: LinkProfile[];
  onEdit: (profile: LinkProfile | "new") => void;
}) {
  const backend = useBackend();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const updateSettings = useUpdateSettings();
  const setDefault = (id: string) =>
    updateSettings.mutate(
      { defaultProfileId: id },
      { onError: (e) => toast(errorMessage(e), "error") },
    );

  return (
    <div>
      <SectionHeader
        title="Link profiles"
        description="Templates turn a share link into a link that opens a compatible app. The starred profile is what QR codes open by default; each share can switch."
      />
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {profiles.map((profile) => {
            const isDefault = defaultProfileId === profile.id;
            // Built-in profiles have no template and can't be edited.
            const builtIn = profile.template === null;
            return (
              <motion.li
                key={profile.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="group flex h-14 items-center gap-3 rounded-[10px] border border-line bg-surface px-3 transition-[border-color] hover:border-line-strong"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
                  {builtIn ? (
                    <Globe aria-hidden="true" size={16} />
                  ) : (
                    <Link2 aria-hidden="true" size={16} />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-[13px] font-medium">
                    {profile.name}
                    {isDefault && (
                      <motion.span
                        layoutId="default-badge"
                        className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-semibold tracking-wide text-accent-strong uppercase"
                      >
                        Default
                      </motion.span>
                    )}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted">
                    {profile.template ?? "http://<address>:<port>/s/<token> · built in"}
                  </span>
                </div>
                <Tooltip
                  label={
                    isDefault ? "QR codes open this by default" : "Use for QR codes by default"
                  }
                >
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={
                      isDefault
                        ? `QR codes open ${profile.name} by default`
                        : `Use ${profile.name} for QR codes by default`
                    }
                    aria-pressed={isDefault}
                    onClick={() => setDefault(profile.id)}
                  >
                    <motion.span
                      animate={
                        isDefault ? { scale: [1, 1.35, 1], rotate: [0, 18, 0] } : { scale: 1 }
                      }
                      transition={{ duration: 0.4 }}
                      className="flex"
                    >
                      <Star
                        aria-hidden="true"
                        size={16}
                        strokeWidth={1.6}
                        className={cn(isDefault ? "fill-[#f5b454] text-[#e2a03b]" : "text-faint")}
                      />
                    </motion.span>
                  </Button>
                </Tooltip>
                {!builtIn && (
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${profile.name}`}
                      onClick={() => onEdit(profile)}
                    />
                    {confirmDelete === profile.id ? (
                      <Button
                        size="sm"
                        variant="dangerSolid"
                        onBlur={() => setConfirmDelete(null)}
                        onClick={async () => {
                          try {
                            await backend.deleteProfile(profile.id);
                          } catch (error) {
                            toast(errorMessage(error), "error");
                          }
                          setConfirmDelete(null);
                        }}
                        autoFocus
                      >
                        Delete
                      </Button>
                    ) : (
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${profile.name}`}
                        onClick={() => setConfirmDelete(profile.id)}
                      />
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <Button className="mt-3" onClick={() => onEdit("new")}>
        <Plus aria-hidden="true" size={15} />
        New profile
      </Button>
    </div>
  );
}

function ProfileEditor({
  profile,
  isDefault,
  onDone,
}: {
  profile: LinkProfile | null;
  isDefault: boolean;
  onDone: () => void;
}) {
  const backend = useBackend();
  const [name, setName] = useState(profile?.name ?? "");
  const [template, setTemplate] = useState(profile?.template ?? "myapp://import?url={encodedUrl}");
  const [makeDefault, setMakeDefault] = useState(isDefault);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let current = true;
    const handle = setTimeout(async () => {
      const result = await backend
        .previewTemplate(template)
        .catch((error: unknown): TemplatePreview => ({ ok: false, error: errorMessage(error) }));
      if (current) setPreview(result);
    }, 140);
    return () => {
      current = false;
      clearTimeout(handle);
    };
  }, [backend, template]);

  const insert = (token: string) => {
    const el = templateRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const valid = preview?.ok === true && name.trim().length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await backend.saveProfile({
        ...(profile ? { id: profile.id } : {}),
        name,
        template,
        makeDefault,
      });
      onDone();
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center gap-2">
        <IconButton icon={ArrowLeft} label="Back to link profiles" onClick={onDone} />
        <div>
          <h3 id="settings-section-title" className="text-[15px] leading-5 font-semibold">
            {profile ? "Edit link profile" : "New link profile"}
          </h3>
          <p className="text-[12px] text-muted">
            Templates are text. Mayfly fills placeholders once and never runs them.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="profile-name">
          <input
            id="profile-name"
            value={name}
            placeholder="Documents app"
            onChange={(e) => setName(e.target.value)}
            className={cn(inputClass, "w-72")}
          />
        </Field>
        <Field label="URL template" htmlFor="profile-template">
          <textarea
            id="profile-template"
            ref={templateRef}
            rows={2}
            spellCheck={false}
            value={template}
            aria-invalid={preview?.ok === false}
            onChange={(e) => {
              setTemplate(e.target.value);
              setSaveError(null);
            }}
            className={cn(
              inputClass,
              "h-auto resize-none py-2 font-mono text-[12px] leading-[18px]",
            )}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[12px] text-muted">Insert</span>
            {PLACEHOLDERS.map((token) => (
              <motion.button
                key={token}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => insert(token)}
                className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-fg transition-colors hover:border-accent/50 hover:bg-accent-soft"
              >
                {token}
              </motion.button>
            ))}
          </div>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Preview</span>
          <motion.div
            layout
            className={cn(
              "selectable rounded-md border px-2.5 py-2 font-mono text-[11.5px] leading-4 break-all transition-colors duration-200",
              preview?.ok === false
                ? "border-danger/30 bg-danger-soft/50 text-muted"
                : "border-transparent bg-surface-muted",
            )}
          >
            {preview?.ok ? preview.preview : "—"}
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={preview?.ok ? "ok" : (preview?.error ?? "pending")}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              role={preview?.ok === false ? "alert" : "status"}
              className={cn(
                "flex items-center gap-1.5 text-[12px]",
                preview?.ok ? "text-accent-strong" : "text-danger",
              )}
            >
              {preview?.ok ? (
                <>
                  <Check aria-hidden="true" size={13} strokeWidth={2.4} />
                  {preview.customScheme
                    ? "Valid template. A compatible app must be installed on the phone."
                    : "Valid template."}
                </>
              ) : (
                (preview?.error ?? "")
              )}
            </motion.span>
          </AnimatePresence>
        </div>
        <InlineMessage message={saveError} tone="error" />
      </div>
      <div className="flex-1" />
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <label htmlFor="profile-default" className="flex items-center gap-2.5 text-[13px]">
          <Switch id="profile-default" checked={makeDefault} onCheckedChange={setMakeDefault} />
          Use as default for new shares
        </label>
        <div className="flex gap-2">
          <Button onClick={onDone}>Cancel</Button>
          <Button variant="primary" disabled={!valid || saving} onClick={save}>
            {profile ? "Save profile" : "Create profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
