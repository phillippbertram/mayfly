import { ArrowUpRight, Check, Laptop, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { type AppInfo, getAppInfo, isDesktop } from "./lib/desktop";

type Connection =
  | { status: "connecting" }
  | { status: "connected"; info: AppInfo }
  | { status: "preview" }
  | { status: "error" };

export function App() {
  const [connection, setConnection] = useState<Connection>({ status: "connecting" });

  useEffect(() => {
    let active = true;

    if (!isDesktop()) {
      setConnection({ status: "preview" });
      return;
    }

    getAppInfo()
      .then((info) => {
        if (active) setConnection({ status: "connected", info });
      })
      .catch(() => {
        if (active) setConnection({ status: "error" });
      });

    return () => {
      active = false;
    };
  }, []);

  const status = {
    connecting: "Connecting to desktop…",
    connected: "Desktop app is running",
    preview: "Browser preview",
    error: "Desktop connection unavailable",
  }[connection.status];

  return (
    <div className="app-shell mx-auto flex min-h-svh max-w-5xl flex-col px-8 py-6 sm:px-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="brand-mark flex size-8 items-center justify-center rounded-xl">
            <ArrowUpRight aria-hidden="true" size={21} strokeWidth={2} />
          </span>
          <span className="text-base font-semibold tracking-tight">FileHop</span>
        </div>
        <span className="stage-label rounded-full px-3 py-1.5 text-xs font-medium">
          Early development
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <div className="device-art mb-6 flex items-center gap-5" aria-hidden="true">
          <span className="device-tile flex size-16 items-center justify-center rounded-2xl">
            <Laptop size={35} strokeWidth={1.4} />
          </span>
          <span className="hop-path flex items-center gap-2">
            <span />
            <span />
            <ArrowUpRight size={20} strokeWidth={1.7} />
          </span>
          <span className="device-tile phone flex size-14 items-center justify-center rounded-2xl">
            <Smartphone size={29} strokeWidth={1.4} />
          </span>
        </div>

        <p className="eyebrow mb-3 text-xs font-semibold uppercase tracking-[0.16em]">
          Hello, FileHop
        </p>
        <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.045em]">
          A little less between your devices.
        </h1>
        <p className="muted mt-4 max-w-sm text-sm leading-6">
          Your desktop app is ready for its next step.
          <br />
          Local file sharing is coming soon.
        </p>

        <div
          className="connection mt-6 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs"
          role="status"
        >
          {connection.status === "connected" ? (
            <Check aria-hidden="true" size={14} />
          ) : (
            <span className="status-dot" aria-hidden="true" />
          )}
          <span>{status}</span>
        </div>
        {connection.status === "error" && (
          <p className="muted mt-3 text-xs">Restart FileHop to reconnect to the desktop backend.</p>
        )}
      </main>

      <footer className="muted flex items-center justify-between gap-4 border-t pt-5 text-xs">
        <span>A small start. A shorter hop.</span>
        <span>
          {connection.status === "connected" ? `v${connection.info.version}` : "FileHop foundation"}
        </span>
      </footer>
    </div>
  );
}
