import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // Service worker personnalisé (src/sw.ts) : cache hors ligne + notifications push.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",          // la mise à jour est appliquée par l'app quand aucune saisie n'est ouverte
      injectRegister: false,
      injectManifest: { globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,webmanifest}"] },
      includeAssets: ["fonts/*.woff2", "img/*.png", "icons/*.png"],
      manifest: {
        id: "/",
        name: "LE PASSEUR TAXI+",
        short_name: "TAXI+",
        description: "Gérer, suivre et rentabiliser vos taxis : recettes, dépenses, chauffeurs, salaires et retour sur investissement.",
        lang: "fr",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        background_color: "#0B5C30",
        theme_color: "#0B5C30",
        categories: ["business", "finance", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          { name: "Saisir la journée", short_name: "Saisie", url: "/saisie", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Ajouter une dépense", short_name: "Dépense", url: "/depenses?ajout=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: (id: string) => id.includes("recharts") || id.includes("d3-") ? "graphiques" : id.includes("@supabase") ? "supabase" : undefined } }
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
} as any);
