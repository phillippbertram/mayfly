import type { Share } from "../../lib/backend";

export function limitOptions(share: Share) {
  const min = share.downloadCount + 1;
  const values = [...new Set([1, 3, 5, 10, 25].map((n) => Math.max(n, min)))];
  return [
    { value: "none", label: "No limit" },
    ...values.map((n) => ({ value: String(n), label: n === 1 ? "1 download" : `${n} downloads` })),
  ];
}

export const EXTEND_OPTIONS = [
  { minutes: 5, label: "Add 5 minutes" },
  { minutes: 10, label: "Add 10 minutes" },
  { minutes: 30, label: "Add 30 minutes" },
  { minutes: 60, label: "Add 1 hour" },
] as const;
