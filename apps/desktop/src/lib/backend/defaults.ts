import { HTTP_PROFILE_ID, type LinkProfile, type Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  port: 8765,
  interfaceId: null,
  defaultLifetimeMinutes: 10,
  defaultDownloadLimit: null,
  confirmBeforeSharing: true,
  theme: "system",
  defaultProfileId: HTTP_PROFILE_ID,
};

export const HTTP_PROFILE: LinkProfile = { id: HTTP_PROFILE_ID, name: "HTTP", template: null };
