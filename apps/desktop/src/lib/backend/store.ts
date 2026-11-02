import type { BackendEvent, Snapshot } from "./types";

/** Minimal observable state container shared by both adapters. */
export class SnapshotStore {
  #snapshot: Snapshot;
  readonly #listeners = new Set<() => void>();
  readonly #eventListeners = new Set<(event: BackendEvent) => void>();

  constructor(initial: Snapshot) {
    this.#snapshot = initial;
  }

  get = (): Snapshot => this.#snapshot;

  set(update: (current: Snapshot) => Snapshot): void {
    this.#snapshot = update(this.#snapshot);
    for (const listener of this.#listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  onEvent = (listener: (event: BackendEvent) => void): (() => void) => {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  };

  emit(event: BackendEvent): void {
    for (const listener of this.#eventListeners) listener(event);
  }
}
