import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useToast } from "../components/ui/toast";
import { useBackend } from "../hooks/use-backend";
import { DEFAULT_SETTINGS } from "./backend/defaults";
import type { Settings, Topic } from "./backend/types";

export const queryKeys = {
  server: ["server"],
  shares: ["shares"],
  settings: ["settings"],
  profiles: ["profiles"],
  interfaces: ["interfaces"],
} as const satisfies Record<Topic, readonly string[]>;

export function useServer() {
  const backend = useBackend();
  return useQuery({ queryKey: queryKeys.server, queryFn: () => backend.getServer() });
}

export function useShares() {
  const backend = useBackend();
  return useQuery({ queryKey: queryKeys.shares, queryFn: () => backend.listShares() });
}

/** Settings with defaults while the first load is in flight. */
export function useSettings(): Settings {
  const backend = useBackend();
  return (
    useQuery({ queryKey: queryKeys.settings, queryFn: () => backend.getSettings() }).data ??
    DEFAULT_SETTINGS
  );
}

export function useProfiles() {
  const backend = useBackend();
  return (
    useQuery({ queryKey: queryKeys.profiles, queryFn: () => backend.listProfiles() }).data ?? []
  );
}

export function useInterfaces() {
  const backend = useBackend();
  return (
    useQuery({ queryKey: queryKeys.interfaces, queryFn: () => backend.listInterfaces() }).data ?? []
  );
}

/** Applies backend change notifications to the query cache. */
export function useBackendSync(client: QueryClient) {
  const backend = useBackend();
  const toast = useToast();
  useEffect(
    () =>
      backend.subscribe((event) => {
        if (event.kind === "changed") {
          for (const topic of event.topics)
            client.invalidateQueries({ queryKey: queryKeys[topic] });
        } else {
          toast(`Your network address changed to ${event.address}. QR codes were updated.`);
        }
      }),
    [backend, client, toast],
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.name === "BackendError"
    ? error.message
    : "Something went wrong. Try again.";
}

export function useUpdateSettings() {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => backend.updateSettings(patch),
    onSuccess: (settings) => client.setQueryData(queryKeys.settings, settings),
  });
}
