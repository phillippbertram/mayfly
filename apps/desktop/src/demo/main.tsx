/**
 * Product demo for the website: the real interface on the sample-data simulator,
 * driven by scripted scenes. Built separately (`pnpm build:demo`); never part of
 * the desktop bundle.
 *
 * Messages from the embedding page (same origin only):
 *   { source: "filehop-site", scene }  plays a scene from fresh sample data
 * Messages to it:
 *   { source: "filehop-demo", event: "ready" | "done", scene }
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../App";
import { applyTheme } from "../hooks/use-theme";
import { createPreviewBackend } from "../lib/backend/preview";
import { useUi } from "../store/ui";
import { Aborted, play } from "./director";
import { isScene, SCENES, type SceneId } from "./scenes";
import "../styles.css";
import "./demo.css";

// The website is dark, so the demo always is: report a dark system theme to the
// app, which would otherwise follow the system until its settings load.
const matchMedia = window.matchMedia.bind(window);
window.matchMedia = (query) =>
  query.includes("prefers-color-scheme")
    ? matchMedia(query.includes("dark") ? "all" : "not all")
    : matchMedia(query);

const params = new URLSearchParams(location.search);
const loop = params.get("loop") === "1";
const initial = params.get("scene");
let sessions = 0;

function notify(event: "ready" | "done", scene: SceneId) {
  if (window.parent !== window)
    window.parent.postMessage({ source: "filehop-demo", event, scene }, location.origin);
}

function Demo() {
  const [run, setRun] = useState<{ scene: SceneId; id: number } | null>(
    isScene(initial) ? { scene: initial, id: 0 } : null,
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      const { source, scene } = (event.data ?? {}) as { source?: unknown; scene?: unknown };
      if (source === "filehop-site" && isScene(scene))
        setRun((r) => ({ scene, id: (r?.id ?? 0) + 1 }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const [session, setSession] = useState<{
    id: number;
    backend: ReturnType<typeof createPreviewBackend>;
  } | null>(null);
  useEffect(() => {
    if (!run) return;
    // Fresh sample data and interface state for every run.
    useUi.setState(useUi.getInitialState(), true);
    const created = createPreviewBackend({ scripted: true });
    setSession({ id: ++sessions, backend: created });
    const controller = new AbortController();
    notify("ready", run.scene);
    play(SCENES[run.scene], { signal: controller.signal, preview: created })
      .then(() => {
        notify("done", run.scene);
        if (loop) setRun((r) => (r ? { ...r, id: r.id + 1 } : r));
      })
      .catch((error) => {
        if (!(error instanceof Aborted)) console.error(error);
      });
    return () => {
      controller.abort();
      created.dispose();
    };
  }, [run]);

  if (!session) return null;
  // The website embeds the demo inert: it is watched, not used.
  return <App key={session.id} backend={session.backend} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("FileHop could not find its application root.");
applyTheme("dark");
createRoot(root).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
