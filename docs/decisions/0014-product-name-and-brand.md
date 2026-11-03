# ADR 0014: Product name and brand

- Status: Accepted
- Date: 2026-11-03
- Related issues: #12

## Context

The product needs a name that can carry a public release, store listings, and
search, and that no other desktop file app in the same category already uses.

A name check (web, app stores, package registries, US trademark search results)
found no file-sharing product or software trademark named "Mayfly". The short
domains and the `mayfly` npm and crates.io names are taken; `mayflyshare.app` was
available.

## Decision

- **Product name "Mayfly".** A mayfly lives for a single day, does one thing, and
  is gone. That is the product model: temporary, memory-only shares that end on
  expiry, on a limit, on stop, or on quit. The wordmark is always lowercase
  "mayfly"; "Mayfly Share" is used only where a longer name is needed, such as the
  website title and domain.
- **Brand concept.** A resting-mayfly mark (upright wing, curved body, fading
  tails), teal-tinted neutrals ("Still water", "Dusk"), the existing River-green
  accent, and Hatch amber for fading shares. Shares show the lifecycle names
  **Live**, **Fading**, and **Gone**; Stopped and Limit reached stay literal. The
  metaphor never replaces security wording. Details live in `docs/design.md`.
- **All identifiers follow the name**: packages `@mayfly/*`, the `mayfly` crate,
  bundle identifier `de.phillippbertram.mayfly`, the `mayfly://event` channel,
  the `mayfly_unlock` cookie, `MAYFLY_*` build and repository variables, the
  `mayfly-release.json` manifest, and GitHub and Pages paths under `mayfly`.

## Consequences

- The bundle identifier determines the app config directory. Changing it later
  would leave saved settings and link profiles behind, so it stays fixed.
- Screenshots and the live demo must show the current brand; recapture them when
  the mark, colors, or wordmark change.
