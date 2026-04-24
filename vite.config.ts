// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";
import path from "node:path";

// Load all (non-VITE_) env vars into process.env for server routes (e.g. SUPABASE_SERVICE_ROLE_KEY).
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(__dirname, "node_modules/entities/lib/index.js"),
        "htmlparser2/dist/esm/index.js": path.resolve(__dirname, "node_modules/htmlparser2/lib/esm/index.js"),
        htmlparser2: path.resolve(__dirname, "node_modules/htmlparser2/lib/esm/index.js"),
      },
    },
    optimizeDeps: {
      exclude: ["htmlparser2", "dom-serializer", "entities"],
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "offline.html"],
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: "Lei Company",
          short_name: "Lei.co",
          description: "Estude com propósito. Cronograma para concurseiros das carreiras de alto nível.",
          start_url: "/",
          display: "standalone",
          background_color: "#F7F4EE",
          theme_color: "#B8C9B0",
          lang: "pt-BR",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/offline.html",
          navigateFallbackDenylist: [/^\/_serverFn/, /^\/api/, /^\/~oauth/, /^\/lovable/, /^\/email/],
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin,
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 4,
              },
            },
          ],
        },
      }),
    ],
  },
});
