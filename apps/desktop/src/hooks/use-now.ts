import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
  // Align ticks to whole seconds so every countdown changes together.
  timer = setTimeout(tick, 1000 - (now % 1000) + 5);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) tick();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) clearTimeout(timer);
  };
}

/** A shared one-second clock for display-only countdowns. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}
