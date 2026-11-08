/**
 * Mayfly mark on a 64-unit grid: an upright wing, a curved body, and two tails.
 * Shared with the empty-state flight; icons/source.svg draws the same paths.
 */
export const MARK = {
  wing: "M24 37C21 25 25 13 35 5C38 16 36 28 31 37Z",
  body: "M10 43C20 37 33 36 44 32",
  tails: "M44 32C49 28 53 23 57 15M44 32C50 30 55 27 60 22",
} as const;
