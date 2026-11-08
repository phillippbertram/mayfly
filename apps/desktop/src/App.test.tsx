import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { Share } from "./lib/backend";
import { DEFAULT_SETTINGS } from "./lib/backend/defaults";
import { createDesktopBackend } from "./lib/backend/desktop";
import { useUi } from "./store/ui";
import { shareFixture, stagedFixture } from "./test/fixtures";
import { emitBackend, emitDrop, invokeMock, resetTauri, respondToCommands } from "./test/tauri";

beforeEach(() => {
  resetTauri();
  useUi.setState(useUi.getInitialState(), true);
});

function startApp() {
  const user = userEvent.setup();
  render(<App backend={createDesktopBackend()} />);
  return user;
}

function linkControls() {
  const container = screen.getByRole("textbox", { name: "Share link" }).parentElement;
  if (!container) throw new Error("Share link must have a copy control.");
  return within(container);
}

async function chooseFiles(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /Choose files/ })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: /Choose files/ }));
}

describe("sharing through the desktop IPC boundary", () => {
  it("confirms selected files before creating a share and shows Rust's returned link", async () => {
    const created = shareFixture();
    let shares: Share[] = [];
    respondToCommands({
      pick_files: () => stagedFixture,
      list_shares: () => shares,
      create_shares: () => {
        shares = [created];
        return shares;
      },
    });
    const user = startApp();
    await chooseFiles(user);
    const composer = await screen.findByRole("dialog", { name: "Share 1 file" });
    expect(invokeMock.mock.calls.some(([command]) => command === "create_shares")).toBe(false);
    await user.click(within(composer).getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("create_shares", {
        stageIds: ["stage-test"],
        options: { lifetimeMinutes: 10, downloadLimit: null },
        separate: false,
        password: null,
      }),
    );
    expect(await screen.findByRole("textbox", { name: "Share link" })).toHaveValue(created.link);
    expect(
      within(await screen.findByRole("list", { name: "Active shares" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Share 1 file" })).not.toBeInTheDocument(),
    );
  });

  it("does nothing when the native picker is cancelled", async () => {
    respondToCommands({ pick_files: () => null });
    const user = startApp();
    await chooseFiles(user);
    expect(invokeMock).toHaveBeenCalledWith("pick_files", undefined);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invokeMock.mock.calls.some(([command]) => command === "create_shares")).toBe(false);
  });

  it("releases staged handles when the composer is cancelled", async () => {
    respondToCommands({ pick_files: () => stagedFixture, discard_staged: () => null });
    const user = startApp();
    await chooseFiles(user);
    const composer = await screen.findByRole("dialog", { name: "Share 1 file" });
    await user.click(within(composer).getByRole("button", { name: "Cancel" }));
    expect(invokeMock).toHaveBeenCalledWith("discard_staged", { stageIds: ["stage-test"] });
    expect(invokeMock.mock.calls.some(([command]) => command === "create_shares")).toBe(false);
  });

  it("stages native drops, reports rejected items, and uses defaults for immediate sharing", async () => {
    let shares: Share[] = [];
    respondToCommands({
      get_settings: () => ({
        ...DEFAULT_SETTINGS,
        confirmBeforeSharing: false,
        defaultLifetimeMinutes: 30,
        defaultDownloadLimit: 3,
      }),
      stage_dropped: () => ({
        ...stagedFixture,
        rejected: [{ name: "Example folder", reason: "Choose regular files." }],
      }),
      list_shares: () => shares,
      create_shares: () => {
        shares = [shareFixture()];
        return shares;
      },
    });
    startApp();
    await waitFor(() => expect(screen.getByRole("button", { name: /Choose files/ })).toBeEnabled());
    act(() =>
      emitDrop({
        type: "drop",
        paths: ["/synthetic/Example.pdf", "/synthetic/folder"],
        position: new PhysicalPosition(500, 400),
      }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("stage_dropped", {
        paths: ["/synthetic/Example.pdf", "/synthetic/folder"],
      }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("create_shares", {
        stageIds: ["stage-test"],
        options: { lifetimeMinutes: 30, downloadLimit: 3 },
        separate: false,
        password: null,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Example folder: Choose regular files.",
    );
    expect(await screen.findByRole("textbox", { name: "Share link" })).toHaveValue(
      "http://example.invalid/s/test",
    );
  });

  it("adds a drop on an active row to that share without creating a new one", async () => {
    const share = shareFixture();
    respondToCommands({
      list_shares: () => [share],
      stage_dropped: () => stagedFixture,
      add_files: () => share,
    });
    startApp();
    const list = await screen.findByRole("list", { name: "Active shares" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
    const row = list.querySelector<HTMLElement>("[data-drop-share]");
    if (!row) throw new Error("Active row must advertise a drop target.");
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 300, 80));
    act(() =>
      emitDrop({
        type: "drop",
        paths: ["/synthetic/Example.pdf"],
        position: new PhysicalPosition(50, 50),
      }),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("add_files", {
        id: share.id,
        stageIds: ["stage-test"],
      }),
    );
    expect(invokeMock.mock.calls.some(([command]) => command === "create_shares")).toBe(false);
  });

  it("keeps the composer and displays a safe error when creating a share fails", async () => {
    respondToCommands({
      pick_files: () => stagedFixture,
      create_shares: () => Promise.reject("The selected file is no longer available."),
    });
    const user = startApp();
    await chooseFiles(user);
    const composer = await screen.findByRole("dialog", { name: "Share 1 file" });
    await user.click(within(composer).getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected file is no longer available.",
    );
    expect(composer).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Share" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Share link" })).not.toBeInTheDocument();
  });

  it("copies a link and reflects revocation only after the backend state changes", async () => {
    let share = shareFixture();
    respondToCommands({ list_shares: () => [share], stop_share: () => null });
    const user = startApp();
    await screen.findByRole("textbox", { name: "Share link" });
    await user.click(
      within(screen.getByRole("list", { name: "Active shares" })).getByRole("button", {
        name: "Copy link",
      }),
    );
    expect(await navigator.clipboard.readText()).toBe(share.link);
    await user.click(screen.getByRole("button", { name: "Stop sharing" }));
    await user.click(await screen.findByRole("button", { name: "Stop sharing now" }));
    expect(invokeMock).toHaveBeenCalledWith("stop_share", { id: share.id });
    expect(screen.getByRole("textbox", { name: "Share link" })).toHaveValue(share.link);
    share = { ...share, status: "stopped", endedAt: Date.now() };
    act(() => emitBackend({ kind: "changed", topics: ["shares"] }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Share link" })).toHaveValue(
        "Link no longer works",
      ),
    );
    expect(linkControls().getByRole("button", { name: "Copy link" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Finished shares" })).toHaveTextContent("Stopped");
  });

  it.each([
    ["expired", "This link is gone"],
    ["limitReached", "Download limit reached"],
  ] as const)("renders the backend's %s state and disables copying", async (status, label) => {
    let share = shareFixture();
    respondToCommands({ list_shares: () => [share] });
    startApp();
    await screen.findByRole("textbox", { name: "Share link" });
    share = { ...share, status, endedAt: Date.now() };
    act(() => emitBackend({ kind: "changed", topics: ["shares"] }));
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(linkControls().getByRole("button", { name: "Copy link" })).toBeDisabled();
    await waitFor(() => {
      for (const button of screen.getAllByRole("button", { name: "Copy QR image" }))
        expect(button).toBeDisabled();
    });
  });

  it("reports clipboard failure without claiming a successful copy", async () => {
    respondToCommands({ list_shares: () => [shareFixture()] });
    const user = startApp();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Clipboard unavailable"),
    );
    await screen.findByRole("textbox", { name: "Share link" });
    await user.click(
      within(screen.getByRole("list", { name: "Active shares" })).getByRole("button", {
        name: "Copy link",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("The link couldn't be copied.");
    expect(screen.queryByRole("button", { name: "Link copied" })).not.toBeInTheDocument();
  });

  it("uses the default profile and copies the selected profile's Rust-generated link", async () => {
    const share = shareFixture({
      appLinks: [
        {
          profileId: "documents",
          name: "Documents",
          link: "documents://import?url=synthetic",
          customScheme: true,
        },
      ],
    });
    respondToCommands({
      list_shares: () => [share],
      get_settings: () => ({ ...DEFAULT_SETTINGS, defaultProfileId: "documents" }),
    });
    const user = startApp();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Share link" })).toHaveValue(
        "documents://import?url=synthetic",
      ),
    );
    await user.click(screen.getByRole("button", { name: "What the QR code opens: Documents" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Share page" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Share link" })).toHaveValue(share.link),
    );
    await user.click(screen.getByRole("button", { name: "What the QR code opens: Share page" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Documents" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Share link" })).toHaveValue(
        "documents://import?url=synthetic",
      ),
    );
    await user.click(linkControls().getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe("documents://import?url=synthetic");
    expect(invokeMock.mock.calls.some(([command]) => command === "open_link")).toBe(false);
  });

  it("disables new sharing when the desktop backend is unavailable", async () => {
    respondToCommands({ get_server: () => Promise.reject(new Error("Disconnected")) });
    startApp();
    expect(
      await screen.findByRole("button", { name: /Server status: Sharing unavailable/ }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Choose files/ })).toBeDisabled();
  });
});

it("validates network settings and retains the last saved port when Rust rejects a rebind", async () => {
  respondToCommands({ update_settings: () => Promise.reject("Port 9000 is already in use.") });
  const user = startApp();
  await user.click(await screen.findByRole("button", { name: "Settings" }));
  await user.click(screen.getByRole("button", { name: "Network" }));
  const port = await screen.findByRole("textbox", { name: "Port" });
  await waitFor(() => expect(port).toHaveValue("8765"));
  await user.clear(port);
  await user.type(port, "0");
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  expect(invokeMock.mock.calls.some(([command]) => command === "update_settings")).toBe(false);
  await user.clear(port);
  await user.type(port, "9000");
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Port 9000 is already in use.");
  expect(invokeMock).toHaveBeenCalledWith("update_settings", {
    patch: { port: 9000, interfaceId: "test-interface" },
  });
  expect(screen.getByText("Listening on 192.0.2.1:8765")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close settings" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(await screen.findByRole("textbox", { name: "Port" })).toHaveValue("8765");
});
