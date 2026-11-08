import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts", "./src/test/tauri.ts"],
    clearMocks: true,
    restoreMocks: true,
    // CI must reject accidentally focused tests and empty test suites.
    allowOnly: !process.env.CI,
    passWithNoTests: false,
  },
});
