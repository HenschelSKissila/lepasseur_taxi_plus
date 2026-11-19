/* Diagnostic de la liaison avec Supabase : répond à « l'application marche-t-elle sur le serveur,
 * et mes données y arrivent-elles ? ». Chaque étape est un test réel contre le serveur. */
import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./supabase";
import { store } from "./store";
import { TABLES, type NomTable } from "./types";

export type Etape = { titre: string; ok: boolean | null; detail: string };
const NOMS: Record<NomTable, string> = { parametres: "Réglages", chauffeurs: "Chauffeurs", taxis: "Taxis", investissements: "Investissements",
  charges: "Charges", journees: "Journées", depenses: "Dépenses", salaires: "Salaires", notifications: "Notifications" };

export async function diagnostiquer(maj: (e: Etape[]) => void): Promise<Etape[]> {
  const e: Etape[] = [];
  const pousse = (x: Etape) => { e.push(x); maj([...e]); return x; };
  if (!supabase) { pousse({ titre: "Mode", ok: false, detail: "Application en mode local : aucun serveur configuré." }); return e; }

  // 1. Réseau + serveur joignable
  if (!navigator.onLine) { pousse({ titre: "Connexion Internet", ok: false, detail: "L'appareil est hors ligne. Les saisies attendent sur le téléphone." }); return e; }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } });
    pousse({ titre: "Serveur Supabase joignable", ok: r.ok, detail: r.ok ? SUPABASE_URL.replace("https://", "") : `Réponse ${r.status} : vérifiez l'adresse et la clé du projet.` });
    if (!r.ok) return e;
  } catch { pousse({ titre: "Serveur Supabase joignable", ok: false, detail: "Aucune réponse du serveur (projet en pause ou adresse erronée ?)." }); return e; }

  // 2. Compte reconnu par le serveur
  const { data: u, error: eu } = await supabase.auth.getUser();
  pousse({ titre: "Compte reconnu par le serveur", ok: !!u?.user && !eu, detail: u?.user ? u.user.email || u.user.id : "Session expirée : déconnectez-vous puis reconnectez-vous." });
  if (!u?.user) return e;

  // 3. Tables créées par le script SQL
  const manquantes: string[] = [], comptes: Partial<Record<NomTable, number>> = {};
  for (const t of TABLES) {
    const { count, error } = await supabase.from(t).select("id", { count: "exact", head: true }).is("deleted_at", null);
    if (error) manquantes.push(NOMS[t]); else comptes[t] = count ?? 0;
  }
  pousse({ titre: "Base de données installée", ok: !manquantes.length,
    detail: manquantes.length ? `Tables absentes : ${manquantes.join(", ")}. Exécutez 1-A-COLLER-DANS-SUPABASE.sql dans SQL Editor.` : `${TABLES.length} tables présentes, sécurité active.` });
  if (manquantes.length) return e;

  // 4. Aller-retour réel : écriture puis relecture de l'horodatage posé par le serveur
  const avant = new Date().toISOString();
  const p = store.data.parametres[0];
  if (p) {
    const { error: ew } = await supabase.from("parametres").upsert({ ...p, owner_id: u.user.id, updated_at: undefined, created_at: undefined } as any, { onConflict: "id" });
    const { data: lu } = await supabase.from("parametres").select("updated_at").eq("id", u.user.id).maybeSingle();
    const ok = !ew && !!lu && lu.updated_at >= avant.slice(0, 19);
    pousse({ titre: "Écriture et relecture sur le serveur", ok, detail: ok ? "Une donnée envoyée a bien été enregistrée puis relue." : ew?.message || "La donnée n'a pas pu être relue." });
  }

  // 5. Envoi des saisies en attente puis comparaison appareil / serveur
  await store.synchroniser();
  const s = store.sync;
  pousse({ titre: "File d'envoi", ok: s.enAttente === 0 && !s.rejets.length,
    detail: s.enAttente ? `${s.enAttente} modification(s) encore en attente.` : s.rejets.length ? `${s.rejets.length} ligne(s) refusée(s) : voir ci-dessous.` : "Tout a été envoyé." });
  const ecarts: string[] = [], resume: string[] = [];
  for (const t of ["taxis", "journees", "depenses", "chauffeurs", "salaires", "charges"] as NomTable[]) {
    const { count } = await supabase.from(t).select("id", { count: "exact", head: true }).is("deleted_at", null);
    const local = store.data[t].length;
    resume.push(`${NOMS[t]} ${count ?? 0}`);
    if ((count ?? 0) !== local) ecarts.push(`${NOMS[t]} : ${local} sur l'appareil, ${count ?? 0} sur le serveur`);
  }
  pousse({ titre: "Données identiques sur l'appareil et le serveur", ok: !ecarts.length,
    detail: ecarts.length ? ecarts.join(" · ") : `Serveur : ${resume.join(" · ")}` });
  return e;
}
