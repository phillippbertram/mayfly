import { isDesktop } from "./desktop";

export const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

/** macOS desktop windows use an overlay title bar with inset traffic lights. */
export const hasOverlayTitleBar = isMac && isDesktop();
