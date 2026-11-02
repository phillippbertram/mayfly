import { useEffect, useRef } from "react";

/**
 * Runs `effect` when a counter signal increments after mount. A component that
 * mounts later (for example the inspector of a newly selected share) does not
 * replay signals it never saw.
 */
export function useSignal(signal: number, effect: () => void) {
  const seen = useRef(signal);
  const effectRef = useRef(effect);
  effectRef.current = effect;
  useEffect(() => {
    if (signal !== seen.current) {
      seen.current = signal;
      effectRef.current();
    }
  }, [signal]);
}
