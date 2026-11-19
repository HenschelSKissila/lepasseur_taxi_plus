/* Notifications : rappel quotidien de 20 h, push serveur, alertes calculées et centre de notifications.
 *
 * Deux mécanismes complémentaires pour le rappel du soir :
 *   1. Push serveur (application fermée) : l'appareil s'abonne, la fonction Supabase
 *      « rappel-quotidien » s'exécute chaque heure et n'envoie qu'aux comptes dont la
 *      journée n'est pas remplie à l'heure choisie. Nécessite VITE_VAPID_PUBLIC_KEY.
 *   2. Rappel local (application ouverte ou en arrière-plan récent) : minuterie jusqu'à
 *      20 h, puis vérification des journées manquantes.                                  */

import { supabase, VAPID_PUBLIC } from "./supabase";
import { store } from "./store";
import { joursManquants, alertes, type Alerte } from "./finance";
import { uuidStable } from "./ids";
import { today } from "./format";
import type { Notif } from "./types";

const PREF = "lptp-rappel";
const MASQUEES = "lptp-alertes-masquees";
export const HEURE_RAPPEL = 20;

export const supportNotif = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
export const supportPush = () => supportNotif() && "PushManager" in window && !!VAPID_PUBLIC && !!supabase;
export const rappelActif = () => { try { return localStorage.getItem(PREF) === "1"; } catch { return false; } };

/* ------------------------------------------------------- notifications stockées */
export const idNotif = (cle: string) => uuidStable(`notif:${store.userId ?? "local"}:${cle}`);
export async function ajouterNotif(cle: string, titre: string, corps: string, lien = "/") {
  const id = idNotif(cle);
  if (store.get("notifications", id)) return;
  await store.enregistrer("notifications", { id, cle, titre, corps, lien, lu: false } as Notif);
}

/* ------------------------------------------------------- alertes calculées */
export function masquees(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MASQUEES) || "[]")); } catch { return new Set(); }
}
export function masquer(cles: string[]) {
  const s = masquees(); cles.forEach(c => s.add(c));
  try { localStorage.setItem(MASQUEES, JSON.stringify([...s].slice(-300))); } catch {}
}
export const alertesVisibles = (): Alerte[] => { const m = masquees(); return alertes(store.data).filter(a => !m.has(a.cle)); };

/* -------------------------------------------------------------- activation */
export async function activerRappel(): Promise<{ ok: boolean; push: boolean; message: string }> {
  if (!supportNotif()) return { ok: false, push: false, message: "Ce navigateur ne gère pas les notifications." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, push: false, message: "Notifications refusées. Autorisez-les dans les réglages du navigateur." };
  localStorage.setItem(PREF, "1");
  planifierRappelLocal();
  if (!supportPush() || !store.distant) return { ok: true, push: false, message: "Rappel activé sur cet appareil (application ouverte)." };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) as BufferSource });
    const j = sub.toJSON() as any;
    const { error } = await supabase!.from("push_abonnements").upsert({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, heure_rappel: HEURE_RAPPEL,
      fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Brazzaville",
      appareil: navigator.userAgent.slice(0, 160), actif: true, owner_id: store.userId
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return { ok: true, push: true, message: "Rappel activé : notification chaque soir à 20 h, même application fermée." };
  } catch (e: any) {
    return { ok: true, push: false, message: "Rappel local activé. Push serveur indisponible : " + (e?.message || "hors ligne") };
  }
}
export async function desactiverRappel() {
  localStorage.removeItem(PREF);
  if (minuteur) clearTimeout(minuteur);
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      if (supabase && store.distant) await supabase.from("push_abonnements").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
}

/* ----------------------------------------------------------- rappel local */
let minuteur: ReturnType<typeof setTimeout> | null = null;
export function planifierRappelLocal() {
  if (minuteur) clearTimeout(minuteur);
  if (!rappelActif()) return;
  const now = new Date(), cible = new Date(now);
  cible.setHours(HEURE_RAPPEL, 0, 0, 0);
  if (cible <= now) cible.setDate(cible.getDate() + 1);
  minuteur = setTimeout(async () => { await verifierRappel(true); planifierRappelLocal(); }, Math.min(cible.getTime() - now.getTime(), 2 ** 31 - 1));
}

/** À l'ouverture après 20 h, ou au déclenchement de la minuterie : rappelle les journées non remplies. */
export async function verifierRappel(systeme = false) {
  if (!store.pret || new Date().getHours() < HEURE_RAPPEL) return;
  const t = today();
  const manque = joursManquants(store.data, t, 1);
  if (!manque.length) return;
  const noms = manque.map(m => m.taxi.nom).join(", ");
  const titre = "Remplissez l'état de la journée";
  const corps = manque.length === 1 ? `La journée de ${noms} n'est pas encore saisie.` : `${manque.length} taxis à saisir : ${noms}.`;
  await ajouterNotif(`rappel-${t}`, titre, corps, "/saisie");
  if (systeme && rappelActif() && Notification.permission === "granted") {
    const reg = await navigator.serviceWorker?.ready;
    reg?.showNotification(titre, { body: corps, tag: "rappel-jour", icon: "/icons/icon-192.png", badge: "/icons/favicon-64.png",
      data: { url: "/saisie" } });
  }
}

function b64(s: string) {
  const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
