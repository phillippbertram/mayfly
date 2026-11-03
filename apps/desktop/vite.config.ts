import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // `vite build --mode demo` builds only the website's product demo, with relative
  // asset paths so it works under any base path. The desktop bundle never includes it.
  ...(mode === "demo" && {
    base: "./",
    build: {
      outDir: "dist-demo",
      rollupOptions: { input: "demo.html" },
      // One lazily loaded chunk inside the iframe; splitting would not help.
      chunkSizeWarningLimit: 1200,
    },
  }),
}));
