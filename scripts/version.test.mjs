import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compareVersions, files, isVersion, readVersion, writeVersion } from "./version.mjs";

test("accepts SemVer 0.x and YY.M.N versions", () => {
  for (const version of ["0.8.0", "0.10.2", "26.11.0", "27.1.3", "0.9.0-beta.1", "27.3.0-rc.2"])
    assert.ok(isVersion(version), version);
});

test("rejects leading zeros, missing parts, prefixes, and build metadata", () => {
  for (const version of ["27.01.0", "0.8", "v0.8.0", "0.8.0+build.1", "0.8.0-01", "0.8.0-", ""])
    assert.ok(!isVersion(version), version);
});

test("orders versions by SemVer precedence", () => {
  const ordered = [
    "0.8.0",
    "0.9.0-beta.1",
    "0.9.0-beta.2",
    "0.9.0-rc.1",
    "0.9.0",
    "0.10.0",
    "26.12.0",
    "27.1.0",
  ];
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(compareVersions(ordered[i - 1], ordered[i]) < 0, `${ordered[i - 1]} < ${ordered[i]}`);
    assert.ok(compareVersions(ordered[i], ordered[i - 1]) > 0, `${ordered[i]} > ${ordered[i - 1]}`);
  }
  assert.equal(compareVersions("0.9.0", "0.9.0"), 0);
});

test("finds every declaration in the workspace", () => {
  const versions = files.map(({ path, pattern }) =>
    readVersion(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), pattern),
  );
  assert.equal(new Set(versions).size, 1);
});

test("rewrites only the package version in Cargo files", () => {
  const cargo = files.find(({ path }) => path.endsWith("Cargo.toml")).pattern;
  const toml =
    '[package]\nname = "mayfly"\nversion = "0.8.0"\n\n[dependencies]\nfoo = { version = "1.0.0" }\n';
  assert.equal(
    writeVersion(toml, cargo, "0.9.0"),
    '[package]\nname = "mayfly"\nversion = "0.9.0"\n\n[dependencies]\nfoo = { version = "1.0.0" }\n',
  );
  const lock = files.find(({ path }) => path.endsWith("Cargo.lock")).pattern;
  const lockfile =
    '[[package]]\nname = "filedescriptor"\nversion = "0.8.0"\n\n[[package]]\nname = "mayfly"\nversion = "0.8.0"\n';
  assert.equal(
    writeVersion(lockfile, lock, "0.9.0"),
    '[[package]]\nname = "filedescriptor"\nversion = "0.8.0"\n\n[[package]]\nname = "mayfly"\nversion = "0.9.0"\n',
  );
  assert.throws(() => writeVersion("[dependencies]\n", cargo, "0.9.0"));
});
