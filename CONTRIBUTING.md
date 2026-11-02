# Contributing to FileHop

## Start with an issue

GitHub Issues are the project-management source of truth:
<https://github.com/phillippbertram/filehop/issues>.

Search existing issues before creating work. Each implementation issue should state
the expected user behavior, scope, acceptance criteria, verification, and dependencies.
Use the feature form for implementation work and the bug form for defects. Keep
security reports private as described in [SECURITY.md](SECURITY.md).

The repository currently contains a minimal runnable desktop starter. The
application foundation issue tracks its remaining work. Do not start all MVP phases
as part of a repository-maintenance task.

## Prepare changes

1. Read [AGENTS.md](AGENTS.md) and the relevant project documents.
2. Inspect the working tree and preserve existing changes.
3. Use a focused branch, such as `feat/2-desktop-foundation` or `docs/agent-workflow`.
4. Implement only the issue's scope and document relevant decisions.
5. Run the checks described in [the development guide](docs/development.md).

Use English for source code, comments, documentation, issues, commits, and pull
requests. Use concise commit subjects such as `docs: define the security model`.
Do not commit secrets, private file paths, access tokens, or generated installers.

## Pull requests

Link the relevant issue, describe the resulting behavior, and report actual
verification. Include UI screenshots when an interface exists and changes visually.
List material platform limitations and incomplete acceptance criteria.

Use `Closes #123` only when the change completes the issue. Use `Refs #123` for partial
work. An accepted PR and passing applicable checks are the normal completion
evidence; a green documentation check does not verify the application.

Do not push, merge, or publish on someone else's behalf without task authorization.

## Dependencies and releases

Use pnpm for JavaScript tooling and Cargo for Rust. Commit the appropriate lockfiles
when the corresponding packages exist. Explain new dependencies and keep runtime
dependencies small. Pin GitHub Actions to commit SHAs and give workflows the minimum
permissions they need.

Application packaging, signing, notarization, and release publishing will be added
through their own issues. A distribution license must be selected before release.
