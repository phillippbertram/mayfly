/**
 * Runtime schemas for every value that crosses the IPC boundary. Rust is
 * authoritative; the frontend validates what it receives so a contract drift
 * fails loudly instead of rendering wrong security state. No DTO carries a
 * local filesystem path.
 */
import { z } from "zod";

export const FileKindSchema = z.enum(["image", "document", "archive", "audio", "video", "other"]);

export const ShareStatusSchema = z.enum(["active", "expired", "stopped", "limitReached"]);

/** Minutes; `null` means the share lasts until it is stopped. */
export const LifetimeSchema = z
  .int()
  .min(1)
  .max(24 * 60)
  .nullable();
export const DownloadLimitSchema = z.int().min(1).max(999).nullable();

export const ShareSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  byteSize: z.int().nonnegative(),
  mediaType: z.string(),
  kind: FileKindSchema,
  /** Wall-clock milliseconds for display. Rust enforces lifetimes with a monotonic clock. */
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  downloadCount: z.int().nonnegative(),
  downloadLimit: DownloadLimitSchema,
  status: ShareStatusSchema,
  profileId: z.string(),
  /** Resolved link for the selected profile and address; `null` while no address is usable. */
  link: z.string().nullable(),
  linkError: z.string().nullable(),
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
  theme: ThemePreferenceSchema,
  defaultProfileId: z.string(),
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
  profileId: z.string(),
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
    profileId: z.string(),
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
