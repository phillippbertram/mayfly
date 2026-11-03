# Roadmap

GitHub Issues are the source of truth for status, acceptance criteria, dependencies,
and verification. This document is an index; keep task progress in the issues.

## Repository foundation

The workspace contains a Tauri/React desktop app with implemented Rust sharing
services and a static product website. The issues below remain the source of
truth for acceptance and release work; implementation alone does not complete
device, installed-bundle, or public-hosting verification.

## MVP implementation

Tracker: [Deliver the Mayfly MVP and first public release (#10)](https://github.com/phillippbertram/mayfly/issues/10).
Milestone: [MVP](https://github.com/phillippbertram/mayfly/milestone/1).

| Phase                   | Implementation issue                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation          | [#1: Tauri 2, React, strict TypeScript, and the desktop workspace](https://github.com/phillippbertram/mayfly/issues/1) |
| 2 — Core sharing        | [#2: In-memory shares and the real Axum streaming server](https://github.com/phillippbertram/mayfly/issues/2)          |
| 2 — Desktop integration | [#3: Native selection, drag and drop, and the dashboard](https://github.com/phillippbertram/mayfly/issues/3)           |
| 3 — QR and mobile       | [#4: QR actions, network selection, and the phone experience](https://github.com/phillippbertram/mayfly/issues/4)      |
| 4 — Desktop experience  | [#5: Tray lifecycle and persistent settings](https://github.com/phillippbertram/mayfly/issues/5)                       |
| 5 — Deep links          | [#6: Persistent link profiles and template substitution](https://github.com/phillippbertram/mayfly/issues/6)           |
| 6 — Hardening           | [#7: Security audit and complete workflow verification](https://github.com/phillippbertram/mayfly/issues/7)            |
| 6 — Platform builds     | [#8: Cross-platform build CI and packaging documentation](https://github.com/phillippbertram/mayfly/issues/8)          |
| Continuous validation   | [#11: TypeScript, frontend, Rust, and HTTP regression checks](https://github.com/phillippbertram/mayfly/issues/11)     |

The functional implementation sequence is
#1 → #2 → #3 → #4 → #5 → #6 → #7. Build infrastructure (#8) can start once #1
provides actual native targets. A compiled artifact and a platform runtime check
are separate verification results.

Each issue contains focused acceptance criteria and required evidence. Security
requirements apply from the first implementation; the hardening phase is a final
audit, not a reason to defer safe file access or atomic download limits.

## First public release and website

Milestone: [First public release](https://github.com/phillippbertram/mayfly/milestone/3).

| Area                   | Delivery issue                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Branding               | [#12: Application icons, tray assets, and shared brand assets](https://github.com/phillippbertram/mayfly/issues/12)   |
| Distribution decisions | [#13: License, third-party notices, and public download hosting](https://github.com/phillippbertram/mayfly/issues/13) |
| Release trust          | [#14: Platform signing and macOS notarization](https://github.com/phillippbertram/mayfly/issues/14)                   |
| Release pipeline       | [#15: Versioned Windows, macOS, and Linux release builds](https://github.com/phillippbertram/mayfly/issues/15)        |
| ARM release targets    | [#30: Linux arm64 and Windows arm64 release builds](https://github.com/phillippbertram/mayfly/issues/30)              |
| Native acceptance      | [#16: Packaged installer and real LAN workflow validation](https://github.com/phillippbertram/mayfly/issues/16)       |
| Public website         | [#17: GitHub Pages product site, downloads, and user guides](https://github.com/phillippbertram/mayfly/issues/17)     |

Native artifact builds (#8), continuous application checks (#11), release bundles
(#15), and installed-bundle acceptance (#16) have separate responsibilities. Build
draft bundles before installation acceptance; promote stable releases only after
the documented release gates pass. The website consumes actual release metadata
and provides clear unavailable states until downloads exist.

The source repository's public launch and Pages deployment are prepared locally;
the owner controls when visibility and hosting change. #13 covers the distribution
arrangement, dependency notices, and platform-added components. The website hosts
product information and installer links; shared files travel over the local network.

## Optional follow-up

[#9: Authenticated loopback management API](https://github.com/phillippbertram/mayfly/issues/9)
belongs to the [Optional local API milestone](https://github.com/phillippbertram/mayfly/milestone/2).
It follows the verified Tauri flow and does not block the required MVP.

The enhancements below are planned optional work beyond the LAN MVP. Their
acceptance criteria and dependencies live in the linked issues; adding them here
does not start implementation or make them first-release blockers. The suggested
order is provisional, with no release dates assigned.

### Suggested first enhancements

| Order | Area                    | Delivery issue                                                                                                     |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1     | Transfer visibility     | [#22: Live download progress and transfer activity](https://github.com/phillippbertram/mayfly/issues/22)           |
| 2     | Transfer reliability    | [#23: Prevent automatic system sleep during active downloads](https://github.com/phillippbertram/mayfly/issues/23) |
| 3     | Native file integration | [#24: Finder and Explorer sharing actions](https://github.com/phillippbertram/mayfly/issues/24)                    |

### Further enhancements

| Area                  | Delivery issue                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Connection help       | [#25: Guided LAN troubleshooting and recipient reachability feedback](https://github.com/phillippbertram/mayfly/issues/25)      |
| Sharing defaults      | [#26: Reusable lifetime and download-limit presets](https://github.com/phillippbertram/mayfly/issues/26)                        |
| Receiving files       | [#27: Opt-in browser-to-desktop file receiving per share](https://github.com/phillippbertram/mayfly/issues/27)                  |
| Interrupted downloads | [#28: Resumable file downloads with explicit range and counting semantics](https://github.com/phillippbertram/mayfly/issues/28) |

### Related optional work

- [#19: CLI for terminal and scripted sharing](https://github.com/phillippbertram/mayfly/issues/19).
- [#20: Optional password protection per share](https://github.com/phillippbertram/mayfly/issues/20).
- [#21: Cloudflare relay proof of concept](https://github.com/phillippbertram/mayfly/issues/21).
- [#29: Detect and install application updates in the app](https://github.com/phillippbertram/mayfly/issues/29).

## Distribution decisions

License and public distribution work is tracked in #13, signing/notarization in
#14, and release publishing in #15. Apache-2.0 is selected; the dependency notice
snapshot and draft-release tooling are prepared. Public hosting, actual bundle
review, and release promotion retain their own acceptance requirements.
Versions follow [ADR 0012](decisions/0012-versioning-scheme.md): SemVer `0.x` before
the first stable release, then `YY.M.N`.
Any future Universal Links infrastructure requires a separate decision.
