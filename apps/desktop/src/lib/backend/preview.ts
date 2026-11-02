/**
 * Browser-preview simulator. It is loaded only when the frontend runs outside
 * Tauri (`pnpm dev:web`) so the interface can be designed and reviewed without the
 * Rust services. It never ships behavior to the desktop build, and the UI labels
 * it as sample data. Rust remains the source of truth for the real application.
 */
import { DEFAULT_SETTINGS, HTTP_PROFILE } from "./defaults";
import { SnapshotStore } from "./store";
import type {
  Backend,
  DroppedFiles,
  FileKind,
  LinkProfile,
  NetworkInterface,
  ProfileInput,
  Result,
  ServerState,
  Settings,
  Share,
  Snapshot,
  TemplatePreview,
} from "./types";
import { HTTP_PROFILE_ID } from "./types";

const INTERFACES: NetworkInterface[] = [
  { id: "en0", name: "Wi‑Fi (en0)", address: "192.168.1.24" },
  { id: "en7", name: "Ethernet (en7)", address: "10.0.0.12" },
];

const PLACEHOLDERS = ["url", "encodedUrl", "filename", "encodedFilename", "token"] as const;
type Placeholder = (typeof PLACEHOLDERS)[number];
const BLOCKED_SCHEMES = new Set(["javascript", "data", "vbscript", "file", "blob", "about"]);

const SAMPLE_FILES: { name: string; size: number; type: string }[] = [
  { name: "Boarding-pass.pdf", size: 312_000, type: "application/pdf" },
  { name: "Holiday-video.mov", size: 184_300_000, type: "video/quicktime" },
  { name: "Screenshot 2026-11-02 at 14.08.31.png", size: 1_420_000, type: "image/png" },
  { name: "Project-assets.zip", size: 48_900_000, type: "application/zip" },
  { name: "Voice memo.m4a", size: 2_100_000, type: "audio/mp4" },
];

const ok = <T = void>(value: T): Result<T> => ({ ok: true, value });
const fail = <T = void>(error: string): Result<T> => ({ ok: false, error });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function kindOf(type: string, name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/") || ["heic", "png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return "image";
  if (type.startsWith("video/") || ["mov", "mp4", "mkv"].includes(ext)) return "video";
  if (type.startsWith("audio/") || ["m4a", "mp3", "wav"].includes(ext)) return "audio";
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) return "archive";
  if (["pdf", "doc", "docx", "txt", "md", "csv", "xls", "xlsx", "key", "pages"].includes(ext))
    return "document";
  return "other";
}

export function validateTemplate(template: string): { ok: true } | { ok: false; error: string } {
  const trimmed = template.trim();
  if (trimmed.length === 0) return { ok: false, error: "Enter a URL template." };
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point.
  if (/[\u0000-\u001f\u007f]/.test(template))
    return { ok: false, error: "Remove line breaks and control characters." };
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme) return { ok: false, error: "Start with a scheme, such as myapp:// or https://." };
  if (BLOCKED_SCHEMES.has(scheme))
    return { ok: false, error: `The ${scheme}: scheme isn't allowed.` };
  const tokens = trimmed.match(/\{[^{}]*\}|[{}]/g) ?? [];
  for (const token of tokens) {
    if (token === "{" || token === "}")
      return { ok: false, error: "A brace is unmatched. Use placeholders like {encodedUrl}." };
    const name = token.slice(1, -1);
    if (!PLACEHOLDERS.includes(name as Placeholder))
      return { ok: false, error: `Unknown placeholder ${token}.` };
  }
  return { ok: true };
}

function substitute(template: string, values: Record<Placeholder, string>): string {
  return template.replace(
    /\{([A-Za-z]+)\}/g,
    (_, name: string) => values[name as Placeholder] ?? "",
  );
}

interface PreviewShareState {
  share: Share;
  token: string;
}

export function createPreviewBackend(): Backend {
  const now = Date.now();
  const minute = 60_000;
  let shares: PreviewShareState[] = [];
  let profiles: LinkProfile[] = [
    HTTP_PROFILE,
    {
      id: "docs-app",
      name: "Documents app",
      template: "myapp://import?url={encodedUrl}&name={encodedFilename}",
    },
  ];
  let settings: Settings = { ...DEFAULT_SETTINGS, interfaceId: "en0" };
  let server: ServerState = { kind: "starting" };
  let sampleIndex = 0;

  const store = new SnapshotStore(build());

  function currentAddress(): { address: string; port: number } | null {
    return server.kind === "online" ? { address: server.address, port: server.port } : null;
  }

  function resolveLink(state: PreviewShareState): Pick<Share, "link" | "linkError"> {
    const address = currentAddress();
    if (!address) return { link: null, linkError: null };
    const url = `http://${address.address}:${address.port}/s/${state.token}`;
    const profile = profiles.find((p) => p.id === state.share.profileId) ?? HTTP_PROFILE;
    if (!profile.template) return { link: url, linkError: null };
    const valid = validateTemplate(profile.template);
    if (!valid.ok) return { link: null, linkError: valid.error };
    return {
      link: substitute(profile.template, {
        url,
        encodedUrl: encodeURIComponent(url),
        filename: state.share.fileName,
        encodedFilename: encodeURIComponent(state.share.fileName),
        token: state.token,
      }),
      linkError: null,
    };
  }

  function build(): Snapshot {
    return {
      server,
      settings,
      profiles,
      interfaces: INTERFACES,
      shares: shares.map((state) => ({ ...state.share, ...resolveLink(state) })),
    };
  }

  const commit = () => store.set(build);

  function makeShare(
    file: { name: string; size: number; type: string },
    overrides: Partial<Share> = {},
  ): PreviewShareState {
    const createdAt = Date.now();
    const share: Share = {
      id: crypto.randomUUID(),
      fileName: file.name,
      byteSize: file.size,
      mediaType: file.type || "application/octet-stream",
      kind: kindOf(file.type, file.name),
      createdAt,
      expiresAt:
        settings.defaultLifetimeMinutes === null
          ? null
          : createdAt + settings.defaultLifetimeMinutes * minute,
      endedAt: null,
      downloadCount: 0,
      downloadLimit: settings.defaultDownloadLimit,
      status: "active",
      profileId: settings.defaultProfileId,
      link: null,
      linkError: null,
      ...overrides,
    };
    return { share, token: randomToken() };
  }

  // Sample shares so every row state is visible right away.
  shares = [
    makeShare(
      { name: "Quarterly-report-2026.pdf", size: 2_400_000, type: "application/pdf" },
      {
        createdAt: now - 2.3 * minute,
        expiresAt: now + 7.7 * minute,
        downloadCount: 1,
        downloadLimit: 3,
      },
    ),
    makeShare(
      { name: "IMG_4821.heic", size: 3_100_000, type: "image/heic" },
      { createdAt: now - 1 * minute, expiresAt: now + 9 * minute },
    ),
    makeShare(
      { name: "Invoice-0342.pdf", size: 184_000, type: "application/pdf" },
      {
        createdAt: now - 9.2 * minute,
        expiresAt: now + 48_000,
        downloadCount: 1,
        downloadLimit: 2,
      },
    ),
    makeShare(
      { name: "export-2026-11-02.csv", size: 812_000, type: "text/csv" },
      {
        createdAt: now - 25 * minute,
        expiresAt: now - 15 * minute,
        endedAt: now - 15 * minute,
        status: "expired",
        downloadCount: 1,
      },
    ),
  ];
  commit();

  // The server "binds" shortly after launch, like the real listener would.
  setTimeout(() => {
    server = { kind: "online", address: "192.168.1.24", port: 8765, interfaceName: "Wi‑Fi (en0)" };
    commit();
  }, 900);

  // Expiration is enforced by the backend; the UI only renders the result.
  setInterval(() => {
    const t = Date.now();
    let expired = 0;
    shares = shares.map((state) => {
      const { share } = state;
      if (share.status === "active" && share.expiresAt !== null && share.expiresAt <= t) {
        expired += 1;
        return { ...state, share: { ...share, status: "expired", endedAt: share.expiresAt } };
      }
      return state;
    });
    if (expired > 0) {
      commit();
      store.emit({ kind: "sharesExpired", count: expired });
    }
  }, 500);

  function findState(id: string): PreviewShareState | undefined {
    return shares.find((s) => s.share.id === id);
  }

  function addShares(files: { name: string; size: number; type: string }[]): Result<Share[]> {
    if (server.kind !== "online") return fail("Sharing resumes once the server is back online.");
    const created = files.map((file) => makeShare(file));
    shares = [...created.reverse(), ...shares];
    commit();
    const snapshot = store.get();
    return ok(created.map((c) => snapshot.shares.find((s) => s.id === c.share.id) ?? c.share));
  }

  return {
    mode: "preview",
    getSnapshot: store.get,
    subscribe: store.subscribe,
    onEvent: store.onEvent,

    async chooseFiles() {
      await wait(250);
      const file = SAMPLE_FILES[sampleIndex % SAMPLE_FILES.length];
      sampleIndex += 1;
      if (!file) return fail("No sample file available.");
      return addShares([file]);
    },

    async shareDropped(files: DroppedFiles) {
      if (files.kind !== "preview") return fail("Paths can only be shared by the desktop app.");
      const regular = files.files.filter((f) => f.type !== "" || f.name.includes("."));
      if (regular.length === 0) return fail("Folders can't be shared. Drop single files.");
      return addShares(regular);
    },

    async shareAgain(id) {
      const state = findState(id);
      if (!state) return fail("This share no longer exists.");
      const result = addShares([
        { name: state.share.fileName, size: state.share.byteSize, type: state.share.mediaType },
      ]);
      if (!result.ok) return result;
      const first = result.value[0];
      return first ? ok(first) : fail("The share could not be created.");
    },

    async stopShare(id) {
      shares = shares.map((s) =>
        s.share.id === id && s.share.status === "active"
          ? { ...s, share: { ...s.share, status: "stopped", endedAt: Date.now() } }
          : s,
      );
      commit();
      return ok(undefined);
    },

    async stopAll() {
      const t = Date.now();
      shares = shares.map((s) =>
        s.share.status === "active"
          ? { ...s, share: { ...s.share, status: "stopped", endedAt: t } }
          : s,
      );
      commit();
      return ok(undefined);
    },

    async removeShare(id) {
      shares = shares.filter((s) => s.share.id !== id || s.share.status === "active");
      commit();
      return ok(undefined);
    },

    async clearFinished() {
      shares = shares.filter((s) => s.share.status === "active");
      commit();
      return ok(undefined);
    },

    async setShareProfile(id, profileId) {
      if (!profiles.some((p) => p.id === profileId)) return fail("That profile no longer exists.");
      shares = shares.map((s) =>
        s.share.id === id ? { ...s, share: { ...s.share, profileId } } : s,
      );
      commit();
      return ok(undefined);
    },

    async updateSettings(patch) {
      const next = { ...settings, ...patch };
      const networkChanged =
        patch.port !== undefined && patch.port !== settings.port
          ? true
          : patch.interfaceId !== undefined && patch.interfaceId !== settings.interfaceId;
      if (networkChanged) {
        await wait(450);
        if (!Number.isInteger(next.port) || next.port < 1 || next.port > 65_535)
          return fail("Enter a port between 1 and 65535.");
        if (next.port < 1024)
          return fail(`Port ${next.port} needs administrator rights. Kept ${settings.port}.`);
        if (next.port === 8000 || next.port === 3000)
          return fail(`Port ${next.port} is in use by another app. Kept ${settings.port}.`);
        const iface = INTERFACES.find((i) => i.id === next.interfaceId) ?? INTERFACES[0];
        if (!iface) return fail("No network address is available.");
        const previous = currentAddress();
        settings = next;
        server = {
          kind: "online",
          address: iface.address,
          port: next.port,
          interfaceName: iface.name,
        };
        commit();
        if (previous?.address !== iface.address || previous.port !== next.port)
          store.emit({ kind: "addressChanged", address: `${iface.address}:${next.port}` });
        return ok(undefined);
      }
      settings = next;
      commit();
      return ok(undefined);
    },

    async saveProfile(input: ProfileInput) {
      const name = input.name.trim();
      if (!name) return fail("Give the profile a name.");
      const valid = validateTemplate(input.template);
      if (!valid.ok) return fail(valid.error);
      const id = input.id ?? crypto.randomUUID();
      const profile: LinkProfile = { id, name, template: input.template.trim() };
      profiles = input.id
        ? profiles.map((p) => (p.id === input.id ? profile : p))
        : [...profiles, profile];
      if (input.makeDefault) settings = { ...settings, defaultProfileId: id };
      else if (settings.defaultProfileId === id)
        settings = { ...settings, defaultProfileId: HTTP_PROFILE_ID };
      commit();
      return ok(profile);
    },

    async deleteProfile(id) {
      if (id === HTTP_PROFILE_ID) return fail("The HTTP profile is always available.");
      profiles = profiles.filter((p) => p.id !== id);
      if (settings.defaultProfileId === id)
        settings = { ...settings, defaultProfileId: HTTP_PROFILE_ID };
      shares = shares.map((s) =>
        s.share.profileId === id ? { ...s, share: { ...s.share, profileId: HTTP_PROFILE_ID } } : s,
      );
      commit();
      return ok(undefined);
    },

    async previewTemplate(template): Promise<TemplatePreview> {
      const valid = validateTemplate(template);
      if (!valid.ok) return valid;
      const address = currentAddress() ?? { address: "192.168.1.24", port: settings.port };
      const url = `http://${address.address}:${address.port}/s/qY3xN8vLpW2dR7tK0mZcA5bH`;
      const filename = "Quarterly-report-2026.pdf";
      const scheme = template.trim().split(":")[0]?.toLowerCase() ?? "";
      return {
        ok: true,
        preview: substitute(template.trim(), {
          url,
          encodedUrl: encodeURIComponent(url),
          filename,
          encodedFilename: encodeURIComponent(filename),
          token: "qY3xN8vLpW2dR7tK0mZcA5bH",
        }),
        customScheme: scheme !== "http" && scheme !== "https",
      };
    },

    async savePng(suggestedName, data) {
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = suggestedName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return ok(undefined);
    },
  };
}
