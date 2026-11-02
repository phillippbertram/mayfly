import { Globe, Keyboard, Link2, Palette, Settings2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { IconButton } from "../../components/ui/icon-button";
import { Modal } from "../../components/ui/modal";
import { appHotkeys } from "../../lib/hotkeys";
import { useUi } from "../../store/ui";
import { ShortcutList } from "../commands/shortcut-list";
import { AppearanceSection } from "./appearance-section";
import { SectionHeader } from "./field";
import { GeneralSection } from "./general-section";
import { NetworkSection } from "./network-section";
import { ProfilesSection } from "./profiles-section";

const SECTIONS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "network", label: "Network", icon: Globe },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "profiles", label: "Link profiles", icon: Link2 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
] as const;

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const section = useUi((s) => s.settingsSection);
  const setSection = useUi((s) => s.setSettingsSection);
  const close = useUi((s) => s.closeSettings);

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy="settings-title"
      className="flex h-[500px] w-[760px] overflow-hidden"
    >
      <nav
        aria-label="Settings sections"
        className="flex w-[184px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface-muted/70 p-3"
      >
        <h2 id="settings-title" className="px-2 pt-1 pb-3 text-[15px] font-semibold">
          Settings
        </h2>
        {SECTIONS.map((item) => {
          const active = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setSection(item.id)}
              className={`relative flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-[13px] font-medium transition-colors duration-150 ${
                active ? "text-fg" : "text-muted hover:bg-surface/60 hover:text-fg"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="settings-nav"
                  className="absolute inset-0 rounded-md border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.05)]"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <item.icon
                aria-hidden="true"
                size={15}
                strokeWidth={1.7}
                className={`relative transition-colors ${active ? "text-accent" : ""}`}
              />
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <section
        aria-labelledby="settings-section-title"
        className="relative min-w-0 flex-1 overflow-y-auto px-7 py-6"
      >
        <div className="absolute top-3 right-3 z-10">
          <IconButton
            icon={X}
            label="Close settings"
            hotkey={appHotkeys["inspector.close"].hotkey}
            onClick={close}
          />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {section === "general" && <GeneralSection />}
            {section === "network" && <NetworkSection />}
            {section === "appearance" && <AppearanceSection />}
            {section === "profiles" && <ProfilesSection />}
            {section === "shortcuts" && (
              <div>
                <SectionHeader
                  title="Shortcuts"
                  description="FileHop works from the keyboard. Single-letter keys act on the selected share."
                />
                <ShortcutList columns={1} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </Modal>
  );
}
