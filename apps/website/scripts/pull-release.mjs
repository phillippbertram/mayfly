// Local-only helper: downloads filehop-release.json with the developer's own GitHub
// CLI session, e.g. while the source repository is still private. Never use it in
// CI; public builds read releases without authentication (prepare-release.mjs).
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { validateRelease } from "./release.mjs";

const output = ".release/pulled-manifest.json";
const tag = process.argv[2];

await mkdir(".release", { recursive: true });
execFileSync(
  "gh",
  [
    "release",
    "download",
    ...(tag ? [tag] : []),
    "--pattern",
    "filehop-release.json",
    "--output",
    output,
    "--clobber",
  ],
  { stdio: "inherit" },
);

const manifest = validateRelease(JSON.parse(await readFile(output, "utf8")));
console.log(
  `Pulled FileHop ${manifest.release?.version ?? "(no release)"}. Preview it with:\n` +
    `  FILEHOP_RELEASE_MANIFEST=${output} pnpm dev:website`,
);
