/* Synchronisation hors ligne : file d'envoi, reprise après coupure, rapatriement multi-appareils,
 * fusion d'une même journée saisie sur deux téléphones, isolement d'une ligne refusée.
 * Le serveur Supabase est simulé en mémoire (horodatage serveur, contrainte d'unicité, panne réseau). */
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------- faux serveur Supabase */
const serveur = { tables: new Map<string, Map<string, any>>(), horloge: 0, enPanne: false, refuser: new Set<string>() };
const tbl = (t: string) => { if (!serveur.tables.has(t)) serveur.tables.set(t, new Map()); return serveur.tables.get(t)!; };
const erreurReseau = { message: "TypeError: Failed to fetch", code: "" };
function upsert(t: string, rows: any) {
  if (serveur.enPanne) return { error: erreurReseau };
  const liste = Array.isArray(rows) ? rows : [rows];
  for (const r of liste) {
    if (serveur.refuser.has(r.id)) return { error: { code: "23514", message: "check violation" } };
    if (t === "journees" && !r.deleted_at) {
      const dup = [...tbl(t).values()].find(x => x.id !== r.id && x.taxi_id === r.taxi_id && x.date === r.date && !x.deleted_at);
      if (dup) return { error: { code: "23505", message: "duplicate key" } };
    }
  }
  for (const r of liste) tbl(t).set(r.id, { ...tbl(t).get(r.id), ...r, updated_at: new Date(Date.UTC(2026, 0, 1) + ++serveur.horloge * 1000).toISOString() });
  return { error: null };
}
function requete(t: string) {
  const f: Array<(r: any) => boolean> = []; let lim = 1e9;
  const q: any = {
    select: () => q, gt: (c: string, v: string) => (f.push(r => r[c] > v), q), eq: (c: string, v: any) => (f.push(r => r[c] === v), q),
    is: (c: string, v: any) => (f.push(r => (r[c] ?? null) === v), q), order: () => q, limit: (n: number) => (lim = n, q),
    upsert: (rows: any) => Promise.resolve(upsert(t, rows)),
    maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
    then: (ok: any) => ok(serveur.enPanne ? { data: null, error: erreurReseau } : { data: run(), error: null })
  };
  const run = () => [...tbl(t).values()].filter(r => f.every(x => x(r))).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, lim).map(r => ({ ...r }));
  return q;
}
vi.mock("../src/lib/supabase", () => ({ supabase: { from: (t: string) => requete(t) }, modeLocal: false, VAPID_PUBLIC: "" }));
Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, get: () => !serveur.enPanne });

const { store } = await import("../src/lib/store");
const { idJournee } = await import("../src/lib/ids");

const USER = "11111111-1111-1111-1111-111111111111";
const taxi = { id: "t-1", nom: "Taxi 01", immatriculation: null, modele: null, annee: null, date_mise_service: "2026-11-01", km_initial: 0,
  mode: "versement", chauffeur_id: null, objectif_recette_jour: 20000, jours_par_mois: 26, carburant_jour_prevu: 0, entretien_mois_prevu: 30000,
  duree_amortissement: 5, valeur_residuelle: 600000, taux_imprevus: 0.1, actif: true, note: null } as any;
const journee = (date: string, recette: number, id = idJournee("t-1", date)) => ({ id, taxi_id: "t-1", chauffeur_id: null, date, statut: "travail",
  recette, carburant: 0, entretien: 0, autres: 0, prelevement: 0, km: null, note: null } as any);
const attendre = async () => { for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 10)); if (store.sync.etat !== "synchro") break; } };

beforeEach(() => { serveur.tables.clear(); serveur.enPanne = false; serveur.refuser.clear(); });

describe("synchronisation hors ligne", () => {
  it("hors ligne : la saisie est conservée localement puis téléversée au retour du réseau", async () => {
    await store.ouvrir("appareil-A", USER, true); await attendre();
    serveur.enPanne = true;
    await store.enregistrer("taxis", taxi);
    await store.enregistrer("journees", journee("2026-11-18", 20000));
    await store.synchroniser();
    expect(store.sync.etat).toBe("horsligne");
    expect(store.sync.enAttente).toBe(2);
    expect(store.data.journees).toHaveLength(1);           // visible immédiatement dans l'application
    expect(tbl("journees").size).toBe(0);                  // rien n'est encore parti

    serveur.enPanne = false;
    await store.synchroniser();
    expect(store.sync.etat).toBe("ajour");
    expect(store.sync.enAttente).toBe(0);
    expect(tbl("journees").get(idJournee("t-1", "2026-11-18")).recette).toBe(20000);
    expect(tbl("journees").get(idJournee("t-1", "2026-11-18")).owner_id).toBe(USER);
  });

  it("les données survivent à la fermeture de l'application (IndexedDB)", async () => {
    await store.ouvrir("appareil-B", USER, true); await attendre();
    serveur.enPanne = true;
    await store.enregistrer("taxis", taxi);
    store.fermer();
    await store.ouvrir("appareil-B", USER, true);          // réouverture, toujours hors ligne
    expect(store.data.taxis).toHaveLength(1);
    expect(store.sync.enAttente).toBe(1);
    serveur.enPanne = false;
    await store.synchroniser();                            // « téléversement à la prochaine ouverture »
    expect(tbl("taxis").has("t-1")).toBe(true);
  });

  it("plusieurs modifications hors ligne d'une même ligne = un seul envoi, la dernière valeur gagne", async () => {
    await store.ouvrir("appareil-C", USER, true); await attendre();
    serveur.enPanne = true;
    await store.enregistrer("taxis", taxi);
    for (const r of [15000, 18000, 21000]) await store.enregistrer("journees", journee("2026-11-19", r));
    expect(store.sync.enAttente).toBe(2);
    serveur.enPanne = false; await store.synchroniser();
    expect(tbl("journees").get(idJournee("t-1", "2026-11-19")).recette).toBe(21000);
  });

  it("un deuxième appareil récupère les données et les suppressions", async () => {
    upsert("taxis", { ...taxi, owner_id: USER });
    upsert("journees", { ...journee("2026-11-10", 19000), owner_id: USER });
    await store.ouvrir("appareil-D", USER, true); await store.synchroniser();
    expect(store.data.journees.map(j => j.recette)).toEqual([19000]);
    upsert("journees", { ...journee("2026-11-10", 19000), deleted_at: new Date().toISOString() });   // supprimée ailleurs
    await store.synchroniser();
    expect(store.data.journees).toHaveLength(0);
  });

  it("même journée saisie sur deux téléphones avec des identifiants différents : fusion sans doublon", async () => {
    upsert("taxis", { ...taxi, owner_id: USER });
    upsert("journees", { ...journee("2026-11-12", 20000, "id-serveur"), owner_id: USER });
    await store.ouvrir("appareil-E", USER, true); await attendre();
    serveur.enPanne = true;
    await store.enregistrer("journees", journee("2026-11-12", 22000, "id-local"));
    serveur.enPanne = false; await store.synchroniser();
    const lignes = [...tbl("journees").values()].filter(j => j.date === "2026-11-12" && !j.deleted_at);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].id).toBe("id-serveur");
    expect(lignes[0].recette).toBe(22000);
    expect(store.data.journees.filter(j => j.date === "2026-11-12")).toHaveLength(1);
    expect(store.sync.rejets).toHaveLength(0);
  });

  it("une ligne refusée par le serveur est isolée sans bloquer les autres", async () => {
    await store.ouvrir("appareil-F", USER, true); await attendre();
    await store.enregistrer("taxis", taxi);
    serveur.refuser.add(idJournee("t-1", "2026-11-14"));
    await store.lot([["journees", [journee("2026-11-13", 20000), journee("2026-11-14", 20000), journee("2026-11-15", 20000)]]]);
    await store.synchroniser();
    expect(tbl("journees").has(idJournee("t-1", "2026-11-13"))).toBe(true);
    expect(tbl("journees").has(idJournee("t-1", "2026-11-15"))).toBe(true);
    expect(store.sync.rejets.map(r => r.row.id)).toEqual([idJournee("t-1", "2026-11-14")]);
    expect(store.sync.enAttente).toBe(0);
    serveur.refuser.clear();
    await store.traiterRejet(store.sync.rejets[0].k, true); await store.synchroniser();
    expect(tbl("journees").has(idJournee("t-1", "2026-11-14"))).toBe(true);
  });

  it("une suppression locale se propage au serveur (suppression logique)", async () => {
    await store.ouvrir("appareil-G", USER, true); await attendre();
    await store.enregistrer("taxis", taxi);
    await store.enregistrer("journees", journee("2026-11-16", 20000));
    await store.synchroniser();
    await store.supprimer("journees", idJournee("t-1", "2026-11-16"));
    await store.synchroniser();
    expect(tbl("journees").get(idJournee("t-1", "2026-11-16")).deleted_at).toBeTruthy();
  });
});
