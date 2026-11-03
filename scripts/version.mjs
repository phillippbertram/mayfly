// App version handling for releases (ADR 0012).
//   node scripts/version.mjs check [vX.Y.Z]   all version declarations agree (and match the tag)
//   node scripts/version.mjs release X.Y.Z    set the version, commit, and create the tag
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// SemVer without leading zeros or build metadata; covers 0.x and YY.M.N.
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

const jsonVersion = /^(\s*"version":\s*")([^"]+)(")/m;
export const files = [
  { path: "package.json", pattern: jsonVersion },
  { path: "apps/desktop/package.json", pattern: jsonVersion },
  { path: "apps/desktop/src-tauri/tauri.conf.json", pattern: jsonVersion },
  {
    path: "apps/desktop/src-tauri/Cargo.toml",
    pattern: /^(\[package\]\n(?:(?!\[)[^\n]*\n)*?version = ")([^"]+)(")/m,
  },
  {
    path: "apps/desktop/src-tauri/Cargo.lock",
    pattern: /^(name = "filehop"\nversion = ")([^"]+)(")/m,
  },
];

export function isVersion(value) {
  return versionPattern.test(value);
}

export function readVersion(text, pattern) {
  const match = text.match(pattern);
  if (!match) throw new Error("Version declaration not found.");
  return match[2];
}

export function writeVersion(text, pattern, version) {
  readVersion(text, pattern);
  return text.replace(pattern, `$1${version}$3`);
}

// SemVer precedence for the subset accepted by isVersion.
export function compareVersions(a, b) {
  const [coreA, preA] = a.split(/-(.*)/s);
  const [coreB, preB] = b.split(/-(.*)/s);
  const numbersA = coreA.split(".").map(Number);
  const numbersB = coreB.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (numbersA[i] !== numbersB[i]) return numbersA[i] - numbersB[i];
  if (!preA || !preB) return (preA ? -1 : 0) + (preB ? 1 : 0);
  const partsA = preA.split(".");
  const partsB = preB.split(".");
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    if (partsA[i] === undefined) return -1;
    if (partsB[i] === undefined) return 1;
    if (partsA[i] === partsB[i]) continue;
    const numericA = /^\d+$/.test(partsA[i]);
    const numericB = /^\d+$/.test(partsB[i]);
    if (numericA && numericB) return Number(partsA[i]) - Number(partsB[i]);
    if (numericA !== numericB) return numericA ? -1 : 1;
    return partsA[i] < partsB[i] ? -1 : 1;
  }
  return 0;
}

function currentVersion() {
  const versions = files.map(({ path, pattern }) => ({
    path,
    version: readVersion(readFileSync(`${root}${path}`, "utf8"), pattern),
  }));
  const distinct = new Set(versions.map((item) => item.version));
  if (distinct.size !== 1)
    throw new Error(
      `Version declarations disagree:\n${versions.map((item) => `  ${item.path}: ${item.version}`).join("\n")}`,
    );
  return versions[0].version;
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function check(tag) {
  const version = currentVersion();
  if (tag !== undefined && tag !== `v${version}`)
    throw new Error(`Tag ${tag} does not match the app version ${version}.`);
  console.log(`Version ${version} is consistent${tag ? ` with ${tag}` : ""}.`);
}

function release(version) {
  if (!isVersion(version)) throw new Error(`"${version}" is not a valid version (see ADR 0012).`);
  const current = currentVersion();
  if (compareVersions(version, current) <= 0)
    throw new Error(`${version} must be greater than the current version ${current}.`);
  if (git("status", "--porcelain")) throw new Error("Commit or stash your changes first.");
  if (git("branch", "--show-current") !== "main") throw new Error("Releases are cut from main.");
  if (git("tag", "--list", `v${version}`)) throw new Error(`Tag v${version} already exists.`);

  for (const { path, pattern } of files) {
    const text = readFileSync(`${root}${path}`, "utf8");
    writeFileSync(`${root}${path}`, writeVersion(text, pattern, version));
  }
  git("add", ...files.map(({ path }) => path));
  git("commit", "--quiet", "-m", `chore(release): v${version}`);
  git("tag", "--annotate", `v${version}`, "-m", `FileHop ${version}`);
  console.log(
    `Created the commit and tag v${version}. Start the release build with:\n` +
      "  git push --follow-tags origin main",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, value] = process.argv.slice(2);
  try {
    if (command === "check") check(value);
    else if (command === "release" && value) release(value);
    else throw new Error("Usage: version.mjs check [vX.Y.Z] | release X.Y.Z");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
