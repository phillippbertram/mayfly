# Architecture

## Status and decisions

The desktop shell, share service, HTTP service, network discovery, settings
persistence, link profiles, and the tray lifecycle are implemented in
`apps/desktop/src-tauri/src/` (`shares/`, `server/`, `network.rs`, `settings.rs`,
`config.rs`, `profiles.rs`, `lifecycle.rs`, `app.rs`, `commands.rs`). See
[ADR 0001](decisions/0001-desktop-foundation.md) for the foundation decision and
[ADR 0005](decisions/0005-share-bundles-and-landing-page.md) for the landing page and
download counting, [ADR 0008](decisions/0008-file-drop.md) for the share model, and
[ADR 0010](decisions/0010-link-profiles-as-templates.md) for link profiles.

FileHop uses a lightweight pnpm workspace with one desktop package at `apps/desktop`
and root development tooling. React/TypeScript and its Tauri Rust crate stay together
inside that package. Add shared packages only when there is a concrete consumer;
no task orchestrator, microservices, or separate daemon is required. Core Rust
services should be testable without starting a webview.

The separate `apps/website` workspace contains the Next.js/Fumadocs product site
and English manual. It exports static assets for GitHub Pages; search and release
metadata are prepared at build time. It has no file-transfer backend and does not
participate in desktop-to-phone sharing. See [ADR 0003](decisions/0003-static-product-website.md).

## Repository layout

```text
.
├── AGENTS.md                 # Canonical shared agent instructions
├── CONTRIBUTING.md
├── README.md
├── SECURITY.md
├── .github/                  # Issue forms, PR template, repository checks
├── docs/
│   ├── concepts/             # Design proposals under discussion
│   ├── decisions/            # Architecture decision records
│   ├── product.md
│   ├── security.md
│   ├── design.md
│   ├── development.md
│   ├── agent-workflow.md
│   └── roadmap.md
├── biome.json                # Shared formatting, lint, and import rules
├── tsconfig.base.json        # Strict TypeScript defaults for future app configs
├── pnpm-workspace.yaml       # Workspace package discovery
└── apps/
    └── desktop/              # @filehop/desktop
        ├── src/              # React start screen, styles, typed IPC adapter
        └── src-tauri/        # Native window, app-info command, configuration/icons
```

Future frontend modules under `apps/desktop/src/`: `components/`, `features/shares/`, `features/settings/`,
`features/profiles/`, and `lib/` for typed IPC and utilities. Add modules when they
have a responsibility, not as empty scaffolding.

Future Rust modules under `apps/desktop/src-tauri/src/`: `shares`, `server`, `network`, `settings`, `profiles`,
`commands`, and application lifecycle wiring. Start with modules in a single crate;
extract crates only if a real boundary requires it.

## Component boundaries

| Component         | Owns                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| React UI          | Rendering, interaction, selection state, copy/save actions, accessible feedback |
| Typed IPC         | Explicit request/response DTOs and sanitized errors                             |
| Share service     | Validated original files, in-memory metadata, tokens, lifetime and limit policy |
| HTTP service      | LAN routes, streaming, mobile pages, headers, server startup/shutdown           |
| Network service   | Discovering eligible addresses and validating the selected interface            |
| Settings service  | Validated local configuration, defaults, schema versioning, reliable writes     |
| Profile service   | Template validation and deterministic URL substitution                          |
| Desktop lifecycle | Tray, hide/show behavior, explicit quit and graceful shutdown                   |

Do not embed UI concerns in share management. Internal models can contain paths;
outbound share DTOs cannot. Keep URLs and profile links derived from current server
configuration so IP or port changes cannot leave stale QR codes in the UI.

## Data flow

1. A native picker or Tauri drop event supplies selected paths to a narrow command.
2. The share service validates and canonicalizes each file, captures metadata,
   generates a token, and stores the share in memory.
3. The UI receives safe metadata and URLs. QR generation uses the selected profile's
   resolved link, with the HTTP mobile-page URL as the default.
4. A mobile request resolves a token to an existing share; request text never becomes
   a filesystem path. Each request checks availability server-side.
5. A download opens the authorized file and streams it with bounded memory after
   atomically reserving download capacity.
6. Expiration and state changes update the desktop through events or bounded polling;
   UI clocks are informative, never authoritative.

## Listeners and lifecycle

The IPv4 LAN listener binds to an appropriate local interface or wildcard address
on port 8765 by default. Only discovered, usable local addresses may be advertised.
Support interface selection, changed/disappearing addresses, and bind failures.
IPv6 URL formatting and reachability are a separate explicitly tested capability;
do not advertise an address the actual listener cannot serve.

Serve only the mobile page and download routes from the LAN listener. An optional
management API uses a separate `127.0.0.1` listener and separate authentication.
There is no Tauri IPC bridge, static filesystem server, or settings route over LAN.

Start the listener under application-managed state. Settings changes that require a
rebind must validate and bind successfully or preserve a usable previous state.
Closing the window hides it. Explicit Quit first blocks new downloads and revokes
shares, then cancels streams, stops listeners, and exits after bounded cleanup.
Define and test the exact in-flight download behavior in the lifecycle issue.

## State and persistence

Store settings and profiles in Tauri's per-user application config directory as a
versioned local document. Validate on load and write via safe replacement. Report
corrupt configuration and recover with documented defaults without silently losing
the user's profiles. Do not store share history, tokens, active shares, or contents.

Implemented (`config.rs`): `settings.json` holds
`{ "version": 1, "settings": {…}, "profiles": […] }`
in the app config directory (macOS `~/Library/Application Support/de.phillippbertram.filehop`,
Windows `%APPDATA%\de.phillippbertram.filehop`, Linux `~/.config/de.phillippbertram.filehop`).
Saves write a synced temporary file and rename it over the old one. On load, unknown
fields are ignored and an invalid value falls back to its default while the others
are kept; an unreadable file, or one from a newer version, is renamed to
`settings.unreadable-<time>.json` and FileHop starts with defaults. Invalid profiles
are left out, keeping the original as `settings.repaired-<time>.json`. Each case
shows a one-time notice in the window. Settings that bind the listener are saved only
after the bind succeeded.

Keep share state synchronized. Never hold a registry lock for an entire download.
Use a monotonic deadline for elapsed lifetime enforcement and wall-clock timestamps
for display. Run periodic cleanup for resource usage; correctness must not depend
on the cleanup interval.

## Technology and future checks

Tauri 2, Rust, Axum, Tokio, React, strict TypeScript, Vite, Tailwind CSS, shadcn/ui,
and Lucide are selected. Choose maintained QR, network-discovery, MIME, randomness,
and persistence dependencies during implementation and explain their purpose.

Use the shared strict TypeScript base for app-specific configs. Biome handles
supported source files, JSON, Markdown, and YAML; rustfmt handles Rust. Tooling
dependencies live at the workspace root; application dependencies belong to the
desktop package. Use `workspace:` references if shared packages become necessary.

Add native packaging CI only after the application has real buildable targets.
Verify macOS ARM64/Intel, Windows, and Linux separately. A cross-compiled artifact
does not establish runtime behavior on its target platform.
