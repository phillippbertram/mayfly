import { isDesktop } from "../desktop";
import { createDesktopBackend } from "./desktop";
import type { Backend } from "./types";

export type * from "./types";

/**
 * The desktop build always talks to Rust. Only a plain browser preview loads the
 * sample-data simulator, as a separate chunk the desktop never requests.
 */
export async function createBackend(): Promise<Backend> {
  if (isDesktop()) return createDesktopBackend();
  const { createPreviewBackend } = await import("./preview");
  return createPreviewBackend();
}
