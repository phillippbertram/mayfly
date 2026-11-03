# Third-party licensing

Refs [#13](https://github.com/phillippbertram/mayfly/issues/13).
Mayfly's own code is Apache-2.0 ([LICENSE](../LICENSE), [NOTICE](../NOTICE),
[ADR 0015](decisions/0015-apache-license.md)). Third-party components retain their
own licenses. The reviewed snapshot in
[`licenses/THIRD_PARTY_NOTICES.txt`](../licenses/THIRD_PARTY_NOTICES.txt) contains
the component inventory, source links, and upstream copyright/license texts.

## Coverage

- The desktop and website's recursive npm production dependency graphs, including
  the website's embedded desktop demo and the Bricolage Grotesque font (OFL-1.1).
  Nested notices inside packages are retained too, including prebundled Next.js
  dependencies. Native npm compiler/image-processing executables are build tools;
  they are excluded because neither static frontend distributes them or Node.js.
- The entire locked Cargo graph, including transitive, platform-specific, build,
  and test dependencies. This intentionally includes more than any one installer.
- Published package license files, plus explicit version-specific overrides when
  upstream packages omit them. `licenses/overrides.json` records the original
  immutable upstream source or source-distribution URL. Override texts are kept
  verbatim; the generator refuses missing package/license text instead of guessing.

Some omitted npm license files use the parent project's license: Next.js for
`@next/env`, and React for its `client-only` marker package. The scroll-bar and
Yuku packages use pinned upstream license blobs matching their declared MIT terms.
Their copyrights were checked against the package/project authors. Missing Rust
workspace licenses are taken from the exact upstream commit recorded in the crate,
or the parent crate's published license for winapi's import libraries. `selectors`
declares MPL-2.0 and uses Mozilla's official license text because its package and
upstream directory omit the text.

The upstream objc2 licensing document links to the MIT terms without reproducing
them or providing a specific copyright notice. Its original document is retained
alongside the standard MIT permission text from SPDX; no copyright holder is
invented or substituted.

The snapshot preserves every collected upstream notice, rather than replacing
them with a single generic MIT/Apache text. Bricolage's original copyright and
full OFL terms appear in the combined document. Package text line endings are
normalized to LF to keep snapshot hashes stable across Git checkouts; the words
and notices are preserved. Generated frontend transforms do not change the font
or third-party source files themselves.

## Updating the snapshot

After a dependency change:

```sh
pnpm install --frozen-lockfile
pnpm licenses:generate
pnpm licenses:check
```

Generation requires installed npm dependencies and Cargo; `cargo metadata --locked`
may download crates for other targets. No external license-generation service or
credentials are used. When a package lacks its license text, obtain the actual
upstream terms, record a version-specific entry and provenance in
`licenses/overrides.json`, then generate again. Never infer a copyright holder or
silently accept unknown terms.

Review the new inventory and license obligations with the lockfile changes.
MPL-2.0 components retain their own terms; every component's source-distribution
link provides its corresponding Source Code Form. Current third-party sources
have no local edits. Preserve those source links, and provide the corresponding
modified source if future changes are made to a covered component.

`licenses/manifest.json` records the reviewed inputs, notice checksum, component
licenses, scopes, and source URLs. `pnpm check`, the desktop frontend build, and
website preparation reject stale or modified notices without network requests.
Changing only Mayfly's version does not invalidate an unchanged dependency inventory.
Regenerate after changing the generator or an override as well as after dependencies.

## Delivery

- Tauri's `bundle.resources` maps the root `LICENSE`, `NOTICE`, and combined
  third-party notice file into `licenses/LICENSE.txt`, `licenses/NOTICE.txt`, and
  `licenses/THIRD_PARTY_NOTICES.txt`. The mapping applies to every package format.
- On macOS these are under `Mayfly.app/Contents/Resources/licenses`; on Windows
  they are beside the installed executable in `licenses`. Linux uses the app's
  resource directory under `usr/lib` (inside an AppImage's corresponding tree).
- Website preparation copies the same files to the ignored `public/licenses/`
  directory before export. The footer and manual link to them using the configured
  GitHub Pages base path. The website needs no runtime license lookup.
- Release finalization attaches the three documents and `INSTALLATION.md` beside
  the packages, and includes their hashes in `SHA256SUMS`, including for prereleases.

## Review the actual platform packages before distribution

The dependency snapshot covers application dependencies; it is not an inventory
of OS libraries, the AppImage runtime, NSIS, WebView2, or anything added by native
packaging tools. Before promoting a downloaded bundle, inspect its actual contents
and retain those components' notices, applicable licenses, and source/relinking
materials where required. In particular, do not assume the Rust binding's license
covers its native Linux library, or that an AppImage contains no extra libraries.
System frameworks supplied by the OS are distinct from libraries redistributed in
the installer. Record the exact package/runner versions and any additional material
with the release acceptance evidence in #13/#16.

This local preparation does not establish Windows/Linux installer acceptance or
complete that platform-bundle review. Public stable promotion remains gated on
those checks, source availability, security acceptance, and the documented signing
policy. The user-facing [installation guide](installation.md) describes the current
unsigned/ad-hoc first-launch experience.
