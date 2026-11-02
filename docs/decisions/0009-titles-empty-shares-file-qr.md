# ADR 0009: Share titles, empty shares, and per-file QR codes

- Status: Accepted
- Date: 2026-11-02

## Context

Phase 2 of the [file drop concept](../concepts/file-drop.md) builds on
[ADR 0008](0008-file-drop.md). Shares that change over time need a name that
doesn't depend on their first file, preparing a link before choosing files should
be possible, and a single file sometimes needs its own scannable code.

## Decision

- **Titles.** A share has an optional title. It is set through the share patch
  (`title`; `null` or blank clears it), trimmed, limited to 80 characters, and
  refused with control characters. Validation happens before any other patch field
  is applied. The DTO's `fileName` is the title when set, otherwise derived from
  the files; `title` tells the UI which. The share page uses the title as heading
  and document title, escaped, and keeps the file name or count visible below it.
  "Share again" keeps the title.
- **Empty shares.** `create_empty_share` creates an active share without files using
  the default lifetime and limit. It behaves like any share that lost its files:
  the page says "No files yet" with a Refresh link and the ZIP answers 404 until
  files are added. The UI offers it in the empty state, the palette, and Cmd/Ctrl+N.
- **Per-file QR codes.** No new route. The inspector's QR card can show a file's
  direct link instead of the share page, toggled per file; copying the QR image
  copies the code that is shown. The list and PNG export keep the share page.

## Consequences

Titles are visible to recipients and are display data, never credentials. An empty
share is a live link to nothing yet, so it follows the default lifetime like any
other share. A file's QR code is a direct download and, like copied file links, is
consumed by link previews and scanners when a download limit is set.
