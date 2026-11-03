# ADR 0011: Optional share passwords and the unlock protocol

- Status: Accepted
- Date: 2026-11-02

## Context

Issue #20 asks for an optional password per share, so a forwarded or overheard
link alone isn't enough. Everything else about a share stays as before
([ADR 0005](0005-share-bundles-and-landing-page.md),
[ADR 0008](0008-file-drop.md)): memory-only, token-addressed, plain HTTP on a
trusted network.

## Decision

- **Verifier, not password.** Rust hashes the password with Argon2id (OWASP
  baseline: 19 MiB, 2 passes, 1 lane, 16-byte random salt, 32-byte output) off the
  async runtime, then drops the plaintext. Only the verifier stays in memory with
  the share; nothing about passwords is persisted, logged, or returned in DTOs,
  which carry only `protected: bool`. Passwords are 1–128 characters without
  control characters, used as typed. One batch from the composer shares one
  verifier, so "separate links" share one password.
- **Before the first request.** The composer sends the password with
  `create_shares`; the share is created already protected. Drops that skip the
  composer create unprotected shares, which can be protected later in the
  inspector (`set_share_password`), with the gap that implies. Generated passwords
  (`generate_password`) are three groups of four characters from a 31-character
  alphabet without look-alikes, about 59 bits.
- **Unlock protocol.** `GET /s/{token}` of a protected share shows a password
  form and nothing else: no title, names, sizes, or file IDs. The form posts
  `password=…` (urlencoded, at most 2 KiB) to `POST /s/{token}`. Posts from other
  sites are refused by Fetch Metadata (`Sec-Fetch-Site` must be `same-origin` or
  `none`) and `Origin` (absent, `null`, or this host); pages send no referrer, so
  browsers report `Origin: null`. A correct password answers `303` to the page and
  sets a random 256-bit credential as `mayfly_unlock` three times, with
  `Path=/s/{token}`, `/d/{token}`, and `/z/{token}`, `HttpOnly`,
  `SameSite=Strict`, and `Max-Age` up to one hour or the share's remaining
  lifetime. No `Secure` flag: the listener is plain HTTP. The registry keeps the
  SHA-256 of each credential with its end, at most 32 per share.
- **Every request.** Page, HEAD, and GET of files and ZIPs check availability
  first, then the credential. Without it, downloads answer `403` with a link to
  the form; a valid token alone never reveals or serves anything. Ranges stay
  ignored. Wrong passwords, form views, and unlocks never count as downloads;
  reservations remain atomic after unlocking.
- **Throttling and resources.** Attempts are budgeted per share, not per address:
  a burst of 5, then one every 12 seconds (`429` with `Retry-After`). The budget
  refills on its own, so a recipient waits at most a minute after an attacker
  stops; an owner can also share again under a new token. At most two Argon2
  checks run at once across all shares (`503` with `Retry-After` beyond that).
- **Invalidation.** Changing or removing a password, stopping, expiry, and quitting
  end every unlock; running downloads follow the existing in-flight rules. Share
  again keeps the verifier but starts with no unlocked browsers.

## Consequences

- A link holder can still try about 300 passwords an hour per share, so short
  chosen passwords protect less than generated ones. The UI offers generation.
- Plain HTTP exposes the password, the cookie, and the files to anyone who can
  observe the network. Protection limits who can use a leaked link; it is not
  encryption and doesn't make public exposure supported.
- Clients that can't run the browser form, such as an app opened through a
  custom-scheme link profile with a direct file URL, can't download protected
  files. Profiles get no password placeholder.
- Real-device behavior (Safari on iPhone completing the form) is not covered by
  the automated tests.
