# ADR 0001: Desktop application and repository foundation

- Status: Accepted for repository organization and implementation direction
- Date: 2026-11-02

## Context

FileHop needs direct desktop-to-phone file sharing over a trusted local network,
without a cloud service or account. The first task explicitly establishes the
project basis before any application code is written. Work is managed in GitHub
Issues, and all source and documentation must be in English.

## Decision

Use a lightweight pnpm workspace with one Tauri 2 desktop package in `apps/desktop`.
Keep the React/strict TypeScript/Vite frontend in `apps/desktop/src/` and the Rust
backend in `apps/desktop/src-tauri/`. Axum and Tokio will serve files and manage
asynchronous work. Use Tailwind CSS, shadcn/ui, and Lucide for the interface.

Keep shared development tooling at the root and app-specific dependencies in the
desktop package. Add shared packages only when a concrete consumer needs them.

Keep security decisions and file access in modular Rust services, exposed through
thin Tauri commands. The LAN server exposes only download-related routes. Any later
management API uses a separate authenticated loopback listener.

Persist settings and profiles locally; keep shares and tokens in memory. Share
original files through streaming rather than copying or uploading them.

Establish shared agent guidance in `AGENTS.md`, with thin compatibility entry points
and scoped frontend/backend instructions. Avoid vendor-specific execution tooling.
Use GitHub Issues for work and this directory for architecture decisions.

Use Node.js 24, pinned pnpm tooling, Biome, and a strict TypeScript base configuration.
Biome covers supported source files and repository documents/configuration. Rust
will use rustfmt and Clippy. Introduce native manifests, Rust toolchain pins, runtime packages,
and native CI when implementation starts, not as empty placeholders now.

## Consequences

The initial checkout is a reviewable project foundation, not a runnable app. Native
setup is the first implementation issue. Runtime dependencies and their exact
versions are selected and verified in that issue. Cross-platform build success,
signing, and physical phone acceptance require later independent evidence.

A single application avoids unnecessary workspace and service overhead. Separating
services from Tauri makes security and HTTP behavior testable without a webview.
Plain HTTP limits the product to trusted networks; public HTTPS and Universal Links
remain outside the MVP.
