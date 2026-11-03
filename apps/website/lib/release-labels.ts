import type { ReleaseAsset } from "./release";
import { repositoryUrl } from "./repository";

/** Every published release, including pre-releases the website does not list. */
export const releasesUrl = `${repositoryUrl}/releases`;

export function assetLabel(asset: Pick<ReleaseAsset, "target" | "format">): string {
  if (asset.target === "macos-arm64") return "Apple Silicon";
  if (asset.target === "macos-x64") return "Intel Mac";
  if (asset.format === "deb") return "Debian & Ubuntu";
  if (asset.format === "AppImage") return "Linux AppImage";
  return "Windows x64";
}

export function releaseDate(publishedAt: string): string {
  return new Date(publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
