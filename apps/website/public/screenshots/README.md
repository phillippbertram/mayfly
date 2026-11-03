# Screenshot provenance

These JPEG images were refreshed from the actual Mayfly browser-preview interface
on 2026-11-03, after the rename from FileHop, at a 1440 × 960 desktop viewport in
dark mode. They are screenshots, not generated
mockups or evidence of a completed transfer.

- `dashboard.jpg`: multiple-file share, QR inspector, and ZIP link action.
- `file-drop.jpg`: a share titled “Weekend away”, with three files and add/remove actions.
- `file-qr.jpg`: the same share with the direct-download QR for `Itinerary.pdf` selected.
- `share-options.jpg`: sharing confirmation with lifetime and download-limit controls.
- `settings.jpg`: General settings, including defaults, close reminder, and hidden codes.
- `profiles.jpg`: the custom profile editor with placeholders and a resolved example.

The simulator uses sample filenames, metadata, tokens, and network addresses. It
creates no real share and serves no files. Website uses retain explicit sample-data
captions. These QR codes do not grant access to real files. Screenshots were captured
through the browser screenshot API without compositing or editing app content.
The website adds decorative window chrome separately.

To refresh: run `pnpm dev:web`, open an isolated browser tab, wait for the initial
preview state and transitions to settle, and capture the relevant panel as JPEG.
Confirm the sample-data label. For the file-drop sequence, open the three-file
sample, rename it to “Weekend away”, then select the QR action for `Itinerary.pdf`.
Never capture real active URLs, QR credentials, or private files.

## Animation

The hero and the product tour play the live interface demo
([ADR 0013](../../../../docs/decisions/0013-live-interface-demo.md)) over these
screenshots. Each tour step plays its scene (`bundle`, `qr`, `share`, `settings`)
and advances when the scene ends; the hero loops `share`. The screenshots remain the
content without JavaScript, before the demo loads, and for reduced motion, where the
tour falls back to crossfading the four unedited screenshots `file-drop`, `file-qr`,
`share-options`, and `settings` without autoplay. This is the actual interface on
sample data, not a transfer recording or a GIF.

The separate transfer story is a code-native illustration of the choose, scan,
and download workflow, with pause/replay, manual selection, and reduced-motion support.
