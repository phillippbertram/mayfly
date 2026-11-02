# ADR 0005: Share bundles, landing page, and download counting

- Status: Accepted; grouping and the `/d/{token}` route superseded by [ADR 0008](0008-file-drop.md)
- Date: 2026-11-02

## Context

The core sharing issue (#2) and the desktop wiring (#3) needed concrete answers
the specification left open: how several selected files are shared, what the
recipient's browser shows, when a download counts, and how a selected file stays
the file that was authorized. Opening a link on another laptop should show a
polished page with download options, not only a phone-sized button.

## Decision

- **Bundles.** A share holds one or more files behind one token. When several
  files are selected, the composer offers "One link for all" (default) or
  separate links. A bundle summarizes itself in the share DTO (`fileName` is
  "N files", `kind` is `bundle`) and lists its files in `files`.
- **One listener.** The landing page is served by the same LAN listener as
  downloads; there is no second web server. Public routes, all GET/HEAD only:
  `/s/{token}` (page), `/d/{token}` (single-file share), `/d/{token}/{index}`
  (file in a bundle), `/z/{token}` (bundle as ZIP). Indexes are plain decimals,
  never paths.
- **Landing page.** Self-contained HTML rendered in Rust: inline CSS allowed by
  a SHA-256 CSP hash, inline SVG, no scripts, no external requests, light and dark
  themes, and a layout that works from phone to laptop width. It shows metadata
  only; inline previews would need their own counting and active-content review.
- **Streamed ZIP.** "Download all" streams an uncompressed (stored) ZIP built on
  the fly from the pinned files. CRCs go into data descriptors, ZIP64 records
  appear only when needed, and the exact length is computed up front so browsers
  show progress. Nothing is written to disk.
- **Counting.** Pages and HEAD never count. A GET reserves capacity atomically
  before the response starts and releases it only if the file can't be served at
  all; once streaming starts, the download counts even if the client aborts.
  Range headers are ignored and every GET receives the full file. In a bundle the
  limit applies per file; a ZIP takes one download from every file, all or
  nothing, and is offered only while every file has capacity left.
- **Lifecycle.** Expiry blocks new requests immediately and lets running
  transfers finish. Stopping a share, removing it, or quitting cancels its
  running transfers within one chunk.
- **File identity.** A selected path is resolved once; FileHop keeps the opened
  handle and serves positional reads from it, so replacing or re-linking the path
  can't redirect a share. A size change makes the file unavailable (503).
- **Native input only.** The picker runs from Rust. Dropped paths are accepted
  only if the native window drop event delivered them, so the webview can't name
  arbitrary files. No dialog or filesystem permission is granted to the webview.
- **Listener address.** The listener binds `0.0.0.0` on the configured port so
  any advertised interface works; links use the selected or best private IPv4
  address. Settings stay in memory until the settings service (#5) persists them.

## Consequences

Recipients can fetch a whole set with one link, from any browser, without the
desktop app buffering or copying files. Bundle limits are easy to explain but a
recipient who downloads files one by one and then the ZIP uses capacity twice.
Resumable downloads aren't supported; a resumed transfer is a new download. The
wildcard bind also answers on other interfaces such as VPNs; tokens still guard
every route. Custom link profiles, QR PNG export, persistence, and the tray remain
separate issues.
