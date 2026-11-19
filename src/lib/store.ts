/* Magasin de données « hors ligne d'abord ».
 *
 *  1. Toute modification est appliquée immédiatement en mémoire et dans IndexedDB.
 *  2. La ligne est déposée dans une file d'envoi (outbox), une entrée par ligne :
 *     plusieurs modifications hors ligne d'une même ligne n'en font qu'un envoi.
 *  3. Dès que le réseau est là (ouverture, retour de connexion, retour au premier plan,
 *     toutes les 90 s), la file est téléversée vers Supabase puis les modifications
 *     faites ailleurs sont rapatriées, avec updated_at (posé par le serveur) comme curseur.
 *  4. Une ligne refusée par le serveur est mise de côté (« rejets ») avec la raison,
 *     sans bloquer le reste de la file.                                                    */

import { openDB, type IDBPDatabase } from "idb";
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { TABLES, type Donnees, type NomTable, type Tables, type Ligne } from "./types";

export type EtatSync = "local" | "demo" | "horsligne" | "synchro" | "ajour" | "erreur";
export interface Rejet { k: string; table: NomTable; row: Ligne; raison: string; date: string }
export interface InfoSync { etat: EtatSync; enAttente: number; derniere: string | null; rejets: Rejet[]; message?: string }

const vide = (): Donnees => Object.fromEntries(TABLES.map(t => [t, []])) as unknown as Donnees;
const cle = (t: string, id: string) => `${t}:${id}`;
const estReseau = (e: any) => !e?.code || /fetch|network|timeout|Failed|Load failed/i.test(e?.message || "");

class Store {
  private db: IDBPDatabase | null = null;
  private maps = new Map<NomTable, Map<string, Ligne>>();
  private enAttenteIds = new Set<string>();
  private ecoute = new Set<() => void>();
  private enCours = false;
  private relancer = false;
  private minuteur: ReturnType<typeof setTimeout> | null = null;
  userId: string | null = null;
  distant = false;
  data: Donnees = vide();
  sync: InfoSync = { etat: "local", enAttente: 0, derniere: null, rejets: [] };
  pret = false;

  /* -------------------------------------------------------------- ouverture */
  async ouvrir(espace: string, userId: string | null, distant: boolean) {
    this.fermer();
    this.userId = userId; this.distant = distant && !!supabase;
    this.db = await openDB(`lptp-${espace}`, 1, {
      upgrade(db) {
        for (const t of TABLES) db.createObjectStore(t, { keyPath: "id" });
        db.createObjectStore("outbox", { keyPath: "k" });
        db.createObjectStore("rejets", { keyPath: "k" });
        db.createObjectStore("meta");
      }
    });
    for (const t of TABLES) {
      const rows = (await this.db.getAll(t)) as Ligne[];
      this.maps.set(t, new Map(rows.filter(r => !r.deleted_at).map(r => [r.id, r])));
    }
    this.enAttenteIds = new Set((await this.db.getAllKeys("outbox")) as string[]);
    this.sync = {
      etat: this.distant ? (navigator.onLine ? "ajour" : "horsligne") : espace === "demo" ? "demo" : "local",
      enAttente: this.enAttenteIds.size,
      derniere: (await this.db.get("meta", "derniere")) ?? null,
      rejets: (await this.db.getAll("rejets")) as Rejet[]
    };
    this.reconstruire(); this.pret = true; this.emettre();
    if (this.distant) this.synchroniser();
  }
  fermer() {
    this.db?.close(); this.db = null; this.maps.clear(); this.data = vide(); this.pret = false;
  }
  /** Efface toutes les données locales d'un espace (déconnexion). */
  async effacer(espace: string) {
    this.fermer();
    await new Promise<void>(ok => { const r = indexedDB.deleteDatabase(`lptp-${espace}`); r.onsuccess = r.onerror = r.onblocked = () => ok(); });
    this.emettre();
  }

  /* ------------------------------------------------------------ abonnement */
  abonner = (f: () => void) => { this.ecoute.add(f); return () => this.ecoute.delete(f); };
  private emettre() { this.ecoute.forEach(f => f()); }
  private reconstruire(tables: NomTable[] = TABLES) {
    const d: any = { ...this.data };
    for (const t of tables) d[t] = [...(this.maps.get(t)?.values() ?? [])];
    this.data = d;
  }
  get<K extends NomTable>(t: K, id: string | null | undefined): Tables[K] | undefined {
    return id ? (this.maps.get(t)?.get(id) as Tables[K] | undefined) : undefined;
  }

  /* ---------------------------------------------------------- écritures */
  async enregistrer<K extends NomTable>(t: K, rows: Tables[K] | Tables[K][]) {
    await this.ecrire([[t, Array.isArray(rows) ? rows : [rows]]], false);
  }
  async supprimer<K extends NomTable>(t: K, ids: string | string[]) {
    const liste = (Array.isArray(ids) ? ids : [ids]).map(id => this.maps.get(t)?.get(id)).filter(Boolean) as Tables[K][];
    await this.ecrire([[t, liste]], true);
  }
  /** Écriture groupée : plusieurs tables en une transaction (ex. taxi + investissements + charges). */
  async lot(ops: Array<[NomTable, Ligne[], boolean?]>) {
    await this.ecrire(ops.map(([t, r]) => [t, r]), false, ops.map(o => !!o[2]));
  }

  private async ecrire(ops: Array<[NomTable, Ligne[]]>, suppr: boolean, supprParOp?: boolean[]) {
    if (!this.db) throw new Error("Données non chargées");
    const now = new Date().toISOString();
    const tx = this.db.transaction([...new Set(ops.map(o => o[0])), "outbox"], "readwrite");
    const touchees = new Set<NomTable>();
    ops.forEach(([t, rows], i) => {
      const del = supprParOp ? supprParOp[i] : suppr;
      const m = this.maps.get(t)!;
      for (const r0 of rows) {
        const r: Ligne = { ...r0, updated_at: now };
        if (this.userId) r.owner_id = this.userId;
        if (del) { r.deleted_at = now; m.delete(r.id); tx.objectStore(t).delete(r.id); }
        else { r.deleted_at = null; m.set(r.id, r); tx.objectStore(t).put(r); }
        if (this.distant) {
          const k = cle(t, r.id);
          tx.objectStore("outbox").put({ k, table: t, row: r });
          this.enAttenteIds.add(k);
        }
      }
      touchees.add(t);
    });
    await tx.done;
    this.reconstruire([...touchees]);
    this.sync = { ...this.sync, enAttente: this.enAttenteIds.size };
    this.emettre();
    if (this.distant) this.planifier(1200);
  }

  /* ---------------------------------------------------- synchronisation */
  planifier(ms = 0) {
    if (!this.distant) return;
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.synchroniser(), ms);
  }
  private etat(p: Partial<InfoSync>) { this.sync = { ...this.sync, ...p }; this.emettre(); }

  private promesse: Promise<void> = Promise.resolve();
  /** Lance une synchronisation ; si une est déjà en cours, renvoie celle-ci et en programme une autre après. */
  synchroniser(): Promise<void> {
    if (!this.distant || !this.db || !supabase) return Promise.resolve();
    if (this.enCours) { this.relancer = true; return this.promesse; }
    if (!navigator.onLine) { this.etat({ etat: "horsligne" }); return Promise.resolve(); }
    this.enCours = true;
    this.promesse = this.cycle();
    return this.promesse;
  }
  private async cycle(): Promise<void> {
    this.etat({ etat: "synchro", message: undefined });
    try {
      await this.pousser();
      await this.tirer();
      const d = new Date().toISOString();
      await this.db?.put("meta", d, "derniere");
      this.etat({ etat: "ajour", derniere: d, enAttente: this.enAttenteIds.size });
    } catch (e: any) {
      this.etat(estReseau(e) ? { etat: "horsligne" } : { etat: "erreur", message: e?.message || String(e) });
    } finally {
      this.enCours = false;
      if (this.relancer) { this.relancer = false; this.planifier(300); }
    }
  }

  private async pousser() {
    const db = this.db!, sb = supabase!;
    const file = (await db.getAll("outbox")) as Array<{ k: string; table: NomTable; row: Ligne }>;
    for (const t of TABLES) {                       // ordre des tables = ordre des clés étrangères
      const lignes = file.filter(f => f.table === t);
      for (let i = 0; i < lignes.length; i += 200) {
        const paquet = lignes.slice(i, i + 200);
        const { error } = await sb.from(t).upsert(paquet.map(p => nettoyer(p.row)), { onConflict: "id" });
        if (!error) { await this.retirer(paquet.map(p => p.k)); continue; }
        if (estReseau(error)) throw error;
        for (const p of paquet) await this.pousserUn(p);   // isole la ou les lignes fautives
      }
    }
  }
  private async pousserUn(p: { k: string; table: NomTable; row: Ligne }) {
    const sb = supabase!;
    let { error } = await sb.from(p.table).upsert(nettoyer(p.row), { onConflict: "id" });
    // Journée déjà saisie sur un autre appareil avec un autre identifiant : on adopte celui du serveur.
    if (error?.code === "23505" && p.table === "journees") {
      const j = p.row as Tables["journees"];
      const { data } = await sb.from("journees").select("id").eq("taxi_id", j.taxi_id).eq("date", j.date).is("deleted_at", null).maybeSingle();
      if (data?.id) {
        const fusion = { ...j, id: data.id };
        ({ error } = await sb.from("journees").upsert(nettoyer(fusion), { onConflict: "id" }));
        if (!error) {
          const m = this.maps.get("journees")!; m.delete(j.id); m.set(fusion.id, fusion);
          const tx = this.db!.transaction("journees", "readwrite");
          await tx.store.delete(j.id); await tx.store.put(fusion); await tx.done;
          this.reconstruire(["journees"]);
        }
      }
    }
    if (error && estReseau(error)) throw error;
    if (error) {
      const r: Rejet = { k: p.k, table: p.table, row: p.row, raison: traduire(error), date: new Date().toISOString() };
      await this.db!.put("rejets", r);
      this.sync = { ...this.sync, rejets: [...this.sync.rejets.filter(x => x.k !== r.k), r] };
    }
    await this.retirer([p.k]);
  }
  private async retirer(ks: string[]) {
    const tx = this.db!.transaction("outbox", "readwrite");
    for (const k of ks) { tx.store.delete(k); this.enAttenteIds.delete(k); }
    await tx.done;
  }

  private async tirer() {
    const db = this.db!, sb = supabase!;
    const modifiees: NomTable[] = [];
    for (const t of TABLES) {
      let curseur: string = (await db.get("meta", `curseur:${t}`)) || "1970-01-01T00:00:00Z";
      for (let page = 0; page < 200; page++) {
        const { data, error } = await sb.from(t).select("*").gt("updated_at", curseur).order("updated_at").limit(1000);
        if (error) throw error;
        if (!data?.length) break;
        const tx = db.transaction([t, "meta"], "readwrite");
        const m = this.maps.get(t)!;
        for (const r of data as Ligne[]) {
          if (this.enAttenteIds.has(cle(t, r.id))) continue;   // modification locale plus récente en attente
          if (r.deleted_at) { m.delete(r.id); tx.objectStore(t).delete(r.id); }
          else { m.set(r.id, r); tx.objectStore(t).put(r); }
        }
        curseur = (data[data.length - 1] as Ligne).updated_at!;
        tx.objectStore("meta").put(curseur, `curseur:${t}`);
        await tx.done;
        modifiees.push(t);
        if (data.length < 1000) break;
      }
    }
    if (modifiees.length) { this.reconstruire([...new Set(modifiees)]); this.emettre(); }
  }

  /** Abandonne une ligne refusée, ou la renvoie dans la file. */
  async traiterRejet(k: string, renvoyer: boolean) {
    const r = this.sync.rejets.find(x => x.k === k);
    if (!r || !this.db) return;
    await this.db.delete("rejets", k);
    if (renvoyer) { await this.db.put("outbox", { k, table: r.table, row: r.row }); this.enAttenteIds.add(k); }
    this.etat({ rejets: this.sync.rejets.filter(x => x.k !== k), enAttente: this.enAttenteIds.size });
    if (renvoyer) this.planifier(0);
  }

  /** Export complet (sauvegarde JSON). */
  exporter() {
    return { app: "le-passeur-taxi-plus", version: 2, exporte_le: new Date().toISOString(), donnees: this.data };
  }
}

/** Retire les champs que le serveur gère lui-même. */
function nettoyer(r: Ligne) {
  const { updated_at, created_at, ...reste } = r as any;
  return reste;
}
function traduire(e: any): string {
  const m: Record<string, string> = {
    "23505": "Doublon : cette ligne existe déjà sur le serveur.",
    "23503": "Référence manquante (taxi, chauffeur ou charge supprimé).",
    "23514": "Valeur refusée par une règle de contrôle.",
    "42501": "Accès refusé par la sécurité du compte.",
    P0001: e?.message || "Refus du serveur."
  };
  return m[e?.code] || e?.message || "Refus du serveur.";
}

export const store = new Store();

let snapD = store.data, snapS = store.sync;
export function useDonnees(): Donnees {
  return useSyncExternalStore(store.abonner, () => (snapD = store.data, snapD));
}
export function useSync(): InfoSync {
  return useSyncExternalStore(store.abonner, () => (snapS = store.sync, snapS));
}

// Déclencheurs de synchronisation
if (typeof window !== "undefined") {
  addEventListener("online", () => store.planifier(500));
  addEventListener("offline", () => store.distant && store.planifier(0));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) store.planifier(300); });
  setInterval(() => { if (!document.hidden) store.planifier(0); }, 90_000);
}
