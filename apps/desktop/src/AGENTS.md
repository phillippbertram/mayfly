# Frontend instructions

Read the root `AGENTS.md` and `apps/desktop/AGENTS.md` first. This directory contains
the React frontend, system-theme styling, and a typed desktop IPC adapter.

For frontend changes:

- Use strict TypeScript, React, Vite, Tailwind CSS, shadcn/ui, and Lucide.
- Keep IPC calls and DTOs behind a small, typed interface. Rust is authoritative for
  statuses, expiration, download counters, file validation, and generated links.
- Use native file selection and Tauri file-drop events for desktop file paths;
  browser `File` objects alone cannot authorize backend filesystem access.
- Handle loading, empty, offline, expired, revoked, and error states without mock data.
- Provide keyboard access, visible focus, accessible names, and light/dark themes.
- Never render untrusted filenames or templates as raw HTML.
- Do not introduce frontend file reads or local-path display to support QR actions.
