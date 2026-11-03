# FileHop website and user manual

An English product website and Fumadocs manual, built with Next.js, Tailwind CSS,
and Motion. The product page uses actual interface-preview screenshots, an animated
screenshot tour, and an interactive transfer illustration. No file-sharing backend
runs on this website.

## Local development

From the workspace root:

```sh
pnpm install --frozen-lockfile
pnpm dev:website
```

Open `http://127.0.0.1:3037`. The development server binds only to loopback.
`pnpm dev` continues to start the desktop app; `pnpm dev:web` remains its simulator.

## Static export for GitHub Pages

```sh
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_BASE_PATH=/filehop pnpm build:website
NEXT_PUBLIC_BASE_PATH=/filehop pnpm --filter @filehop/website check:export
```

The complete deployable artifact is `apps/website/out`. There is no Node.js runtime,
server-side search request, or runtime environment secret after export. Search is
pre-rendered into `search-index.json` and runs in the browser. All public assets use
the configured project base path; Next.js handles internal route prefixes.

Set `NEXT_PUBLIC_BASE_PATH` to an empty string for a root/custom-domain site, or a
single path such as `/filehop` for a GitHub project site. `NEXT_PUBLIC_SITE_URL`
sets the canonical origin (default `https://phillippbertram.github.io`). Do not
include the project path in the origin. Build again after changing either setting.

For local static review, serve the exported directory under the matching project
path. A static HTTP server needs directory-index support and the export's generated
404 page. Never use `next start` for this static export.

The included preview server handles both:

```sh
NEXT_PUBLIC_BASE_PATH=/filehop pnpm --filter @filehop/website preview
```

Open `http://127.0.0.1:3037/filehop/`. Override `PORT` if that port is occupied.

## Checks

```sh
pnpm --filter @filehop/website typecheck
pnpm test:website
pnpm build:website
pnpm --filter @filehop/website check:export
```

Root `pnpm check` also checks the website's TypeScript. Biome is shared with the
desktop package; generated `.source`, `.next`, `.release`, and `out` are ignored.
The exported-link checker validates local page/asset targets, anchors, and base-path
prefixes. Release tests cover invalid targets, duplicate assets, checksums, stable
versions, and credential-bearing or unsafe URLs.

Next.js and Fumadocs are pinned to versions accepted by the workspace's dependency
age policy. Only esbuild's necessary installation script is explicitly permitted.
No minimum-release-age exceptions are needed.

## Release data and real download links

`data/release.json` is intentionally `{ "schemaVersion": 1, "release": null }`.
Without verified public release assets, the website shows a clear unavailable state
and source-development instructions. It never invents installer URLs or minimum OS
versions. macOS Apple Silicon/Intel and all platform choices remain visible.

While the source repository is private, `pnpm --filter @filehop/website
release:pull [tag]` downloads a release's manifest with your own GitHub CLI session
into `.release/pulled-manifest.json` for a local preview with
`FILEHOP_RELEASE_MANIFEST`. Never use it in CI or for a public build.

The build accepts either:

- `FILEHOP_RELEASE_MANIFEST`: a local, validated manifest file for build-time input.
- `FILEHOP_RELEASE_REPOSITORY=owner/public-releases`: an approved public GitHub
  repository. The build requests its latest stable release without authentication,
  downloads the attached `filehop-release.json`, verifies its tag, and checks that
  every listed download is an actual release asset. A 404 yields the unavailable
  state; malformed metadata and other request failures fail the build.

An available manifest has this structure (illustrative only):

```json
{
  "schemaVersion": 1,
  "release": {
    "version": "1.0.0",
    "publishedAt": "2026-11-02T12:00:00Z",
    "notesUrl": "https://github.com/OWNER/PUBLIC-RELEASES/releases/tag/v1.0.0",
    "assets": [
      {
        "target": "macos-arm64",
        "format": "dmg",
        "minimumOs": "A verified minimum version",
        "sha256": "REPLACE_WITH_64_LOWERCASE_HEX_CHARACTERS",
        "url": "https://github.com/OWNER/PUBLIC-RELEASES/releases/download/v1.0.0/FileHop-arm64.dmg"
      }
    ]
  }
}
```

Supported targets: `macos-arm64`, `macos-x64`, `windows-x64`, and `linux-x64`.
Checksums must be real SHA-256 values. The release workflow
(`scripts/release-assets.mjs`, see [Releasing](../../docs/releasing.md)) produces
this file for every stable release. Tests use fixtures; they are
never shipped as production download data. Public unauthenticated access and binary
integrity still require signed-out acceptance testing before release promotion.

## GitHub Actions and publication

`.github/workflows/website.yml` builds and validates project-path exports on relevant
PRs/main changes, release publication, `filehop-release-published` repository-dispatch
events, and manual runs. This refreshes build-time download metadata when configured.
For a separate public release repository, its release workflow can dispatch that
event to this source repository using a suitably scoped credential stored there.
The browser never needs that credential.

Deployment is a separate job. It is disabled until the repository variable
`FILEHOP_PAGES_ENABLED` is `true`, and then runs only on `main`, from a manual run
with the `publish` input selected. A published release requests such a run
automatically, so release-triggered deployments also come from `main`. To enable
publication later:

1. Resolve issue #13's repository visibility/public distribution decision and verify
   that the account plan supports Pages for the selected source repository.
2. Configure GitHub Pages to use GitHub Actions and the `github-pages` environment.
3. Configure the approved `FILEHOP_RELEASE_REPOSITORY` repository variable, if ready.
4. Set `FILEHOP_PAGES_ENABLED` to `true`.
5. Review the built artifact, then run the workflow with publication explicitly enabled.
6. Check the deployed `/filehop/` site, manual, static search, and signed-out downloads.

After future releases, publish a newly validated build to refresh the public site.
To roll back site changes, revert the relevant website change on `main`, build it
again, and explicitly run the publish workflow. Do not weaken checks to deploy a
broken export. This task prepares the pipeline; it does not enable Pages, change
repository visibility, publish a website, or claim a successful hosted deployment.

## Content and media

The manual lives in `content/docs`; navigation is in `meta.json`. It covers the
current native development build: multiple-file shares, ZIP downloads, editable
file lists, titles, empty links, per-file QR codes, saved settings, tray behavior,
and custom link profiles. Public installers, packaged-platform/device acceptance,
and integrated remote sharing remain pending.

Keep public language English and distinguish implemented behavior from verification
and release availability. Screenshot provenance is in `public/screenshots/README.md`.
Screenshots use only the sample-data browser simulator, never real access tokens.
The screenshot tour crossfades actual captures, runs once in view, offers pause/play
and manual selection, and stays static for reduced motion. Text and the initial
image remain available without JavaScript; no video or GIF dependency is needed.

Linear's website informed the restrained typography, spacing, and product-first
presentation. No Linear text, branding, or media is copied into this website.
