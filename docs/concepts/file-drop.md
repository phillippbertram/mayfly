# Concept: the file drop

- Status: Phases 1 and 2 implemented, 2026-11-02 ([ADR 0008](../decisions/0008-file-drop.md),
  [ADR 0009](../decisions/0009-titles-empty-shares-file-qr.md))
- Supersedes, once accepted: the grouping and link-profile model in
  [ADR 0005](../decisions/0005-share-bundles-and-landing-page.md),
  [ADR 0006](../decisions/0006-direct-download-links.md), and
  [ADR 0007](../decisions/0007-collections.md)

## Summary

Everything Mayfly shares is a **drop**: one link, any number of files, a
lifetime, and a download limit. One file or twenty, fixed or changing, it is the
same thing. A drop has one page link; every file in it has its own direct link;
the whole drop has a ZIP link. Nothing is chosen up front except how long the
drop lasts and how often files may be downloaded.

This removes three concepts the interface currently asks about: the grouping
(separate, bundle, collection), the link profile (page or direct download), and
the collection type. It also leaves room for drops that receive files later.

## Why

The current composer asks four questions before anything is shared, and two of
them interact: a bundle with a direct link is a ZIP, a collection with a direct
link is always a ZIP, a single file with a direct link is the file. The labels
change with the file count. "Link profile" names something users don't think
about, and the same thing is called Link, Profile, and Link profiles in three
places. Bundles and collections differ only in whether files can change later,
which is a decision nobody wants to make before they need it.

## The drop

A drop is:

| Part           | Meaning                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Token          | 256-bit secret in every link. Memory only; a restart invalidates it.                                                      |
| Files          | 0..n validated regular files, each with a stable random ID. Files stream from their original location; nothing is copied. |
| Lifetime       | 5, 10, 30, 60 minutes, custom, or until stopped. Enforced on every request.                                               |
| Download limit | Per file. New files start at zero and inherit the limit.                                                                  |
| Status         | Active, expired, stopped, or limit reached (every file exhausted).                                                        |

While a drop is active, its owner adds and removes files. Adding is allowed
through the picker, drag and drop onto the drop, or the command palette.
Removing a file cancels its running downloads and any ZIP that contains it; its
file link then answers "File removed". A drop may be empty, which keeps it
active and shows "No files yet" to recipients.

Nothing about a drop depends on how many files it holds. Only the presentation
adapts: one file is shown large with one button, several as a list with a ZIP.

## Links

| Link      | Route               | Opens                                             | Stability                                                          |
| --------- | ------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Drop link | `/s/{token}`        | The page: one file large, several as a list       | Never changes while the drop lives                                 |
| File link | `/d/{token}/{file}` | That file, as a download                          | Valid while the file is in the drop; 410 "File removed" afterwards |
| ZIP link  | `/z/{token}`        | Everything currently in the drop, as a stored ZIP | Always valid; 404 "No files yet" while empty                       |

Rules:

- There is no bare `/d/{token}`. Direct links belong to files, never to the drop,
  so no link changes meaning when the file count changes.
- The QR code always encodes the drop link. Direct links are copied, not scanned;
  a per-file QR is available from the file's menu for the rare case it is needed.
- Copying a file or ZIP link of a drop with a download limit shows a brief note:
  chat apps fetch links for previews, and that fetch is a counted download. The
  drop page is safe to preview and never counts.
- A file link contains the drop's token, so whoever has a file link can also open
  the drop page and see every file in it. A drop is one audience. To give
  different people different files, use separate drops.

Custom app templates (link profiles, #6) no longer belong to a drop. They become
additional copy actions ("Copy link for Documents app") and, optionally, the QR
target in settings. The built-in "Direct download" profile is retired; the
file link replaces it.

## Desktop

### Creating a drop

Dropping or picking files opens the composer when "Ask before sharing" is on.
It asks only how long and how often:

```text
Share 3 files
┌──────────────────────────────────────────────┐
│ ▣ Beach.jpg                          4.2 MB  │
│ ▣ Sunset.jpg                         3.8 MB  │
│ ▣ Itinerary.pdf                      220 KB  │
└──────────────────────────────────────────────┘
Lasts       5 min · 10 min · 30 min · 1 h · Until stopped · Custom
Downloads   No limit · 1 · 3 · 5 · Custom

Until about 9:41 PM · each file up to 3 downloads

☐ Put each file in its own drop                      (only with several files)
[●] Ask before sharing                      Cancel    Share ⌘↩
```

With one file the dialog has two rows. The checkbox replaces today's three-way
segment; it is unchecked by default and creates one drop per file with the same
options, for people who need separate audiences or separate QR codes.

An empty drop can be created without files ("New empty drop" in the command
palette and as a secondary action in the empty state). This is for opening the
link on another device first and filling the drop afterwards.

### The list

Each row is one drop:

```text
▣  Holiday photos                          ⏱ 9:37    0 downloads   ⧉ ▦ …
   3 files · 8.2 MB
▣  Quarterly-report-2026.pdf               ⏱ 7:12    1 of 3
   2.4 MB · PDF document
```

The title is the file name for one file and "N files" otherwise, or the drop's
own title once titles exist (see Open questions). The meta line no longer names a
link type. Dragging files over a row outlines it with "Drop to add to this drop";
dropping anywhere else creates a new drop.

### The inspector

Files, link, and actions in one place:

```text
▣ Holiday photos · 3 files · 8.2 MB                   ✕

Files                                        Add files…
  ▣ Beach.jpg           4.2 MB    ↓0        ⧉   ×
  ▣ Sunset.jpg          3.8 MB    ↓0        ⧉   ×
  ▣ Itinerary.pdf       220 KB    ↓0        ⧉   ×
  Drop files here to add them. Everyone with the link sees them.

              [ QR code of the drop link ]
         Scan with any camera, or open the link

Link   http://192.168.1.24:8765/s/TOKEN                  ⧉
       Copy ZIP link

Expires 9:41 PM  ·  Extend ▾          Downloads 0 of 3 per file  ·  Limit ▾

[ Copy link ]  [▦]                     Stop sharing
```

- ⧉ next to a file copies its file link; its menu also offers "Show QR" and
  "Remove from drop".
- With one file the list is a single row and ⧉ copies the direct link to it.
- The × on the last remaining file becomes "Stop sharing" so a drop isn't emptied
  by accident; an empty drop is only created deliberately.
- Finished drops show the same file list read-only, with "Share again" (a new
  drop with the same files) and "Remove".

### Commands and keyboard

- "Add files to this drop…" (palette; also `A` while a drop is selected).
- "Copy ZIP link", "Copy file link" for the focused file.
- "New empty drop".
- Existing extend, limit, stop, share again, and QR commands stay.

### Settings

- General: default lifetime, default download limit, ask before sharing.
- "Links" replaces "Link profiles": app templates as extra copy actions, and the
  QR target (drop page by default). Nothing here is required for normal use.

## The recipient page

Unchanged in spirit. `/s/{token}` is self-contained HTML without scripts:

- One file: glyph, name, size and type, a 52-point Download button, availability.
- Several files: "N files · total size", "Download all .zip", then one row per
  file with its own download button. Files that reached their limit show "Limit
  reached"; the ZIP button is disabled once any file is exhausted.
- After the owner changed the drop, the page notes "The owner may add or remove
  files" with a Refresh link. Empty drops show "No files yet".
- Error pages: expired, stopped, limit reached, file removed, not found, file
  unavailable, no files yet.

## Lifetime, limits, counting

Nothing changes in the rules from [security.md](../security.md): pages and HEAD
never count, a GET counts once streaming starts, ranges are ignored, the ZIP
reserves one download of every file or none. Limits are per file so that a drop
of ten files with a limit of 1 means "everyone fetches each file once". The
interface says "per file" wherever a limit is shown on a drop with several files.

## Receiving files (later)

A drop is also the natural place to receive files. This is outside the MVP, but
the model is designed so it fits without a second concept:

- A drop has a **direction**: give (today), receive, or both. Receiving is
  enabled per drop in the inspector ("Allow receiving files"), never globally,
  and asks for a target folder (default `~/Downloads/Mayfly/<drop title>`).
- The page gains a "Send files to this computer" section with a plain form; it
  works without JavaScript, and progress display can be added as enhancement. A
  receive-only drop is a letterbox: no files listed, only the form.
- Route `POST /u/{token}`, multipart, streamed to a temporary file and renamed
  into place when complete. Limits per file and per drop, a free-space check,
  sanitized unique names ("name (2).ext"), never overwriting, no executable bit,
  and no path from the client ever used as a path. In-flight uploads are
  cancelled and their temporary files deleted on stop or quit.
- Received files are persisted on disk because that is the point; the drop and
  its token remain memory-only like everything else.
- The inspector shows "Received" below "Files": name, size, when, and "Show in
  Finder". Received files are **not** shared back to other recipients unless the
  owner switches on "Share received files back" for a collaborative drop.
- Download limits apply to giving only. Receiving is bounded by size and count,
  and shown as "Received 3 files · 120 MB".

Security consequences to settle before building it: the token already grants
upload to anyone on the network who has it, so receive-only drops should default
to short lifetimes; the public listener gets its first write route and needs
request-size limits and slow-upload timeouts; the desktop must show received
files as untrusted (no auto-open, quarantine attribute on macOS).

## Naming

The concept name is "drop". In the interface the recommendation is to keep
talking about **links** and **sharing**, which is what people hand over and what
the verbs already say: "Share", "Copy link", "Add files to this link", "Stop
sharing", "New empty link". "Drop" as a visible noun collides with "drop files
here" in the same sentences. In code the type can stay `Share` to limit churn, or
become `Drop`; the concept doesn't depend on it.

## What changes in the implementation

Removed:

- `Grouping` and the `collection` flag, in Rust, DTOs, schemas, and the preview.
- `profile_id` on shares, the built-in "Direct download" profile, and the link
  profile selectors in the composer, inspector, row menu, and palette.
- The `/d/{token}` route and the rule that a lone file in a collection isn't
  served there.
- The "Links"/"Opens" rows of the composer; the `DirectLinkHint` component
  becomes a toast on copy.

Kept: stable file IDs, per-file cancellation, ZIP streaming, counting semantics,
the landing page, native-input verification, all security headers and tests.

Added:

- `add_files` and `remove_file` on any active drop; a `changed` marker for the
  page's refresh hint.
- Per-file "Copy link" and "Show QR"; "Copy ZIP link"; "New empty drop".
- Optional "Put each file in its own drop" at creation.

Documentation: one new ADR "The file drop" superseding 0005–0007; updates to
product.md, design.md, security.md, and the website pages for sharing and link
profiles.

## Open questions

1. **Titles.** Should a drop have an optional title ("Holiday photos"), shown in
   the list and as the page heading? Recommendation: yes, in a second step,
   derived from the first file until edited.
2. **Empty drops.** Offer "New empty drop" from the start? Recommendation: yes;
   it is cheap and matches the "open the link on the other device first" flow.
3. **Separate drops option.** Keep the checkbox or drop it and let people share
   twice? Recommendation: keep it, unobtrusive, because separate audiences are a
   real need and the checkbox costs one line.
4. **Visible noun.** "Link" (recommended) or "drop" in the interface?

## Rollout

1. **Model and interface**: remove grouping and profiles, per-file links, any
   active drop editable, composer with two rows, inspector as above, docs and ADR.
2. **Titles and empty drops**, plus per-file QR.
3. **Receiving**, after the MVP and its hardening audit, as its own issue with
   the security points above.
