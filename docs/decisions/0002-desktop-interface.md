# ADR 0002: Desktop interface implementation

- Status: Accepted
- Date: 2026-11-02

## Context

The design concept (variant A in [design.md](../design.md)) asks for a calm,
single-window dashboard with clear motion and hover feedback. The Rust share,
server, network, and settings services do not exist yet, while the interface must
never invent online states or mock production behavior. The production CSP allows
only `style-src 'self'`, so runtime-injected `<style>` elements are refused.

## Decision

- Put every backend interaction behind one typed `Backend` contract in
  `apps/desktop/src/lib/backend/`. Rust remains authoritative for statuses,
  expiration, counters, links, and template validation; DTOs carry no local paths.
- The desktop adapter calls Rust and reports sharing as unavailable until the
  commands exist. A sample-data simulator loads only outside Tauri, as a separate
  chunk, and the UI labels it as a browser preview.
- Use Motion for enter, exit, and layout animations, honoring reduced motion.
  Do not use `AnimatePresence` `popLayout`, which injects a style element.
- Build shadcn-style components on Radix primitives that need no style injection:
  Tooltip, DropdownMenu with `modal={false}` (also used as the select), Switch, and
  RadioGroup. Use the native modal `<dialog>` for dialogs and sheets instead of
  Radix Dialog, whose scroll lock injects styles.
- Render QR codes in the frontend from the backend-provided link with `uqr`, as SVG
  on screen and PNG for export, on a white card in both themes.
- Use a macOS overlay title bar with inset traffic lights and a draggable header;
  the capability grants only drag-drop event listening and window dragging.

## Consequences

The interface can be reviewed and refined before the backend exists, and each
backend issue replaces adapter methods without touching components. The browser
preview is not verification of native behavior. New UI dependencies must be checked
for runtime style injection before use.
