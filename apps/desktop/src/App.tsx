import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { Modal } from "./components/ui/modal";
import { ToastProvider, useToast } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsDialog, type SettingsSection } from "./features/settings/settings-dialog";
import { DragOverlay } from "./features/shares/drag-overlay";
import { DropStrip } from "./features/shares/drop-strip";
import { EmptyState } from "./features/shares/empty-state";
import { InspectorBody, InspectorPanel } from "./features/shares/inspector";
import { ShareList } from "./features/shares/share-list";
import { StopAllDialog } from "./features/shares/stop-all-dialog";
import { useShareActions } from "./features/shares/use-share-actions";
import { BackendProvider, useBackend, useSnapshot } from "./hooks/use-backend";
import { useFileDrop } from "./hooks/use-file-drop";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useMediaQuery } from "./hooks/use-media-query";
import { useTheme } from "./hooks/use-theme";
import { type Backend, createBackend, type DroppedFiles, type Share } from "./lib/backend";

export function App() {
  const [backend, setBackend] = useState<Backend | null>(null);

  useEffect(() => {
    let active = true;
    createBackend().then((created) => {
      if (active) setBackend(created);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!backend) return null;

  return (
    <BackendProvider backend={backend}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </TooltipProvider>
      </MotionConfig>
    </BackendProvider>
  );
}

function Shell() {
  const backend = useBackend();
  const snapshot = useSnapshot();
  const toast = useToast();
  const wide = useMediaQuery("(min-width: 900px)");
  useTheme(snapshot.settings.theme);

  const { shares, server, profiles, settings } = snapshot;
  const online = server.kind === "online";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(wide);
  const [qrPulse, setQrPulse] = useState(0);
  const [stopSignal, setStopSignal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("general");
  const [stopAllOpen, setStopAllOpen] = useState(false);
  const lastIndex = useRef(0);

  // Shrinking the window turns the panel into a sheet; don't pop it open uninvited.
  useEffect(() => {
    if (!wide) setInspectorOpen(false);
  }, [wide]);

  const selected = shares.find((s) => s.id === selectedId) ?? null;
  const activeCount = shares.filter((s) => s.status === "active").length;

  // Keep a sensible selection: the first share at launch, a neighbour after removal.
  useEffect(() => {
    const index = shares.findIndex((s) => s.id === selectedId);
    if (index >= 0) {
      lastIndex.current = index;
      return;
    }
    const fallback = shares[Math.min(lastIndex.current, shares.length - 1)] ?? null;
    setSelectedId(fallback?.id ?? null);
  }, [shares, selectedId]);

  const onCreated = useCallback((share: Share) => {
    setSelectedId(share.id);
    setInspectorOpen(true);
  }, []);
  const actions = useShareActions(onCreated);

  const onDrop = useCallback(
    async (files: DroppedFiles) => {
      const result = await backend.shareDropped(files);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      const first = result.value[0];
      if (first) onCreated(first);
      if (result.value.length > 1) toast(`${result.value.length} files are now shared.`, "success");
    },
    [backend, toast, onCreated],
  );
  const dragging = useFileDrop(onDrop);

  useEffect(
    () =>
      backend.onEvent((event) => {
        if (event.kind === "addressChanged")
          toast(`Your network address changed to ${event.address}. QR codes were updated.`);
      }),
    [backend, toast],
  );

  const openSettings = (target: SettingsSection = section) => {
    setSection(target);
    setSettingsOpen(true);
  };

  const select = (id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
  };

  const showQr = (id: string) => {
    select(id);
    setQrPulse((n) => n + 1);
  };

  const activeSelected = selected?.status === "active" ? selected : null;

  useHotkeys([
    { keys: "Mod+O", handler: () => online && actions.chooseFiles() },
    { keys: "Mod+,", handler: () => openSettings() },
    {
      keys: "Mod+C",
      handler: async () => {
        if (activeSelected && (await actions.copyLink(activeSelected)))
          toast("Link copied.", "success");
      },
    },
    {
      keys: "Mod+Shift+C",
      handler: async () => {
        if (activeSelected && (await actions.copyQr(activeSelected)))
          toast("QR image copied.", "success");
      },
    },
    { keys: "Mod+S", handler: () => activeSelected && actions.saveQr(activeSelected) },
    {
      keys: "Delete",
      handler: () => {
        if (!activeSelected) return;
        setInspectorOpen(true);
        setStopSignal((n) => n + 1);
      },
    },
    {
      keys: "Backspace",
      handler: () => {
        if (!activeSelected) return;
        setInspectorOpen(true);
        setStopSignal((n) => n + 1);
      },
    },
    { keys: "Escape", handler: () => setInspectorOpen(false) },
  ]);

  const inspectorProps = selected
    ? {
        share: selected,
        profiles,
        actions,
        qrPulse,
        stopSignal,
        onClose: () => setInspectorOpen(false),
      }
    : null;

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <Header
        server={server}
        onOpenSettings={() => openSettings()}
        onOpenNetwork={() => openSettings("network")}
      />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {shares.length === 0 ? (
              <EmptyState
                key="empty"
                server={server}
                dragging={dragging}
                onChoose={actions.chooseFiles}
              />
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="flex min-h-0 flex-1 flex-col gap-3 pt-4 pr-5 pl-6"
              >
                <DropStrip dragging={dragging} disabled={!online} onChoose={actions.chooseFiles} />
                <ShareList
                  shares={shares}
                  profiles={profiles}
                  selectedId={selectedId}
                  actions={actions}
                  onSelect={select}
                  onShowQr={showQr}
                  onStopAll={() => setStopAllOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <AnimatePresence initial={false}>
          {wide && inspectorOpen && inspectorProps && (
            <InspectorPanel key="inspector" {...inspectorProps} />
          )}
        </AnimatePresence>
      </div>
      <Footer preview={backend.mode === "preview"} />

      {!wide && (
        <Modal
          open={inspectorOpen && inspectorProps !== null}
          onClose={() => setInspectorOpen(false)}
          labelledBy="inspector-title"
          side="right"
          className="w-[360px] overflow-y-auto px-5 py-4"
        >
          {inspectorProps && <InspectorBody {...inspectorProps} />}
        </Modal>
      )}

      <DragOverlay
        visible={dragging && shares.length > 0}
        enabled={online}
        lifetimeMinutes={settings.defaultLifetimeMinutes}
      />
      <SettingsDialog
        open={settingsOpen}
        section={section}
        onSectionChange={setSection}
        onClose={() => setSettingsOpen(false)}
      />
      <StopAllDialog
        open={stopAllOpen}
        count={activeCount}
        onConfirm={() => actions.stopAll()}
        onClose={() => setStopAllOpen(false)}
      />
    </div>
  );
}
