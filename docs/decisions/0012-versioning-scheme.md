# ADR 0012: Versioning scheme

- Status: Accepted
- Date: 2026-11-03
- Related issues: #15, #29

## Context

The release pipeline (#15) needs one version scheme for tags, bundles, the website
release manifest, and the in-app updater (#29). Cargo, `tauri.conf.json`, and the
Tauri updater require SemVer-shaped `MAJOR.MINOR.PATCH` versions and compare them by
SemVer precedence. Windows MSI limits versions to `255.255.65535` and accepts only
numeric pre-release identifiers. The website validator accepts stable `X.Y.Z` only.

## Decision

- **Pre-1.0: SemVer `0.MINOR.PATCH`.** Minor releases add functionality or may
  break persisted settings and profiles; patch releases fix bugs. The workspace
  starts at `0.8.0`. No earlier version was published.
- **First stable release: calendar versioning `YY.M.N`.** `YY` is the two-digit
  release year, `M` the month without a leading zero, and `N` a counter starting at
  `0` for each month (`27.3.0`, `27.3.1`, `27.4.0`). SemVer forbids leading zeros,
  so January is `27.1.0`, never `27.01.0`. These versions remain valid SemVer, stay
  within the MSI limits until 2255, and sort after every `0.x` release, so updates
  from pre-1.0 installs keep working. There is no `1.0.0`; the first `YY.M.N`
  release takes its role.
- **No way back.** After the switch, versions never return to small SemVer
  majors: `1.0.0` would sort before `27.3.0` and the updater would ignore it.
- **Pre-releases** append `-beta.N` or `-rc.N` and are published as GitHub
  pre-releases, which the website and `releases/latest` ignore. Numeric-only
  identifiers are required if MSI bundles are added.
- **One version for the app.** The Git tag `vX.Y.Z` equals the version in the root
  and desktop `package.json`, `Cargo.toml`, `Cargo.lock`, and `tauri.conf.json`.
  The release pipeline rejects mismatches. The website is not versioned with the app.

## Consequences

Under CalVer, a version shows when it was released but not whether it breaks
compatibility. Settings and profile format changes therefore need migrations and
release-note entries instead of a major bump. Once the switch happens, the release
pipeline should derive `YY.M` from the release date and increment `N`
automatically, so versions are never typed by hand.
