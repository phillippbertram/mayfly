import { useEffect } from "react";
import type { ThemePreference } from "../lib/backend";
import { useMediaQuery } from "./use-media-query";

export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function applyTheme(theme: "light" | "dark"): void {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  const swap = () => {
    root.dataset.theme = theme;
  };
  // Cross-fade the whole window when the user switches themes.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (root.dataset.theme && !reduce && "startViewTransition" in document) {
    document.startViewTransition(swap);
  } else {
    swap();
  }
}

export function useTheme(preference: ThemePreference): void {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  useEffect(() => {
    applyTheme(resolveTheme(preference, systemDark));
  }, [preference, systemDark]);
}
