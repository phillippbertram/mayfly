import { motion } from "motion/react";
import { Kbd } from "../../components/ui/kbd";
import { appHotkeys } from "../../lib/hotkeys";

type Entry = { name: string; hotkey: Parameters<typeof Kbd>[0]["hotkey"] };

function groups(): [string, Entry[]][] {
  const map = new Map<string, Entry[]>();
  for (const hotkey of Object.values(appHotkeys)) {
    const group = hotkey.meta?.group ?? "General";
    const list = map.get(group) ?? [];
    list.push({ name: hotkey.meta?.name ?? hotkey.id, hotkey: hotkey.hotkey });
    map.set(group, list);
  }
  map.get("Navigate")?.push({ name: "Select share by position", hotkey: null });
  return [...map.entries()];
}

export function ShortcutList({ columns = 2 }: { columns?: 1 | 2 }) {
  return (
    <div className={columns === 2 ? "grid grid-cols-2 gap-x-8 gap-y-5" : "flex flex-col gap-5"}>
      {groups().map(([group, entries], gi) => (
        <motion.section
          key={group}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.05, duration: 0.2 }}
          aria-label={group}
        >
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
            {group}
          </h3>
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li
                key={entry.name}
                className="flex h-8 items-center justify-between gap-3 border-b border-line/60 text-[13px] last:border-b-0"
              >
                <span>{entry.name}</span>
                {entry.hotkey ? (
                  <Kbd hotkey={entry.hotkey} />
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Kbd hotkey="1" /> – <Kbd hotkey="9" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}
