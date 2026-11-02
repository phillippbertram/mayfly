import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { Backend, Snapshot } from "../lib/backend";

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  return <BackendContext value={backend}>{children}</BackendContext>;
}

export function useBackend(): Backend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error("useBackend must be used inside BackendProvider.");
  return backend;
}

export function useSnapshot(): Snapshot {
  const backend = useBackend();
  return useSyncExternalStore(backend.subscribe, backend.getSnapshot);
}
