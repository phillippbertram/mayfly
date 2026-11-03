import { mkdir, readFile, writeFile } from "node:fs/promises";
import { validateRelease } from "./release.mjs";

let manifest = JSON.parse(await readFile("data/release.json", "utf8"));
const file = process.env.MAYFLY_RELEASE_MANIFEST;
const repository = process.env.MAYFLY_RELEASE_REPOSITORY;

async function publicJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json", "User-Agent": "Mayfly-website-build" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public release request failed: ${response.status}`);
  const text = await response.text();
  if (text.length > 200000) throw new Error("Release metadata exceeds the allowed size.");
  return JSON.parse(text);
}

if (file) {
  manifest = JSON.parse(await readFile(file, "utf8"));
} else if (repository) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))
    throw new Error("Invalid public release repository.");
  // No authentication: private release data must never become public website content.
  const release = await publicJson(`https://api.github.com/repos/${repository}/releases/latest`);
  if (!release) {
    manifest = { schemaVersion: 1, release: null };
  } else {
    const asset = release.assets.find((item) => item.name === "mayfly-release.json");
    if (!asset) throw new Error("Latest stable release is missing mayfly-release.json.");
    const expected = `https://github.com/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/mayfly-release.json`;
    if (asset.browser_download_url !== expected)
      throw new Error("Unexpected release manifest URL.");
    manifest = await publicJson(expected);
    validateRelease(manifest);
    if (!manifest.release || release.tag_name !== `v${manifest.release.version}`)
      throw new Error("Release manifest version does not match the stable tag.");
    const publishedUrls = new Set(release.assets.map((item) => item.browser_download_url));
    for (const item of manifest.release.assets)
      if (!publishedUrls.has(item.url))
        throw new Error("Manifest references an asset absent from the release.");
  }
}

manifest = validateRelease(manifest);
await mkdir(".release", { recursive: true });
await writeFile(".release/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  manifest.release
    ? `Prepared stable release ${manifest.release.version}.`
    : "No public release configured; displaying the unavailable state.",
);
