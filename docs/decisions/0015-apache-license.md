# ADR 0015: License Mayfly under Apache-2.0

- Status: Accepted
- Date: 2026-11-03
- Related issues: #13

## Context

Mayfly is about to be distributed as installers and its repository will become
public. Until now no license was selected, so nobody had the right to use,
change, or redistribute the code. Issue #13 requires the owner to choose the
source and binary distribution license before release.

The owner compared MIT, Apache-2.0, GPL-3.0, and a source-available license and
selected Apache-2.0.

## Decision

- **Apache License 2.0** for the source code and the distributed binaries. It
  is permissive like MIT and adds an explicit patent grant and patent
  retaliation clause, and it is compatible with the MIT and Apache-2.0
  dependencies that dominate the Tauri, Rust, and npm ecosystems.
- `LICENSE` holds the unmodified official text from apache.org. `NOTICE` names
  the project and copyright holder; downstream redistributors must keep it.
- Package metadata declares the SPDX identifier `Apache-2.0`: the root,
  desktop, and website `package.json` files and `Cargo.toml`, which Tauri also
  uses for the Linux package metadata. `bundle.copyright` in `tauri.conf.json`
  carries the copyright line into the bundles.
- Contributions are accepted under the same license (inbound equals outbound,
  section 5); there is no separate contributor license agreement.

## Consequences

- Anyone may use, modify, and sell Mayfly, including in closed products, as long
  as they keep the license, the copyright, and the `NOTICE`, and mark changed
  files. The license does not grant rights to the Mayfly name or logo
  (section 6).
- Because contributions arrive under Apache-2.0 without a CLA, relicensing the
  project later requires the consent of every contributor.
- Third-party license notices for the shipped bundles and the website remain a
  separate part of #13 and must be compiled before the first public release.
- The installers do not yet include the license text or show a license page.
  The copyright holder is not bound by section 4, but redistributors are, so the
  bundles should ship `LICENSE` and `NOTICE` together with the third-party
  notices from #13.

Implementation update: [ADR 0016](0016-bundled-license-notices.md) records the
reviewed dependency notice snapshot and its inclusion in app resources, the
website, and release attachments. Actual platform-added components and public
distribution acceptance remain part of #13/#16.
