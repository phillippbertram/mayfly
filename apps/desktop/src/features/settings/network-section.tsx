import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import type { ServerState } from "../../lib/backend";
import { PortSchema } from "../../lib/backend/schemas";
import { cn } from "../../lib/cn";
import {
  errorMessage,
  useInterfaces,
  useServer,
  useSettings,
  useUpdateSettings,
} from "../../lib/queries";
import { Field, InlineMessage, inputClass, SectionHeader } from "./field";

function statusLine(server: ServerState): {
  tone: "ok" | "warn" | "error" | "muted";
  text: string;
} {
  switch (server.kind) {
    case "online":
      return { tone: "ok", text: `Listening on ${server.address}:${server.port}` };
    case "noAddress":
      return { tone: "warn", text: "No usable network address" };
    case "bindFailed":
      return { tone: "error", text: server.message };
    case "starting":
      return { tone: "muted", text: "Starting…" };
    case "stopping":
      return { tone: "muted", text: "Stopping…" };
    case "unavailable":
      return { tone: "muted", text: server.message };
  }
}

export function NetworkSection() {
  const settings = useSettings();
  const server: ServerState = useServer().data ?? { kind: "starting" };
  const interfaces = useInterfaces();
  const mutation = useUpdateSettings();
  const [port, setPort] = useState(String(settings.port));
  const [iface, setIface] = useState(settings.interfaceId ?? interfaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setPort(String(settings.port));
    setIface(settings.interfaceId ?? interfaces[0]?.id ?? "");
  }, [settings.port, settings.interfaceId, interfaces]);

  const parsed = PortSchema.safeParse(Number(port));
  const portValid = port !== "" && parsed.success;
  const portError = portValid ? null : (parsed.error?.issues[0]?.message ?? "Enter a port.");
  const dirty =
    port !== String(settings.port) || iface !== (settings.interfaceId ?? interfaces[0]?.id ?? "");
  const status = statusLine(server);

  const busy = mutation.isPending;
  const apply = () => {
    if (!parsed.success) return;
    setError(null);
    setApplied(false);
    mutation.mutate(
      { port: parsed.data, interfaceId: iface || null },
      {
        onSuccess: () => {
          setApplied(true);
          setTimeout(() => setApplied(false), 2400);
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        title="Network"
        description="Phones must be on the same network and able to reach this address."
      />
      <div className="flex flex-col gap-5">
        <Field label="Port" htmlFor="port">
          <div className="flex items-center gap-3">
            <input
              id="port"
              inputMode="numeric"
              value={port}
              aria-invalid={!portValid}
              onChange={(e) => {
                setPort(e.target.value.replace(/[^\d]/g, "").slice(0, 5));
                setError(null);
              }}
              className={cn(inputClass, "w-28 tnum")}
            />
            <span className="flex items-center gap-2 text-[12px] text-muted">
              <span
                className={cn(
                  "size-2 rounded-full transition-colors",
                  status.tone === "ok"
                    ? "bg-accent"
                    : status.tone === "warn"
                      ? "bg-warning"
                      : status.tone === "error"
                        ? "bg-danger"
                        : "bg-faint",
                )}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={status.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="tnum"
                >
                  {status.text}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
          <InlineMessage message={portError} tone="error" />
        </Field>

        <Field
          label="Interface"
          htmlFor="interface"
          hint="Only addresses the server can actually bind are listed. Guest Wi‑Fi, VPNs, and client isolation can keep phones from reaching this computer."
        >
          {interfaces.length > 0 ? (
            <Select
              id="interface"
              label="Interface"
              className="w-80"
              value={iface}
              onValueChange={setIface}
              options={interfaces.map((i) => ({ value: i.id, label: i.name, hint: i.address }))}
            />
          ) : (
            <div className="rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[12px] text-muted">
              No network interfaces are available. Connect to Wi‑Fi or Ethernet.
            </div>
          )}
        </Field>
        <InlineMessage message={error} tone="error" />
        <InlineMessage
          message={applied ? "Applied. QR codes now use the new address." : null}
          tone="success"
        />
      </div>
      <div className="flex-1" />
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-muted">
          Mayfly keeps the last working address until the new one binds.
        </span>
        <Button variant="primary" disabled={!dirty || !portValid || busy} onClick={apply} layout>
          {busy && <LoaderCircle aria-hidden="true" size={14} className="spin" />}
          {busy ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
