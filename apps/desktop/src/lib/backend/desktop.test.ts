import { beforeEach, describe, expect, it, vi } from "vitest";
import { shareFixture, stagedFixture } from "../../test/fixtures";
import { emitBackend, invokeMock, resetTauri, respondToCommands } from "../../test/tauri";
import { DEFAULT_SETTINGS } from "./defaults";
import { createDesktopBackend } from "./desktop";
import { BackendError } from "./types";

beforeEach(resetTauri);

describe("desktop IPC contract", () => {
  it("passes only native paths to staging and only opaque handles to share creation", async () => {
    const share = shareFixture();
    respondToCommands({ stage_dropped: () => stagedFixture, create_shares: () => [share] });
    const backend = createDesktopBackend();
    const staged = await backend.stageDropped({ kind: "paths", paths: ["/synthetic/Example.pdf"] });
    const options = { lifetimeMinutes: 5, downloadLimit: 1 };
    expect(
      await backend.createShares(
        staged.files.map((file) => file.stageId),
        options,
        false,
      ),
    ).toEqual([share]);
    expect(invokeMock.mock.calls).toEqual([
      ["stage_dropped", { paths: ["/synthetic/Example.pdf"] }],
      ["create_shares", { stageIds: ["stage-test"], options, separate: false, password: null }],
    ]);
  });

  it("refuses browser file metadata in the desktop adapter", async () => {
    const backend = createDesktopBackend();
    await expect(
      backend.stageDropped({
        kind: "preview",
        files: [{ name: "Example.pdf", size: 1, type: "application/pdf" }],
      }),
    ).rejects.toThrow("Drop the files on the window again.");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("preserves native picker cancellation", async () => {
    invokeMock.mockResolvedValue(null);
    expect(await createDesktopBackend().pickFiles()).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("pick_files", undefined);
  });

  it.each([
    { status: "invented" },
    { downloadCount: -1 },
    { protected: "yes" },
    { files: [{ id: "file", name: "Example.pdf", byteSize: -1 }] },
  ])("rejects malformed share DTOs", async (patch) => {
    invokeMock.mockResolvedValue([{ ...shareFixture(), ...patch }]);
    await expect(createDesktopBackend().listShares()).rejects.toThrow(
      "Mayfly received unexpected data from its backend.",
    );
  });

  it("strips extra internal fields before they can reach UI state", async () => {
    const share = shareFixture();
    invokeMock.mockResolvedValue([
      {
        ...share,
        path: "/synthetic/private",
        files: share.files.map((file) => ({ ...file, path: "/synthetic/private" })),
      },
    ]);
    expect(await createDesktopBackend().listShares()).toEqual([share]);
  });

  it("keeps a user-safe Rust error but hides structured transport failures", async () => {
    const backend = createDesktopBackend();
    invokeMock.mockRejectedValueOnce("The selected port is already in use.");
    await expect(backend.updateSettings({ port: 9000 })).rejects.toEqual(
      new BackendError("The selected port is already in use."),
    );
    invokeMock.mockRejectedValueOnce({ path: "/synthetic/private", detail: "internal failure" });
    await expect(backend.updateSettings({ port: 9000 })).rejects.toEqual(
      new BackendError("Mayfly's backend didn't respond."),
    );
  });

  it("reports unavailable state when server IPC fails or its DTO is invalid", async () => {
    const backend = createDesktopBackend();
    invokeMock.mockRejectedValueOnce(new Error("internal failure"));
    expect(await backend.getServer()).toEqual({
      kind: "unavailable",
      message: "Mayfly can't reach its desktop backend.",
    });
    invokeMock.mockResolvedValueOnce({ kind: "online" });
    expect(await backend.getServer()).toEqual({
      kind: "unavailable",
      message: "Mayfly can't reach its desktop backend.",
    });
  });

  it("forwards validated change events and unsubscribes consumers", () => {
    const backend = createDesktopBackend();
    const listener = vi.fn();
    const unsubscribe = backend.subscribe(listener);
    emitBackend({ kind: "changed", topics: ["shares", "settings"] });
    emitBackend({ kind: "changed", topics: ["unknown"] });
    emitBackend({ kind: "quitRequested", activeShares: -1 });
    expect(listener.mock.calls).toEqual([[{ kind: "changed", topics: ["shares", "settings"] }]]);
    unsubscribe();
    emitBackend({ kind: "changed", topics: ["shares"] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("sends profile templates unchanged for Rust to resolve once", async () => {
    const template = "myapp://open?name={encodedFilename}&url={encodedUrl}";
    const preview = {
      ok: true,
      preview: "myapp://open?name=%C3%9C%20%7Burl%7D.pdf&url=http%3A%2F%2Fexample.invalid",
      customScheme: true,
    };
    respondToCommands({ preview_template: () => preview });
    expect(await createDesktopBackend().previewTemplate(template)).toEqual(preview);
    expect(invokeMock).toHaveBeenCalledWith("preview_template", { template });
  });

  it("uses the settings returned by Rust rather than the requested patch", async () => {
    const saved = { ...DEFAULT_SETTINGS, interfaceId: "resolved-interface" };
    respondToCommands({ update_settings: () => saved });
    expect(await createDesktopBackend().updateSettings({ interfaceId: null })).toEqual(saved);
    expect(invokeMock).toHaveBeenCalledWith("update_settings", { patch: { interfaceId: null } });
  });
});
