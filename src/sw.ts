/// <reference lib="webworker" />
/* Service worker : application disponible hors ligne, notifications push et clics sur notification. */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// 1. Tous les fichiers de l'application sont mis en cache à l'installation.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// 2. Toute navigation (ex. /taxis/123 ouvert hors ligne) sert l'application en cache.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/] }));

// 3. Mise à jour : l'application demande l'activation quand aucune saisie n'est ouverte.
self.addEventListener("message", e => { if (e.data?.type === "SKIP_WAITING") self.skipWaiting(); });
clientsClaim();

// 4. Notification push (rappel de 20 h envoyé par la fonction Supabase).
self.addEventListener("push", e => {
  let p: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { p = e.data?.json() ?? {}; } catch { p = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(p.title || "LE PASSEUR TAXI+", {
    body: p.body || "Pensez à remplir l'état de la journée.",
    icon: "/icons/icon-192.png", badge: "/icons/favicon-64.png",
    tag: p.tag || "rappel-jour",            // remplace la précédente : jamais d'empilement
    data: { url: p.url || "/saisie" },
    requireInteraction: false               // l'utilisateur peut la supprimer d'un glissement
  } as NotificationOptions));
});

// 5. Clic : ouvre (ou ramène au premier plan) l'application sur la bonne page.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const f = fenetres[0] as WindowClient | undefined;
    if (f) { await f.focus(); f.postMessage({ type: "NAVIGUER", url }); }
    else await self.clients.openWindow(url);
  })());
});
