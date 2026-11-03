# Development guide

## Current stage

The workspace contains a Tauri 2/React desktop app and a separate static product
website. The desktop app uses real Rust services for native file selection and
drop staging, memory-only shares, Axum HTTP streaming, network discovery, tray
lifecycle, persistent settings/link profiles, and optional per-share passwords.
The frontend communicates through typed IPC; browser previews use a separate
sample-data simulator. Do not run a scaffold generator over this checkout.

Implementation is ahead of native/device acceptance. See
[Current verification](#current-verification), the [architecture](architecture.md),
and the [issue index](roadmap.md) for the boundaries and remaining work.

## Available commands

Use Node.js 24 and pnpm 11.15.1. With a compatible Node version manager, select the
version from `.nvmrc` or `.node-version`.

```sh
npm install --global pnpm@11.15.1
pnpm install --frozen-lockfile
pnpm check
pnpm format
```

| Command                            | Current behavior                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm check`                       | Run Biome, desktop/website TypeScript, version/notice checks, and script tests |
| `pnpm lint`                        | Run Biome lint checks; warnings fail                                           |
| `pnpm format:check`                | Check formatting with Biome                                                    |
| `pnpm format`                      | Apply Biome formatting                                                         |
| `pnpm version:check`               | Check that desktop/workspace/Cargo versions agree                              |
| `pnpm licenses:check`              | Reject stale or modified dependency notice snapshots                           |
| `pnpm licenses:generate`           | Collect locked dependency license texts for review                             |
| `pnpm test:scripts`                | Test version tooling and release-asset collection/manifests                    |
| `pnpm list --recursive --depth -1` | List the workspace root, desktop, and website packages                         |

Biome warnings fail `pnpm check`. That command does not run Rust checks, build the
desktop frontend, or run desktop interaction tests. Application commands:

| Command              | Behavior                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`           | Start Vite and the native Tauri app                                              |
| `pnpm dev:web`       | Serve a browser-only preview at `http://127.0.0.1:1420`                          |
| `pnpm typecheck`     | Check strict TypeScript for both desktop and website                             |
| `pnpm build:web`     | Type-check and build frontend assets                                             |
| `pnpm check:rust`    | Check rustfmt and run Clippy with `--all-targets` and `-D warnings` for the host |
| `pnpm build`         | Build and package the desktop app for the current host                           |
| `pnpm dev:website`   | Serve the product website at `http://127.0.0.1:3037`                             |
| `pnpm build:website` | Build the live interface demo and export the static website                      |
| `pnpm test:website`  | Run the website release-metadata tests                                           |

The workspace root, `@mayfly/desktop`, and `@mayfly/website` packages are private.
The root contains Biome and TypeScript tooling; application dependencies live in
their respective packages. Both app TypeScript configurations extend the shared
strict `tsconfig.base.json`.
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
pnpm build:web
pnpm check:rust
pnpm dev
```

`pnpm dev` starts Vite on loopback port 1420, then compiles/opens Mayfly. The
desktop adapter in `apps/desktop/src/lib/backend/desktop.ts` invokes Rust commands
and validates responses with the schemas in `schemas.ts`. Commands in
`src-tauri/src/commands.rs` adapt the independent Rust services; the frontend
does not own file authorization or download policy.

The capability file grants only native event listening and title-bar
dragging; it grants no filesystem, shell, network, or plugin permissions.
Production CSP is restrictive; development CSP adds the local Vite/HMR origins.
Closing the window shows a one-time explanation before hiding it while sharing
continues. Reopen or quit from the tray, or quit with Cmd/Ctrl+Q. If no tray is
available, closing the window requests quit instead. Explicit quit asks for
confirmation when active shares would stop, then revokes shares, cancels transfers,
and stops the listener with a two-second grace period.
During development, stop the session with Ctrl+C in the terminal, which skips the quit
confirmation. Settings and profiles persist in the app config directory (see
[State and persistence](architecture.md#state-and-persistence)); move `settings.json`
aside while the app is stopped to start from defaults without discarding profiles.
Shares and tokens never persist and are invalid after a complete restart.

The LAN listener uses IPv4 wildcard binding on port 8765 by default and advertises
a usable discovered local address. Port/interface selection and sharing defaults
live in Settings. A port change must bind successfully before the new settings
are saved. Use the displayed share links rather than inventing URLs from the
frontend development port; port 1420 serves the UI, not shared files. Keep local
tests on trusted networks: the sharing listener uses unencrypted HTTP.

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

After stopping the development session, check that port 1420 is free with the same `lsof` command.
The normal development command remains `tauri dev`; no separate Vite process
supervisor is needed.

`pnpm build` uses release mode and the current host's supported bundle formats.
For a quicker macOS debug app bundle, use
`pnpm --filter @mayfly/desktop tauri build --debug --bundles app`.
Build outputs are ignored under `apps/desktop/src-tauri/target/`.
App icons and the macOS tray template have editable SVG sources in
`apps/desktop/src-tauri/icons/`; platform visual acceptance remains issue #12.
Interface components follow the shadcn/ui pattern on Radix
primitives; see [ADR 0002](decisions/0002-desktop-interface.md) for CSP constraints.

`pnpm dev:web` loads a sample-data simulator for interface review only; the desktop
app always uses the Rust backend. A browser preview does not verify native IPC,
file access, clipboard integration, the tray, or actual LAN downloads.

## Tests and local checks

Run these commands from the repository root with native prerequisites installed:

```sh
pnpm check
pnpm build:web
pnpm check:rust
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
pnpm test:website
```

Build the frontend before standalone Rust checks in a clean checkout: Tauri's
generated context embeds those assets. Cargo uses the committed lockfile.

Rust unit tests cover tokens, file validation/pinned handles, exact expiry,
atomic reservations, configuration recovery, profile substitution, and password
verification. `src-tauri/src/server/tests.rs` starts actual loopback listeners and
uses HTTP requests to check original bytes, safe headers/escaping, malformed
requests, concurrency, HEAD/ranges, revocation, cancellation, password unlocks,
throttling, and bind conflicts. They do not need a running desktop webview.

Normal test runs skip the slow ZIP64 round trip. To run it explicitly, build the
frontend first, then use the following command; it streams a sparse source larger
than 4 GiB into a ZIP and needs over 4 GiB of temporary output space:

```sh
cargo test --release --manifest-path apps/desktop/src-tauri/Cargo.toml --locked -- --ignored zip64
```

There is no desktop frontend interaction/IPC test suite yet. Strict TypeScript,
the frontend build, Rust service tests, and the website's metadata tests cover
different boundaries. Native selection/drop, QR decoding/clipboard/save, tray,
and phone downloads still need their own recorded smoke/acceptance tests (#3–#7,
#16, #20). Follow [the security model](security.md) when changing these boundaries.

## Website interface demo

`pnpm --filter @mayfly/desktop build:demo` builds `demo.html`: the unchanged
interface on the scripted sample-data simulator, which the product website embeds
([ADR 0013](decisions/0013-live-interface-demo.md)). Scenes live in
`apps/desktop/src/demo/scenes.ts` and find controls by their accessible names; when
you rename a control a scene uses, update the scene and check it at
`http://127.0.0.1:1420/demo.html?scene=<name>` while `pnpm dev:web` runs.

## Local platform builds

Local build commands are available from the repository root and from `apps/desktop`.
The same platform scripts are used by the tag-driven release workflow. Native
PR/build artifacts remain tracked in
[#8](https://github.com/phillippbertram/mayfly/issues/8); release publishing and
installed-bundle acceptance are separate work.

| Command                  | Rust target                                  | Tauri bundles  |
| ------------------------ | -------------------------------------------- | -------------- |
| `pnpm build:macos`       | Current Mac architecture; no explicit target | `app,dmg`      |
| `pnpm build:macos:arm64` | `aarch64-apple-darwin`                       | `app,dmg`      |
| `pnpm build:macos:x64`   | `x86_64-apple-darwin`                        | `app,dmg`      |
| `pnpm build:windows`     | `x86_64-pc-windows-msvc`                     | `nsis`         |
| `pnpm build:linux`       | `x86_64-unknown-linux-gnu`                   | `appimage,deb` |

Each platform alias invokes `tauri build` in release mode with fixed bundle options and
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
version tag. The Tauri configuration explicitly selects ad-hoc signing (`-`) for
macOS bundles. Developer ID signing, notarization, and Windows signing are not
configured; ad-hoc signing does not establish public distribution trust (#14).
Read [Installation and first launch](installation.md) for the documented per-app
exceptions and checksum checks. Those instructions do not establish downloaded
bundle acceptance on any platform.

The build checks the dependency notice snapshot before compiling the frontend.
Tauri includes the project license, copyright notice, and full third-party notices
as `licenses/` resources in every configured bundle; see [Third-party licensing](licensing.md).

The platform aliases are fixed release commands. For debug builds or custom Tauri flags,
invoke the CLI directly, placing Cargo arguments after `--`, for example:

```sh
pnpm --filter @mayfly/desktop tauri build --debug --bundles app -- --locked
```

## Current verification

### Local automated checks — 2026-11-03

On macOS Apple Silicon, `pnpm check`, `pnpm build:web`, `pnpm check:rust`, and
`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked` passed.
The Rust suite reported **110 passed, 0 failed, 1 ignored** (the optional ZIP64
test); the repository script suite reported **9 passed**. The frontend build
emitted a non-fatal bundle-size warning. These results cover local compilation,
linting, and automated behavior, including real loopback HTTP requests.

### Recorded native smoke checks

The initial app was built and launched on macOS Apple Silicon with Rust 1.99.1,
including a debug `.app` displaying the version and real Rust connection status.

On 2026-11-02, `pnpm build:macos:arm64` completed from the repository root and
produced a macOS ARM64 release `.app` and `.dmg`. `lipo -archs` confirmed `arm64`, and `hdiutil verify` confirmed
the DMG checksum. The release app was launched from its build output, displayed
the native dashboard, and quit with Cmd+Q. This verifies local packaging and a
startup/quit smoke test; installation from the DMG was not tested. These are
recorded earlier checks, not a new native launch during the documentation update.

### GitHub Actions build evidence

[Release run 41649425528](https://github.com/phillippbertram/mayfly/actions/runs/41649425528)
for `v0.8.0` at commit `e63b486b10f62652349f7318c2dc697cbdc5d81d` completed
successfully on 2026-11-03. The quality-gate job and builds for macOS arm64,
macOS x64, Windows x64, and Linux x64 all passed and uploaded platform artifacts;
the draft-release job also passed. This run predates the Mayfly rename and is
evidence for that revision, not a build of the latest checkout or proof that
publicly accessible downloads currently exist.

### Remaining acceptance

Installed-bundle checks on all supported systems, complete native selection/drop,
QR image clipboard/save, close-to-tray/reopen, and the real iPhone Safari flow
remain outstanding (#3–#7, #16, #20). Windows, Linux, and Intel macOS runtime
behavior is not established by CI compilation. Final security hardening,
Developer ID signing, notarization, Windows signing, and public website/download
acceptance remain open. A locally bound listener does not prove phone reachability.

## Quality gates

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

`Repository checks` runs on pushes and pull requests, installs locked pnpm
dependencies, and runs `pnpm check`: Biome, both TypeScript projects, version
consistency, and release/version script tests. It uses read-only repository
permissions, pinned action commits, a timeout, and cancels superseded runs. It
does not currently run Rust tests/Clippy or a desktop frontend production build.

`Release` runs quality gates (including the frontend build, rustfmt, Clippy, and
Rust tests) on version tags, builds the four-target native matrix, and creates a
draft release only after all builds succeed; see [Releasing](releasing.md).
These tag-only gates do not replace continuous application validation (#11) or
native PR artifact builds (#8). Keep publishing and signing credentials out of
pull-request workflows.

`Website` type-checks, tests release metadata, builds the live demo/static site,
checks exported links, and uploads a Pages artifact. Public deployment is gated
by `MAYFLY_PAGES_ENABLED` and an explicit publishing run; a green build alone
does not mean the site was deployed. See the
[website guide](../apps/website/README.md) for release metadata and preview commands.
