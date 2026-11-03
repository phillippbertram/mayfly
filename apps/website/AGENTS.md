# Website instructions

Read the root `AGENTS.md` first. This workspace contains Mayfly's public product
website and English user manual, implemented with Next.js, Fumadocs, and Motion.

- Export static files for GitHub Pages; no runtime API, authentication, or secrets.
- Respect `NEXT_PUBLIC_BASE_PATH` for assets, search, navigation, and exported links.
- Keep screenshots faithful to the actual app and label sample-data browser previews.
- Describe planned features as planned. Never invent release downloads or supported OS versions.
- Validate release metadata at build time; retain a useful unavailable state.
- Honor reduced motion and retain readable content without animation or JavaScript.
- Run the website build, TypeScript checks, release tests, and exported-link checks.
- Deployment and public distribution remain gated by the owner's repository/hosting decisions.
