/* Enregistrement du service worker et mise à jour automatique.
 * Une nouvelle version est téléchargée en arrière-plan puis activée dès qu'aucune
 * feuille de saisie n'est ouverte : l'utilisateur ne perd jamais une saisie en cours. */
import { registerSW } from "virtual:pwa-register";
import { feuillesOuvertes } from "../components/ui";

export const versionApp = __APP_VERSION__;
let appliquer: ((reload?: boolean) => Promise<void>) | null = null;
let enAttente = false;
let reg: ServiceWorkerRegistration | undefined;
let annoncer: (m: string) => void = () => {};

export function demarrerPWA(toast: (m: string) => void) {
  annoncer = toast;
  if (!("serviceWorker" in navigator)) return;
  appliquer = registerSW({
    immediate: true,
    onNeedRefresh() { enAttente = true; tenter(); },
    onOfflineReady() { toast("Application prête à fonctionner hors ligne"); },
    onRegisteredSW(_url, r) {
      reg = r;
      // Vérifie une nouvelle version toutes les 30 min et à chaque retour au premier plan.
      setInterval(() => r?.update(), 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) r?.update(); });
    }
  });
  feuillesOuvertes.ecoute.add(tenter);
  // Clic sur une notification : le service worker demande d'ouvrir une page.
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.type === "NAVIGUER" && e.data.url) location.assign(e.data.url);
  });
}
function tenter() {
  if (!enAttente || feuillesOuvertes.n > 0 || !appliquer) return;
  enAttente = false;
  sessionStorage.setItem("lptp-maj", "1");
  appliquer(true);
}
export function annonceApresMaj() {
  if (sessionStorage.getItem("lptp-maj")) { sessionStorage.removeItem("lptp-maj"); annoncer(`Application mise à jour (v${versionApp})`); }
}
export async function verifierMaj(): Promise<string> {
  if (!reg) return "Mises à jour disponibles uniquement sur la version installée en ligne.";
  if (!navigator.onLine) return "Hors ligne : vérification impossible.";
  await reg.update();
  return reg.installing || reg.waiting ? "Nouvelle version trouvée : installation en cours…" : `Vous avez la dernière version (v${versionApp}).`;
}
