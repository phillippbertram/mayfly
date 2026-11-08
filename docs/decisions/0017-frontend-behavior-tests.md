# ADR 0017: Test desktop behavior at the native transport boundary

- Status: Accepted
- Date: 2026-11-08
- Related issue: #11

## Context

Rust unit and real HTTP tests cover the sharing services. Type checking and a
frontend build cannot detect broken picker/drop flows, stale query state, or
incorrect copy/profile/settings interactions. The browser demo is a separate
simulator and must not stand in for the production IPC adapter in these tests.

## Decision

Use Vitest, jsdom, and React Testing Library in the desktop package. Test the
production adapter, Zod schemas, query cache, UI store, hooks, and React components
together. Replace only Tauri's command/event/drop transport and unavailable
browser primitives. Use synthetic file metadata, handles, and links; never select
real user files or start a LAN server from the JavaScript suite.

Keep tests under `src` so strict TypeScript checks include them. Use a separate
Vitest configuration without the production CSS/build plugins. Pin Vitest 4.1.12,
which supports the workspace's Vite version and Testing Library's assertion
types, without disabling library type checks.

`pnpm check` includes the frontend suite. Push/PR CI also builds the frontend,
checks rustfmt/Clippy, and runs the locked Rust unit/HTTP suite on Linux. Release
tags retain the same checks. Empty suites fail, and CI rejects focused tests.

## Consequences

UI tests catch changes in command arguments, DTO validation, backend events, and
visible interaction behavior. Assertions use accessible controls and wait for
observable state instead of fixed delays. The existing Rust tests remain the
authority for file access, expiration, atomic limits, and profile substitution.

jsdom does not establish rendering, OS picker/drop, clipboard permissions, QR
scanning, tray, or phone acceptance. Those checks remain in #7/#16. GitHub execution
must be recorded separately from local runs; implementing a workflow is not proof
that it ran successfully on a hosted runner.
