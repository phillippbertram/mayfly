/** Receiving devices, cycled once per flight. `cx`/`cy` is the screen centre. */
export const DEVICES = [
  { id: "phone", label: "phone", cx: 266, cy: 86 },
  { id: "tablet", label: "tablet", cx: 265, cy: 89 },
  { id: "laptop", label: "laptop", cx: 266, cy: 86 },
  { id: "monitor", label: "computer", cx: 266, cy: 80 },
] as const;
export type DeviceId = (typeof DEVICES)[number]["id"];
