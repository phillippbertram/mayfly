# FileHop

Temporary file sharing from your desktop to any browser on the same local network.

FileHop is planned as a small desktop application for macOS, Windows, and Linux.
Select files, scan a QR code on your phone, and download directly from your computer.
No cloud service, account, or companion mobile app is required.

## Project status

**The desktop interface is implemented. The Rust sharing backend is not implemented yet.**

The app opens a native window with the dashboard from the [design concept](docs/design.md):
an empty state and drop zone, the share list, a share inspector with QR codes,
settings, and light/dark themes. It talks to Rust through a typed backend contract.
The desktop build truthfully reports that sharing is unavailable, because there are
no file-sharing services, HTTP endpoints, native picker, or tray service in Rust yet.
The pnpm workspace includes strict TypeScript, Vite, Tailwind CSS, Lucide, and Biome.
Further implementation is tracked in the [roadmap](docs/roadmap.md).

## Planned experience

1. Add files with the native file picker or drag and drop.
2. Open a share's QR code or copy its local download URL.
3. Scan the code with a phone connected to the same trusted network.
4. Download from a mobile page in the browser.
5. Revoke the share, let it expire, or limit its download count.

The desktop interface will provide light and dark themes, an inviting empty state,
share details, network selection, and a tray menu. Closing the window will keep
sharing active; explicitly quitting will stop the server and revoke all shares.

## Repository setup

For frontend development and repository tooling:

- Git.
- Node.js 24, also recorded in `.nvmrc` and `.node-version`.
- pnpm 11.15.1, pinned in `package.json`.
- GitHub CLI (`gh`) for issue management, or the GitHub web interface.

```sh
git clone git@github.com:phillippbertram/filehop.git
cd filehop
npm install --global pnpm@11.15.1
pnpm install --frozen-lockfile
pnpm check
```

For the native desktop app, also install Rust with [rustup](https://rustup.rs/) and
the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.
`rust-toolchain.toml` selects stable Rust, rustfmt, and Clippy. Rust must be on your
shell's PATH. For a standard rustup installation on macOS/Linux, load it into the
current terminal with `. "$HOME/.cargo/env"`. See
[Native development](docs/development.md#native-development) for persistent shell
setup and prerequisite checks.

## Start FileHop

From the repository root:

```sh
pnpm dev
```

This starts Vite and opens the native FileHop desktop window. On the first run,
Cargo downloads and compiles Tauri's native dependencies, which can take a few minutes.
The start screen confirms the real Rust connection when the native app is ready.
Closing the window currently exits the app; background tray behavior is a later issue.

If port 1420 is already in use, stop the running `pnpm dev:web` or previous
`pnpm dev` process before starting the desktop app. Tauri starts its own Vite server
on that port.

For a browser-only preview without Rust:

```sh
pnpm dev:web
```

Open <http://127.0.0.1:1420>. The preview loads a clearly labeled sample-data
simulator so every interface state can be reviewed without Rust. It shares nothing
and does not provide native IPC. The development server binds only to loopback.

To format repository documents and configuration:

```sh
pnpm format
```

## Application development and builds

The app uses Tauri 2, Rust, React, strict TypeScript, Vite, Tailwind CSS, Lucide,
Motion, and shadcn-style components on Radix primitives. Axum and Tokio-based sharing
services will be added when their features are implemented.

Native prerequisites include Rust through rustup and the platform dependencies
in the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

| Platform | Native prerequisites and build targets                                 |
| -------- | ---------------------------------------------------------------------- |
| macOS    | Xcode Command Line Tools; Apple Silicon and Intel builds               |
| Windows  | Microsoft C++ build tools and WebView2; Windows x64 build              |
| Linux    | Distribution-specific WebKitGTK and tray dependencies; Linux x64 build |

```sh
pnpm check        # Biome and strict TypeScript
pnpm build:web    # Type-check and build the frontend
pnpm check:rust   # rustfmt and Clippy (requires Rust/native prerequisites)
pnpm build        # Build and package the native app for the current host OS
```

For explicit local release packages, use these commands from the repository root
or from `apps/desktop`:

| Command                  | Target                   | Packages               |
| ------------------------ | ------------------------ | ---------------------- |
| `pnpm build:macos`       | Current Mac architecture | `.app` and `.dmg`      |
| `pnpm build:macos:arm64` | macOS Apple Silicon      | `.app` and `.dmg`      |
| `pnpm build:macos:x64`   | macOS Intel              | `.app` and `.dmg`      |
| `pnpm build:windows`     | Windows x64 (MSVC)       | NSIS `.exe` installer  |
| `pnpm build:linux`       | Linux x64 (GNU)          | `.AppImage` and `.deb` |

Run each command on its corresponding operating system with the required Rust
target installed. Both macOS architecture targets can be built on a Mac. These
commands use the existing Tauri frontend build hook and Cargo's locked dependencies.
They do not install toolchains or build Windows/Linux packages from macOS.

Without an explicit target, bundles live under
`apps/desktop/src-tauri/target/release/bundle/`; architecture-specific commands use
`apps/desktop/src-tauri/target/<target>/release/bundle/`. See
[Local platform builds](docs/development.md#local-platform-builds) for target names,
prerequisites, and verification status. Native build CI, release publishing,
Developer ID signing, and notarization remain separate tasks; these are local
development artifacts. The desktop package lives at `apps/desktop`; shared
packages will be introduced only when needed.

## Product website and user manual

The Next.js/Fumadocs website lives in `apps/website`, with a Motion-enhanced product
page, real interface-preview screenshots, and an English user manual. Run it with
`pnpm dev:website` or create a static export with `pnpm build:website`.
See the [website guide](apps/website/README.md) for GitHub Pages base paths, local
export preview, static search, release metadata, and the prepared publishing workflow.
The website hosts product information and installers, not shared user files.

## Network and security model

The planned HTTP server streams only explicitly shared files from their original
locations. Each share receives an unpredictable temporary token. The LAN listener
serves only the mobile download page and download endpoint. Expiration, revocation,
and download limits are enforced by the backend.

Both devices must be able to reach each other on the same network. Guest Wi-Fi,
client isolation, VPNs, or a firewall may prevent access. No router port forwarding
or public network exposure is required.

**HTTP is unencrypted. Use FileHop only on trusted networks.** Anyone who obtains a
valid share URL can access that share until it expires or is revoked. Do not treat
tokens as permanent credentials. No telemetry, cloud relay, or file upload service
is part of the product. See the [security model](docs/security.md).

## Link profiles

For optional future access outside your Wi-Fi, see
[Sharing beyond your local network](docs/remote-sharing.md): Cloudflare Tunnel,
ngrok, private Tailscale access/Serve, and public Tailscale Funnel. These workflows
are not currently implemented or verified. The guide explains their different
access and provider trust models; local sharing remains the default.

The standard QR code will contain the local mobile-page URL. Custom profiles will
support templates such as:

```text
myapp://import?url={encodedUrl}
```

Supported placeholders are `{url}`, `{encodedUrl}`, `{filename}`,
`{encodedFilename}`, and `{token}`. Custom schemes require an installed application
that supports that scheme. FileHop will generate links without registering schemes
or installing external applications. See the [product specification](docs/product.md#link-profiles).

## Project documents

- [Product specification](docs/product.md): scope and acceptance criteria.
- [Architecture](docs/architecture.md): component boundaries and planned structure.
- [Security model](docs/security.md): requirements and validation cases.
- [Design concept](docs/design.md): desktop and mobile-page interface concept.
- [Development guide](docs/development.md): current tooling and future quality gates.
- [Agent workflow](docs/agent-workflow.md): shared instructions across coding tools.
- [Roadmap](docs/roadmap.md): links to the GitHub issue backlog.
- [Contributing](CONTRIBUTING.md): issue and pull request workflow.

## Current limitations

- File-sharing features remain unimplemented, including sharing, QR generation,
  profile persistence, the tray, and the optional management API.
- No file-sharing or phone end-to-end testing has been performed.
- Native bundle configuration exists; signing identities and a release pipeline are not configured.
- Universal Links and public HTTPS infrastructure are outside the MVP.
- A distribution license has not been selected. Do not assume an open-source license.
