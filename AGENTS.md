# Agent instructions

This is the canonical, tool-independent instruction file for FileHop. Keep shared
rules here; tool-specific entry points should only reference this file.

## Scope and language

- Write all code, comments, documentation, issues, commit messages, and PR text in English.
- Never add `Co-Authored-By:` trailers or other agent attribution lines to commit messages.
- The current app is a minimal, runnable Tauri/React starter. Implement only the
  functionality authorized by the current task; sharing, HTTP, tray, and profiles
  remain separate implementation issues.
- Read `README.md`, `docs/architecture.md`, and the relevant GitHub issue before work.
- Treat GitHub Issues as the source of truth for tasks and acceptance criteria.
  Use `docs/roadmap.md` as an issue index, not a duplicate task database.
- Describe planned, implemented, locally verified, and platform-verified behavior accurately.

## Workflow

- Inspect repository state and existing instructions before editing. Preserve unrelated changes.
- Work in small, reviewable changes linked to an issue. Do not expand into another
  implementation phase without task authorization.
- Make routine technical decisions independently and record meaningful architecture
  decisions in `docs/decisions/`. Ask only about decisions that fundamentally change the product.
- Use the current checkout unless isolation is needed. Do not commit, push, merge,
  publish, or release unless the task authorizes it.
- Do not add vendor-specific agent runtimes, credentials, MCP servers, permission
  bypasses, or global machine configuration to the repository.
- Do not delegate to subagents unless the task explicitly requests delegation.
- When interacting with Cloudflare, use the cf CLI unless the project has a Wrangler
  configuration file.

## Architecture and implementation rules

- Use a pnpm workspace with one Tauri 2 app in `apps/desktop`: React/TypeScript in
  `apps/desktop/src/` and Rust in `apps/desktop/src-tauri/`.
- Extend `tsconfig.base.json` for TypeScript. Use Biome for supported source/config
  files and keep app-specific dependencies in the desktop package. Add shared
  packages only when there is a concrete need.
- Keep share management, token creation, file access, expiration, network discovery,
  persistence, and server lifecycle in Rust. UI code must not own security decisions.
- Keep Rust services independent of Tauri commands and UI state. Commands are thin
  adapters; transport DTOs must not expose internal file paths.
- Use strict TypeScript and clear IPC types. Avoid unnecessary abstractions and dependencies.
- Share files by streaming their original contents. Never use mock data for production
  functionality or copy entire files into memory.
- Persist settings and profiles only. Shares and access tokens must be memory-only
  and invalid after a complete application restart.

## Security invariants

- Only explicitly selected, validated regular files can be served. Never accept a
  request path as a filesystem path or expose directory browsing.
- Use cryptographically secure unpredictable tokens. Never log tokens, full share
  URLs, absolute file paths, or API credentials.
- Enforce expiration and revocation on every request. Download-limit reservations
  must be atomic; define retries, HEAD, ranges, and failures before implementing counting.
- Public LAN routes are exclusively download-related. An optional management API
  must use a separate IPv4 loopback listener with authentication, strict Host
  validation, and rejection of browser-originated requests and DNS rebinding.
- Use narrow Tauri capabilities and a restrictive CSP. Do not expose arbitrary
  filesystem access or shell execution to the frontend.
- Keep HTTP's trusted-network limitation visible in the product and documentation.
- Consult `docs/security.md` whenever changing networking, file access, IPC, or profiles.

## Verification and reporting

- Install tooling with `pnpm install --frozen-lockfile`; use `pnpm check` for the
  current repository checks and `pnpm format` for formatting.
- Use `pnpm dev` for the desktop app, `pnpm dev:web` for a browser-only preview,
  `pnpm build:web` for the frontend, and `pnpm build` for a native bundle.
- `pnpm check` includes Biome and strict TypeScript. Use `pnpm check:rust` for
  rustfmt and Clippy. Add meaningful tests as behavior arrives; no successful no-op checks.
- Once application code exists, verify relevant strict TypeScript checks, frontend
  tests/builds, Rust tests, rustfmt, and Clippy. Test security behavior through real HTTP requests.
- Keep meaningful tests for expiration, token generation, atomic limits, path
  handling, streaming, error responses, and template substitution.
- Report the checks actually run, their results, and any unverified platform behavior.
- Never claim a desktop build, installer, phone download, or CI execution succeeded
  from a documentation-only check.
