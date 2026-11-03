# Backend instructions

Read the root `AGENTS.md`, `apps/desktop/AGENTS.md`, and `docs/security.md` first.
This directory contains the Rust services, Axum handlers, thin Tauri commands,
configuration persistence, and native lifecycle integrations.

For backend changes:

- Separate core services from Axum handlers and thin Tauri commands.
- Use asynchronous streaming with bounded memory, explicit errors, and cancellation.
- Keep internal paths and tokens out of logs, errors, and unrelated serialized DTOs.
- Validate regular files and address symlink/replacement behavior explicitly.
- Enforce download policy atomically without holding a shared lock during streaming.
- Revoke all shares and gracefully stop listeners on explicit quit. Hiding a window
  must not stop sharing. Account for failed binds and conflicting ports.
- Use narrow capabilities and allow only the native integrations the application needs.
- Add meaningful Rust unit and HTTP integration tests; run rustfmt and Clippy.
