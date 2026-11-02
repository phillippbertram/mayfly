import assert from "node:assert/strict";
import test from "node:test";
import { validateRelease } from "./release.mjs";

function fixture() {
  return {
    schemaVersion: 1,
    release: {
      version: "1.0.0",
      publishedAt: "2026-11-02T12:00:00Z",
      notesUrl: "https://github.com/example/filehop/releases/tag/v1.0.0",
      assets: [
        {
          target: "macos-arm64",
          format: "dmg",
          minimumOs: "the verified OS version",
          sha256: "a".repeat(64),
          url: "https://github.com/example/filehop/releases/download/v1.0.0/FileHop-arm64.dmg",
        },
      ],
    },
  };
}

test("an unavailable release is an explicit supported state", () => {
  assert.equal(validateRelease({ schemaVersion: 1, release: null }).release, null);
});
test("valid versioned release metadata is accepted", () =>
  assert.equal(validateRelease(fixture()).release.version, "1.0.0"));
test("untrusted or credential-bearing download URLs are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://github.com/example/filehop/a.dmg",
    "https://user:secret@github.com/example/filehop/a.dmg",
    "https://evil.example/file.dmg",
    "https://github.com/example/filehop/releases/download/v1.0.0/a.dmg?token=secret",
  ]) {
    const data = fixture();
    data.release.assets[0].url = url;
    assert.throws(() => validateRelease(data));
  }
});
test("missing checksums, invalid targets, mismatched extensions, and duplicate assets fail", () => {
  for (const mutation of [
    (data) => {
      data.release.assets[0].sha256 = "invalid";
    },
    (data) => {
      data.release.assets[0].target = "unknown";
    },
    (data) => {
      data.release.assets[0].format = "exe";
    },
    (data) => {
      data.release.assets.push(data.release.assets[0]);
    },
  ]) {
    const data = fixture();
    mutation(data);
    assert.throws(() => validateRelease(data));
  }
});
test("prereleases and empty release records cannot masquerade as stable downloads", () => {
  const pre = fixture();
  pre.release.version = "1.0.0-beta.1";
  assert.throws(() => validateRelease(pre));
  const empty = fixture();
  empty.release.assets = [];
  assert.throws(() => validateRelease(empty));
  assert.throws(() => validateRelease({ schemaVersion: 2, release: null }));
});

test("unknown fields cannot leak into the public release payload", () => {
  const data = fixture();
  data.release.privateCredential = "do-not-export";
  data.release.assets[0].privateCredential = "do-not-export";
  const output = validateRelease(data);
  assert.equal(JSON.stringify(output).includes("do-not-export"), false);
});
