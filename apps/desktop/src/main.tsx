import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme } from "./hooks/use-theme";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("FileHop could not find its application root.");
}

// Match the system theme before the first paint; settings refine it afterwards.
applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
