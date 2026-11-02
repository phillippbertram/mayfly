import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";
import type { DroppedFiles } from "../lib/backend";
import { isDesktop } from "../lib/desktop";
import { type DropTarget, dropTargetAt, sameDropTarget } from "../lib/drop-targets";
import { isWindows } from "../lib/platform";

export interface FileDrag {
  dragging: boolean;
  /** What a drop at the pointer would do. */
  target: DropTarget;
}

/**
 * Converts a native drag position to CSS pixels. Tauri labels it physical, but
 * wry passes the platform's own units through: AppKit points on macOS and GTK
 * widget coordinates on Linux are already logical; only WebView2 on Windows
 * reports device pixels.
 */
function cssPoint(position: { x: number; y: number }): { x: number; y: number } {
  const scale = isWindows ? window.devicePixelRatio : 1;
  return { x: position.x / scale, y: position.y / scale };
}

/**
 * Window-wide file drop. The desktop build receives native paths from Tauri's
 * drag-drop events; the browser preview only receives names, sizes, and types.
 * Dropping on an active share's row or on the inspector adds to that share;
 * anywhere else creates a new one (see `dropTargetAt`).
 */
export function useFileDrop(onDrop: (files: DroppedFiles, target: DropTarget) => void): FileDrag {
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<DropTarget>({ kind: "new" });
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const track = (x: number, y: number) => {
      const next = dropTargetAt(x, y);
      setTarget((current) => (sameDropTarget(current, next) ? current : next));
      return next;
    };

    if (isDesktop()) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      const at = (position: { x: number; y: number }) => {
        const { x, y } = cssPoint(position);
        return track(x, y);
      };
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter") {
            setDragging(payload.paths.length > 0);
            at(payload.position);
          } else if (payload.type === "over") at(payload.position);
          else if (payload.type === "leave") setDragging(false);
          else if (payload.type === "drop") {
            setDragging(false);
            const dropped = at(payload.position);
            if (payload.paths.length > 0)
              onDropRef.current({ kind: "paths", paths: payload.paths }, dropped);
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
      track(e.clientX, e.clientY);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      track(e.clientX, e.clientY);
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
      const dropped = track(e.clientX, e.clientY);
      const files = Array.from(e.dataTransfer?.files ?? []).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      onDropRef.current({ kind: "preview", files }, dropped);
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
