# ADR 0010: Link profiles as global app templates

- Status: Accepted
- Date: 2026-11-02

## Context

Issue #6 asks for persistent link profiles: named URL templates such as
`myapp://import?url={encodedUrl}` whose resolved link can be copied and shown as a
QR code. The issue predates [ADR 0008](0008-file-drop.md), which removed the
per-share link profile: every share has its page, ZIP, and file links, and those
never change meaning.

## Decision

- **Profiles are global templates.** A profile is an ID, a name (up to 40
  characters), and a template (up to 2,000 characters). Up to 20 profiles are
  stored next to the settings in `settings.json`. Shares carry no profile.
- **Rust owns templates.** `profiles.rs` validates templates (scheme required;
  `javascript`, `data`, `vbscript`, `file`, `blob`, and `about` refused; no control
  characters; only known placeholders with matched braces) and resolves them in a
  single pass, so inserted values are copied literally. Encoded placeholders use
  the `encodeURIComponent` character set. The frontend asks Rust for a live
  preview while editing and never resolves templates itself in the desktop app.
- **App links on the share DTO.** Each active share lists `appLinks`: one resolved
  link per profile, with whether it uses a custom scheme. `{url}` is the share
  page URL and `{filename}` the share's display name (title, file name, or
  "N files"). Links follow address and port changes like the share's own links.
- **The default profile is the QR default.** Settings keep `defaultProfileId`
  (`http` for the share page). The inspector's "QR opens" select starts there and
  can switch per share for the current view; the QR code, link field, copy action,
  copied QR image, and PNG export all use what is shown. The row menu adds "Copy
  link for …" per profile. Deleting the default falls back to the share page.
- **Loading is forgiving.** Invalid stored profiles are left out, duplicates are
  dropped, and a missing default falls back to `http`. When anything was repaired,
  the original file is kept as `settings.repaired-<time>.json` and the window
  shows a one-time notice.

## Consequences

- Shares stay simple: their links never depend on a template, and switching the QR
  source changes no server state.
- FileHop only builds and copies links. It never opens a resolved link, installs
  an app, or registers a scheme; a custom-scheme QR code needs a compatible app on
  the scanning device, which the inspector says.
- Opening custom-scheme links on real devices is not verified by the test suite.
