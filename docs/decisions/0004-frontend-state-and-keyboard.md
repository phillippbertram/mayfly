# ADR 0004: Frontend state, validation, and keyboard model

- Status: Accepted
- Date: 2026-11-02

## Context

The desktop interface grew beyond a single snapshot: per-share options before
sharing, lifetime extension, a command palette, and keyboard control of every
action. Hand-rolled state and key handling were starting to duplicate logic.
Popular libraries were evaluated: zod, zustand, TanStack Query, TanStack Hotkeys,
cmdk, and Fastify or Hono for file serving.

## Decision

- **zod** defines every IPC DTO in `apps/desktop/src/lib/backend/schemas.ts`.
  TypeScript types are inferred from the schemas, and the desktop adapter parses
  Rust responses with them so contract drift fails loudly. Forms reuse the same
  schemas, such as the port rule.
- **TanStack Query** owns backend state. The backend contract is request and
  response plus a change feed; change notifications invalidate the affected query
  keys. Queries never go stale on their own and are not retried.
- **zustand** holds UI-only state: selection, inspector, dialogs, the options sheet,
  and counter signals that let shortcuts open menus.
- **TanStack Hotkeys** declares all shortcuts once with names and groups. One
  command list drives the hotkeys, the **cmdk** command palette, and the shortcut
  overview. Dialogs use exclusive hotkey scopes. The package is pre-1.0, so its
  version is pinned exactly and reviewed on upgrade.
- Files are **staged** before sharing: Rust validates them and returns handles
  without paths, the options sheet chooses lifetime, limit, and profile, and
  `createShares` turns handles into shares.
- **Fastify and Hono are not used.** Serving files is the Rust/Axum HTTP service's
  job (ADR 0001). A Node server would need a bundled sidecar runtime, duplicate the
  token, expiry, and limit enforcement outside Rust, and widen the attack surface,
  with no capability Axum lacks.

## Consequences

Backend issues implement Tauri commands and events that match the schemas and the
`Backend` contract; components stay unchanged. New libraries must not inject
`<style>` elements at runtime, which the production CSP refuses; cmdk and TanStack
Hotkeys were checked. The frontend bundle grows by roughly 70 kB gzip, which is
acceptable for a desktop app loaded from disk.
