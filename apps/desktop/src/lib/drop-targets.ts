/**
 * Where files dragged over the window would go. Elements opt in with
 * `data-drop-share="<share id>"`: active share rows in the list, and the
 * inspector panel (also marked `data-drop-inspector`) for the share it shows.
 * Everything else creates a new share.
 */
export type DropTarget =
  | { kind: "new" }
  | { kind: "add"; shareId: string; area: "row" | "inspector"; rect: DOMRect };

const NEW: DropTarget = { kind: "new" };

/**
 * Resolves a point in CSS pixels. Rows are resolved by band rather than by the
 * element under the pointer: the gap between two rows is split between them, so
 * moving down the list never falls through to "new" for a few pixels.
 */
export function dropTargetAt(x: number, y: number): DropTarget {
  for (const panel of document.querySelectorAll<HTMLElement>("[data-drop-inspector]")) {
    const rect = panel.getBoundingClientRect();
    const shareId = panel.dataset.dropShare;
    if (shareId && contains(rect, x, y)) return { kind: "add", shareId, area: "inspector", rect };
  }

  const rows = [...document.querySelectorAll<HTMLElement>("[data-drop-share]")]
    .filter((el) => !("dropInspector" in el.dataset))
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height > 0)
    .sort((a, b) => a.rect.top - b.rect.top);
  for (const [i, { el, rect }] of rows.entries()) {
    if (x < rect.left || x > rect.right) continue;
    const previous = rows[i - 1]?.rect;
    const next = rows[i + 1]?.rect;
    const top =
      previous && previous.bottom <= rect.top ? (previous.bottom + rect.top) / 2 : rect.top;
    const bottom = next && next.top >= rect.bottom ? (rect.bottom + next.top) / 2 : rect.bottom;
    const shareId = el.dataset.dropShare;
    if (shareId && y >= top && y <= bottom) return { kind: "add", shareId, area: "row", rect };
  }
  return NEW;
}

export function sameDropTarget(a: DropTarget, b: DropTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "new" || b.kind === "new") return true;
  return (
    a.shareId === b.shareId &&
    a.area === b.area &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
}

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
