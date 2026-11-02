# ADR 0007: Collections and stable file IDs

- Status: Accepted
- Date: 2026-11-02

## Context

Users want to keep one link open, for example on another computer, and add or
remove files over time. Bundle files were addressed by their position
(`/d/{token}/{index}`), so removing a file would silently redirect older links to
a different file. Changing a sent single-file or bundle link would also surprise
recipients and break direct links whose route depends on the file count.

## Decision

- **Stable file IDs.** Every file in a share gets a random 12-byte base64url ID.
  Bundle and collection files are served at `/d/{token}/{file}`; IDs are never
  reused, and removed IDs answer 410 "File removed". This supersedes the index
  route from [ADR 0005](0005-share-bundles-and-landing-page.md).
- **Collections are explicit.** Sharing offers three groupings: separate links,
  one fixed bundle, or a collection kept open for more files. Only collections
  accept `add_files` and `remove_file`, and only while active. Single shares and
  bundles stay immutable.
- **Stable links.** A collection always uses the list page and, for direct
  downloads, its ZIP (`/z/{token}`), even with one file, so the link never changes.
  A lone file in a collection is not served at `/d/{token}`. An empty collection
  stays active, shows "No files yet", and its ZIP answers 404 until files arrive.
- **Cancellation per file.** Each file's cancellation token is a child of the
  share's token. Removing a file cancels its transfers and ZIPs containing it;
  stopping the share cancels everything.
- **Limits.** Download limits stay per file; new files start at zero. An empty
  collection is never "limit reached".
- **Desktop.** The inspector lists a collection's files with remove buttons, an
  "Add files…" button, and acts as a drop target; drops elsewhere create shares.
  Native drop paths are still verified against the window's drop event.

## Consequences

A collection link grants access to files added after it was sent; the interface
says so. Recipients see changes after reloading the page, since it has no scripts.
Share again copies a collection's current files into a new collection.
