import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(fileURLToPath(import.meta.url));
const api = process.env.INKBOARD_API || "http://127.0.0.1:8787";

export default defineConfig({
  root,
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: api, changeOrigin: true, timeout: 0 },
      "/healthz": { target: api },
      "/readyz": { target: api },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": { target: api, changeOrigin: true, timeout: 0 },
      "/healthz": { target: api },
      "/readyz": { target: api },
    },
  },
  resolve: {
    alias: {
      "@": join(root, "src"),
      "@inkboard/shared": join(root, "../shared/src/lib"),
    },
  },
  plugins: [tailwindcss(), tanstackStart({ router: { autoCodeSplitting: true } }), viteReact()],
});
