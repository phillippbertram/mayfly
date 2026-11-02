# Agent workflow

## One source of instructions

[AGENTS.md](../AGENTS.md) is the canonical repository instruction file for all coding
agents and human contributors. Scoped instructions live in `apps/desktop/AGENTS.md`,
`apps/desktop/src/AGENTS.md`, and `apps/desktop/src-tauri/AGENTS.md`. Maintain rules in these files rather than duplicating them
across vendor configurations.

| Tool           | Entry point                                                                     |
| -------------- | ------------------------------------------------------------------------------- |
| Codex          | Root and relevant nested `AGENTS.md` files                                      |
| Cursor         | Root and relevant nested `AGENTS.md` files                                      |
| Claude Code    | `CLAUDE.md` imports `AGENTS.md` for compatibility                               |
| Gemini CLI     | `GEMINI.md` directs the agent to read the shared instructions                   |
| GitHub Copilot | `.github/copilot-instructions.md` directs the agent to the shared instructions  |
| Other agents   | Explicitly ask the tool to read `AGENTS.md` and the issue before making changes |

The Gemini and Copilot entry points are reading instructions, not import mechanisms.
Instruction loading varies by product, version, and local settings. At the start
of a session, ask the tool to identify the project guidance it loaded; explicitly
provide the canonical file when necessary. No vendor CLI or paid subscription is
required for the project's build tooling.

## Task handoff

A useful handoff includes the GitHub issue URL, expected outcome, relevant files,
scope limits, and available verification environment. Agents should read the issue
and its dependencies, inspect the working tree, implement a focused change, run
applicable checks, and report evidence and limitations.

Project work is tracked in [GitHub Issues](https://github.com/phillippbertram/filehop/issues).
Do not use chat history or a vendor-specific task store as the only record of a
decision. Put acceptance criteria in the issue and architecture decisions in
`docs/decisions/`. Keep the roadmap as an issue index.

## Local state

Agent credentials, personal settings, session logs, and machine paths stay outside
version control. This setup adds no automatic execution hooks, external agent
services, permission overrides, MCP servers, or global configuration changes.

All code and documentation remain in English. A minimal desktop starter is now
implemented; further application features require authorization in the current task.

## Instruction format references

- [Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Cursor AGENTS.md support](https://cursor.com/docs/rules#agentsmd)
- [Claude Code shared instruction imports](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)
- [Gemini CLI context files](https://geminicli.com/docs/cli/gemini-md/)
- [GitHub Copilot repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)
