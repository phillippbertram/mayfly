const targets = new Set(["macos-arm64", "macos-x64", "windows-x64", "linux-x64"]);
const formats = { macos: ["dmg"], windows: ["exe", "msi"], linux: ["AppImage", "deb"] };

function publicUrl(value) {
  if (typeof value !== "string") throw new Error("Release URLs must be strings.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["github.com", "objects.githubusercontent.com"].includes(url.hostname)
  )
    throw new Error(
      "Release URLs must be public HTTPS GitHub URLs without credentials or query parameters.",
    );
  return value;
}

export function validateRelease(data) {
  if (data?.schemaVersion !== 1 || !("release" in data))
    throw new Error("Unsupported release manifest.");
  if (data.release === null) return { schemaVersion: 1, release: null };
  const release = data.release;
  if (!/^\d+\.\d+\.\d+$/.test(release.version) || !Number.isFinite(Date.parse(release.publishedAt)))
    throw new Error("A stable version and publication date are required.");
  publicUrl(release.notesUrl);
  if (!Array.isArray(release.assets) || release.assets.length === 0)
    throw new Error("Release assets are required.");
  const seen = new Set();
  for (const asset of release.assets) {
    if (!targets.has(asset.target) || !formats[asset.target?.split("-")[0]]?.includes(asset.format))
      throw new Error("Unknown release target or format.");
    const key = `${asset.target}:${asset.format}`;
    if (seen.has(key)) throw new Error("Duplicate release asset.");
    seen.add(key);
    if (
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      typeof asset.minimumOs !== "string" ||
      !asset.minimumOs.trim()
    )
      throw new Error("Checksums and verified minimum OS versions are required.");
    const url = new URL(publicUrl(asset.url));
    if (
      url.hostname !== "github.com" ||
      !/^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/.test(url.pathname)
    )
      throw new Error("Asset must point to a versioned GitHub release download.");
    if (!url.pathname.endsWith(`.${asset.format}`))
      throw new Error("Asset extension does not match its format.");
  }
  return {
    schemaVersion: 1,
    release: {
      version: release.version,
      publishedAt: release.publishedAt,
      notesUrl: release.notesUrl,
      assets: release.assets.map(({ target, format, minimumOs, sha256, url }) => ({
        target,
        format,
        minimumOs,
        sha256,
        url,
      })),
    },
  };
}
