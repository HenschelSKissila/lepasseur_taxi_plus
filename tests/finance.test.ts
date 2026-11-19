import { describe, it, expect } from "vitest";
import { genererDemo } from "../src/lib/demo";
import * as F from "../src/lib/finance";
import { idJournee, uuidStable } from "../src/lib/ids";
import { addDays, addMonths, monthStart } from "../src/lib/format";
import type { Donnees, Taxi } from "../src/lib/types";

const REF = "2026-11-19";
const d = genererDemo(REF);
const [t1, t2] = d.taxis;

describe("investissement et amortissement", () => {
  it("frais de démarrage par défaut : 2 819 750 FCFA, dont 2 780 000 amortissables", () => {
    expect(F.investTaxi(d, t1.id)).toBe(2_819_750);
    expect(F.baseAmort(d, t1.id)).toBe(2_780_000);
    expect(F.investTotal(d, null)).toBe(F.investTaxi(d, t1.id) + F.investTaxi(d, t2.id));
  });
  it("amortissement linéaire sur la seule part amortissable : (base − VR) / durée", () => {
    expect(F.amortAnnuel(t1, F.baseAmort(d, t1.id))).toBe(436_000);
    const tab = F.tableauAmort(t1, F.baseAmort(d, t1.id));
    expect(tab.lignes).toHaveLength(5);
    expect(tab.lignes.at(-1)!.vnc).toBe(600_000);
  });
  it("amortissement couru au jour près et plafonné à la durée", () => {
    const an = F.amortTaxiPeriode(t1, 2_780_000, t1.date_mise_service, addDays(addMonths(t1.date_mise_service, 12), -1));
    expect(Math.round(an)).toBeGreaterThan(435_000);
    expect(Math.round(an)).toBeLessThan(437_000);
    const tout = F.amortTaxiPeriode(t1, 2_780_000, "2000-01-01", "2099-01-01");
    expect(Math.round(tout)).toBe(2_180_000);
  });
  it("budget de démarrage = investissement + premières échéances payées à la mise en service", () => {
    const b = F.budgetDemarrage(d, t1);
    expect(b.premieresCharges).toBe(100_000 + 36_500 + 10_000 + 10_000 + 5_000 + 25_000);
    expect(b.total).toBe(2_819_750 + 186_500);
  });
});

describe("période et bilan", () => {
  it("marge = entrées − sorties, résultat = marge − amortissement", () => {
    const p = F.periode(d, null, "2026-01-01", REF);
    expect(p.marge).toBe(p.recettes - p.sorties);
    expect(p.resultat).toBeCloseTo(p.marge - p.amort, 6);
    expect(p.sorties).toBe(p.carburant + p.entretienJ + p.autresJ + p.fixes + p.imprevus + p.entretienH + p.autresH + p.salaires);
  });
  it("la flotte est la somme des taxis plus les dépenses communes", () => {
    const f = F.periode(d, null, "2026-01-01", REF);
    const a = F.periode(d, t1.id, "2026-01-01", REF), b = F.periode(d, t2.id, "2026-01-01", REF);
    const communes = d.depenses.filter(x => !x.taxi_id).reduce((s, x) => s + x.montant, 0);
    expect(f.recettes).toBe(a.recettes + b.recettes);
    expect(f.sorties).toBe(a.sorties + b.sorties + communes);
  });
  it("le détail des dépenses totalise exactement les sorties", () => {
    const a = "2026-01-01";
    const tot = F.detailDepenses(d, null, a, REF).reduce((s, c) => s + c.total, 0);
    expect(tot).toBe(F.periode(d, null, a, REF).sorties);
  });
  it("bilan : récupération partielle et date de retour projetée", () => {
    const b = F.bilan(d, t1.id, REF);
    expect(b.part).toBeGreaterThan(0.3);
    expect(b.part).toBeLessThan(1);
    expect(b.dateRetour! > REF).toBe(true);
    expect(b.fonds.provision).toBeCloseTo(b.recettes * 0.1, 6);
  });
});

describe("échéancier et salaires", () => {
  it("une échéance payée n'est plus en retard ; la vidange non payée l'est", () => {
    const e = F.echeancier(d, t1.id, 0, REF);
    expect(e.some(x => x.statut === "retard" && x.charge.categorie === "Entretien programmé")).toBe(true);
    expect(e.filter(x => x.charge.categorie === "Assurance").every(x => x.payee)).toBe(true);
  });
  it("salaire au pourcentage = % des recettes du chauffeur, moins ce qui est versé", () => {
    const serge = d.chauffeurs.find(c => c.remuneration === "pourcentage")!;
    const s = F.salaireMois(d, serge, monthStart(REF));
    expect(s.base).toBe(Math.round(s.recettes * 0.3));
    expect(s.avances).toBe(40_000);
    expect(s.reste).toBe(s.du - s.verse);
  });
  it("salaire journalier = jours travaillés × montant", () => {
    const eric = d.chauffeurs.find(c => c.remuneration === "journalier")!;
    const s = F.salaireMois(d, eric, monthStart(addMonths(REF, -1)));
    expect(s.base).toBe(s.jours * 5000);
  });
});

describe("plan prévisionnel", () => {
  it("versement 20 000 × 26 jours : retour en moins d'un an", () => {
    const p = F.plan(d, t1);
    expect(p.recette).toBe(520_000);
    expect(p.retourMois!).toBeGreaterThan(5);
    expect(p.retourMois!).toBeLessThan(12);
  });
  it("au seuil de rentabilité, la marge prévue est nulle", () => {
    const p = F.plan(d, t2);
    const auSeuil = F.plan(d, t2, { recetteJour: p.seuilJour });
    expect(Math.abs(auSeuil.marge)).toBeLessThan(1);
    const cible = F.plan(d, t2, { recetteJour: p.cible12 });
    expect(cible.retourMois!).toBeCloseTo(12, 5);
  });
});

describe("synchronisation", () => {
  it("identifiant de journée stable entre appareils et au format UUID", () => {
    expect(idJournee("abc", "2026-11-19")).toBe(idJournee("abc", "2026-11-19"));
    expect(idJournee("abc", "2026-11-19")).not.toBe(idJournee("abc", "2026-11-20"));
    expect(uuidStable("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("jeu vide", () => {
  it("aucune division par zéro sans données", () => {
    const vide: Donnees = { taxis: [], investissements: [], chauffeurs: [], journees: [], charges: [], depenses: [], salaires: [], notifications: [] };
    const b = F.bilan(vide, null, REF);
    expect(b.part).toBe(0); expect(b.marge).toBe(0);
    expect(F.alertes(vide, REF)).toEqual([]);
    const t: Taxi = { ...t1, id: "x" };
    expect(F.plan({ ...vide, taxis: [t] }, t).retourMois).toBe(0);
  });
});
