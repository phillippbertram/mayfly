import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateRelease } from "../scripts/release.mjs";

export interface ReleaseAsset {
  target: "macos-arm64" | "macos-x64" | "windows-x64" | "linux-x64";
  format: string;
  sha256: string;
  minimumOs: string;
  url: string;
}
export interface Release {
  version: string;
  publishedAt: string;
  notesUrl: string;
  assets: ReleaseAsset[];
}
export function getRelease(): Release | null {
  const path = ".release/manifest.json";
  const manifest = validateRelease(JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")));
  return manifest.release as Release | null;
}
