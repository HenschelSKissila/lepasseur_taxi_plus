/* Moteur financier — pur, sans effet de bord, testé (tests/finance.test.ts).
 *
 * Définitions utilisées partout dans l'application :
 *   Entrées          = recettes des journées (versements ou recettes brutes)
 *   Sorties          = dépenses du journal (carburant, entretien, autres)
 *                    + charges fixes payées + imprévus + entretien/autres hors journal
 *                    + salaires versés (salaire, avance, prime)
 *   Marge (solde)    = entrées − sorties                          → argent réellement gagné
 *   Amortissement    = (investissement − valeur résiduelle) ÷ durée, au jour près
 *   Résultat net     = marge − amortissement                       → vision comptable
 *   Récupération     = Σ marges depuis la mise en service ÷ investissement
 *   Prélèvement      = argent retiré par le propriétaire : ni charge, ni recette
 *
 * Périmètre : `taxiId = null` désigne la flotte entière (y compris dépenses communes) ;
 * un identifiant restreint aux lignes rattachées à ce taxi.                              */

import type { Donnees, Taxi, Charge, Chauffeur, Frequence, Mode } from "./types";
import { addDays, addMonths, daysBetween, monthStart, monthEnd, mKey, minD, maxD, today } from "./format";

export const MODES: Record<Mode, { nom: string; court: string; detail: string; recette: string; rapide: number[]; carburant: boolean; prelevement: boolean }> = {
  versement: { nom: "Versement journalier", court: "Versement",
    detail: "Un chauffeur exploite le taxi et vous remet un montant fixe chaque jour. Il paie son carburant.",
    recette: "Versement reçu", rapide: [15000, 18000, 20000, 22000, 25000], carburant: false, prelevement: false },
  direct: { nom: "Exploitation directe", court: "Direct",
    detail: "Un chauffeur salarié conduit. Toute la recette vous revient ; carburant et salaire sont à votre charge.",
    recette: "Recette brute", rapide: [35000, 40000, 45000, 50000, 55000], carburant: true, prelevement: false },
  perso: { nom: "Je conduis moi-même", court: "Je conduis",
    detail: "Vous êtes au volant. Toute la recette vous revient, le carburant est à votre charge, aucun salaire.",
    recette: "Recette brute", rapide: [25000, 30000, 35000, 40000, 45000], carburant: true, prelevement: true }
};

export const FREQ: Record<Frequence, { nom: string; mois: number }> = {
  mensuel: { nom: "Mensuelle", mois: 1 }, trimestriel: { nom: "Trimestrielle", mois: 3 },
  semestriel: { nom: "Semestrielle", mois: 6 }, annuel: { nom: "Annuelle", mois: 12 }, unique: { nom: "Unique", mois: 0 }
};

export const CAT_CHARGE = ["Assurance", "Impôts & taxes", "Contrôle technique", "Taxes & licences", "Stationnement", "Entretien programmé", "Téléphone & divers", "Autre"];
export const CAT_IMPREVU = ["Panne mécanique", "Pneumatique", "Accident / carrosserie", "Électricité / batterie", "Amende / contrôle", "Vol / vandalisme", "Autre imprévu"];
export const CAT_ENTRETIEN = ["Vidange", "Freins", "Pneus", "Amortisseurs", "Révision", "Lavage", "Pièce détachée"];
export const CAT_AUTRE = ["Administratif", "Équipement", "Frais bancaires", "Divers"];

const dans = (taxiId: string | null) => (x: { taxi_id: string | null }) => taxiId === null || x.taxi_id === taxiId;
export const depJournee = (j: { carburant?: number; entretien?: number; autres?: number }) =>
  (j.carburant || 0) + (j.entretien || 0) + (j.autres || 0);

/* ------------------------------------------------------------ périmètre */
export const taxisDe = (d: Donnees, taxiId: string | null) =>
  d.taxis.filter(t => taxiId === null ? true : t.id === taxiId);
export const taxisActifs = (d: Donnees) => d.taxis.filter(t => t.actif).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
export function debut(d: Donnees, taxiId: string | null): string {
  const ts = taxisDe(d, taxiId);
  return ts.length ? ts.map(t => t.date_mise_service).sort()[0] : today();
}
export const investTaxi = (d: Donnees, id: string) =>
  d.investissements.filter(i => i.taxi_id === id).reduce((s, i) => s + i.montant, 0);
export const investTotal = (d: Donnees, taxiId: string | null) =>
  taxisDe(d, taxiId).reduce((s, t) => s + investTaxi(d, t.id), 0);
/** Part amortissable de l'investissement (le véhicule et sa mise en conformité, hors plein et nettoyage). */
export const baseAmort = (d: Donnees, id: string) =>
  d.investissements.filter(i => i.taxi_id === id && i.amortissable !== false).reduce((s, i) => s + i.montant, 0);
/** Budget de démarrage = investissement + charges réglées à la mise en service (1re assurance, taxes…). */
export function budgetDemarrage(d: Donnees, t: Taxi) {
  const premieres = d.depenses.filter(p => p.taxi_id === t.id && p.type === "fixe" && p.echeance === t.date_mise_service)
    .reduce((s, p) => s + p.montant, 0);
  const I = investTaxi(d, t.id), base = baseAmort(d, t.id);
  return { investissement: I, amortissable: base, fraisDemarrage: I - base, premieresCharges: premieres, total: I + premieres };
}

/* ------------------------------------------------------- amortissement */
export const amortAnnuel = (t: Taxi, I: number) => Math.max(0, I - t.valeur_residuelle) / Math.max(1, t.duree_amortissement);
export const finAmort = (t: Taxi) => addDays(addMonths(t.date_mise_service, 12 * t.duree_amortissement), -1);
export function amortTaxiPeriode(t: Taxi, I: number, a: string, b: string) {
  // Réparti au prorata des jours de la période d'amortissement : le total couru vaut exactement I − VR.
  const fin = finAmort(t), x = maxD(a, t.date_mise_service), y = minD(b, fin);
  if (y < x) return 0;
  const total = daysBetween(t.date_mise_service, fin) + 1;
  return Math.max(0, I - t.valeur_residuelle) * (daysBetween(x, y) + 1) / total;
}
export const amortPeriode = (d: Donnees, taxiId: string | null, a: string, b: string) =>
  taxisDe(d, taxiId).reduce((s, t) => s + amortTaxiPeriode(t, baseAmort(d, t.id), a, b), 0);

export function tableauAmort(t: Taxi, I: number) {
  const an = amortAnnuel(t, I), lignes = [];
  let cumul = 0;
  for (let i = 1; i <= t.duree_amortissement; i++) {
    cumul += an;
    lignes.push({ annee: i, debut: addMonths(t.date_mise_service, 12 * (i - 1)),
      fin: addDays(addMonths(t.date_mise_service, 12 * i), -1), dotation: an, cumul, vnc: I - cumul });
  }
  return { I, annuel: an, mensuel: an / 12, lignes, fin: finAmort(t) };
}

/* ------------------------------------------------------------ période */
export interface Periode {
  a: string; b: string;
  recettes: number; carburant: number; entretienJ: number; autresJ: number; prelevement: number;
  fixes: number; imprevus: number; entretienH: number; autresH: number; salaires: number;
  travail: number; repos: number; panne: number; saisies: number;
  entretien: number; depJournal: number; sorties: number; marge: number; amort: number; resultat: number;
  tauxMarge: number; recetteMoy: number; tresorerie: number;
}

export function periode(d: Donnees, taxiId: string | null, a: string, b: string): Periode {
  const r = { a, b, recettes: 0, carburant: 0, entretienJ: 0, autresJ: 0, prelevement: 0, fixes: 0, imprevus: 0,
    entretienH: 0, autresH: 0, salaires: 0, travail: 0, repos: 0, panne: 0, saisies: 0 };
  const f = dans(taxiId);
  for (const j of d.journees) {
    if (j.date < a || j.date > b || (taxiId && j.taxi_id !== taxiId)) continue;
    r.saisies++; r[j.statut]++;
    r.recettes += j.recette; r.carburant += j.carburant; r.entretienJ += j.entretien;
    r.autresJ += j.autres; r.prelevement += j.prelevement;
  }
  for (const p of d.depenses) {
    if (p.date < a || p.date > b || !f(p)) continue;
    if (p.type === "fixe") r.fixes += p.montant;
    else if (p.type === "imprevu") r.imprevus += p.montant;
    else if (p.type === "entretien") r.entretienH += p.montant;
    else r.autresH += p.montant;
  }
  for (const s of d.salaires) {
    if (s.type === "retenue" || s.date_paiement < a || s.date_paiement > b || !f(s)) continue;
    r.salaires += s.montant;
  }
  const depJournal = r.carburant + r.entretienJ + r.autresJ;
  const sorties = depJournal + r.fixes + r.imprevus + r.entretienH + r.autresH + r.salaires;
  const marge = r.recettes - sorties, amort = amortPeriode(d, taxiId, a, b);
  return { ...r, entretien: r.entretienJ + r.entretienH, depJournal, sorties, marge, amort, resultat: marge - amort,
    tauxMarge: r.recettes ? marge / r.recettes : 0, recetteMoy: r.travail ? r.recettes / r.travail : 0,
    tresorerie: marge - r.prelevement };
}

/* --------------------------------------------- bilan depuis la mise en service */
export function bilan(d: Donnees, taxiId: string | null, ref = today()) {
  const mise = debut(d, taxiId), I = investTotal(d, taxiId), fin = maxD(ref, mise);
  const p = periode(d, taxiId, mise, fin);
  const ecoules = Math.max(1, daysBetween(mise, fin) + 1);
  const deb = maxD(mise, addDays(fin, -59));
  const rec = periode(d, taxiId, deb, fin);
  const rythme = rec.marge / (daysBetween(deb, fin) + 1);
  const reste = Math.max(0, I - p.marge);
  const jRestants = p.marge >= I ? 0 : rythme > 0 ? Math.ceil(reste / rythme) : null;
  const taux = taxisDe(d, taxiId);
  const provision = taux.reduce((s, t) => s + periode(d, t.id, mise, fin).recettes * t.taux_imprevus, 0);
  const vnc = taux.reduce((s, t) => {
    const B = baseAmort(d, t.id);
    return s + Math.max(Math.min(t.valeur_residuelle, B), B - amortTaxiPeriode(t, B, t.date_mise_service, fin));
  }, 0);
  return {
    ...p, mise, I, ecoules, rythme, rythmeMois: rythme * 30.4375, recupere: p.marge,
    part: I ? p.marge / I : 0, reste, rembourse: I > 0 && p.marge >= I,
    dateRetour: I > 0 && p.marge >= I ? null : jRestants != null ? addDays(fin, jRestants) : null, jRestants,
    roiAnnuel: I ? (p.marge / ecoules) * 365.25 / I : 0, vnc,
    fonds: { provision, consomme: p.imprevus, solde: provision - p.imprevus }
  };
}
export type Bilan = ReturnType<typeof bilan>;

/** Séries mensuelles entre deux dates. */
export function serieMois(d: Donnees, taxiId: string | null, a: string, b: string) {
  const out: Array<Periode & { k: string; cumul: number; prevu: number }> = [];
  let k = monthStart(a), cumul = 0, g = 0;
  while (k <= b && g++ < 240) {
    const x = maxD(k, a), y = minD(monthEnd(k), b);
    const p = periode(d, taxiId, x, y);
    cumul += p.marge;
    out.push({ ...p, k: mKey(k), cumul, prevu: prevuPeriode(d, taxiId, x, y) });
    k = addMonths(k, 1);
  }
  return out;
}

/* ------------------------------------------------- détail des dépenses */
export interface LigneDep { id: string; date: string; libelle: string; montant: number; taxi_id: string | null; source: string; ref?: any }
export interface CatDep { cle: string; nom: string; groupe: string; total: number; lignes: LigneDep[] }

export function detailDepenses(d: Donnees, taxiId: string | null, a: string, b: string): CatDep[] {
  const cats = new Map<string, CatDep>();
  const add = (groupe: string, nom: string, l: LigneDep) => {
    const k = groupe + "|" + nom;
    if (!cats.has(k)) cats.set(k, { cle: k, nom, groupe, total: 0, lignes: [] });
    const c = cats.get(k)!; c.total += l.montant; c.lignes.push(l);
  };
  for (const j of d.journees) {
    if (j.date < a || j.date > b || (taxiId && j.taxi_id !== taxiId)) continue;
    const base = { date: j.date, taxi_id: j.taxi_id, source: "journal", ref: j };
    if (j.carburant) add("Exploitation", "Carburant", { ...base, id: j.id + "c", libelle: "Carburant du jour", montant: j.carburant });
    if (j.entretien) add("Entretien", "Entretien courant", { ...base, id: j.id + "e", libelle: j.note || "Entretien du jour", montant: j.entretien });
    if (j.autres) add("Exploitation", "Frais divers", { ...base, id: j.id + "a", libelle: j.note || "Autres frais du jour", montant: j.autres });
  }
  const groupe = { fixe: "Charges fixes", imprevu: "Imprévus", entretien: "Entretien", autre: "Autres dépenses" } as const;
  for (const p of d.depenses) {
    if (p.date < a || p.date > b || !dans(taxiId)(p)) continue;
    add(groupe[p.type], p.categorie, { id: p.id, date: p.date, libelle: p.libelle, montant: p.montant, taxi_id: p.taxi_id, source: "depense", ref: p });
  }
  const nomType = { salaire: "Salaires", avance: "Avances sur salaire", prime: "Primes" } as const;
  for (const s of d.salaires) {
    if (s.type === "retenue" || s.date_paiement < a || s.date_paiement > b || !dans(taxiId)(s)) continue;
    const ch = d.chauffeurs.find(c => c.id === s.chauffeur_id);
    add("Personnel", nomType[s.type], { id: s.id, date: s.date_paiement, libelle: ch?.nom || "Chauffeur", montant: s.montant, taxi_id: s.taxi_id, source: "salaire", ref: s });
  }
  for (const c of cats.values()) c.lignes.sort((x, y) => y.date.localeCompare(x.date));
  return [...cats.values()].sort((x, y) => y.total - x.total);
}

/* ------------------------------------------------- charges récurrentes */
export const mensualise = (c: Charge) => (!c.actif || c.frequence === "unique") ? 0 : c.montant / FREQ[c.frequence].mois;
export const fixesMensuelles = (d: Donnees, taxiId: string | null) =>
  d.charges.filter(dans(taxiId)).reduce((s, c) => s + mensualise(c), 0);

export function occurrences(c: Charge, a: string, b: string): string[] {
  if (!c.actif) return [];
  if (c.frequence === "unique") return c.date_debut >= a && c.date_debut <= b ? [c.date_debut] : [];
  const out: string[] = [], pas = FREQ[c.frequence].mois;
  for (let i = 0, x = c.date_debut; x <= b && i < 600; x = addMonths(c.date_debut, pas * ++i)) if (x >= a) out.push(x);
  return out;
}
export type Echeance = { cle: string; charge: Charge; date: string; montant: number; payee: boolean; statut: "payee" | "retard" | "proche" | "avenir" };

export function echeancier(d: Donnees, taxiId: string | null, horizon = 60, ref = today()): Echeance[] {
  const payees = new Set(d.depenses.filter(p => p.charge_id && p.echeance).map(p => `${p.charge_id}@${p.echeance}`));
  const fin = addDays(ref, horizon), out: Echeance[] = [];
  for (const c of d.charges.filter(dans(taxiId))) {
    const t = c.taxi_id ? d.taxis.find(x => x.id === c.taxi_id) : null;
    if (c.taxi_id && (!t || !t.actif)) continue;
    for (const x of occurrences(c, c.date_debut, fin)) {
      const k = `${c.id}@${x}`, ok = payees.has(k);
      out.push({ cle: k, charge: c, date: x, montant: c.montant, payee: ok,
        statut: ok ? "payee" : x < ref ? "retard" : daysBetween(ref, x) <= 7 ? "proche" : "avenir" });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* --------------------------------------------- plan prévisionnel par taxi */
export function plan(d: Donnees, t: Taxi, o: Partial<{ recetteJour: number; jours: number; carburantJour: number; entretienMois: number; salaireMois: number; invest: number; fixes: number }> = {}) {
  const ch = d.chauffeurs.find(c => c.id === t.chauffeur_id);
  const recetteJour = o.recetteJour ?? t.objectif_recette_jour, jours = o.jours ?? t.jours_par_mois;
  const carb = o.carburantJour ?? t.carburant_jour_prevu, entretien = o.entretienMois ?? t.entretien_mois_prevu;
  const recette = recetteJour * jours;
  const salaire = o.salaireMois ?? (!ch ? 0 : ch.remuneration === "salaire_fixe" ? ch.montant
    : ch.remuneration === "journalier" ? ch.montant * jours : ch.remuneration === "pourcentage" ? recette * ch.pourcentage / 100 : 0);
  const fixes = o.fixes ?? fixesMensuelles(d, t.id);
  const I = o.invest ?? investTaxi(d, t.id);
  const base = o.invest != null ? o.invest - (investTaxi(d, t.id) - baseAmort(d, t.id)) : baseAmort(d, t.id);
  const variable = carb * jours + entretien + salaire;
  const imprevus = recette * t.taux_imprevus;
  const marge = recette - variable - fixes - imprevus;
  const coutFixeJour = (entretien + fixes + (ch?.remuneration === "salaire_fixe" ? salaire : 0)) / Math.max(1, jours);
  const varJour = carb + (ch?.remuneration === "journalier" ? ch.montant : 0);
  const facteur = Math.max(0.01, 1 - t.taux_imprevus - (ch?.remuneration === "pourcentage" ? ch.pourcentage / 100 : 0));
  return {
    I, recette, variable, salaire, fixes, imprevus, marge, amort: amortAnnuel(t, Math.max(0, base)) / 12,
    retourMois: marge > 0 ? I / marge : null, roiAnnuel: I ? marge * 12 / I : 0,
    seuilJour: (varJour + coutFixeJour) / facteur,
    cible12: (varJour + coutFixeJour + I / 12 / Math.max(1, jours)) / facteur
  };
}
export function prevuPeriode(d: Donnees, taxiId: string | null, a: string, b: string) {
  return taxisDe(d, taxiId).reduce((s, t) => {
    const x = maxD(a, t.date_mise_service);
    if (b < x) return s;
    return s + plan(d, t).marge * (daysBetween(x, b) + 1) / 30.4375;
  }, 0);
}

/* ---------------------------------------------------- salaires dus */
export function salaireMois(d: Donnees, c: Chauffeur, mois: string) {
  const a = monthStart(mois), b = monthEnd(mois);
  const js = d.journees.filter(j => j.chauffeur_id === c.id && j.date >= a && j.date <= b && j.statut === "travail");
  const recettes = js.reduce((s, j) => s + j.recette, 0);
  const base = c.remuneration === "salaire_fixe" ? c.montant : c.remuneration === "journalier" ? c.montant * js.length
    : c.remuneration === "pourcentage" ? Math.round(recettes * c.pourcentage / 100) : 0;
  const ps = d.salaires.filter(s => s.chauffeur_id === c.id && s.periode === a);
  const som = (t: string) => ps.filter(s => s.type === t).reduce((x, s) => x + s.montant, 0);
  const retenues = som("retenue"), verse = som("salaire") + som("avance"), primes = som("prime");
  const du = Math.max(0, base - retenues);
  return { a, jours: js.length, recettes, base, retenues, du, salaire: som("salaire"), avances: som("avance"), primes, verse,
    reste: du - verse, paiements: ps.sort((x, y) => y.date_paiement.localeCompare(x.date_paiement)) };
}

/* ------------------------------------------------- jours non saisis */
export function joursManquants(d: Donnees, ref = today(), fenetre = 7) {
  const saisi = new Set(d.journees.map(j => `${j.taxi_id}@${j.date}`));
  const out: Array<{ taxi: Taxi; date: string }> = [];
  for (const t of taxisActifs(d))
    for (let i = 0; i < fenetre; i++) {
      const x = addDays(ref, -i);
      if (x >= t.date_mise_service && !saisi.has(`${t.id}@${x}`)) out.push({ taxi: t, date: x });
    }
  return out;
}

/* ------------------------------------------------------------ alertes */
export interface Alerte { cle: string; niveau: "rouge" | "ambre" | "info"; titre: string; detail: string; lien: string }
export function alertes(d: Donnees, ref = today()): Alerte[] {
  const out: Alerte[] = [];
  const ech = echeancier(d, null, 7, ref).filter(e => !e.payee);
  const retard = ech.filter(e => e.statut === "retard"), proche = ech.filter(e => e.statut === "proche");
  if (retard.length) out.push({ cle: `retard-${retard.map(e => e.cle).join(",")}`, niveau: "rouge",
    titre: `${retard.length} échéance${retard.length > 1 ? "s" : ""} en retard`,
    detail: retard.slice(0, 3).map(e => e.charge.libelle).join(", "), lien: "/depenses" });
  if (proche.length) out.push({ cle: `proche-${proche.map(e => e.cle).join(",")}`, niveau: "ambre",
    titre: `${proche.length} paiement${proche.length > 1 ? "s" : ""} dans les 7 jours`,
    detail: proche.slice(0, 3).map(e => `${e.charge.libelle} (${e.date.slice(8)}/${e.date.slice(5, 7)})`).join(", "), lien: "/depenses" });
  const manque = joursManquants(d, addDays(ref, -1), 7);
  if (manque.length >= 2) out.push({ cle: `manque-${ref}-${manque.length}`, niveau: "ambre",
    titre: `${manque.length} journée${manque.length > 1 ? "s" : ""} non saisie${manque.length > 1 ? "s" : ""} cette semaine`,
    detail: "Une journée oubliée fausse la marge et la date de retour sur investissement.", lien: "/saisie" });
  for (const t of taxisActifs(d)) {
    const p = periode(d, t.id, addDays(ref, -29), ref);
    if (p.travail >= 8 && t.objectif_recette_jour) {
      const e = p.recetteMoy / t.objectif_recette_jour - 1;
      if (e < -0.1) out.push({ cle: `objectif-${t.id}-${mKey(ref)}`, niveau: "ambre",
        titre: `${t.nom} : recette ${Math.round(-e * 100)} % sous l'objectif`,
        detail: `Moyenne sur 30 jours : ${Math.round(p.recetteMoy).toLocaleString("fr-FR")} FCFA pour ${t.objectif_recette_jour.toLocaleString("fr-FR")} visés.`, lien: `/taxis/${t.id}` });
    }
    if (MODES[t.mode].carburant && p.recettes > 0 && p.carburant / p.recettes > 0.42)
      out.push({ cle: `carb-${t.id}-${mKey(ref)}`, niveau: "ambre", titre: `${t.nom} : le carburant absorbe ${Math.round(p.carburant / p.recettes * 100)} % des recettes`,
        detail: "Au-delà de 40 %, vérifiez la consommation ou les trajets à vide.", lien: `/taxis/${t.id}` });
    if (p.panne >= 3) out.push({ cle: `panne-${t.id}-${mKey(ref)}`, niveau: "rouge", titre: `${t.nom} : ${p.panne} jours d'immobilisation en 30 jours`,
      detail: "Chaque jour d'arrêt coûte une recette entière.", lien: `/taxis/${t.id}` });
  }
  const b = bilan(d, null, ref);
  if (d.taxis.length && b.fonds.solde < 0) out.push({ cle: `fonds-${mKey(ref)}`, niveau: "rouge", titre: "Fonds d'imprévus épuisé",
    detail: `Les imprévus dépassent la provision de ${Math.round(-b.fonds.solde).toLocaleString("fr-FR")} FCFA.`, lien: "/depenses?onglet=fonds" });
  for (const c of d.chauffeurs.filter(c => c.actif && c.remuneration !== "versement")) {
    const prev = monthStart(addDays(monthStart(ref), -1)), s = salaireMois(d, c, prev);
    if (s.reste > 0 && s.base > 0) out.push({ cle: `salaire-${c.id}-${prev}`, niveau: "ambre",
      titre: `Salaire de ${c.nom} non soldé`, detail: `Reste ${s.reste.toLocaleString("fr-FR")} FCFA à verser pour le mois précédent.`, lien: "/chauffeurs" });
  }
  return out;
}
