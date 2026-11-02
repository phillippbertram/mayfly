import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import { motion } from "motion/react";
import { Kbd } from "../../components/ui/kbd";
import { Modal } from "../../components/ui/modal";
import { useNow } from "../../hooks/use-now";
import type { Share } from "../../lib/backend";
import { displayStatus, formatBytes } from "../../lib/format";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { FileGlyph } from "../shares/file-glyph";
import { STATUS_LABEL } from "../shares/status-chip";
import type { AppCommand } from "./use-commands";

/** Matches every search word against the visible label and keywords, ignoring hidden ids. */
function filter(value: string, search: string, keywords?: string[]): number {
  const label = value.split("\u0000")[0] ?? "";
  const haystack = [label, ...(keywords ?? [])].join(" ").toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((word) => haystack.includes(word))) return 0;
  return label.toLowerCase().startsWith(words[0] ?? "") ? 1 : 0.6;
}

const item =
  "flex h-10 items-center gap-3 rounded-lg px-2.5 text-[13px] text-fg outline-none transition-colors duration-100 data-[selected=true]:bg-surface-muted data-[disabled=true]:opacity-40";

export function CommandPalette({ commands, shares }: { commands: AppCommand[]; shares: Share[] }) {
  const open = useUi((s) => s.overlay === "palette");
  const setOverlay = useUi((s) => s.setOverlay);
  const select = useUi((s) => s.select);
  const now = useNow();
  const close = () => setOverlay(null);
  const run = (command: AppCommand) => {
    close();
    // Let the palette close before the command opens its own UI.
    setTimeout(command.run, 60);
  };
  const groups = (["Share", "Navigate", "General"] as const).map(
    (group) =>
      [
        group,
        commands.filter((c) => c.group === group && c.enabled && c.id !== "palette.open"),
      ] as const,
  );

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy="palette-title"
      align="top"
      className="w-[580px] overflow-hidden"
    >
      <h2 id="palette-title" className="sr-only">
        Command palette
      </h2>
      <Command label="Command palette" loop filter={filter} className="flex flex-col">
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
          <Search aria-hidden="true" size={16} className="text-muted" />
          <Command.Input
            data-autofocus
            placeholder="Search shares and commands…"
            className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
          />
          <Kbd hotkey="Escape" />
        </div>
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5">
          <Command.Empty className="py-10 text-center text-[13px] text-muted">
            Nothing matches.
          </Command.Empty>
          {shares.length > 0 && (
            <Command.Group
              heading="Shares"
              className="pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted"
            >
              {shares.map((share, i) => (
                <Command.Item
                  key={share.id}
                  value={`${share.fileName}\u0000${share.id}`}
                  keywords={[STATUS_LABEL[displayStatus(share, now)]]}
                  onSelect={() => {
                    close();
                    select(share.id);
                  }}
                  className={item}
                >
                  <FileGlyph
                    kind={share.kind}
                    muted={share.status !== "active"}
                    className="size-7 rounded-md"
                  />
                  <span className="min-w-0 flex-1 truncate">{share.fileName}</span>
                  <span className="text-[11px] text-muted tnum">
                    {formatBytes(share.byteSize)} · {STATUS_LABEL[displayStatus(share, now)]}
                  </span>
                  {i < 9 && <Kbd hotkey={String(i + 1) as "1"} />}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {groups.map(([group, list]) =>
            list.length === 0 ? null : (
              <Command.Group
                key={group}
                heading={group}
                className="pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted"
              >
                {list.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={command.label}
                    keywords={command.keywords ?? []}
                    onSelect={() => run(command)}
                    className={item}
                  >
                    <span className="flex size-7 items-center justify-center rounded-md bg-surface-muted text-muted">
                      <command.icon aria-hidden="true" size={15} strokeWidth={1.7} />
                    </span>
                    <span className="flex-1">{command.label}</span>
                    {command.hotkeyId && <Kbd hotkey={appHotkeys[command.hotkeyId].hotkey} />}
                  </Command.Item>
                ))}
              </Command.Group>
            ),
          )}
        </Command.List>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.15 } }}
          className="flex h-9 items-center gap-4 border-t border-line px-4 text-[11px] text-muted"
        >
          <span className="flex items-center gap-1.5">
            <Kbd hotkey="ArrowUp" />
            <Kbd hotkey="ArrowDown" /> move
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft aria-hidden="true" size={12} /> run
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5">
            All shortcuts <Kbd hotkey={appHotkeys["shortcuts.open"].hotkey} />
          </span>
        </motion.div>
      </Command>
    </Modal>
  );
}
