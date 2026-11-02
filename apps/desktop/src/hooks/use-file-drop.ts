import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";
import type { DroppedFiles } from "../lib/backend";
import { isDesktop } from "../lib/desktop";

/** A collection under the pointer that accepts dropped files. */
export interface DropTarget {
  shareId: string;
  rect: DOMRect;
}

export interface FileDrag {
  dragging: boolean;
  target: DropTarget | null;
}

/**
 * Finds the drop zone under a point. Elements mark themselves with
 * `data-drop-share="<share id>"`; the drag overlay ignores the pointer, so the
 * element underneath is what the user sees through it.
 */
function locate(x: number, y: number): DropTarget | null {
  const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-share]");
  const shareId = zone?.dataset.dropShare;
  return zone && shareId ? { shareId, rect: zone.getBoundingClientRect() } : null;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a?.shareId === b?.shareId &&
  a?.rect.x === b?.rect.x &&
  a?.rect.y === b?.rect.y &&
  a?.rect.width === b?.rect.width &&
  a?.rect.height === b?.rect.height;

/**
 * Window-wide file drop. The desktop build receives native paths from Tauri's
 * drag-drop events; the browser preview only receives names, sizes, and types.
 * `onDrop` receives the collection the files were dropped on, if any.
 */
export function useFileDrop(
  onDrop: (files: DroppedFiles, targetShareId: string | null) => void,
): FileDrag {
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const track = (next: DropTarget | null) =>
      setTarget((current) => (sameTarget(current, next) ? current : next));

    if (isDesktop()) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      // Tauri reports physical pixels relative to the webview.
      const at = (position: { x: number; y: number }) =>
        locate(position.x / window.devicePixelRatio, position.y / window.devicePixelRatio);
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter") {
            setDragging(payload.paths.length > 0);
            track(at(payload.position));
          } else if (payload.type === "over") track(at(payload.position));
          else if (payload.type === "leave") {
            setDragging(false);
            track(null);
          } else if (payload.type === "drop") {
            setDragging(false);
            track(null);
            if (payload.paths.length > 0)
              onDropRef.current(
                { kind: "paths", paths: payload.paths },
                at(payload.position)?.shareId ?? null,
              );
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch(() => {
          // Without the event permission the window simply doesn't accept drops.
        });
      return () => {
        disposed = true;
        unlisten?.();
      };
    }

    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      track(locate(e.clientX, e.clientY));
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setDragging(false);
        track(null);
      }
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      track(null);
      const files = Array.from(e.dataTransfer?.files ?? []).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      onDropRef.current({ kind: "preview", files }, locate(e.clientX, e.clientY)?.shareId ?? null);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return { dragging, target };
}
