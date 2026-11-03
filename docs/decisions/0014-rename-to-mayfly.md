# ADR 0014: Rename FileHop to Mayfly

- Status: Accepted
- Date: 2026-11-03
- Related issues: #12

## Context

The project started as "FileHop". Another, actively developed desktop file app
already uses that exact name, in the same category, so the name could not carry
a public release, store listings, or search. No release has been published yet:
`v0.8.0` exists only as a draft, so a rename costs no user migration.

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
  Earlier ADRs were updated to the new names instead of keeping stale identifiers.

## Consequences

- The new bundle identifier means a new app config directory. Settings and link
  profiles saved by FileHop development builds are not migrated; developers can
  copy the old `de.phillippbertram.filehop` directory by hand.
- The GitHub repository, its `MAYFLY_PAGES_ENABLED` and `MAYFLY_RELEASE_REPOSITORY`
  variables, issue and milestone titles, and the draft release must be renamed or
  recreated on GitHub. Until the repository is renamed, links to
  `phillippbertram/mayfly` and the `/mayfly` Pages path do not resolve.
- Screenshots and the live demo must be recaptured whenever they still show the
  old name.
