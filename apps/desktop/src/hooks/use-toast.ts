import { createContext, useContext } from "react";

export type ToastTone = "info" | "success" | "error";

export const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(
  null,
);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside ToastProvider.");
  return push;
}
