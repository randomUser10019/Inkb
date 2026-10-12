import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(fileURLToPath(import.meta.url));
const api = process.env.INKBOARD_API || "http://127.0.0.1:8787";

/** Bare imports inside `shared/` walk up from that folder and miss
 * `frontend/node_modules`, which is a sibling. Resolve them from this app. */
function resolveSharedDeps(): Plugin {
  const fromApp = join(root, "src/routes/__root.tsx");
  return {
    name: "resolve-shared-deps",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || importer === fromApp) return null;
      if (!importer.replaceAll("\\", "/").includes("/shared/")) return null;
      if (
        source.startsWith(".") ||
        source.startsWith("/") ||
        source.startsWith("\0") ||
        source.startsWith("node:") ||
        source.startsWith("@inkboard/")
      ) {
        return null;
      }
      return this.resolve(source, fromApp, { ...options, skipSelf: true });
    },
  };
}

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
  plugins: [resolveSharedDeps(), tailwindcss(), tanstackStart({ router: { autoCodeSplitting: true } }), viteReact()],
});
