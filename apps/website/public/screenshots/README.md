# Screenshot provenance

These JPEG images were captured from the actual FileHop interface on 2026-11-02.
They are not generated product mockups or screenshots of a successful transfer.

- `dashboard.jpg`: current browser-preview dashboard and QR inspector.
- `settings.jpg`: current browser-preview General settings dialog.
- `profiles.jpg`: current browser-preview Link profiles dialog.

The browser preview uses sample filenames, metadata, tokens, and network addresses.
It creates no real share and serves no file. Every website use retains an explicit
interface-preview caption. The example QR codes do not grant access to real files.
The screenshots were taken through the browser screenshot API without compositing
or editing app content. Native-window chrome is represented separately by the website.

To refresh: run `pnpm dev:web`, use an isolated browser tab, wait for the initial
preview state, open the relevant panel, and capture the viewport as JPEG. Confirm
the visible sample-data label and avoid capturing real credentials or private files.
Do not replace these with screenshots of a real active share without removing its
access-bearing URL and QR code.

The site's animated transfer story is a code-native Motion illustration of the
planned workflow, with pause/replay, manual step selection, and reduced-motion
support. It is not a recording of a working file transfer.
