# Security model

## Status and trust boundary

These are implementation requirements, not verified guarantees of a finished app.
The share registry and LAN listener are implemented and covered by unit and real
HTTP tests (see `apps/desktop/src-tauri/src/server/tests.rs`); the hardening audit
(#7) and platform checks are still outstanding.

Mayfly is intended for trusted local networks. Plain HTTP exposes transferred
contents and bearer tokens to observers on the network. A share URL authorizes
access until revocation, expiration, process exit, or download-limit exhaustion.
No port forwarding or public internet exposure is part of the product.

Trust the native desktop selection and explicitly authorized local API clients.
Treat filenames, URL templates, network traffic, web content, and HTTP headers as
untrusted. A malicious website running in a local browser must not create shares.

## File access

- Share only explicitly selected readable regular files. Reject directories,
  devices, pipes, sockets, and invalid inputs.
- Canonicalize and validate at creation; never concatenate HTTP request segments
  with filesystem paths. Tokens resolve through the in-memory registry only.
- Define a symlink policy and defend against replacement between validation and
  opening. Prefer a handle to the validated file or equivalent identity checking
  rather than following a newly substituted path to another file.
  Implemented policy: a selected path (including a symlink) is resolved once at
  selection, opened without blocking, and re-checked through the opened handle.
  Every download uses positional reads on that pinned handle; replacing or
  re-linking the path afterwards has no effect. A size change makes the file
  unavailable instead of serving content that doesn't match its advertised length.
- Accept only paths from the native picker (opened by Rust) or from the native
  window drop event. The webview can't submit arbitrary paths for sharing.
- Saving a QR code PNG is the only write the webview can trigger: it sends the
  image bytes and a suggested name; Rust checks the PNG signature and a 4 MiB
  limit, reduces the name to a plain `.png` file name, and writes only where the
  user chose in the native save dialog.
- Handle deleted, changed, or unreadable files without panics or path disclosure.
- Stream from the authorized source with bounded memory; do not duplicate file
  contents in a database, temporary upload directory, or webview memory.
- Never serialize absolute local paths into public pages, share DTOs, or error messages.

## Tokens, lifetime, and limits

- Generate tokens with an OS-backed cryptographic RNG and at least 256 bits of
  entropy, encoded in a URL-safe form. IDs and filenames are not credentials.
- Keep tokens and shares in memory only. Restarting invalidates all earlier URLs.
- Reject malformed tokens early. Enforce expiration and disabled state on page,
  GET, HEAD, and any supported range requests.
- Reserve download capacity atomically before starting a stream. Concurrent
  requests must never exceed the configured limit.
- Specify when a download counts, how failed opens/streams affect reservations,
  and how HEAD, retries, and ranges behave. An HTTP response is not proof that a
  browser saved the complete file. Keep the counter's meaning explicit in the UI.
- Reject unsupported range behavior rather than allowing requests to bypass limits.
- Expiry and revocation block new requests immediately; specify in-flight behavior.

Implemented counting semantics ([ADR 0005](decisions/0005-share-bundles-and-landing-page.md)):

| Request                              | Counts?                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Landing page `GET /s/{token}`        | Never                                                                            |
| `HEAD` on any download route         | Never; same availability checks and headers as GET                               |
| `GET` download, file can't be served | Reservation released; 503 "File unavailable"                                     |
| `GET` download, streaming started    | Counts, even if the client aborts or the network drops                           |
| `GET` with a `Range` header          | Range ignored (`Accept-Ranges: none`); full 200 response, counts once            |
| Retry or resumed download            | A new download                                                                   |
| File `GET /d/{token}/{file}`         | One download of that file; limits apply per file                                 |
| ZIP `GET /z/{token}`                 | One download of every file, reserved all-or-nothing; refused if any is exhausted |

Link previews in chat apps and security scanners fetch URLs before a person does.
A share page link is safe to preview; a file or ZIP link (`/d`, `/z`) is a GET
download and counts. The QR code always encodes the page, and copying a file or
ZIP link of a share with a download limit shows a warning.

Expiry blocks new requests and lets running transfers finish. Stopping, removing,
or quitting cancels running transfers within one 64 KiB chunk, so the client sees
an incomplete transfer rather than a short success. Removing a file from a share
cancels its own transfers and any ZIP download that includes it.

Share titles are shown to everyone who opens the link, escaped like file names;
they are trimmed, limited to 80 characters, and refuse control characters. They
are not a place for secrets.

A share's token authorizes whatever files the share holds at request time,
including files added after the link was sent. Every file link contains the token,
so whoever has one file's link can also open the share page and see all its files:
a share is one audience. The share details and the add-files hint say so, and the
share options offer one link per file for separate audiences. Files can only be
added while the share is active; an expired, stopped, or exhausted share never
reopens by adding files.

## Share passwords

Optional per share ([ADR 0011](decisions/0011-share-passwords.md)):

- Rust hashes passwords with Argon2id (19 MiB, 2 passes, 1 lane, random 16-byte
  salt) and keeps only the verifier in memory. Passwords, verifiers, and unlock
  credentials are never persisted, logged, put in URLs or QR codes, returned in
  DTOs, or offered to link profiles. Plaintext is wiped when dropped.
- A protected share's page shows only a password form. Every page, HEAD, GET,
  range, and retry request needs the share's unlock cookie: a random 256-bit
  credential scoped by path to that share's `/s`, `/d`, and `/z` routes,
  `HttpOnly`, `SameSite=Strict`, valid for at most one hour or the remaining
  lifetime. The registry stores only its SHA-256, at most 32 per share.
- The form accepts urlencoded bodies up to 2 KiB and passwords up to 128
  characters, and refuses posts whose Fetch Metadata or `Origin` show another site.
- Attempts are throttled per share (5, then one per 12 seconds; `429` with
  `Retry-After`); at most two Argon2 checks run at once (`503` beyond that). Failed
  attempts, form views, and unlocks never count as downloads.
- Changing or removing the password, stopping, expiry, and quitting end all
  unlocks. Plain HTTP exposes passwords, cookies, and files to network observers;
  a password limits who can use a link, it doesn't encrypt anything.

## Public HTTP listener

- Expose only share pages, the password form, and download endpoints:
  `/s/{token}` (GET, HEAD, and POST for the password), `/d/{token}/{file}`, and
  `/z/{token}` (GET and HEAD). No
  management routes, arbitrary static-file routes, directory listing, or uploads.
  File IDs are random 16-character base64url values, checked for shape and then
  resolved against the in-memory share; IDs of removed files are never reused.
- Active content types (HTML, JavaScript, XML, SVG) are served as
  `application/octet-stream`; downloads also carry `Content-Security-Policy: sandbox`.
  Pages allow only their own inline stylesheet by SHA-256 hash and no scripts.
- Set a correct MIME type and safe `Content-Disposition`, including non-ASCII
  filename support. Strip/reject CR, LF, path separators, and control characters
  from header fallback values; escape filenames in HTML.
- Use `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, and a restrictive page CSP.
- Download active content as an attachment. Avoid externally fetched page assets.
  The page footer's only outbound link is the fixed Mayfly website URL, with
  `rel="noopener noreferrer"` on top of the no-referrer policy, so the token never
  leaves the LAN through it.
- Limit request sizes, constrain methods, and return appropriate sanitized errors
  for invalid, unavailable, expired, revoked, or exhausted shares.
- Do not log tokens, URL paths containing tokens, private filenames, or absolute
  paths. Review tracing and framework request logging defaults explicitly.
- Account for port conflicts, firewall restrictions, guest Wi-Fi isolation, and
  disconnected interfaces. Do not silently report the server as running after failure.

## Optional management API

Implement only after the Tauri workflow works. This API is a distinct listener,
bound to `127.0.0.1` on a separately configured port.

- Require a high-entropy authentication secret on every endpoint, with a secure
  local handoff mechanism and no credentials in query strings or URLs.
- Validate the actual Host authority against the exact configured numeric
  loopback address and port. Reject arbitrary domains, forwarded-host overrides,
  and DNS-rebinding names, even when they resolve to loopback.
- Reject `Origin` headers and browser fetch-metadata requests; expose no permissive
  CORS behavior. CORS alone is not authentication or CSRF protection.
- Require JSON content type for writes, reject simple browser form submissions,
  bound request bodies, and authenticate before reading paths or returning metadata.
- Keep both successful and failed management requests off the public router.
- Validate file inputs with the same service used by Tauri. Do not expose local
  paths or credentials in listing/detail DTOs.

## Desktop, configuration, and profiles

- Configure a restrictive Tauri CSP and minimal capabilities. No arbitrary shell
  execution, broadly scoped filesystem commands, or remote web content in the app.
- The About dialog opens Mayfly's own web pages through `open_link`, which accepts
  only a link name; the fixed URLs live in Rust (`menu.rs`). The opener plugin is
  used from Rust only and grants the frontend no permission.
- Treat profile templates as data. Resolve placeholders once, percent-encode URI
  components correctly, reject malformed/unknown placeholders and executable schemes,
  and never inject resulting links or filenames as raw HTML. Validation and
  resolution live in Rust (`profiles.rs`); the UI only displays resolved links.
- Generate and copy custom links; never execute a scheme automatically on profile changes.
- Store only settings and profiles in the user config directory. Use validated,
  reliable writes and sanitized errors. Do not commit credentials or signing keys.
- Explicit quit revokes all shares and stops listeners: after confirmation,
  shutdown marks every share stopped so new page and download requests get 410,
  cancels running transfers within one chunk, stops the listener with a two-second
  grace period, and exits. Shares and tokens never reach disk, so a restart starts
  with none. Window close only hides
  the app, with understandable tray behavior.

## Required security verification

Core tests must cover random token shape/uniqueness, share creation/revocation,
expiry boundaries, concurrent download limits, and malformed/missing tokens.
Exercise real HTTP handlers for content and headers, Unicode and hostile filenames,
traversal attempts, unauthorized files, missing/replaced files, HEAD and ranges,
sanitized errors, and failed binds. Verify large-file transfers without whole-file buffering.

Profile tests cover every placeholder, Unicode, percent signs, inserted braces,
single-pass substitution, unknown placeholders, and disallowed schemes.

Password tests cover correct, wrong, and missing passwords over real HTTP; direct
file, ZIP, HEAD, and range requests without unlocking; cookies of other shares and
forged cookies; throttling and refill; cross-site and oversized posts; password
changes, revocation, and expiry; counters after failed attempts and unlocks; and
download limits under concurrent unlocked requests.

If the management API is delivered, test actual bound addresses, authentication,
Host allowlisting, forged forwarded headers, Origin/fetch metadata rejection, request
limits, and absence of management routes on the LAN listener.

Use real desktop, OS, and phone checks for firewall, tray, clipboard image, PNG
export, server shutdown, and Safari behavior. Automated HTTP tests cannot verify
those integrations on their own.
