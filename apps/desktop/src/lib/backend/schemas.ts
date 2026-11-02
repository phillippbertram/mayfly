/**
 * Runtime schemas for every value that crosses the IPC boundary. Rust is
 * authoritative; the frontend validates what it receives so a contract drift
 * fails loudly instead of rendering wrong security state. No DTO carries a
 * local filesystem path.
 */
import { z } from "zod";

/** `bundle` only describes a share that contains several files. */
export const FileKindSchema = z.enum([
  "image",
  "document",
  "archive",
  "audio",
  "video",
  "other",
  "bundle",
]);

export const ShareStatusSchema = z.enum(["active", "expired", "stopped", "limitReached"]);

/** Minutes; `null` means the share lasts until it is stopped. */
export const LifetimeSchema = z
  .int()
  .min(1)
  .max(24 * 60)
  .nullable();
export const DownloadLimitSchema = z.int().min(1).max(999).nullable();

export const ShareFileSchema = z.object({
  /** Stable within its share, also after other files are removed. */
  id: z.string().min(1),
  name: z.string().min(1),
  byteSize: z.int().nonnegative(),
  kind: FileKindSchema,
  /** Downloads started of this file, including those inside ZIP downloads. */
  downloadCount: z.int().nonnegative(),
  /** Direct download of this file; `null` while no address is usable. */
  link: z.string().nullable(),
});

/** The share link through a custom link profile, for a compatible app. */
export const AppLinkSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  /** `null` while no address is usable. */
  link: z.string().nullable(),
  /** Opens an app rather than a web page; the app must be installed. */
  customScheme: z.boolean(),
});

/**
 * A share is a file drop: one page link, a ZIP link, and a direct link per file.
 * Files can be added and removed while it is active, and it may be empty. With
 * several files (or none), `fileName` is "3 files" (or "No files yet"),
 * `byteSize` the total, and `kind` is `bundle`.
 */
export const ShareSchema = z.object({
  id: z.string().min(1),
  /** Display name: the title if set, else the file name, "3 files", or "No files yet". */
  fileName: z.string().min(1),
  /** The owner's title; `null` when the name comes from the files. */
  title: z.string().nullable(),
  byteSize: z.int().nonnegative(),
  kind: FileKindSchema,
  files: z.array(ShareFileSchema),
  /** Wall-clock milliseconds for display. Rust enforces lifetimes with a monotonic clock. */
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  /** Bundles count downloads per file; this is the most-downloaded file's count. */
  downloadCount: z.int().nonnegative(),
  /** Bundles apply the limit to each file. */
  downloadLimit: DownloadLimitSchema,
  status: ShareStatusSchema,
  /** The share's page, which the QR code opens; `null` while no address is usable. */
  link: z.string().nullable(),
  /** Everything in the share as one ZIP. */
  zipLink: z.string().nullable(),
  /** One link per custom profile; empty without custom profiles. */
  appLinks: z.array(AppLinkSchema),
});

export const ServerStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("starting") }),
  z.object({
    kind: z.literal("online"),
    address: z.string(),
    port: z.int(),
    interfaceName: z.string(),
  }),
  z.object({ kind: z.literal("noAddress"), port: z.int() }),
  z.object({ kind: z.literal("bindFailed"), port: z.int(), message: z.string() }),
  z.object({ kind: z.literal("stopping") }),
  z.object({ kind: z.literal("unavailable"), message: z.string() }),
]);

export const NetworkInterfaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
});

export const ThemePreferenceSchema = z.enum(["system", "light", "dark"]);

export const PortSchema = z
  .int({ error: "Enter a whole number." })
  .min(1, { error: "Enter a port between 1 and 65535." })
  .max(65_535, { error: "Enter a port between 1 and 65535." });

export const SettingsSchema = z.object({
  port: PortSchema,
  interfaceId: z.string().nullable(),
  defaultLifetimeMinutes: LifetimeSchema,
  defaultDownloadLimit: DownloadLimitSchema,
  /** Show the share options sheet before files are shared. */
  confirmBeforeSharing: z.boolean(),
  /** Blur QR codes and mask link tokens until revealed, e.g. while screen sharing. */
  hideCodes: z.boolean(),
  theme: ThemePreferenceSchema,
  defaultProfileId: z.string(),
  /** Explain once that closing the window keeps sharing in the background. */
  showCloseNotice: z.boolean(),
});

export const LinkProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** `null` for the built-in HTTP profile. */
  template: z.string().nullable(),
});

export const TemplatePreviewSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), preview: z.string(), customScheme: z.boolean() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/** A validated file waiting for share options. Rust keeps the path; the UI gets a handle. */
export const StagedFileSchema = z.object({
  stageId: z.string(),
  fileName: z.string(),
  byteSize: z.int().nonnegative(),
  kind: FileKindSchema,
});

export const StagedFilesSchema = z.object({
  files: z.array(StagedFileSchema),
  /** Items that were dropped or picked but can't be shared, such as folders. */
  rejected: z.array(z.object({ name: z.string(), reason: z.string() })),
});

export const ShareOptionsSchema = z.object({
  lifetimeMinutes: LifetimeSchema,
  downloadLimit: DownloadLimitSchema,
});

export const SharePatchSchema = z
  .object({
    /** Adds minutes to the remaining lifetime, or `null` to keep it until stopped. */
    extendMinutes: z
      .int()
      .min(1)
      .max(24 * 60)
      .nullable(),
    downloadLimit: DownloadLimitSchema,
    /** A blank title or `null` returns to the name derived from the files. */
    title: z.string().max(80, { error: "Keep the title under 80 characters." }).nullable(),
  })
  .partial();

export const ProfileInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, { error: "Give the profile a name." }),
  template: z.string(),
  makeDefault: z.boolean(),
});

export type FileKind = z.infer<typeof FileKindSchema>;
export type ShareStatus = z.infer<typeof ShareStatusSchema>;
export type ShareFile = z.infer<typeof ShareFileSchema>;
export type AppLink = z.infer<typeof AppLinkSchema>;
export type Share = z.infer<typeof ShareSchema>;
export type ServerState = z.infer<typeof ServerStateSchema>;
export type NetworkInterface = z.infer<typeof NetworkInterfaceSchema>;
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type LinkProfile = z.infer<typeof LinkProfileSchema>;
export type TemplatePreview = z.infer<typeof TemplatePreviewSchema>;
export type StagedFile = z.infer<typeof StagedFileSchema>;
export type StagedFiles = z.infer<typeof StagedFilesSchema>;
export type ShareOptions = z.infer<typeof ShareOptionsSchema>;
export type SharePatch = z.infer<typeof SharePatchSchema>;
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
