import type { BackendEvent } from "./types";

export function createEmitter() {
  const listeners = new Set<(event: BackendEvent) => void>();
  return {
    subscribe(listener: (event: BackendEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(event: BackendEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}
