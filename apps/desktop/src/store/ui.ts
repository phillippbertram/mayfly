import { create } from "zustand";
import type { StagedFiles } from "../lib/backend";

export type SettingsSection = "general" | "network" | "appearance" | "profiles" | "shortcuts";
export type Overlay = "palette" | "shortcuts" | "about" | "stopAll" | "closeNotice" | "quit" | null;

interface UiState {
  selectedId: string | null;
  inspectorOpen: boolean;
  /** Incrementing counters let keyboard shortcuts poke components. */
  qrPulse: number;
  stopSignal: number;
  limitMenuSignal: number;
  /** Incremented to start renaming the selected share in the inspector. */
  renameSignal: number;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  overlay: Overlay;
  composer: StagedFiles | null;
  /** Per-share QR visibility that overrides the hide-codes setting for this session. */
  qrVisibility: Record<string, boolean>;

  select: (id: string | null, open?: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  pulseQr: () => void;
  armStop: () => void;
  openLimitMenu: () => void;
  startRename: () => void;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSettingsSection: (section: SettingsSection) => void;
  setOverlay: (overlay: Overlay) => void;
  openComposer: (staged: StagedFiles) => void;
  dropFromComposer: (stageId: string) => void;
  closeComposer: () => void;
  setQrVisible: (id: string, visible: boolean) => void;
  resetQrVisibility: () => void;
}

export const useUi = create<UiState>()((set) => ({
  selectedId: null,
  inspectorOpen: window.matchMedia("(min-width: 900px)").matches,
  qrPulse: 0,
  stopSignal: 0,
  limitMenuSignal: 0,
  renameSignal: 0,
  settingsOpen: false,
  settingsSection: "general",
  overlay: null,
  composer: null,
  qrVisibility: {},

  select: (id, open = true) =>
    set(() => ({ selectedId: id, ...(open ? { inspectorOpen: true } : {}) })),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  pulseQr: () => set((s) => ({ qrPulse: s.qrPulse + 1, inspectorOpen: true })),
  armStop: () => set((s) => ({ stopSignal: s.stopSignal + 1, inspectorOpen: true })),
  openLimitMenu: () =>
    set((s) => ({ limitMenuSignal: s.limitMenuSignal + 1, inspectorOpen: true })),
  startRename: () => set((s) => ({ renameSignal: s.renameSignal + 1, inspectorOpen: true })),
  openSettings: (section) =>
    set((s) => ({
      settingsOpen: true,
      settingsSection: section ?? s.settingsSection,
      overlay: null,
    })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  setOverlay: (overlay) => set({ overlay }),
  openComposer: (composer) => set({ composer, overlay: null }),
  dropFromComposer: (stageId) =>
    set((s) =>
      s.composer
        ? {
            composer: {
              ...s.composer,
              files: s.composer.files.filter((f) => f.stageId !== stageId),
            },
          }
        : {},
    ),
  closeComposer: () => set({ composer: null }),
  setQrVisible: (id, visible) =>
    set((s) => ({ qrVisibility: { ...s.qrVisibility, [id]: visible } })),
  resetQrVisibility: () => set({ qrVisibility: {} }),
}));
