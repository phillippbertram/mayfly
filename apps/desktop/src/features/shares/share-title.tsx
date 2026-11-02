import { Pencil } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useSignal } from "../../hooks/use-signal";
import type { Share } from "../../lib/backend";
import { appHotkeys } from "../../lib/hotkeys";

/**
 * The inspector heading. Active shares can be renamed inline: the title shows in
 * the list and as the heading of the share page. Clearing it returns to the name
 * derived from the files.
 */
export function ShareTitle({
  share,
  renameSignal,
  onRename,
}: {
  share: Share;
  /** Incrementing this starts editing, for the shortcut and menus. */
  renameSignal: number;
  onRename: (title: string | null) => Promise<unknown>;
}) {
  const editable = share.status === "active";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const start = () => {
    if (!editable) return;
    setDraft(share.title ?? "");
    setEditing(true);
  };
  useSignal(renameSignal, start);
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim() || null;
    if (next !== share.title) await onRename(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keep app shortcuts (Escape closes the inspector) away from the field.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  };

  if (editing)
    return (
      <input
        ref={input}
        value={draft}
        maxLength={80}
        aria-label="Link title"
        placeholder={share.title ? "Name from the files" : share.fileName}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
        className="-mx-1.5 h-[30px] w-full rounded-md border border-accent bg-surface px-1.5 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] outline-none placeholder:font-normal placeholder:text-faint"
      />
    );

  return (
    <div className="group/title flex min-w-0 items-start gap-1">
      <h2
        id="inspector-title"
        onDoubleClick={start}
        className="selectable line-clamp-2 min-w-0 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] break-all"
      >
        {share.fileName}
      </h2>
      {editable && (
        <IconButton
          icon={Pencil}
          size="iconSm"
          label="Rename this link"
          hotkey={appHotkeys["share.rename"].hotkey}
          onClick={start}
          className="-mt-0.5 shrink-0 opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  );
}
