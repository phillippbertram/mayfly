# Product specification

## Goal and current state

FileHop will let a desktop user temporarily share selected files with a browser
on the same trusted local network, particularly Safari on an iPhone. No account,
cloud service, external server, or mobile application is required.

This document defines the intended product. Local sharing is implemented: native
selection and drop, in-memory shares and bundles, the LAN listener, landing pages,
streamed downloads, and ZIP downloads. Persistence, custom link profiles, QR PNG
export, and the tray remain planned. GitHub Issues track delivery.

## MVP scope

| Area        | Required behavior                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files       | Native multi-file picker and drag and drop; several files share one link (bundle) by default, or get one link each                                              |
| Shares      | Unique ID, filename, byte size, internal path, random token, URL, timestamps, status, download count                                                            |
| HTTP        | Embedded LAN server; configurable port, default 8765; mobile page and streamed attachment download                                                              |
| QR          | Per-share QR; copy image, save PNG, copy URL; update when the selected network address changes                                                                  |
| Lifetime    | Per share: 5, 10 (default), 30, 60, or custom minutes, or until revoked; optional positive download limit; active shares can be extended and their limit raised |
| Desktop     | Dashboard, empty state, share details, settings, light/dark themes, accessible keyboard actions                                                                 |
| Tray        | Open and Quit actions; closing the window keeps sharing active                                                                                                  |
| Profiles    | Create, edit, delete, select, and set a default link profile                                                                                                    |
| Persistence | Local settings and profiles; no persisted active shares, file contents, or access tokens                                                                        |
| Targets     | macOS Apple Silicon and Intel, Windows, Linux                                                                                                                   |

The internal share status is active, expired, or disabled. Reaching a download limit
must make a share unavailable and expose a clear reason to both desktop and browser
users. An unlimited lifetime is represented explicitly rather than as a distant date.

## Desktop interface

- Header: FileHop name, server status, selected local address, and settings.
- Drop zone: clear drag feedback and a native file-picker button.
- Share list: name/type, size, remaining lifetime, download count, and copy/QR/revoke actions.
- Share detail: large QR, selected profile, generated URL, expiration, copy and PNG actions.
- Settings: port, local interface/address, default lifetime, optional download limit,
  theme, and profile management.

Use calm typography, rounded components, generous spacing, native desktop behavior,
and restrained motion. Never show an online state when binding the server failed.

## Mobile experience

`GET /s/{token}` opens a responsive, self-contained landing page that works on a
phone or on another computer. For one file it shows the escaped filename, size,
type, remaining time, and a download button; `GET /d/{token}` streams the file
with appropriate media type and attachment headers. For a bundle it lists every
file with its own download (`GET /d/{token}/{file}`, where `{file}` is a stable
random file ID) and offers "Download all" as a ZIP (`GET /z/{token}`), streamed
without compression or temporary files. The page must not depend on CDNs,
third-party scripts, external fonts, or an account.

A link can also be kept open as a **collection**: the user adds and removes files
while it is active, and the link, QR code, and file IDs of remaining files stay the
same. Everyone with the link sees the current files after reloading the page; a
removed file's link reports that it was removed, and its running downloads stop.
An empty collection shows "No files yet". A collection's direct-download link is
always its ZIP, so it doesn't change as files come and go.

Expired, disabled, exhausted, invalid, and unavailable-file requests receive
understandable pages and suitable HTTP status codes without revealing local paths.
Download counting is defined in [security.md](security.md#tokens-lifetime-and-limits)
and [ADR 0005](decisions/0005-share-bundles-and-landing-page.md). In-browser file
previews are not part of the MVP.

## Link profiles

Two built-in profiles always remain available: **Download page** (`http`) links to
the landing page, `/s/{token}`; **Direct download** (`download`) links to the file
itself, `/d/{token}`, or for a bundle to its ZIP, `/z/{token}`, so the browser
starts the download without showing a page. Because chat apps fetch links to build
previews, a direct link with a download limit warns that a preview can use up a
download; the landing page never counts. A custom profile consists of an ID, name,
and URL template. Settings record an optional default profile ID; deleting the
default falls back to the download page. Selectors stay hidden while only one
profile exists.

| Placeholder         | Replacement                                         |
| ------------------- | --------------------------------------------------- |
| `{url}`             | Full mobile download-page URL                       |
| `{encodedUrl}`      | UTF-8 percent-encoded URL as one URI component      |
| `{filename}`        | Original filename                                   |
| `{encodedFilename}` | UTF-8 percent-encoded filename as one URI component |
| `{token}`           | Share access token                                  |

Example: `myapp://import?url={encodedUrl}&name={encodedFilename}`.

Substitute known placeholders in one pass without recursively interpreting inserted
values. Reject unknown or malformed placeholders, missing schemes, control
characters, and executable schemes such as `javascript:` or `data:`. Support HTTP(S)
and custom application schemes; treat templates as data, never as executable code.
Prefer encoded placeholders in query parameters. Show validation errors rather
than generating misleading QR codes.

The user can switch between HTTP and a custom profile in share details. The copied
link, displayed link, exported PNG, and QR must all match the selected profile and
network address. A compatible installed application is required for custom schemes;
FileHop neither installs apps nor registers deep links itself.

## Optional second step

An authenticated management API may provide `POST /api/shares`, `GET /api/shares`,
`GET /api/shares/{id}`, and `DELETE /api/shares/{id}`. This requires a separate
listener bound only to `127.0.0.1`; it must never appear on the LAN listener. Deliver
the Tauri IPC end-to-end workflow before starting this optional work.

## Outside the MVP

Cloud relays, public hosting of shared user files, accounts, directory sharing, uploads, mobile
apps, automatic external-app installation, and Universal Links infrastructure are
outside the MVP. HTTPS on a public domain is not required.

## Public release and website

The first public release adds versioned installers for Windows, macOS Apple Silicon
and Intel, and Linux, together with checksums, release notes, and verified installation
guidance. Platform signing/notarization and distribution licensing are explicit
release-readiness decisions tracked in GitHub Issues.

A separate English GitHub Pages website will explain FileHop with polished product
content, real screenshots, a short getting-started guide, platform download links,
and installation/network troubleshooting. It must reflect actual release availability
and provide downloads accessible through the approved public distribution arrangement.
The website and release hosting do not participate in transfers of shared user files.
See the [roadmap](roadmap.md#first-public-release-and-website) for the delivery issues.

## End-to-end acceptance

1. Launch the desktop app and observe a successful local server start.
2. Drop a real PDF or image and see its share in the dashboard.
3. Open its QR code and scan it with an iPhone on the same reachable Wi-Fi network.
4. Open the mobile page in Safari and download a file matching the original contents.
5. Select a custom-scheme profile and verify its generated link and QR.
6. Verify that expiry, manual revocation, and the download limit prevent new downloads.
7. Close the main window and confirm sharing continues through the tray.
8. Explicitly quit and confirm shares are invalidated and listeners are stopped.
9. Restart and confirm previous share URLs do not work.

Record OS, architecture, phone/browser, actual checks, and any unsupported behavior
in the relevant issue. Do not substitute a web-only preview for desktop acceptance.
