# Security model

## Status and trust boundary

These are implementation requirements, not verified guarantees of a finished app.
The share registry and LAN listener are implemented and covered by unit and real
HTTP tests (see `apps/desktop/src-tauri/src/server/tests.rs`); the hardening audit
(#7) and platform checks are still outstanding.

FileHop is intended for trusted local networks. Plain HTTP exposes transferred
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
| Bundle file `GET /d/{token}/{index}` | One download of that file; limits apply per file                                 |
| Bundle ZIP `GET /z/{token}`          | One download of every file, reserved all-or-nothing; refused if any is exhausted |

Link previews in chat apps and security scanners fetch URLs before a person does.
A landing-page link is safe to preview; a direct-download link (`/d`, `/z`) is a
GET download and counts. The interface warns about this when a direct link has a
download limit.

Expiry blocks new requests and lets running transfers finish. Stopping, removing,
or quitting cancels running transfers within one 64 KiB chunk, so the client sees
an incomplete transfer rather than a short success.

## Public HTTP listener

- Expose only landing pages and their download endpoints: `/s/{token}`,
  `/d/{token}`, `/d/{token}/{index}`, and `/z/{token}`, GET and HEAD only. No
  management routes, arbitrary static-file routes, directory listing, or uploads.
  Bundle indexes are plain decimals resolved against the in-memory share.
- Active content types (HTML, JavaScript, XML, SVG) are served as
  `application/octet-stream`; downloads also carry `Content-Security-Policy: sandbox`.
  Pages allow only their own inline stylesheet by SHA-256 hash and no scripts.
- Set a correct MIME type and safe `Content-Disposition`, including non-ASCII
  filename support. Strip/reject CR, LF, path separators, and control characters
  from header fallback values; escape filenames in HTML.
- Use `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, and a restrictive page CSP.
- Download active content as an attachment. Avoid externally fetched page assets.
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
- Treat profile templates as data. Resolve placeholders once, percent-encode URI
  components correctly, reject malformed/unknown placeholders and executable schemes,
  and never inject resulting links or filenames as raw HTML.
- Generate and copy custom links; never execute a scheme automatically on profile changes.
- Store only settings and profiles in the user config directory. Use validated,
  reliable writes and sanitized errors. Do not commit credentials or signing keys.
- Explicit quit revokes all shares and stops listeners. Window close only hides
  the app, with understandable tray behavior.

## Required security verification

Core tests must cover random token shape/uniqueness, share creation/revocation,
expiry boundaries, concurrent download limits, and malformed/missing tokens.
Exercise real HTTP handlers for content and headers, Unicode and hostile filenames,
traversal attempts, unauthorized files, missing/replaced files, HEAD and ranges,
sanitized errors, and failed binds. Verify large-file transfers without whole-file buffering.

Profile tests cover every placeholder, Unicode, percent signs, inserted braces,
single-pass substitution, unknown placeholders, and disallowed schemes.

If the management API is delivered, test actual bound addresses, authentication,
Host allowlisting, forged forwarded headers, Origin/fetch metadata rejection, request
limits, and absence of management routes on the LAN listener.

Use real desktop, OS, and phone checks for firewall, tray, clipboard image, PNG
export, server shutdown, and Safari behavior. Automated HTTP tests cannot verify
those integrations on their own.
