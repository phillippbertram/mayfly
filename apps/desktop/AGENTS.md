# Desktop workspace instructions

Read the root `AGENTS.md` first. This package contains the Tauri desktop app,
including real Rust sharing services, HTTP downloads, settings, profiles, and tray
integration. Keep implementation and platform/device verification distinct.

- Keep React/TypeScript in `src/` and Rust/Tauri in `src-tauri/`.
- Extend the root `tsconfig.base.json` when adding application TypeScript configs.
- Use root Biome settings for supported source/configuration files; use rustfmt for Rust.
- Keep app-specific dependencies here and shared development tooling at the root.
- Keep development, frontend, Rust, and platform build commands working.
- Keep `LICENSE`, `NOTICE`, and third-party notices in the bundled `licenses/` resources.
- Do not extract shared packages until at least one concrete consumer needs them.
