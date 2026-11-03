import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkSnapshot, inputHashes, prepareWebsite } from "./licenses.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "mayfly-notices-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["apps/desktop/src-tauri", "apps/website", "scripts", "licenses/overrides"])
    mkdirSync(join(root, dir), { recursive: true });
  const notices = "Copyright Example Authors\nExample license text.\n";
  for (const [name, text] of Object.entries({
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "package.json": '{"version":"0.8.0"}\n',
    "apps/desktop/package.json": '{"version":"0.8.0","dependencies":{"example":"1.0.0"}}\n',
    "apps/website/package.json": '{"version":"0.0.0"}\n',
    "apps/desktop/src-tauri/Cargo.toml": '[package]\nname = "mayfly"\nversion = "0.8.0"\n',
    "apps/desktop/src-tauri/Cargo.lock":
      '[[package]]\nname = "mayfly"\nversion = "0.8.0"\n\n[[package]]\nname = "dependency"\nversion = "1.0.0"\n',
    "scripts/licenses.mjs": "// generator fixture\n",
    "licenses/overrides.json": "{}\n",
    "licenses/THIRD_PARTY_NOTICES.txt": notices,
    LICENSE: "Mayfly license\n",
    NOTICE: "Mayfly copyright\n",
  }))
    writeFileSync(join(root, name), text);
  writeFileSync(
    join(root, "licenses/manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      inputs: inputHashes(root),
      noticeSha256: createHash("sha256").update(notices).digest("hex"),
      packages: [{ id: "npm:example@1.0.0" }],
    }),
  );
  return root;
}

test("dependency drift blocks delivery while an application-only release version does not", (t) => {
  const root = fixture(t);
  const lock = join(root, "apps/desktop/src-tauri/Cargo.lock");
  const original = readFileSync(lock, "utf8");
  writeFileSync(lock, original.replace('version = "0.8.0"', 'version = "0.9.0"'));
  writeFileSync(join(root, "package.json"), '{"version":"0.9.0"}\n');
  writeFileSync(
    join(root, "apps/desktop/package.json"),
    '{"version":"0.9.0","dependencies":{"example":"1.0.0"}}\n',
  );
  writeFileSync(
    join(root, "apps/desktop/src-tauri/Cargo.toml"),
    '[package]\nname = "mayfly"\nversion = "0.9.0"\n',
  );
  assert.doesNotThrow(() => checkSnapshot(root));
  writeFileSync(lock, original.replace('version = "1.0.0"', 'version = "1.1.0"'));
  assert.throws(() => prepareWebsite(root), /stale or modified/);
});

test("changed upstream texts and changed pnpm dependencies require a fresh review", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, "licenses/overrides/new.txt"), "Additional upstream terms\n");
  assert.throws(() => checkSnapshot(root), /stale or modified/);
  rmSync(join(root, "licenses/overrides/new.txt"));
  writeFileSync(join(root, "pnpm-lock.yaml"), "changed dependencies\n");
  assert.throws(() => checkSnapshot(root), /stale or modified/);
});

test("manifest dependency changes cannot reuse an old lockfile's notice snapshot", (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, "apps/desktop/package.json"),
    '{"version":"0.8.0","dependencies":{"different":"1.0.0"}}\n',
  );
  assert.throws(() => checkSnapshot(root), /stale or modified/);
});

test("website delivery keeps the reviewed legal texts byte-for-byte and rejects tampering", (t) => {
  const root = fixture(t);
  prepareWebsite(root);
  const target = join(root, "apps/website/public/licenses");
  for (const [source, name] of [
    ["LICENSE", "LICENSE.txt"],
    ["NOTICE", "NOTICE.txt"],
    ["licenses/THIRD_PARTY_NOTICES.txt", "THIRD_PARTY_NOTICES.txt"],
  ])
    assert.deepEqual(readFileSync(join(root, source)), readFileSync(join(target, name)));
  writeFileSync(join(root, "licenses/THIRD_PARTY_NOTICES.txt"), "truncated notice\n");
  assert.throws(() => prepareWebsite(root), /stale or modified/);
});
