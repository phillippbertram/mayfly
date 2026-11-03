import { getRelease } from "@/lib/release";
import { assetLabel, releaseDate, releasesUrl } from "@/lib/release-labels";

// Rendered at build time from the latest stable release. The website workflow
// rebuilds the site whenever a release is published.
export function ReleaseSummary() {
  const release = getRelease();
  if (!release)
    return (
      <p>
        No stable release is published yet. Test builds and pre-releases, when available, are listed
        on <a href={releasesUrl}>GitHub Releases</a>.
      </p>
    );
  return (
    <>
      <p>
        The current release is <strong>Mayfly {release.version}</strong>, published{" "}
        {releaseDate(release.publishedAt)}.
      </p>
      <ul>
        {release.assets.map((asset) => (
          <li key={`${asset.target}-${asset.format}`}>
            <a href={asset.url}>
              {assetLabel(asset)} (.{asset.format})
            </a>{" "}
            · requires {asset.minimumOs}
          </li>
        ))}
      </ul>
      <p>
        See the <a href={release.notesUrl}>release notes</a> for checksums and limitations, or{" "}
        <a href={releasesUrl}>all releases</a> for earlier versions.
      </p>
    </>
  );
}
