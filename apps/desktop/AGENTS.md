# Desktop workspace instructions

Read the root `AGENTS.md` first. This package contains the minimal runnable Tauri
desktop application. File sharing, server, tray, and profile features remain planned.

- Keep React/TypeScript in `src/` and Rust/Tauri in `src-tauri/`.
- Extend the root `tsconfig.base.json` when adding application TypeScript configs.
- Use root Biome settings for supported source/configuration files; use rustfmt for Rust.
- Keep app-specific dependencies here and shared development tooling at the root.
- Add real development/build/test scripts when application implementation starts.
- Do not extract shared packages until at least one concrete consumer needs them.
