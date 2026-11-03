# Frontend instructions

Read the root `AGENTS.md` and `apps/desktop/AGENTS.md` first. This directory contains
the React frontend, system-theme styling, and a typed desktop IPC adapter.

For frontend changes:

- Use strict TypeScript, React, Vite, Tailwind CSS, shadcn/ui, and Lucide.
- Define IPC DTOs as zod schemas in `lib/backend/schemas.ts`, keep backend state in
  TanStack Query, UI-only state in the zustand store, and every shortcut in
  `lib/hotkeys.ts` plus the command list (ADR 0004). Check new UI libraries for
  runtime `<style>` injection, which the production CSP refuses.
- Keep IPC calls and DTOs behind a small, typed interface. Rust is authoritative for
  statuses, expiration, download counters, file validation, and generated links.
- Use native file selection and Tauri file-drop events for desktop file paths;
  browser `File` objects alone cannot authorize backend filesystem access.
- Handle loading, empty, offline, expired, revoked, and error states without mock data.
- Provide keyboard access, visible focus, accessible names, and light/dark themes.
- Never render untrusted filenames or templates as raw HTML.
- Do not introduce frontend file reads or local-path display to support QR actions.
- The website's live demo (`demo/`, ADR 0013) drives controls by accessible name.
  When you rename a control a scene in `demo/scenes.ts` uses, update the scene.
