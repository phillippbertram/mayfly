# ADR 0016: Bundle a reviewed dependency notice snapshot

- Status: Accepted
- Date: 2026-11-03
- Related issues: #13, #14, #15, #17

## Context

Apache-2.0 covers Mayfly's own code. The desktop packages and the static website
also distribute third-party code and a self-hosted OFL font. Their original
copyright and license notices must accompany the delivered files. Generating only
on one native target would omit dependencies used by the other platform builds.

## Decision

Collect installed npm production dependencies and all locked Cargo dependencies
into a checked-in component inventory and combined notice document. Include the
desktop demo's dependencies in the website's scope. Preserve nested package
notices and record explicit upstream overrides for missing texts. Exclude native
npm build tools whose executables are not distributed in either static frontend.

Builds verify the snapshot's inputs and checksum offline and fail on drift. Tauri
resources and the website export carry the same readable text files; releases
also attach those files and the installation guide with checksums. Snapshot
generation uses existing pnpm/Cargo metadata and Node's standard library.

## Consequences

Dependency changes include reviewable license changes, while normal builds need
no new tool installation or network license lookup. The combined notices include
some build/test and other-platform components deliberately. Native packagers can
add OS libraries and installer runtimes outside these graphs; their licensing and
source obligations still require inspection of the actual bundle before public
distribution. See [the licensing process](../licensing.md).
