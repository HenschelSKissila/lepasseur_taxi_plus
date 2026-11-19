import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

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
      injectManifest: { globPatterns: ["**/*.{js,css,html,woff2,svg,ico,webmanifest}", "icons/icon-192.png", "icons/badge-96.png", "img/*.png"], globIgnores: ["screenshots/**", "icons/icon-store-*"] },
      includeAssets: ["fonts/*.woff2", "img/*.png", "icons/*.png", "confidentialite.html"],
      manifest: {
        id: "/?source=pwa",
        name: "LE PASSEUR TAXI+",
        short_name: "TAXI+",
        description: "Gérez vos taxis à Brazzaville : recettes journalières, dépenses, chauffeurs et salaires, amortissement et retour sur investissement en FCFA. Fonctionne hors ligne et se synchronise entre vos appareils.",
        lang: "fr",
        dir: "ltr",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        background_color: "#0B5C30",
        theme_color: "#0B5C30",
        categories: ["business", "finance", "productivity"],
        prefer_related_applications: false,
        launch_handler: { client_mode: ["navigate-existing", "auto"] },
        handle_links: "preferred",
        edge_side_panel: { preferred_width: 420 },
        icons: [
          ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512].map(n => ({ src: `/icons/icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png", purpose: "any" })),
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" }
        ],
        screenshots: [
          { src: "/screenshots/mobile-tableau-de-bord.png", sizes: "1080x2340", type: "image/png", form_factor: "narrow", label: "Tableau de bord : entrées, sorties et retour sur investissement" },
          { src: "/screenshots/mobile-saisie.png", sizes: "1080x2340", type: "image/png", form_factor: "narrow", label: "Saisie de la journée pour chaque taxi" },
          { src: "/screenshots/mobile-taxi.png", sizes: "1080x2340", type: "image/png", form_factor: "narrow", label: "Fiche taxi : remboursement de l'investissement" },
          { src: "/screenshots/mobile-depenses.png", sizes: "1080x2340", type: "image/png", form_factor: "narrow", label: "Dépenses et échéancier des charges" },
          { src: "/screenshots/bureau-tableau-de-bord.png", sizes: "1920x1080", type: "image/png", form_factor: "wide", label: "Tableau de bord de la flotte" },
          { src: "/screenshots/bureau-rapports.png", sizes: "1920x1080", type: "image/png", form_factor: "wide", label: "Compte de résultat mensuel" }
        ],
        shortcuts: [
          { name: "Saisir la journée", short_name: "Saisie", description: "Enregistrer les recettes du jour", url: "/saisie", icons: [{ src: "/icons/raccourci-plus.png", sizes: "96x96", type: "image/png" }] },
          { name: "Ajouter une dépense", short_name: "Dépense", description: "Imprévu, entretien ou autre dépense", url: "/depenses?ajout=1", icons: [{ src: "/icons/raccourci-depense.png", sizes: "96x96", type: "image/png" }] },
          { name: "Rapports", short_name: "Rapports", description: "Compte de résultat et exports", url: "/rapports", icons: [{ src: "/icons/raccourci-graphique.png", sizes: "96x96", type: "image/png" }] }
        ]
      } as any,
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
