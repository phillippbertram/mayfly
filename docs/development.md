# Development guide

## Current stage

The workspace contains a minimal Tauri 2/React desktop application with a start
screen and a read-only Rust app-info command. File sharing, HTTP, tray, persistence,
and profiles are not implemented. Do not run a scaffold generator over this checkout.

## Available commands

Use Node.js 24 and pnpm 11.15.1. With a compatible Node version manager, select the
version from `.nvmrc` or `.node-version`.

```sh
npm install --global pnpm@11.15.1
pnpm install --frozen-lockfile
pnpm check
pnpm format
```

| Command                            | Current behavior                                                  |
| ---------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                       | Run Biome's CI formatting, lint, and assist checks; warnings fail |
| `pnpm lint`                        | Run Biome lint checks; warnings fail                              |
| `pnpm format:check`                | Check formatting with Biome                                       |
| `pnpm format`                      | Apply Biome formatting                                            |
| `pnpm list --recursive --depth -1` | List the workspace root and desktop package                       |

`pnpm check` also runs the strict TypeScript compiler. Application commands:

| Command           | Behavior                                                |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | Start Vite and the native Tauri app                     |
| `pnpm dev:web`    | Serve a browser-only preview at `http://127.0.0.1:1420` |
| `pnpm typecheck`  | Check the desktop TypeScript sources/configuration      |
| `pnpm build:web`  | Type-check and build frontend assets                    |
| `pnpm check:rust` | Check rustfmt and run Clippy for all Rust targets       |
| `pnpm build`      | Build and package the desktop app for the current host  |

The workspace root and `@filehop/desktop` package are private. The root contains
Biome and TypeScript tooling; app dependencies live in `apps/desktop`.
The desktop `tsconfig.json` extends the shared strict `tsconfig.base.json`.
Biome 2.6.4 supports Markdown and YAML as well as TypeScript, JavaScript, JSON,
and CSS. Generated lockfiles and build outputs are excluded from formatting. Rust uses rustfmt.

The lockfile is committed with dependency changes. Do not add dummy `dev`, `build`, or `test`
scripts that report success without building or testing an application.

## Native development

Install Rust with [rustup](https://rustup.rs/) and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the host OS.
The root `rust-toolchain.toml` selects stable Rust with rustfmt and Clippy. Rust
must be on PATH; on macOS/Linux, `. "$HOME/.cargo/env"` loads a standard rustup
installation when the shell has not loaded it yet.

`pnpm dev` starts Vite on loopback port 1420, then compiles/opens FileHop. The
frontend's status and version are returned by the real `get_app_info` Rust command.
The capability file grants no filesystem, shell, network, or plugin permissions.
Production CSP is restrictive; development CSP adds the local Vite/HMR origins.
Window close currently exits the process; tray behavior remains a separate feature.

`pnpm build` uses release mode and the current host's supported bundle formats.
For a quicker macOS debug app bundle, use
`pnpm --filter @filehop/desktop tauri build --debug --bundles app`.
Build outputs are ignored under `apps/desktop/src-tauri/target/`.
The starter icon has an editable SVG source in `src-tauri/icons/`; final brand/tray
assets remain issue #12. shadcn/ui will be introduced with actual interactive components.

The starter has no behavioral test suite yet. Run real native startup/IPC checks
alongside compiler/linter checks; add meaningful feature tests as features arrive.
Do not treat a browser preview as verification of native IPC or a desktop build.

## Current verification

The starter was built and launched on macOS Apple Silicon with Rust 1.99.1.
Verified checks include frozen pnpm installation, Biome/strict TypeScript,
frontend production build, Cargo compilation, rustfmt, Clippy, and creation of a
macOS debug `.app` bundle. The bundled window displayed the version and successful
desktop connection returned by Rust. Windows, Linux, Intel macOS, signed release
installers, and file-sharing/phone workflows have not been verified yet.

## Quality gates as features arrive

| Change                             | Required evidence                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Repository documents/configuration | `pnpm check`, valid issue/workflow configuration, correct local links             |
| React/IPC implementation           | Strict type checking, relevant behavior tests, frontend production build          |
| Rust core/HTTP implementation      | Relevant unit and HTTP integration tests, rustfmt, Clippy, Rust build             |
| Native desktop integrations        | Desktop build and OS-specific smoke tests                                         |
| LAN/mobile flow                    | Real same-network phone download and file integrity check                         |
| Packaging                          | Artifact build per target, installation/start smoke test, signing status recorded |

Use tests that protect behavior and security boundaries. Do not add tests that
merely mirror constants or claim network behavior without exercising HTTP requests.
Do not claim verification on an OS that was not tested.

## GitHub Actions

The initial `Repository checks` workflow installs the locked development tools and
runs the same repository checks as local development. It uses read-only repository
permissions, pinned action commits, a timeout, and cancels superseded runs.

Native build matrices and releases are a separate backlog item. Do not create
empty Cargo/Tauri packages just to make a premature matrix green. Keep publishing
and signing credentials out of pull-request workflows.
