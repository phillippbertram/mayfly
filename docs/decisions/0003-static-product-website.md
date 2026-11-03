# ADR 0003: Static product website and user manual

- Status: Accepted
- Date: 2026-11-02
- Delivery issue: #17

## Context

Mayfly needs an appealing user-facing product page, platform downloads, and an
English user manual. The requested direction uses Next.js, Fumadocs, and Motion,
with GitHub Pages as the publication target. The desktop backend and public release
installers are still in development, so the website must distinguish previews
from functional transfers and released downloads.

## Decision

Create `apps/website` in the existing pnpm workspace. Use Next.js static export,
Fumadocs MDX content, shared strict TypeScript/Biome, Tailwind CSS, and Motion.
Use real screenshots of the app's browser-preview interface with explicit sample-data
captions; implement the animated workflow as a reduced-motion-aware interactive
illustration instead of presenting a fabricated transfer recording.

Keep product pages expressive and the manual focused on readable task guidance.
Respect the configured project base path in assets, search, metadata, and links.
Export the search index as JSON and perform searches on the client.

Prepare release metadata at build time. With no approved public release, show an
unavailable state. A configured public GitHub release repository may supply a
validated manifest, fetched without authentication; credentials and private release
assets must never reach browser code. Local manifests support release-pipeline
integration and tests. Binary-integrity/public-access acceptance remains a release gate.

Prepare a dedicated GitHub Actions workflow for static builds and an explicit
manual publishing action. Do not enable Pages, change repository visibility, or
claim hosted deployment as part of local implementation. Issues #13 and #15 retain
the distribution and release prerequisites.

## Consequences

The site needs no running Node.js server, runtime API, cloud search account, or
file-transfer infrastructure after export. New releases require a fresh build and
explicit publication. Remote-sharing documentation describes optional future
workflows without enabling tunnels. The static export and real browsers must be
tested at both root and GitHub project paths, including search and mobile layouts.
