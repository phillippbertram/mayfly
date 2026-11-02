# ADR 0006: Direct download links

- Status: Accepted
- Date: 2026-11-02

## Context

Some recipients should get the file right away instead of a landing page, for
example when the link is opened on another computer. The download routes from
[ADR 0005](0005-share-bundles-and-landing-page.md) already exist; the app only
handed out landing-page links. Custom link profiles (#6) are templates for app
deep links and have no placeholder for a download URL.

## Decision

- Add a second built-in profile, **Direct download** (`download`), next to the
  landing page (**Download page**, `http`). Rust resolves its link to
  `/d/{token}` for one file and `/z/{token}` for a bundle; QR codes and copied
  links follow the selected profile like any other.
- Keep the landing page as the default. Chat apps and scanners fetch links to
  build previews; for a direct link that fetch is a counted GET download. The
  composer and inspector warn when a direct link has a download limit.
- Built-in profiles have no template, can't be edited or deleted, and either can
  be the default. Profile selectors appear only when there is a choice.

## Consequences

Direct links work without new routes or server behavior. A limited direct link
may be consumed by a preview before the recipient opens it; the warning makes
that visible but can't prevent it.
