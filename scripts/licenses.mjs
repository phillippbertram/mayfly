// Refs #13: collect upstream notices once; builds verify and ship the reviewed snapshot offline.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const repository = fileURLToPath(new URL("../", import.meta.url));
const noticePath = "licenses/THIRD_PARTY_NOTICES.txt";
const manifestPath = "licenses/manifest.json";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// These are native compiler/image-processing tools, never copied into either static frontend.
// Keep their JS wrappers in the inventory; no .node binaries or Node runtime are distributed.
const nativeBuildTool =
  /^(?:@esbuild\/|@rolldown\/binding-|@yuku-core\/binding-|@tailwindcss\/oxide-|@next\/swc-|@img\/|lightningcss-|@emnapi\/)/;
const noticeName = /^(?:licen[cs]es?|notice|copying|copyright|authors)(?:[._-]|$)/i;

export function inputHashes(root) {
  const files = [
    "pnpm-lock.yaml",
    "package.json",
    "apps/desktop/package.json",
    "apps/website/package.json",
    "apps/desktop/src-tauri/Cargo.lock",
    "apps/desktop/src-tauri/Cargo.toml",
    "scripts/licenses.mjs",
    "licenses/overrides.json",
    ...readdirSync(join(root, "licenses/overrides")).map((name) => `licenses/overrides/${name}`),
  ].sort(compare);
  return Object.fromEntries(
    files.map((name) => {
      let content = readFileSync(join(root, name), "utf8");
      if (name.endsWith("package.json")) {
        const pkg = JSON.parse(content);
        content = JSON.stringify({
          dependencies: pkg.dependencies,
          devDependencies: pkg.devDependencies,
          optionalDependencies: pkg.optionalDependencies,
          peerDependencies: pkg.peerDependencies,
        });
      }
      // A release changes the first-party version, not its third-party dependencies.
      if (name.endsWith("Cargo.lock"))
        content = content.replace(
          /(\[\[package\]\]\r?\nname = "mayfly"\r?\nversion = ")[^"]+("\r?\n)/,
          "$1<application-version>$2",
        );
      if (name.endsWith("Cargo.toml"))
        content = content.replace(/^(version\s*=\s*")[^"]+(".*)$/m, "$1<application-version>$2");
      return [name, digest(content)];
    }),
  );
}

export function checkSnapshot(root = repository) {
  const manifest = json(join(root, manifestPath));
  if (
    manifest.schemaVersion !== 1 ||
    JSON.stringify(manifest.inputs) !== JSON.stringify(inputHashes(root)) ||
    manifest.noticeSha256 !== digest(readFileSync(join(root, noticePath)))
  ) {
    throw new Error(
      "Third-party notices are stale or modified. Run pnpm licenses:generate and review the changes.",
    );
  }
  return manifest;
}

export function prepareWebsite(root = repository) {
  checkSnapshot(root);
  const target = join(root, "apps/website/public/licenses");
  mkdirSync(target, { recursive: true });
  for (const [source, name] of [
    ["LICENSE", "LICENSE.txt"],
    ["NOTICE", "NOTICE.txt"],
    [noticePath, "THIRD_PARTY_NOTICES.txt"],
  ])
    cpSync(join(root, source), join(target, name));
}

function licenseFiles(root) {
  const files = [];
  function walk(dir, insideLicenses = false) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "target"].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      const selected = noticeName.test(entry.name);
      if (entry.isDirectory()) walk(path, insideLicenses || selected);
      else if (entry.isFile() && (selected || insideLicenses)) {
        // Match the repository's LF checkout policy so snapshot hashes survive Git checkout.
        const text = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
        if (text.trim() && !text.includes("\0"))
          files.push({ file: relative(root, path).replaceAll("\\", "/"), text });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => compare(a.file, b.file));
}

export function generate(root = repository) {
  const overrides = json(join(root, "licenses/overrides.json"));
  const packages = new Map();
  const documents = new Map();
  const missing = [];

  function add(ecosystem, name, version, license, source, dir, scopes) {
    const id = `${ecosystem}:${name}@${version}`;
    const existing = packages.get(id);
    if (existing) {
      existing.scopes = [...new Set([...existing.scopes, ...scopes])].sort(compare);
      return;
    }
    if (!license || !source || !dir || !existsSync(dir)) {
      missing.push(`${id}: missing installed package or license metadata`);
      return;
    }
    const files = licenseFiles(dir);
    for (const override of overrides[id] ?? [])
      files.push({
        file: override.source,
        text: readFileSync(join(root, "licenses", override.file), "utf8"),
      });
    if (!files.length) {
      missing.push(`${id}: no license text; add a reviewed, version-specific upstream override`);
      return;
    }
    const entry = { id, license, source, scopes: [...scopes].sort(compare), notices: [] };
    for (const { file, text } of files) {
      const sha256 = digest(text);
      if (!documents.has(sha256)) documents.set(sha256, { text, uses: [] });
      documents.get(sha256).uses.push({ id, file });
      entry.notices.push(sha256);
    }
    packages.set(id, entry);
  }

  const projects = JSON.parse(
    execFileSync("pnpm", ["list", "--recursive", "--prod", "--depth", "Infinity", "--json"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === "win32",
    }),
  );
  for (const project of projects) {
    if (!["@mayfly/desktop", "@mayfly/website"].includes(project.name)) continue;
    const scopes = project.name === "@mayfly/desktop" ? ["desktop", "website"] : ["website"];
    function visit(dependencies) {
      for (const [key, dependency] of Object.entries(dependencies ?? {})) {
        const name = dependency.name ?? key;
        if (!nativeBuildTool.test(name)) {
          const path = join(dependency.path, "package.json");
          if (!existsSync(path)) missing.push(`npm:${name}@${dependency.version}: not installed`);
          else {
            const pkg = json(path);
            add(
              "npm",
              name,
              pkg.version,
              pkg.license,
              dependency.resolved,
              dependency.path,
              scopes,
            );
          }
        }
        visit(dependency.dependencies);
        visit(dependency.optionalDependencies);
      }
    }
    visit(project.dependencies);
    visit(project.optionalDependencies);
  }

  // No --filter-platform: include the complete locked graph, including platform-specific crates.
  const cargo = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--manifest-path",
        "apps/desktop/src-tauri/Cargo.toml",
        "--locked",
        "--format-version",
        "1",
      ],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "inherit"],
      },
    ),
  );
  for (const pkg of cargo.packages.filter((pkg) => pkg.source)) {
    if (!pkg.source.startsWith("registry+https://github.com/rust-lang/crates.io-index"))
      throw new Error(
        `Review the source and licensing of ${pkg.name} before adding a non-crates.io dependency.`,
      );
    add(
      "crate",
      pkg.name,
      pkg.version,
      pkg.license,
      `https://crates.io/api/v1/crates/${pkg.name}/${pkg.version}/download`,
      dirname(pkg.manifest_path),
      ["desktop"],
    );
  }
  if (missing.length) throw new Error([...new Set(missing)].sort(compare).join("\n"));

  const entries = [...packages.values()].sort((a, b) => compare(a.id, b.id));
  let text = "MAYFLY — THIRD-PARTY NOTICES\n\n";
  text += "Mayfly is licensed under Apache-2.0. Third-party components retain their own terms.\n";
  text += "This combined inventory covers the desktop app and the static website, including its\n";
  text += "embedded desktop demo and self-hosted font. It deliberately includes some build/test\n";
  text += "dependencies and crates for other platforms; listing does not imply all are shipped.\n";
  text += "Native npm build tools are excluded: their executables are not distributed.\n\n";
  text += "Package source links below provide the original published source distributions.\n";
  text +=
    "Third-party source files are used without local modifications. For MPL-2.0 components,\n";
  text += "the corresponding Source Code Form is available from each component's source link.\n";
  text += "OS frameworks, system libraries, and installer-added components require a separate\n";
  text +=
    "artifact inventory before distribution; see docs/licensing.md in the source repository.\n\n";
  text += "COMPONENT INVENTORY\n===================\n\n";
  for (const entry of entries)
    text += `${entry.id}\nLicense: ${entry.license}\nUsed by: ${entry.scopes.join(", ")}\nSource: ${entry.source}\n\n`;
  text += "UPSTREAM COPYRIGHT AND LICENSE TEXTS\n====================================\n";
  const sortedDocuments = [...documents.values()].sort((a, b) =>
    compare(a.uses[0].id, b.uses[0].id),
  );
  for (const document of sortedDocuments) {
    text += "\n-------------------------------------------------------------------------------\n";
    for (const use of document.uses.sort((a, b) => compare(a.id + a.file, b.id + b.file)))
      text += `${use.id} — ${use.file}\n`;
    text += `\n${document.text}\n`;
  }
  writeFileSync(join(root, noticePath), text);
  const manifest = {
    schemaVersion: 1,
    inputs: inputHashes(root),
    noticeSha256: digest(text),
    packages: entries,
  };
  writeFileSync(join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Collected ${entries.length} components and ${documents.size} upstream notice texts.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const action = process.argv[2];
    if (action === "generate") generate();
    else if (action === "check") {
      const manifest = checkSnapshot();
      console.log(`Verified notices for ${manifest.packages.length} components.`);
    } else if (action === "prepare-website") prepareWebsite();
    else throw new Error("Usage: node scripts/licenses.mjs generate|check|prepare-website");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
