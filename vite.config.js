// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const sanitizeRouteTreeCode = (code) => code.replace(/\nimport type[\s\S]*$/, "\n");

const stripRouteTreeTypesPlugin = {
  name: "strip-route-tree-types",
  enforce: "pre",
  transform(code, id) {
    const normalizedId = id.replace(/\\/g, "/");
    if (!normalizedId.endsWith("/src/routeTree.gen.js")) return null;
    if (!code.includes("import type")) return null;
    return sanitizeRouteTreeCode(code);
  },
};
// Redirect TanStack Start's bundled server entry to src/server.js (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: [stripRouteTreeTypesPlugin],
  tanstackStart: {
    server: { entry: "server" },
    router: {
      disableTypes: true,
      generatedRouteTree: "routeTree.gen.js",
    },
  },
});
