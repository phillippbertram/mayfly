"use client";

import { ArrowDown, ArrowUpRight, Check, Command, Monitor, Terminal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Release } from "@/lib/release";

const systems = [
  { id: "macos", label: "macOS", icon: Command },
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "linux", label: "Linux", icon: Terminal },
] as const;

export function Downloads({ release }: { release: Release | null }) {
  const [system, setSystem] = useState<string>("macos");
  const [copied, setCopied] = useState(false);
  const assets = release?.assets.filter((item) => item.target.startsWith(system)) ?? [];
  return (
    <div className="download-panel">
      <div className="download-heading">
        <span className="eyebrow">A HOME ON YOUR DESKTOP</span>
        <h2>
          A small app.
          <br />A shorter way there.
        </h2>
        <p>
          Being built for macOS, Windows, and Linux.
          <br />
          No account for local sharing. No mobile app to install.
        </p>
      </div>
      <div className="download-card">
        <fieldset className="system-selector" aria-label="Operating system">
          {systems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              aria-pressed={system === id}
              key={id}
              onClick={() => setSystem(id)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </fieldset>
        {release && assets.length ? (
          <div className="download-options">
            <span className="release-label">Mayfly {release.version} · stable</span>
            {assets.map((item) => (
              <div className="download-asset" key={`${item.target}-${item.format}`}>
                <a className="button button-primary" href={item.url}>
                  <ArrowDown size={16} />
                  {item.target === "macos-arm64"
                    ? "Apple Silicon"
                    : item.target === "macos-x64"
                      ? "Intel Mac"
                      : item.format === "deb"
                        ? "Debian & Ubuntu"
                        : item.format === "AppImage"
                          ? "Any distribution"
                          : "Windows x64"}{" "}
                  <span>.{item.format}</span>
                </a>
                <small>Requires {item.minimumOs}</small>
                <details>
                  <summary>SHA-256 checksum</summary>
                  <code>{item.sha256}</code>
                </details>
              </div>
            ))}
            <a className="text-link" href={release.notesUrl}>
              All downloads & release notes <ArrowUpRight size={14} />
            </a>
          </div>
        ) : (
          <div className="download-unavailable">
            <p className="release-target">
              Planned builds:{" "}
              {system === "macos"
                ? "Apple Silicon & Intel"
                : system === "windows"
                  ? "Windows x64"
                  : "Linux x64 · AppImage & .deb"}
            </p>
            <span className="availability-dot" />
            <strong>Good things take a little building.</strong>
            <p>
              {release
                ? "A verified installer for this platform is not available in this release."
                : "Public installers aren’t ready yet. With source access, run the desktop development build with real local sharing. Platform acceptance is still pending."}
            </p>
            <button className="button unavailable-button" type="button" disabled>
              <ArrowDown size={16} />
              Installer coming soon
            </button>
            <div className="source-command">
              <code>pnpm dev</code>
              <button
                type="button"
                aria-label="Copy development command"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText("pnpm dev");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied
                  </>
                ) : (
                  "Copy"
                )}
              </button>
            </div>
            <Link href="/docs/getting-started/" className="text-link">
              Set up from source <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
