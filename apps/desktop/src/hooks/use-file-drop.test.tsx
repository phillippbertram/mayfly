import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { emitDrop, resetTauri, unlistenDropMock } from "../test/tauri";
import { useFileDrop } from "./use-file-drop";

beforeEach(resetTauri);

it("tracks native enter/leave, ignores empty drops, and uses the latest callback", async () => {
  const initial = vi.fn();
  const latest = vi.fn();
  const position = new PhysicalPosition(400, 300);
  const { result, rerender, unmount } = renderHook(({ onDrop }) => useFileDrop(onDrop), {
    initialProps: { onDrop: initial },
  });
  act(() => emitDrop({ type: "enter", paths: ["/synthetic/Example.pdf"], position }));
  expect(result.current.dragging).toBe(true);
  act(() => emitDrop({ type: "leave" }));
  expect(result.current.dragging).toBe(false);
  act(() => emitDrop({ type: "drop", paths: [], position }));
  expect(initial).not.toHaveBeenCalled();
  rerender({ onDrop: latest });
  act(() => emitDrop({ type: "drop", paths: ["/synthetic/Example.pdf"], position }));
  expect(latest).toHaveBeenCalledWith(
    { kind: "paths", paths: ["/synthetic/Example.pdf"] },
    { kind: "new" },
  );
  expect(initial).not.toHaveBeenCalled();
  // Registration resolves asynchronously, including when the component unmounts first.
  unmount();
  await waitFor(() => expect(unlistenDropMock).toHaveBeenCalledOnce());
  emitDrop({ type: "drop", paths: ["/synthetic/Example.pdf"], position });
  expect(latest).toHaveBeenCalledOnce();
});
