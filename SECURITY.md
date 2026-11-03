# Security policy

Mayfly has an implemented desktop sharing backend, but no supported stable
application release yet. The threat model is documented in [docs/security.md](docs/security.md).
Current test packages have no verified publisher identity: macOS uses ad-hoc
signing without notarization; Windows packages are unsigned. Read the
[installation guidance](docs/installation.md) before running a downloaded package.

Do not include an exploit, a token, a private filename, or an absolute local path
in a public issue. Report vulnerabilities through the repository's **Security >
Report a vulnerability** option when private reporting is enabled:
<https://github.com/phillippbertram/mayfly/security>.

If private reporting is unavailable, request a private reporting channel from the
repository owner without posting vulnerability details. A monitored security email
address and response commitments have not been established yet.
