import { click, download, hideCursor, press, type Step, type as typeText, wait } from "./director";

const inDialog = { within: "dialog[open]" };

/** Scenes for the product website; each starts from fresh sample data. */
export const SCENES = {
  /** Choose a file, pick a lifetime and limit, share, and watch two downloads. */
  share: [
    wait(900),
    click("Choose files…"),
    wait(700),
    click("1 h", { role: "radio" }),
    click("3", { role: "radio" }),
    wait(300),
    click("Share"),
    hideCursor,
    wait(1800),
    download,
    wait(1500),
    download,
    wait(2600),
  ],
  /** Open a bundle, give it a title, and add more files to the same link. */
  bundle: [
    wait(900),
    click(/^3 files,/),
    wait(900),
    click("Rename this link"),
    typeText("Weekend away", { clear: true }),
    press("Enter"),
    wait(700),
    click("Add files…"),
    hideCursor,
    wait(2600),
  ],
  /** Switch the QR code between the share page and single files. */
  qr: [
    wait(900),
    click(/^3 files,/),
    wait(900),
    click("Show QR code for Itinerary.pdf"),
    wait(2000),
    click("Show QR code for Beach.jpg"),
    hideCursor,
    wait(2600),
  ],
  /** Change a saved default in Settings. */
  settings: [
    wait(900),
    click("Settings"),
    wait(900),
    click("30 min", { role: "radio", ...inDialog }),
    wait(700),
    click("5", { role: "radio", ...inDialog }),
    wait(900),
    click("Appearance", inDialog),
    hideCursor,
    wait(2600),
  ],
} satisfies Record<string, Step[]>;

export type SceneId = keyof typeof SCENES;

export function isScene(value: unknown): value is SceneId {
  return typeof value === "string" && Object.hasOwn(SCENES, value);
}
