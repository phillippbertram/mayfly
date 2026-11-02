import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { Modal } from "./components/ui/modal";
import { ToastProvider } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { AppHotkeys } from "./features/commands/app-hotkeys";
import { CommandPalette } from "./features/commands/command-palette";
import { ShortcutsDialog } from "./features/commands/shortcuts-dialog";
import { useCommands } from "./features/commands/use-commands";
import { CloseNoticeDialog, QuitDialog } from "./features/lifecycle/lifecycle-dialogs";
import { SettingsDialog } from "./features/settings/settings-dialog";
import { Composer } from "./features/shares/composer";
import { DragOverlay } from "./features/shares/drag-overlay";
import { DropStrip } from "./features/shares/drop-strip";
import { EmptyState } from "./features/shares/empty-state";
import { InspectorBody, InspectorPanel } from "./features/shares/inspector";
import { ShareList } from "./features/shares/share-list";
import { StopAllDialog } from "./features/shares/stop-all-dialog";
import { useShareActions } from "./features/shares/use-share-actions";
import { BackendProvider, useBackend } from "./hooks/use-backend";
import { useFileDrop } from "./hooks/use-file-drop";
import { useMediaQuery } from "./hooks/use-media-query";
import { useTheme } from "./hooks/use-theme";
import { type Backend, createBackend } from "./lib/backend";
import { displayOrder } from "./lib/format";
import { useBackendSync, useServer, useSettings, useShares } from "./lib/queries";
import { useUi } from "./store/ui";

export function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The backend pushes change notifications; queries never go stale on their own.
          queries: {
            staleTime: Number.POSITIVE_INFINITY,
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

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
      <QueryClientProvider client={client}>
        <HotkeysProvider defaultOptions={{ hotkey: { conflictBehavior: "allow" } }}>
          <MotionConfig reducedMotion="user">
            <TooltipProvider>
              <ToastProvider>
                <Shell client={client} />
              </ToastProvider>
            </TooltipProvider>
          </MotionConfig>
        </HotkeysProvider>
      </QueryClientProvider>
    </BackendProvider>
  );
}

function Shell({ client }: { client: QueryClient }) {
  const backend = useBackend();
  useBackendSync(client);
  const settings = useSettings();
  useTheme(settings.theme);

  const server = useServer().data;
  const sharesQuery = useShares();
  // One display order everywhere: list, arrow keys, number keys, and the palette.
  const shares = useMemo(() => displayOrder(sharesQuery.data ?? []), [sharesQuery.data]);
  const online = server?.kind === "online";
  const wide = useMediaQuery("(min-width: 900px)");

  const selectedId = useUi((s) => s.selectedId);
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const select = useUi((s) => s.select);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);
  const setOverlay = useUi((s) => s.setOverlay);
  const openSettings = useUi((s) => s.openSettings);
  const lastIndex = useRef(0);

  const actions = useShareActions();
  const commands = useCommands(shares, actions);
  const selected = shares.find((s) => s.id === selectedId) ?? null;
  // Dropping on an active share's row or details adds to it; anywhere else
  // creates a new share.
  const activeShare = (id: string) =>
    shares.find((s) => s.id === id && s.status === "active") ?? null;
  const { dragging, target: dropTarget } = useFileDrop((files, target) => {
    const share = target.kind === "add" ? activeShare(target.shareId) : null;
    if (share) actions.dropInto(share, files);
    else actions.drop(files);
  });
  const dropShare = dropTarget.kind === "add" ? activeShare(dropTarget.shareId) : null;

  // Keep a sensible selection: the first share at launch, a neighbour after removal.
  useEffect(() => {
    if (!sharesQuery.isSuccess) return;
    const index = shares.findIndex((s) => s.id === selectedId);
    if (index >= 0) {
      lastIndex.current = index;
      return;
    }
    const fallback = shares[Math.min(lastIndex.current, shares.length - 1)] ?? null;
    select(fallback?.id ?? null, false);
  }, [shares, selectedId, sharesQuery.isSuccess, select]);

  // Shrinking the window turns the panel into a sheet; don't pop it open uninvited.
  useEffect(() => {
    if (!wide) setInspectorOpen(false);
  }, [wide, setInspectorOpen]);

  const inspectorProps = selected
    ? { share: selected, actions, onClose: () => setInspectorOpen(false) }
    : null;

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <AppHotkeys commands={commands} shares={shares} />
      <Header
        server={server ?? { kind: "starting" }}
        onOpenSettings={() => openSettings()}
        onOpenNetwork={() => openSettings("network")}
        onOpenPalette={() => setOverlay("palette")}
      />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {sharesQuery.isSuccess && shares.length === 0 ? (
              <EmptyState
                key="empty"
                server={server}
                dragging={dragging}
                onChoose={actions.chooseFiles}
                onNewEmpty={actions.newEmptyShare}
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
                <DropStrip
                  dragging={dragging && !dropShare}
                  disabled={!online}
                  onChoose={actions.chooseFiles}
                />
                <ShareList shares={shares} actions={actions} />
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
        target={dropTarget}
        targetShare={dropShare}
        lifetimeMinutes={settings.defaultLifetimeMinutes}
      />
      <Composer actions={actions} />
      <CommandPalette commands={commands} shares={shares} />
      <ShortcutsDialog />
      <SettingsDialog />
      <StopAllDialog
        count={shares.filter((s) => s.status === "active").length}
        onConfirm={() => actions.stopAll()}
      />
      <CloseNoticeDialog activeShares={shares.filter((s) => s.status === "active").length} />
      <QuitDialog activeShares={shares.filter((s) => s.status === "active").length} />
    </div>
  );
}
