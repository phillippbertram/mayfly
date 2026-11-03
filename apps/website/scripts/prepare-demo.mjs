// Builds the desktop interface's scripted demo (apps/desktop/src/demo) and copies it
// to public/demo, where the product page embeds it.
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const desktop = fileURLToPath(new URL("../../desktop/", import.meta.url));
const target = fileURLToPath(new URL("../public/demo/", import.meta.url));

execFileSync("pnpm", ["run", "build:demo"], {
  cwd: desktop,
  stdio: "inherit",
  shell: process.platform === "win32",
});
rmSync(target, { recursive: true, force: true });
cpSync(`${desktop}dist-demo`, target, { recursive: true });
console.log("Prepared the product demo in public/demo.");
