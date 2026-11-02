import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";
import type { DroppedFiles } from "../lib/backend";
import { isDesktop } from "../lib/desktop";

/** Where dropped files go: a new share, or the selected share. */
export type DropZone = "new" | "add";

export interface FileDrag {
  dragging: boolean;
  /** The zone under the pointer while dragging. */
  zone: DropZone;
}

/**
 * Window-wide file drop. The desktop build receives native paths from Tauri's
 * drag-drop events; the browser preview only receives names, sizes, and types.
 *
 * `zoneAt` maps the pointer's horizontal position (CSS pixels) to a zone. Zones
 * are large areas of the overlay, not individual elements, so the decision never
 * depends on hitting a row precisely and is the same in the browser and natively.
 */
export function useFileDrop(
  onDrop: (files: DroppedFiles, zone: DropZone) => void,
  zoneAt: (x: number) => DropZone,
): FileDrag {
  const [dragging, setDragging] = useState(false);
  const [zone, setZone] = useState<DropZone>("new");
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const zoneAtRef = useRef(zoneAt);
  zoneAtRef.current = zoneAt;

  useEffect(() => {
    const track = (x: number) => {
      const next = zoneAtRef.current(x);
      setZone(next);
      return next;
    };

    if (isDesktop()) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      // Tauri reports physical pixels relative to the webview.
      const cssX = (position: { x: number }) => position.x / window.devicePixelRatio;
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter") {
            setDragging(payload.paths.length > 0);
            track(cssX(payload.position));
          } else if (payload.type === "over") track(cssX(payload.position));
          else if (payload.type === "leave") setDragging(false);
          else if (payload.type === "drop") {
            setDragging(false);
            const at = track(cssX(payload.position));
            if (payload.paths.length > 0)
              onDropRef.current({ kind: "paths", paths: payload.paths }, at);
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
      track(e.clientX);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      track(e.clientX);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const at = track(e.clientX);
      const files = Array.from(e.dataTransfer?.files ?? []).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      onDropRef.current({ kind: "preview", files }, at);
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

  return { dragging, zone };
}
