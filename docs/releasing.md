# Releasing

Releases are published on GitHub Releases. Versions follow
[ADR 0012](decisions/0012-versioning-scheme.md). Issue #15 tracks the pipeline;
signing (#14), licensing (#13), and installed-bundle acceptance (#16) remain
prerequisites for a promoted stable release.

## Cutting a release

From a clean, up-to-date `main`:

```sh
pnpm release 0.9.0
git push --follow-tags origin main
```

`pnpm release` refuses invalid versions, versions that are not greater than the
current one, existing tags, uncommitted changes, and branches other than `main`.
It sets the version in the root and desktop `package.json`, `tauri.conf.json`,
`Cargo.toml`, and `Cargo.lock`, commits `chore(release): vX.Y.Z`, and creates an
annotated tag. `pnpm version:check` (part of `pnpm check`) verifies that the
declarations agree.

## What the workflow does

The tag starts `.github/workflows/release.yml`:

1. **verify** rejects a tag that differs from the app version or already has a
   release, then runs `pnpm check`, Rust formatting/Clippy, and Rust tests.
2. **build** runs the platform scripts from [Local platform builds](development.md#local-platform-builds)
   for macOS arm64 and x64 (both on an Apple Silicon runner), Windows x64 (NSIS),
   and Linux x64 (AppImage and `.deb` on Ubuntu 22.04). Bundles are renamed to
   `Mayfly-<version>-<target>.<ext>` and stored as workflow artifacts.
3. **draft** runs only after every build succeeds. It attaches the license texts,
   third-party notices, and `INSTALLATION.md`, writes their and the packages'
   `SHA256SUMS` entries and,
   for stable versions, the website manifest `mayfly-release.json`, then creates
   a **draft** release with the signing/installation warning from
   `docs/release-notes.md` followed by generated notes. Versions with a pre-release suffix
   (`-beta.1`) become GitHub pre-releases without a website manifest.

Every binary embeds the short commit hash it was built from (`GITHUB_SHA` in CI,
`git rev-parse` locally; see `src-tauri/build.rs`). The About dialog shows it next
to the version and copies both for bug reports.

An incomplete matrix never produces a release. A failed run can be re-run; once a
draft exists, a new run for the same tag fails instead of overwriting assets.
Delete the draft first to rebuild a tag.

## Publishing

Download the draft's assets, check them on each platform, edit the notes
(supported platforms, installation guidance, limitations, signing status), and
select **Publish release** only after the applicable promotion gates pass.
Current test packages have no verified publisher signature (#14): macOS uses
ad-hoc signing (`bundle.macOS.signingIdentity: "-"`) without Developer ID signing
or notarization, and Windows installers are unsigned. Ad-hoc signing seals bundle
contents; it does not identify the developer or establish notarization.

Keep the signing warning in the release notes and point to the attached
`INSTALLATION.md` and [installation guide](installation.md). macOS users first try
opening the installed app, then choose **System Settings → Privacy & Security →
Open Anyway** and confirm **Open**. Windows SmartScreen may offer **More info →
Run anyway** for an unrecognized app. These are explicit exceptions for a verified
download the user trusts; do not recommend disabling Gatekeeper/SmartScreen,
stripping quarantine, or overriding malware/damaged-app warnings. Managed devices
may prohibit the exception entirely. Test the exact downloaded artifacts on each
target before describing that installation experience as verified.

`pnpm licenses:check` verifies the reviewed dependency snapshot before builds.
The documents are included in Tauri resources and release attachments, but native
packagers can add components outside the npm/Cargo graphs. Complete the actual
bundle inventory and applicable notices/source review from
[Third-party licensing](licensing.md#review-the-actual-platform-packages-before-distribution)
before public binary promotion.

Declared minimum systems: macOS 11 (`bundle.macOS.minimumSystemVersion`),
Windows 10, and Ubuntu 22.04/Debian 12 or equivalent for Linux. They are build
settings, not yet platform-verified (#16).

## Website downloads

The website reads `mayfly-release.json` from the latest stable release at build
time (see the [website guide](../apps/website/README.md#release-data-and-real-download-links)).

While the repository is private, preview the download section locally with your
own GitHub CLI session. The links work in a browser signed in to GitHub with
access to the repository:

```sh
pnpm --filter @mayfly/website release:pull        # or: release:pull v0.9.0
MAYFLY_RELEASE_MANIFEST=.release/pulled-manifest.json pnpm dev:website
```

GitHub Pages deployment stays disabled until the repository variable
`MAYFLY_PAGES_ENABLED` is `true`. After the repository becomes public, set it,
configure Pages to use GitHub Actions, and set `MAYFLY_RELEASE_REPOSITORY` to
this repository. Every published release then triggers a publishing run of the
website workflow on `main`.

## Costs while private

Private repositories consume included GitHub Actions minutes, and macOS and
Windows runners count at higher multipliers than Linux. With two macOS builds, a
full release run can use a few hundred included minutes. Public repositories use
standard runners for free.
