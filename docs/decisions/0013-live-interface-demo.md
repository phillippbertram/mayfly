# ADR 0013: Live interface demo on the product website

- Status: Accepted
- Date: 2026-11-03
- Amends: [ADR 0003](0003-static-product-website.md)

## Context

The product page showed still screenshots and a screenshot crossfade. The owner
asked for animated product screens. The desktop frontend already runs without
Tauri as a browser preview on the sample-data simulator (`pnpm dev:web`).
Recorded videos or GIFs would drift from the interface, weigh more, and need
re-recording for every UI change.

## Decision

- **The real interface, scripted.** `apps/desktop/demo.html` and `src/demo/`
  render the unchanged `App` on the preview simulator in a deterministic
  `scripted` mode: dark theme, online at once, no random downloads, and downloads
  only when a scene asks for one. A director moves a drawn cursor to elements
  found by their accessible name and clicks them. Scenes live in
  `src/demo/scenes.ts`.
- **Separate build.** `pnpm --filter @filehop/desktop build:demo` (`vite build
  --mode demo`) builds only the demo, with relative asset paths. The desktop
  bundle never contains it. The website's `dev` and `build` scripts build it and
  copy it to `apps/website/public/demo/` (ignored by Git).
- **Embedding.** `LiveScreen` loads the demo lazily in an inert, `aria-hidden`
  iframe at 1200 × 800, scaled to fit, over the existing screenshot. The
  screenshot stays the content without JavaScript, before the demo is ready, and
  for reduced motion. The page and the demo exchange same-origin `postMessage`
  events: `ready`/`done` from the demo and scene changes from the page, so the
  product tour advances when a scene ends.
- **Honest labelling.** Captions say it is the actual interface running in the
  browser with sample data and that no files are transferred. The app's own
  "Browser preview · sample data" badge stays visible.

## Consequences

Interface changes appear on the website with the next build. A scene that refers to
a renamed control stops at that step and logs `Demo target not found`, so scenes need
a check whenever their controls change. The page loads about 280 kB (gzip) of demo
code per visitor who scrolls to a live screen. The website workflow now also runs
for changes to the desktop frontend.
