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

The workspace root and `@mayfly/desktop` package are private. The root contains
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
must be available on the shell's PATH before running native pnpm commands.

On macOS, install the Xcode Command Line Tools with `xcode-select --install` if
needed. Check that an installed developer directory is selected:

```sh
xcode-select -p
```

When installing Rust through rustup, allow the installer to configure your shell's
PATH. For a standard installation on macOS/Linux, load Cargo's environment into
the current terminal and verify the tools:

```sh
. "$HOME/.cargo/env"
cargo --version
rustc --version
rustup show active-toolchain
```

If this fixes `failed to run 'cargo metadata' ... No such file or directory`, Rust
was installed but unavailable to the process starting Tauri. Installing pnpm
dependencies does not install Rust or configure the shell. Ensure your shell's
startup configuration loads Cargo's environment for future sessions; rustup
normally configures this during installation. For zsh, its standard setup uses
`~/.zshenv` to load `. "$HOME/.cargo/env"`. Restart your terminal and development
tools after changing PATH so child processes inherit it, then check that
`cargo --version` works in a fresh terminal without manually loading the file.

Once the prerequisites are available, run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check:rust
pnpm dev
```

`pnpm dev` starts Vite on loopback port 1420, then compiles/opens Mayfly. The
frontend's status and version are returned by the real `get_app_info` Rust command.
The capability file grants only native file-drop event listening and title-bar
dragging; it grants no filesystem, shell, network, or plugin permissions.
Production CSP is restrictive; development CSP adds the local Vite/HMR origins.
Closing the window hides it and keeps sharing; quit from the tray or with Cmd/Ctrl+Q.
During development, stop the session with Ctrl+C in the terminal, which skips the quit
confirmation. Settings persist in the app config directory (see architecture.md);
delete `settings.json` there to start from defaults.

Port 1420 must be available when starting `pnpm dev`. Stop a running `pnpm dev:web`
or a previous desktop development process first; Tauri starts Vite itself.

If Vite keeps port 1420 after the native app exits on macOS, inspect Tauri's
temporary cleanup script:

```sh
ls -l "$TMPDIR/tauri-stop-dev-processes.sh"
```

Tauri CLI 2.12.4 reuses this file without checking its contents or permissions.
An empty or non-executable file prevents it from stopping Vite's process tree
([upstream issue #15098](https://github.com/tauri-apps/tauri/issues/15098)). Stop
the development session with Ctrl+C and stop any remaining Vite process after
identifying it with `lsof -nP -iTCP:1420 -sTCP:LISTEN`. With no Tauri development
sessions running, remove the broken temporary script so Tauri can recreate it:

```sh
rm "$TMPDIR/tauri-stop-dev-processes.sh"
pnpm dev
```

After closing the app, check that port 1420 is free with the same `lsof` command.
The normal development command remains `tauri dev`; no separate Vite process
supervisor is needed.

`pnpm build` uses release mode and the current host's supported bundle formats.
For a quicker macOS debug app bundle, use
`pnpm --filter @mayfly/desktop tauri build --debug --bundles app`.
Build outputs are ignored under `apps/desktop/src-tauri/target/`.
The starter icon has an editable SVG source in `src-tauri/icons/`; final brand/tray
assets remain issue #12. Interface components follow the shadcn/ui pattern on Radix
primitives; see [ADR 0002](decisions/0002-desktop-interface.md) for CSP constraints.

The starter has no behavioral test suite yet. Run real native startup/IPC checks
alongside compiler/linter checks; add meaningful feature tests as features arrive.
Do not treat a browser preview as verification of native IPC or a desktop build.
`pnpm dev:web` loads a sample-data simulator for interface review only; the desktop
build never loads it and reports sharing as unavailable until the Rust services exist.

## Website interface demo

`pnpm --filter @mayfly/desktop build:demo` builds `demo.html`: the unchanged
interface on the scripted sample-data simulator, which the product website embeds
([ADR 0013](decisions/0013-live-interface-demo.md)). Scenes live in
`apps/desktop/src/demo/scenes.ts` and find controls by their accessible names; when
you rename a control a scene uses, update the scene and check it at
`http://127.0.0.1:1420/demo.html?scene=<name>` while `pnpm dev:web` runs.

## Local platform builds

Local build commands are available from the repository root and from `apps/desktop`.
They prepare the packaging work tracked in
[#8](https://github.com/phillippbertram/mayfly/issues/8); native CI and release
publishing remain separate work.

| Command                  | Rust target                                  | Tauri bundles  |
| ------------------------ | -------------------------------------------- | -------------- |
| `pnpm build:macos`       | Current Mac architecture; no explicit target | `app,dmg`      |
| `pnpm build:macos:arm64` | `aarch64-apple-darwin`                       | `app,dmg`      |
| `pnpm build:macos:x64`   | `x86_64-apple-darwin`                        | `app,dmg`      |
| `pnpm build:windows`     | `x86_64-pc-windows-msvc`                     | `nsis`         |
| `pnpm build:linux`       | `x86_64-unknown-linux-gnu`                   | `appimage,deb` |

Each new alias invokes `tauri build` in release mode with fixed bundle options and
passes `--locked` to Cargo. The existing `beforeBuildCommand` runs `pnpm build:web`,
which checks TypeScript and builds the frontend; a frontend failure stops packaging.
Run `pnpm install --frozen-lockfile` before building. The existing `pnpm build`
command retains Tauri's default bundle selection for the host.

### Prerequisites and supported hosts

Use the matching operating system and the
[official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

- **macOS:** Xcode Command Line Tools and a macOS Rust toolchain. Both Apple Silicon
  and Intel targets can be built on a Mac with the corresponding Rust targets
  installed. Add a missing target manually with
  `rustup target add aarch64-apple-darwin` or
  `rustup target add x86_64-apple-darwin`.
- **Windows x64:** Microsoft C++ Build Tools with the Desktop development with C++
  workload, Windows SDK, WebView2, and the `x86_64-pc-windows-msvc` Rust target.
  Add a missing target with `rustup target add x86_64-pc-windows-msvc`.
- **Linux x64:** The distribution's Tauri development packages, including WebKitGTK
  4.1, GTK 3, AppIndicator support for the tray, librsvg, and packaging tools such as
  `patchelf`, plus the `x86_64-unknown-linux-gnu` Rust target. Add a missing target
  with `rustup target add x86_64-unknown-linux-gnu`. Build on the oldest supported
  distribution providing these dependencies; building on a newer system can raise
  the minimum required glibc version. See the
  [Tauri AppImage guidance](https://v2.tauri.app/distribute/appimage/#limitations).

The scripts do not install Rust targets or OS packages. Run Windows and Linux
builds on their respective hosts; cross-compilation between operating systems and
universal macOS bundles are outside these commands.

### Outputs and customization

`pnpm build:macos` writes bundles under
`apps/desktop/src-tauri/target/release/bundle/`. Commands with an explicit target
write under `apps/desktop/src-tauri/target/<target>/release/bundle/`:

- `macos/Mayfly.app` and `dmg/*.dmg` on macOS.
- `nsis/*-setup.exe` on Windows.
- `appimage/*.AppImage` and `deb/*.deb` on Linux.

Outputs remain in the ignored Tauri target directory. These commands do not upload
artifacts or create releases; the [release workflow](releasing.md) does that from a
version tag. Nothing configures signing identities or notarizes the app. macOS may
apply an ad hoc signature for local execution; this is not Developer ID signing
or notarization.

The new aliases are fixed release commands. For debug builds or custom Tauri flags,
invoke the CLI directly, placing Cargo arguments after `--`, for example:

```sh
pnpm --filter @mayfly/desktop tauri build --debug --bundles app -- --locked
```

## Current verification

The starter was built and launched on macOS Apple Silicon with Rust 1.99.1.
Verified checks include frozen pnpm installation, Biome/strict TypeScript,
frontend production build, Cargo compilation, rustfmt, Clippy, and creation of a
macOS debug `.app` bundle. The bundled window displayed the version and successful
desktop connection returned by Rust. Windows, Linux, Intel macOS, signed release
installers, and file-sharing/phone workflows have not been verified yet.

On 2026-11-02, `pnpm build:macos:arm64` completed from the repository root and
produced a macOS ARM64 release `.app` and `.dmg`. `lipo -archs` confirmed `arm64`, and `hdiutil verify` confirmed
the DMG checksum. The release app was launched from its build output, displayed
the native dashboard, and quit with Cmd+Q. This verifies local packaging and a
startup/quit smoke test; installation from the DMG was not tested. The Windows,
Linux, and Intel macOS commands are prepared but have not been built or run on
their target platforms. Developer ID signing and notarization remain unverified.

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

The `Release` workflow builds the native matrix from `vX.Y.Z` tags and creates a
draft GitHub release; see [Releasing](releasing.md). Keep publishing and signing
credentials out of pull-request workflows.
