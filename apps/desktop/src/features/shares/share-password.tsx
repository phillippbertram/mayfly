import { Lock, LockOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import type { Share } from "../../lib/backend";
import { PasswordField, passwordProblem } from "./password-field";
import type { ShareActions } from "./use-share-actions";

/**
 * The share's password state with add, change, and remove. The password is never
 * shown again after saving; changing it signs out everyone who unlocked the link.
 */
export function SharePassword({ share, actions }: { share: Share; actions: ShareActions }) {
  const ended = share.status !== "active";
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = passwordProblem(password);

  // A different share, or one that ended, never inherits a half-typed password.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the share changes.
  useEffect(() => {
    setEditing(false);
    setPassword("");
  }, [share.id, ended]);

  if (ended && !share.protected) return null;

  const save = async () => {
    if (problem || busy) return;
    setBusy(true);
    const ok = await actions.setPassword(share, password);
    setBusy(false);
    if (ok) {
      setPassword("");
      setEditing(false);
    }
  };
  const cancel = () => {
    setPassword("");
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg/60 p-3">
      <div className="flex items-center gap-2.5">
        <span
          className={
            share.protected
              ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted"
          }
        >
          {share.protected ? (
            <Lock aria-hidden="true" size={14} strokeWidth={1.8} />
          ) : (
            <LockOpen aria-hidden="true" size={14} strokeWidth={1.8} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {share.protected ? "Password set" : "No password"}
        </span>
        {!ended && !editing && (
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {share.protected ? "Change" : "Add"}
            </Button>
            {share.protected && (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await actions.setPassword(share, null);
                  setBusy(false);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="text-[11.5px] text-muted">
        {share.protected
          ? "Recipients enter the password before they see any file."
          : "Anyone with the link can open it."}
      </p>
      <AnimatePresence initial={false}>
        {editing && !ended && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancel();
              }
            }}
          >
            <div className="flex flex-col gap-2 p-0.5">
              <PasswordField
                id={`password-${share.id}`}
                value={password}
                onChange={setPassword}
                onGenerate={actions.generatePassword}
                describedBy={`password-hint-${share.id}`}
                invalid={password.length > 0 && problem !== null}
                autoFocus
              />
              <p id={`password-hint-${share.id}`} className="text-[11.5px] text-muted">
                {password.length > 0 && problem
                  ? problem
                  : share.protected
                    ? "Everyone who unlocked the link needs the new password. Downloads in progress continue."
                    : "Send it separately from the link. People with the page open need to enter it."}
              </p>
              <div className="flex justify-end gap-1.5">
                <Button size="sm" type="button" onClick={cancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={problem !== null || busy}
                >
                  Save password
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
