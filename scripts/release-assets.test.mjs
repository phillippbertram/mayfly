import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assetName, assets, releaseDocuments } from "./release-assets.mjs";

const script = fileURLToPath(new URL("release-assets.mjs", import.meta.url));
const run = (...args) => execFileSync("node", [script, ...args], { stdio: "pipe" });

function assetDir(version) {
  const dir = mkdtempSync(join(tmpdir(), "mayfly-assets-"));
  for (const { target, format } of assets)
    writeFileSync(join(dir, assetName(version, target, format)), `${target}.${format}`);
  return dir;
}

test("collect copies one bundle per format under its release name", () => {
  const bundles = mkdtempSync(join(tmpdir(), "mayfly-bundle-"));
  mkdirSync(join(bundles, "appimage"));
  mkdirSync(join(bundles, "deb"));
  writeFileSync(join(bundles, "appimage", "Mayfly_0.9.0_amd64.AppImage"), "a");
  writeFileSync(join(bundles, "deb", "Mayfly_0.9.0_amd64.deb"), "d");
  const out = join(bundles, "out");
  run("collect", bundles, "linux-x64", "0.9.0", out);
  assert.deepEqual(readdirSync(out).sort(), [
    "Mayfly-0.9.0-linux-x64.AppImage",
    "Mayfly-0.9.0-linux-x64.deb",
  ]);
  writeFileSync(join(bundles, "deb", "Mayfly_0.8.0_amd64.deb"), "stale");
  run("collect", bundles, "linux-x64", "0.9.0", out);
  assert.equal(readFileSync(join(out, "Mayfly-0.9.0-linux-x64.deb"), "utf8"), "d");
  writeFileSync(join(bundles, "deb", "Mayfly_0.9.0_arm64.deb"), "other");
  assert.throws(() => run("collect", bundles, "linux-x64", "0.9.0", out));
});

test("finalize writes checksums and a manifest the website accepts", () => {
  const dir = assetDir("0.9.0");
  run("finalize", dir, "0.9.0", "owner/repo");
  const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
  assert.equal(sums.length, assets.length + releaseDocuments.length);
  for (const document of releaseDocuments) {
    const content = readFileSync(join(dir, document.name));
    assert.ok(sums.includes(`${createHash("sha256").update(content).digest("hex")}  ${document.name}`));
  }
  assert.match(readFileSync(join(dir, "INSTALLATION.md"), "utf8"), /Open Anyway/);
  assert.match(readFileSync(join(dir, "THIRD_PARTY_NOTICES.txt"), "utf8"), /Bricolage/);
  const manifest = JSON.parse(readFileSync(join(dir, "mayfly-release.json"), "utf8"));
  assert.equal(manifest.release.version, "0.9.0");
  assert.equal(manifest.release.notesUrl, "https://github.com/owner/repo/releases/tag/v0.9.0");
  const mac = manifest.release.assets.find((item) => item.target === "macos-arm64");
  assert.equal(
    mac.url,
    "https://github.com/owner/repo/releases/download/v0.9.0/Mayfly-0.9.0-macos-arm64.dmg",
  );
  assert.equal(mac.sha256, createHash("sha256").update("macos-arm64.dmg").digest("hex"));
  assert.ok(sums.includes(`${mac.sha256}  Mayfly-0.9.0-macos-arm64.dmg`));
});

test("finalize refuses an incomplete or unexpected asset set", () => {
  const missing = assetDir("0.9.0");
  rmSync(join(missing, "Mayfly-0.9.0-windows-x64.exe"));
  assert.throws(() => run("finalize", missing, "0.9.0", "owner/repo"));
  const extra = assetDir("0.9.0");
  writeFileSync(join(extra, "notes.txt"), "x");
  assert.throws(() => run("finalize", extra, "0.9.0", "owner/repo"));
});

test("pre-releases get checksums but no website manifest", () => {
  const dir = assetDir("0.9.0-beta.1");
  run("finalize", dir, "0.9.0-beta.1", "owner/repo");
  const names = readdirSync(dir);
  assert.ok(names.includes("SHA256SUMS"));
  assert.ok(names.includes("THIRD_PARTY_NOTICES.txt"));
  assert.ok(!names.includes("mayfly-release.json"));
});
