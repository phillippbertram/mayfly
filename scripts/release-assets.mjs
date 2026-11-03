// Release workflow helper: names bundles deterministically, then writes SHA256SUMS
// and the website manifest (mayfly-release.json) for a directory of release assets.
//   node scripts/release-assets.mjs collect <bundle-dir> <target> <version> <out-dir>
//   node scripts/release-assets.mjs finalize <asset-dir> <version> <owner/repo>
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRelease } from "../apps/website/scripts/release.mjs";

// Declared build minimums (tauri.conf.json, WebView2, the ubuntu-22.04 runner's glibc
// and WebKitGTK 4.1). Installed-bundle acceptance is tracked separately in #16.
export const assets = [
  { target: "macos-arm64", format: "dmg", bundle: "dmg", minimumOs: "macOS 11" },
  { target: "macos-x64", format: "dmg", bundle: "dmg", minimumOs: "macOS 11" },
  { target: "windows-x64", format: "exe", bundle: "nsis", minimumOs: "Windows 10" },
  {
    target: "linux-x64",
    format: "AppImage",
    bundle: "appimage",
    minimumOs: "Ubuntu 22.04, Debian 12, or equivalent",
  },
  {
    target: "linux-x64",
    format: "deb",
    bundle: "deb",
    minimumOs: "Ubuntu 22.04, Debian 12, or equivalent",
  },
];

export function assetName(version, target, format) {
  return `Mayfly-${version}-${target}.${format}`;
}

export const releaseDocuments = [
  { source: "LICENSE", name: "LICENSE.txt" },
  { source: "NOTICE", name: "NOTICE.txt" },
  { source: "licenses/THIRD_PARTY_NOTICES.txt", name: "THIRD_PARTY_NOTICES.txt" },
  { source: "docs/installation.md", name: "INSTALLATION.md" },
];
const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

export function isStable(version) {
  return !version.includes("-");
}

function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function collect(bundleDir, target, version, outDir) {
  const expected = assets.filter((asset) => asset.target === target);
  if (!expected.length) throw new Error(`Unknown target ${target}.`);
  await mkdir(outDir, { recursive: true });
  for (const { bundle, format } of expected) {
    const dir = join(bundleDir, bundle);
    // Tauri names bundles Mayfly_<version>_<arch>…; other versions are stale outputs.
    const matches = (await readdir(dir)).filter(
      (name) => name.includes(`_${version}_`) && name.endsWith(`.${format}`),
    );
    if (matches.length !== 1)
      throw new Error(`Expected one ${version} .${format} in ${bundle}/, found ${matches.length}.`);
    await copyFile(join(dir, matches[0]), join(outDir, assetName(version, target, format)));
  }
}

async function finalize(assetDir, version, repository) {
  const tag = `v${version}`;
  const present = new Set(await readdir(assetDir));
  const entries = [];
  for (const asset of assets) {
    const name = assetName(version, asset.target, asset.format);
    if (!present.has(name)) throw new Error(`Missing release asset ${name}.`);
    entries.push({ ...asset, name, sha256: await sha256(join(assetDir, name)) });
  }
  if (present.size !== entries.length) throw new Error("Unexpected files in the asset directory.");

  const checksums = entries.map(({ sha256, name }) => `${sha256}  ${name}\n`);
  for (const document of releaseDocuments) {
    const destination = join(assetDir, document.name);
    await copyFile(join(repositoryRoot, document.source), destination);
    checksums.push(`${await sha256(destination)}  ${document.name}\n`);
  }

  await writeFile(join(assetDir, "SHA256SUMS"), checksums.join(""));
  // The website only lists stable releases; pre-releases ship without a manifest.
  if (!isStable(version)) return;
  const base = `https://github.com/${repository}/releases`;
  const manifest = validateRelease({
    schemaVersion: 1,
    release: {
      version,
      publishedAt: new Date().toISOString(),
      notesUrl: `${base}/tag/${tag}`,
      assets: entries.map(({ target, format, minimumOs, sha256, name }) => ({
        target,
        format,
        minimumOs,
        sha256,
        url: `${base}/download/${tag}/${name}`,
      })),
    },
  });
  await writeFile(join(assetDir, "mayfly-release.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "collect" && args.length === 4) await collect(...args);
    else if (command === "finalize" && args.length === 3) await finalize(...args);
    else throw new Error("Usage: release-assets.mjs collect|finalize ...");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
