/**
 * Browser-preview simulator. It loads only when the frontend runs outside Tauri
 * (`pnpm dev:web`) so the interface can be designed and reviewed without the Rust
 * services. The UI labels it as sample data. It never ships behavior to the
 * desktop build; Rust remains the source of truth for the real application.
 */
import { DEFAULT_SETTINGS, HTTP_PROFILE } from "./defaults";
import { createEmitter } from "./emitter";
import {
  type Backend,
  BackendError,
  type DroppedFiles,
  type FileKind,
  HTTP_PROFILE_ID,
  type LinkProfile,
  type NetworkInterface,
  type ServerState,
  type Settings,
  type Share,
  type ShareOptions,
  type StagedFile,
  type StagedFiles,
  type TemplatePreview,
  type Topic,
} from "./types";

const INTERFACES: NetworkInterface[] = [
  { id: "en0", name: "Wi‑Fi (en0)", address: "192.168.1.24" },
  { id: "en7", name: "Ethernet (en7)", address: "10.0.0.12" },
];

const PLACEHOLDERS = ["url", "encodedUrl", "filename", "encodedFilename", "token"] as const;
type Placeholder = (typeof PLACEHOLDERS)[number];
const BLOCKED_SCHEMES = new Set(["javascript", "data", "vbscript", "file", "blob", "about"]);

const SAMPLE_PICKS: { name: string; size: number; type: string }[][] = [
  [{ name: "Boarding-pass.pdf", size: 312_000, type: "application/pdf" }],
  [
    { name: "Screenshot 2026-11-02 at 14.08.31.png", size: 1_420_000, type: "image/png" },
    { name: "Holiday-video.mov", size: 184_300_000, type: "video/quicktime" },
  ],
  [{ name: "Project-assets.zip", size: 48_900_000, type: "application/zip" }],
  [{ name: "Voice memo.m4a", size: 2_100_000, type: "audio/mp4" }],
];

const MINUTE = 60_000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message: string): never => {
  throw new BackendError(message);
};

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
  for (const token of trimmed.match(/\{[^{}]*\}|[{}]/g) ?? []) {
    if (token === "{" || token === "}")
      return { ok: false, error: "A brace is unmatched. Use placeholders like {encodedUrl}." };
    if (!PLACEHOLDERS.includes(token.slice(1, -1) as Placeholder))
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

interface Entry {
  share: Omit<Share, "link" | "linkError">;
  token: string;
}

interface Staged extends StagedFile {
  mediaType: string;
}

export function createPreviewBackend(): Backend {
  const events = createEmitter();
  const changed = (...topics: Topic[]) => events.emit({ kind: "changed", topics });

  let server: ServerState = { kind: "starting" };
  let settings: Settings = { ...DEFAULT_SETTINGS, interfaceId: "en0" };
  let profiles: LinkProfile[] = [
    HTTP_PROFILE,
    {
      id: "docs-app",
      name: "Documents app",
      template: "myapp://import?url={encodedUrl}&name={encodedFilename}",
    },
  ];
  let entries: Entry[] = [];
  const staged = new Map<string, Staged>();
  let pickIndex = 0;

  const address = () =>
    server.kind === "online" ? { address: server.address, port: server.port } : null;

  function resolve(entry: Entry): Share {
    const at = address();
    if (!at) return { ...entry.share, link: null, linkError: null };
    const url = `http://${at.address}:${at.port}/s/${entry.token}`;
    const profile = profiles.find((p) => p.id === entry.share.profileId) ?? HTTP_PROFILE;
    if (!profile.template) return { ...entry.share, link: url, linkError: null };
    const valid = validateTemplate(profile.template);
    if (!valid.ok) return { ...entry.share, link: null, linkError: valid.error };
    const link = substitute(profile.template, {
      url,
      encodedUrl: encodeURIComponent(url),
      filename: entry.share.fileName,
      encodedFilename: encodeURIComponent(entry.share.fileName),
      token: entry.token,
    });
    return { ...entry.share, link, linkError: null };
  }

  function makeEntry(
    file: { fileName: string; byteSize: number; mediaType: string; kind: FileKind },
    options: ShareOptions,
    overrides: Partial<Entry["share"]> = {},
  ): Entry {
    const createdAt = Date.now();
    return {
      token: randomToken(),
      share: {
        id: crypto.randomUUID(),
        fileName: file.fileName,
        byteSize: file.byteSize,
        mediaType: file.mediaType,
        kind: file.kind,
        createdAt,
        expiresAt:
          options.lifetimeMinutes === null ? null : createdAt + options.lifetimeMinutes * MINUTE,
        endedAt: null,
        downloadCount: 0,
        downloadLimit: options.downloadLimit,
        status: "active",
        profileId: options.profileId,
        ...overrides,
      },
    };
  }

  const sample = (name: string, size: number, type: string) => ({
    fileName: name,
    byteSize: size,
    mediaType: type,
    kind: kindOf(type, name),
  });
  const now = Date.now();
  const base: ShareOptions = {
    lifetimeMinutes: 10,
    downloadLimit: null,
    profileId: HTTP_PROFILE_ID,
  };
  entries = [
    makeEntry(sample("Quarterly-report-2026.pdf", 2_400_000, "application/pdf"), base, {
      createdAt: now - 2.3 * MINUTE,
      expiresAt: now + 7.7 * MINUTE,
      downloadCount: 1,
      downloadLimit: 3,
    }),
    makeEntry(sample("IMG_4821.heic", 3_100_000, "image/heic"), base, {
      createdAt: now - MINUTE,
      expiresAt: now + 9 * MINUTE,
    }),
    makeEntry(sample("Invoice-0342.pdf", 184_000, "application/pdf"), base, {
      createdAt: now - 9.2 * MINUTE,
      expiresAt: now + 48_000,
      downloadCount: 1,
      downloadLimit: 2,
    }),
    makeEntry(sample("export-2026-11-02.csv", 812_000, "text/csv"), base, {
      createdAt: now - 25 * MINUTE,
      expiresAt: now - 15 * MINUTE,
      endedAt: now - 15 * MINUTE,
      status: "expired",
      downloadCount: 1,
    }),
  ];

  setTimeout(() => {
    server = { kind: "online", address: "192.168.1.24", port: 8765, interfaceName: "Wi‑Fi (en0)" };
    changed("server", "shares");
  }, 900);

  // Expiration is enforced by the backend; the UI only renders the result.
  setInterval(() => {
    const t = Date.now();
    let dirty = false;
    entries = entries.map((entry) => {
      const { share } = entry;
      if (share.status === "active" && share.expiresAt !== null && share.expiresAt <= t) {
        dirty = true;
        return { ...entry, share: { ...share, status: "expired", endedAt: share.expiresAt } };
      }
      return entry;
    });
    if (dirty) changed("shares");
  }, 500);

  // Now and then a "phone" downloads the selected sample, so counters move.
  setInterval(() => {
    const candidates = entries.filter((e) => e.share.status === "active");
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (!target || Math.random() < 0.6) return;
    const count = target.share.downloadCount + 1;
    const limitReached = target.share.downloadLimit !== null && count >= target.share.downloadLimit;
    update(target.share.id, {
      downloadCount: count,
      ...(limitReached ? { status: "limitReached", endedAt: Date.now() } : {}),
    });
  }, 9000);

  function update(id: string, patch: Partial<Entry["share"]>) {
    entries = entries.map((e) =>
      e.share.id === id ? { ...e, share: { ...e.share, ...patch } } : e,
    );
    changed("shares");
  }

  function find(id: string): Entry {
    return entries.find((e) => e.share.id === id) ?? fail("This share no longer exists.");
  }

  function stage(files: { name: string; size: number; type: string }[]): StagedFiles {
    const rejected: StagedFiles["rejected"] = [];
    const accepted: StagedFile[] = [];
    for (const file of files) {
      if (file.type === "" && !file.name.includes(".")) {
        rejected.push({ name: file.name, reason: "Folders can't be shared." });
        continue;
      }
      const item: Staged = {
        stageId: crypto.randomUUID(),
        fileName: file.name,
        byteSize: file.size,
        kind: kindOf(file.type, file.name),
        mediaType: file.type || "application/octet-stream",
      };
      staged.set(item.stageId, item);
      accepted.push({
        stageId: item.stageId,
        fileName: item.fileName,
        byteSize: item.byteSize,
        kind: item.kind,
      });
    }
    return { files: accepted, rejected };
  }

  function requireOnline() {
    if (server.kind !== "online") fail("Sharing resumes once the server is back online.");
  }

  return {
    mode: "preview",
    subscribe: events.subscribe,

    getServer: async () => server,
    listShares: async () => entries.map(resolve),
    getSettings: async () => settings,
    listProfiles: async () => profiles,
    listInterfaces: async () => INTERFACES,

    async pickFiles() {
      requireOnline();
      await wait(200);
      const pick = SAMPLE_PICKS[pickIndex % SAMPLE_PICKS.length] ?? [];
      pickIndex += 1;
      return stage(pick);
    },

    async stageDropped(files: DroppedFiles) {
      requireOnline();
      if (files.kind !== "preview") return fail("Paths can only be shared by the desktop app.");
      return stage(files.files);
    },

    async discardStaged(ids) {
      for (const id of ids) staged.delete(id);
    },

    async createShares(ids, options) {
      requireOnline();
      if (!profiles.some((p) => p.id === options.profileId)) fail("That profile no longer exists.");
      const created = ids.map((id) => {
        const file = staged.get(id) ?? fail("A file is no longer available. Add it again.");
        staged.delete(id);
        return makeEntry(file, options);
      });
      entries = [...[...created].reverse(), ...entries];
      changed("shares");
      return created.map(resolve);
    },

    async shareAgain(id, options) {
      requireOnline();
      const old = find(id).share;
      const entry = makeEntry(
        old,
        options ?? {
          lifetimeMinutes: settings.defaultLifetimeMinutes,
          downloadLimit: settings.defaultDownloadLimit,
          profileId: old.profileId,
        },
      );
      entries = [entry, ...entries];
      changed("shares");
      return resolve(entry);
    },

    async updateShare(id, patch) {
      const { share } = find(id);
      if (share.status !== "active") fail("Only active shares can be changed.");
      const next: Partial<Entry["share"]> = {};
      if (patch.extendMinutes !== undefined) {
        next.expiresAt =
          patch.extendMinutes === null
            ? null
            : Math.max(Date.now(), share.expiresAt ?? Date.now()) + patch.extendMinutes * MINUTE;
      }
      if (patch.downloadLimit !== undefined) {
        if (patch.downloadLimit !== null && patch.downloadLimit <= share.downloadCount)
          fail(
            `The limit must be higher than the ${share.downloadCount} downloads already started.`,
          );
        next.downloadLimit = patch.downloadLimit;
      }
      if (patch.profileId !== undefined) {
        if (!profiles.some((p) => p.id === patch.profileId)) fail("That profile no longer exists.");
        next.profileId = patch.profileId;
      }
      update(id, next);
      return resolve(find(id));
    },

    async stopShare(id) {
      if (find(id).share.status === "active")
        update(id, { status: "stopped", endedAt: Date.now() });
    },

    async stopAll() {
      const t = Date.now();
      entries = entries.map((e) =>
        e.share.status === "active"
          ? { ...e, share: { ...e.share, status: "stopped", endedAt: t } }
          : e,
      );
      changed("shares");
    },

    async removeShare(id) {
      entries = entries.filter((e) => e.share.id !== id || e.share.status === "active");
      changed("shares");
    },

    async clearFinished() {
      entries = entries.filter((e) => e.share.status === "active");
      changed("shares");
    },

    async updateSettings(patch) {
      const next = { ...settings, ...patch };
      const networkChanged =
        (patch.port !== undefined && patch.port !== settings.port) ||
        (patch.interfaceId !== undefined && patch.interfaceId !== settings.interfaceId);
      if (networkChanged) {
        await wait(450);
        if (next.port < 1024)
          fail(`Port ${next.port} needs administrator rights. Kept ${settings.port}.`);
        if (next.port === 8000 || next.port === 3000)
          fail(`Port ${next.port} is in use by another app. Kept ${settings.port}.`);
        const iface = INTERFACES.find((i) => i.id === next.interfaceId) ?? INTERFACES[0];
        if (!iface) fail("No network address is available.");
        const before = address();
        settings = next;
        server = {
          kind: "online",
          address: iface?.address ?? "",
          port: next.port,
          interfaceName: iface?.name ?? "",
        };
        changed("settings", "server", "shares");
        if (before?.address !== iface?.address || before?.port !== next.port)
          events.emit({ kind: "addressChanged", address: `${iface?.address}:${next.port}` });
        return settings;
      }
      settings = next;
      changed("settings");
      return settings;
    },

    async saveProfile(input) {
      const valid = validateTemplate(input.template);
      if (!valid.ok) return fail(valid.error);
      const id = input.id ?? crypto.randomUUID();
      const profile: LinkProfile = { id, name: input.name.trim(), template: input.template.trim() };
      profiles = input.id
        ? profiles.map((p) => (p.id === id ? profile : p))
        : [...profiles, profile];
      if (input.makeDefault) settings = { ...settings, defaultProfileId: id };
      else if (settings.defaultProfileId === id)
        settings = { ...settings, defaultProfileId: HTTP_PROFILE_ID };
      changed("profiles", "settings", "shares");
      return profile;
    },

    async deleteProfile(id) {
      if (id === HTTP_PROFILE_ID) fail("The HTTP profile is always available.");
      profiles = profiles.filter((p) => p.id !== id);
      if (settings.defaultProfileId === id)
        settings = { ...settings, defaultProfileId: HTTP_PROFILE_ID };
      entries = entries.map((e) =>
        e.share.profileId === id ? { ...e, share: { ...e.share, profileId: HTTP_PROFILE_ID } } : e,
      );
      changed("profiles", "settings", "shares");
    },

    async previewTemplate(template): Promise<TemplatePreview> {
      const valid = validateTemplate(template);
      if (!valid.ok) return valid;
      const at = address() ?? { address: "192.168.1.24", port: settings.port };
      const url = `http://${at.address}:${at.port}/s/qY3xN8vLpW2dR7tK0mZcA5bH`;
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
    },
  };
}
