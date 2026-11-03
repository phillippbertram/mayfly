/**
 * Plays scripted scenes against the real interface: a drawn cursor moves to
 * elements found by their accessible name and clicks them like a user would.
 */
import type { PreviewControls } from "../lib/backend/preview";

export interface Ctx {
  signal: AbortSignal;
  preview: PreviewControls;
}
export type Step = (ctx: Ctx) => Promise<void>;

interface Target {
  /** Accessible name: `aria-label`, else visible text without keyboard hints. */
  name: string | RegExp;
  role?: string;
  /** Limits the search to a container, e.g. `dialog[open]`. */
  within?: string;
}

const CANDIDATES =
  'button, a, input, [role="button"], [role="radio"], [role="switch"], [role="tab"]';

export class Aborted extends Error {}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Aborted());
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Aborted());
    });
  });
}

function nameOf(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label) return label.trim();
  const clone = element.cloneNode(true) as Element;
  for (const hint of clone.querySelectorAll("kbd, [aria-hidden='true']")) hint.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

function matches(element: Element, { name, role }: Target): boolean {
  if (role && element.getAttribute("role") !== role) return false;
  if (element.closest("[aria-hidden='true'], [inert]")) return false;
  if (!element.getClientRects().length) return false;
  const actual = nameOf(element);
  return typeof name === "string" ? actual === name : name.test(actual);
}

async function find(target: Target, ctx: Ctx): Promise<HTMLElement> {
  for (let elapsed = 0; elapsed < 5000; elapsed += 100) {
    const roots = target.within ? [...document.querySelectorAll(target.within)] : [document];
    for (const root of roots)
      for (const element of root.querySelectorAll<HTMLElement>(CANDIDATES))
        if (matches(element, target)) return element;
    await sleep(100, ctx.signal);
  }
  throw new Error(`Demo target not found: ${String(target.name)}`);
}

let cursor: HTMLElement | null = null;
let position = { x: 0, y: 0 };

function cursorElement(): HTMLElement {
  if (cursor) return cursor;
  cursor = document.createElement("div");
  cursor.className = "demo-cursor";
  // A popover shares the top layer with modal dialogs, so the cursor stays visible.
  cursor.popover = "manual";
  cursor.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5 19.5 13l-7 1.2-3.6 6.3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.body.append(cursor);
  return cursor;
}

/** Re-enters the top layer above any dialog opened since. */
function raise(element: HTMLElement) {
  if (element.matches(":popover-open")) element.hidePopover();
  element.showPopover();
}

/** Puts the cursor at a resting point near the lower right of the window. */
export function resetCursor() {
  position = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.82 };
  const element = cursorElement();
  for (const animation of element.getAnimations()) animation.cancel();
  element.style.transform = `translate(${position.x}px, ${position.y}px)`;
  element.style.opacity = "0";
}

async function moveTo(element: HTMLElement, ctx: Ctx) {
  const rect = element.getBoundingClientRect();
  const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const distance = Math.hypot(to.x - position.x, to.y - position.y);
  const duration = Math.min(900, 280 + distance * 0.7);
  const node = cursorElement();
  raise(node);
  node.style.opacity = "1";
  node.animate(
    [
      { transform: `translate(${position.x}px, ${position.y}px)` },
      { transform: `translate(${to.x}px, ${to.y}px)` },
    ],
    { duration, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards" },
  );
  position = to;
  await sleep(duration + 120, ctx.signal);
}

function pulse() {
  const ring = document.createElement("span");
  ring.className = "demo-click";
  ring.popover = "manual";
  ring.style.transform = `translate(${position.x}px, ${position.y}px)`;
  document.body.append(ring);
  ring.showPopover();
  setTimeout(() => ring.remove(), 600);
}

export const wait =
  (ms: number): Step =>
  (ctx) =>
    sleep(ms, ctx.signal);

export const click =
  (name: Target["name"], options: Omit<Target, "name"> = {}): Step =>
  async (ctx) => {
    const element = await find({ name, ...options }, ctx);
    await moveTo(element, ctx);
    pulse();
    element.click();
    await sleep(350, ctx.signal);
  };

export const hover =
  (name: Target["name"], options: Omit<Target, "name"> = {}): Step =>
  async (ctx) => {
    await moveTo(await find({ name, ...options }, ctx), ctx);
  };

/** Types into a focused text field the way React expects from real input. */
export const type =
  (text: string, { clear = false } = {}): Step =>
  async (ctx) => {
    const field = document.activeElement;
    if (!(field instanceof HTMLInputElement)) throw new Error("Demo: no focused text field.");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    let value = clear ? "" : field.value;
    if (clear) {
      setValue?.call(field, "");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const char of text) {
      value += char;
      setValue?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(55 + Math.random() * 45, ctx.signal);
    }
  };

export const press =
  (key: string): Step =>
  async (ctx) => {
    const target = document.activeElement ?? document.body;
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
    await sleep(250, ctx.signal);
  };

export const download: Step = async (ctx) => {
  ctx.preview.simulateDownload();
  await sleep(200, ctx.signal);
};

export const hideCursor: Step = async (ctx) => {
  cursorElement().style.opacity = "0";
  await sleep(200, ctx.signal);
};

export async function play(steps: Step[], ctx: Ctx) {
  resetCursor();
  for (const step of steps) await step(ctx);
}
