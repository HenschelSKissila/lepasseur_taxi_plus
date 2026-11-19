/* Réglages du compte, synchronisés entre tous les appareils connectés au même compte. */
import { store, useDonnees } from "./store";
import type { Parametres } from "./types";

export const PARAM_DEFAUT: Omit<Parametres, "id"> = {
  entreprise: "LE PASSEUR TAXI+", responsable: null, telephone: null, ville: "Brazzaville",
  theme: "auto", rappel_actif: false, heure_rappel: 20, alertes_masquees: []
};

export const lireParametres = (): Parametres =>
  ({ ...PARAM_DEFAUT, ...(store.data.parametres[0] || {}), id: store.userId ?? "local" });

export function useParametres(): Parametres {
  const d = useDonnees();
  return { ...PARAM_DEFAUT, ...(d.parametres[0] || {}), id: store.userId ?? "local" };
}

/** Modifie les réglages du compte : enregistrés hors ligne puis synchronisés comme le reste. */
export async function majParametres(p: Partial<Parametres>) {
  const cur = lireParametres();
  await store.enregistrer("parametres", { ...cur, ...p, id: store.userId ?? "local" });
}

/** Crée la ligne de réglages du compte si elle n'existe pas encore (reprend les anciens réglages locaux). */
export async function assurerParametres() {
  if (store.data.parametres.length) return;
  let ancien: Partial<Parametres> = {};
  try {
    const p = JSON.parse(localStorage.getItem("lptp-profil") || "{}");
    const t = localStorage.getItem("lptp-theme") as Parametres["theme"] | null;
    ancien = { ...(p.entreprise ? { entreprise: p.entreprise } : {}), responsable: p.responsable || null,
      telephone: p.telephone || null, ville: p.ville || "Brazzaville", ...(t ? { theme: t } : {}) };
  } catch {}
  await majParametres(ancien);
}

/** Applique le thème du compte (et le mémorise pour le premier affichage suivant, avant chargement). */
export function appliquerTheme(theme: Parametres["theme"]) {
  try { localStorage.setItem("lptp-theme", theme); } catch {}
  const sombre = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = sombre ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sombre ? "#0B1410" : "#0B5C30");
}
