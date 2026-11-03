# Roadmap

GitHub Issues are the source of truth for status, acceptance criteria, dependencies,
and verification. This document is an index; keep task progress in the issues.

## Repository foundation

The initial task creates the pnpm workspace, strict TypeScript base, Biome tooling,
shared agent instructions, project documents, issue forms, PR template, and
repository-check workflow. A subsequent task adds a minimal runnable Tauri/React
starter under `apps/desktop`, including the native window, system-theme styling,
typed app-info IPC, and working development/build commands. Feature delivery
continues through the issues below; this starter does not complete the MVP.

## MVP implementation

Tracker: [Deliver the FileHop MVP and first public release (#10)](https://github.com/phillippbertram/filehop/issues/10).
Milestone: [MVP](https://github.com/phillippbertram/filehop/milestone/1).

| Phase                   | Implementation issue                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation          | [#1: Tauri 2, React, strict TypeScript, and the desktop workspace](https://github.com/phillippbertram/filehop/issues/1) |
| 2 — Core sharing        | [#2: In-memory shares and the real Axum streaming server](https://github.com/phillippbertram/filehop/issues/2)          |
| 2 — Desktop integration | [#3: Native selection, drag and drop, and the dashboard](https://github.com/phillippbertram/filehop/issues/3)           |
| 3 — QR and mobile       | [#4: QR actions, network selection, and the phone experience](https://github.com/phillippbertram/filehop/issues/4)      |
| 4 — Desktop experience  | [#5: Tray lifecycle and persistent settings](https://github.com/phillippbertram/filehop/issues/5)                       |
| 5 — Deep links          | [#6: Persistent link profiles and template substitution](https://github.com/phillippbertram/filehop/issues/6)           |
| 6 — Hardening           | [#7: Security audit and complete workflow verification](https://github.com/phillippbertram/filehop/issues/7)            |
| 6 — Platform builds     | [#8: Cross-platform build CI and packaging documentation](https://github.com/phillippbertram/filehop/issues/8)          |
| Continuous validation   | [#11: TypeScript, frontend, Rust, and HTTP regression checks](https://github.com/phillippbertram/filehop/issues/11)     |

Begin application implementation with #1. The functional sequence is
#1 → #2 → #3 → #4 → #5 → #6 → #7. Build infrastructure (#8) can start once #1
provides actual native targets. A compiled artifact and a platform runtime check
are separate verification results.

Each issue contains focused acceptance criteria and required evidence. Security
requirements apply from the first implementation; the hardening phase is a final
audit, not a reason to defer safe file access or atomic download limits.

## First public release and website

Milestone: [First public release](https://github.com/phillippbertram/filehop/milestone/3).

| Area                   | Delivery issue                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Branding               | [#12: Application icons, tray assets, and shared brand assets](https://github.com/phillippbertram/filehop/issues/12)   |
| Distribution decisions | [#13: License, third-party notices, and public download hosting](https://github.com/phillippbertram/filehop/issues/13) |
| Release trust          | [#14: Platform signing and macOS notarization](https://github.com/phillippbertram/filehop/issues/14)                   |
| Release pipeline       | [#15: Versioned Windows, macOS, and Linux release builds](https://github.com/phillippbertram/filehop/issues/15)        |
| ARM release targets    | [#30: Linux arm64 and Windows arm64 release builds](https://github.com/phillippbertram/filehop/issues/30)              |
| Native acceptance      | [#16: Packaged installer and real LAN workflow validation](https://github.com/phillippbertram/filehop/issues/16)       |
| Public website         | [#17: GitHub Pages product site, downloads, and user guides](https://github.com/phillippbertram/filehop/issues/17)     |

Native artifact builds (#8), continuous application checks (#11), release bundles
(#15), and installed-bundle acceptance (#16) have separate responsibilities. Build
draft bundles before installation acceptance; promote stable releases only after
the documented release gates pass. The website consumes actual release metadata
and provides clear unavailable states until downloads exist.

The source repository is currently private. #13 records the owner-approved public
distribution arrangement and Pages eligibility before exposing repository content
or binaries. The public website hosts product information and application installers;
shared user files continue to travel directly over the local network.

## Optional follow-up

[#9: Authenticated loopback management API](https://github.com/phillippbertram/filehop/issues/9)
belongs to the [Optional local API milestone](https://github.com/phillippbertram/filehop/milestone/2).
It follows the verified Tauri flow and does not block the required MVP.

The enhancements below are planned optional work beyond the LAN MVP. Their
acceptance criteria and dependencies live in the linked issues; adding them here
does not start implementation or make them first-release blockers. The suggested
order is provisional, with no release dates assigned.

### Suggested first enhancements

| Order | Area                    | Delivery issue                                                                                                      |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | Transfer visibility     | [#22: Live download progress and transfer activity](https://github.com/phillippbertram/filehop/issues/22)           |
| 2     | Transfer reliability    | [#23: Prevent automatic system sleep during active downloads](https://github.com/phillippbertram/filehop/issues/23) |
| 3     | Native file integration | [#24: Finder and Explorer sharing actions](https://github.com/phillippbertram/filehop/issues/24)                    |

### Further enhancements

| Area                  | Delivery issue                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Connection help       | [#25: Guided LAN troubleshooting and recipient reachability feedback](https://github.com/phillippbertram/filehop/issues/25)      |
| Sharing defaults      | [#26: Reusable lifetime and download-limit presets](https://github.com/phillippbertram/filehop/issues/26)                        |
| Receiving files       | [#27: Opt-in browser-to-desktop file receiving per share](https://github.com/phillippbertram/filehop/issues/27)                  |
| Interrupted downloads | [#28: Resumable file downloads with explicit range and counting semantics](https://github.com/phillippbertram/filehop/issues/28) |

### Related optional work

- [#19: CLI for terminal and scripted sharing](https://github.com/phillippbertram/filehop/issues/19).
- [#20: Optional password protection per share](https://github.com/phillippbertram/filehop/issues/20).
- [#21: Cloudflare relay proof of concept](https://github.com/phillippbertram/filehop/issues/21).
- [#29: Detect and install application updates in the app](https://github.com/phillippbertram/filehop/issues/29).

## Distribution decisions

License and public distribution decisions are tracked in #13, signing/notarization
in #14, and release publishing in #15. They are planned work, not configured services.
Versions follow [ADR 0012](decisions/0012-versioning-scheme.md): SemVer `0.x` before
the first stable release, then `YY.M.N`.
Any future Universal Links infrastructure requires a separate decision.
