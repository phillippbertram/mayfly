# ADR 0008: Every share is a file drop

- Status: Accepted
- Date: 2026-11-02
- Supersedes: grouping and routes in [ADR 0005](0005-share-bundles-and-landing-page.md),
  [ADR 0006](0006-direct-download-links.md), and the collection type in
  [ADR 0007](0007-collections.md)

## Context

Sharing had grown four up-front choices: separate links, one bundle, a collection
kept open for more files, and a link profile deciding whether the link opens a page
or downloads directly. They interacted (a bundle's direct link was a ZIP, a
collection's always a ZIP, a single file's the file), their labels changed with
the file count, and the same concept appeared as Link, Profile, and Link profiles.
The [file drop concept](../concepts/file-drop.md) proposed one model instead.

## Decision

- **One kind of share.** A share has a token, zero or more files with stable random
  IDs, a lifetime, and a download limit per file. Any active share accepts new
  files and gives up files; the `Grouping` and `collection` concepts are removed.
- **Three links per share.** The share page `/s/{token}` (one file large, several
  as a list, or "No files yet"), a direct link per file `/d/{token}/{file}`, and a
  ZIP of everything `/z/{token}`. There is no bare `/d/{token}`, so no link changes
  meaning when the file count changes. The QR code always encodes the page.
- **No per-share link profile.** The built-in "Direct download" profile is retired;
  file and ZIP links replace it. Shares no longer carry `profileId`; DTOs carry
  `link`, `zipLink`, and `files[].link`. Custom app templates (#6) will become
  extra copy actions, not a property of the share.
- **Share options ask two things.** Lifetime and download limit. With several files
  a switch "Give each file its own link" creates one share per file; by default
  all files go behind one link.
- **Editing.** Add files through the inspector, the row menu, the palette (`A`), or
  by dropping onto a share's row or file list. Remove files from the inspector
  while more than one remains; "Stop sharing" ends the share instead of emptying
  it. The page shows "The owner may add or remove files" with a Refresh link once
  files changed and while the share is empty.
- **Direct-link warning.** Copying a file or ZIP link of a share with a download
  limit notes that chat-app previews can use up a download.

## Consequences

The composer, inspector, and row lose their profile and grouping controls, and the
Rust registry loses the collection flag and the single-file route. A share is one
audience: a file link contains the token and opens the page with all files, and any
link a recipient has may later show more files. Separate links remain available
for separate audiences. Receiving files (uploads) can be added to the same model
later as a direction of the share, as outlined in the concept.
