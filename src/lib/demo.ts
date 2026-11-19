/* Jeu de démonstration réaliste : deux taxis, trois chauffeurs, ~6 mois d'activité. */
import type { Donnees, Journee, Depense, Salaire, Chauffeur, Taxi } from "./types";
import { investDefaut, chargesDefaut, PLAN_DEFAUT } from "./defaults";
import { echeancier, salaireMois } from "./finance";
import { idJournee, idPaiement, uuid } from "./ids";
import { today, addDays, D, monthStart, addMonths, monthEnd } from "./format";

export function genererDemo(ref = today()): Donnees {
  let seed = 20261119;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

  const prosper: Chauffeur = { id: uuid(), nom: "Prosper Ngoma", telephone: "06 612 34 56", numero_permis: "BZV-118734",
    date_embauche: addDays(ref, -200), remuneration: "versement", montant: 0, pourcentage: 0, actif: true, note: null };
  const serge: Chauffeur = { id: uuid(), nom: "Serge Mabiala", telephone: "05 534 78 90", numero_permis: "BZV-120551",
    date_embauche: addDays(ref, -100), remuneration: "pourcentage", montant: 0, pourcentage: 30, actif: true, note: null };
  const eric: Chauffeur = { id: uuid(), nom: "Éric Loubaki", telephone: "06 987 11 22", numero_permis: "BZV-097312",
    date_embauche: addDays(ref, -100), remuneration: "journalier", montant: 5000, pourcentage: 0, actif: true, note: "Chauffeur de relève" };

  const t1: Taxi = { id: uuid(), nom: "Taxi 01", immatriculation: "BZV 4821 A", modele: "Toyota Corolla", annee: 2013,
    date_mise_service: addDays(ref, -170), km_initial: 186400, mode: "versement", chauffeur_id: prosper.id,
    ...PLAN_DEFAUT.versement, duree_amortissement: 5, valeur_residuelle: 600000, taux_imprevus: 0.1, actif: true, note: null };
  const t2: Taxi = { id: uuid(), nom: "Taxi 02", immatriculation: "BZV 5137 B", modele: "Hyundai Accent", annee: 2014,
    date_mise_service: addDays(ref, -95), km_initial: 142900, mode: "direct", chauffeur_id: serge.id,
    ...PLAN_DEFAUT.direct, duree_amortissement: 5, valeur_residuelle: 650000, taux_imprevus: 0.1, actif: true, note: null };

  const inv = [...investDefaut(t1.id), ...investDefaut(t2.id)];
  inv.filter(i => i.taxi_id === t2.id && i.ordre === 0).forEach(i => (i.montant = 2650000));
  const charges = [...chargesDefaut(t1.id, t1.date_mise_service), ...chargesDefaut(t2.id, t2.date_mise_service)];

  const journees: Journee[] = [];
  for (const t of [t1, t2]) {
    let km = t.km_initial;
    for (let x = t.date_mise_service; x < ref; x = addDays(x, 1)) {
      const base = { id: idJournee(t.id, x), taxi_id: t.id, date: x, carburant: 0, entretien: 0, autres: 0, prelevement: 0, km: null as number | null, note: null as string | null };
      if (D(x).getDay() === 0) { journees.push({ ...base, chauffeur_id: null, statut: "repos", recette: 0 }); continue; }
      if (rnd() < 0.022) { journees.push({ ...base, chauffeur_id: null, statut: "panne", recette: 0, note: "Immobilisé au garage" }); continue; }
      km += ri(140, 230);
      if (t.mode === "versement") {
        const manque = rnd() < 0.12;
        journees.push({ ...base, chauffeur_id: prosper.id, statut: "travail", km,
          recette: manque ? ri(20, 32) * 500 : ri(37, 44) * 500,
          entretien: rnd() < 0.05 ? ri(4, 16) * 500 : 0, autres: rnd() < 0.12 ? ri(2, 4) * 500 : 0,
          note: manque ? "Versement incomplet" : null });
      } else {
        const releve = D(x).getDay() === 6;
        journees.push({ ...base, chauffeur_id: releve ? eric.id : serge.id, statut: "travail", km,
          recette: ri(80, 112) * 500, carburant: ri(24, 32) * 500,
          entretien: rnd() < 0.05 ? ri(4, 16) * 500 : 0, autres: rnd() < 0.15 ? ri(2, 6) * 500 : 0 });
      }
    }
  }

  const d: Donnees = { taxis: [t1, t2], investissements: inv, chauffeurs: [prosper, serge, eric], journees, charges,
    depenses: [], salaires: [], notifications: [] };

  // Échéances passées payées, sauf la dernière vidange de chaque taxi (pour montrer un retard)
  const ech = echeancier(d, null, 0, ref);
  const dernieres = new Set(["Taxi 01", "Taxi 02"].map(n => ech.filter(e => e.charge.categorie === "Entretien programmé"
    && e.charge.taxi_id === (n === "Taxi 01" ? t1.id : t2.id)).pop()?.cle));
  const depenses: Depense[] = ech.filter(e => !dernieres.has(e.cle)).map(e => ({
    id: idPaiement(e.charge.id, e.date), taxi_id: e.charge.taxi_id, date: e.date, type: "fixe" as const,
    categorie: e.charge.categorie, libelle: e.charge.libelle, montant: e.montant, charge_id: e.charge.id, echeance: e.date, note: null }));
  const imp: Array<[Taxi, number, string, string, string, number]> = [
    [t1, 18, "imprevu", "Pneumatique", "Crevaison + réparation", 15000], [t1, 41, "imprevu", "Amende / contrôle", "Contrôle routier", 10000],
    [t1, 67, "imprevu", "Panne mécanique", "Remplacement alternateur", 75000], [t1, 96, "imprevu", "Électricité / batterie", "Batterie neuve", 55000],
    [t1, 121, "imprevu", "Accident / carrosserie", "Rétroviseur + pare-chocs", 40000], [t1, 88, "entretien", "Freins", "Plaquettes avant", 30000],
    [t2, 22, "imprevu", "Pneumatique", "Deux pneus avant", 50000], [t2, 57, "imprevu", "Panne mécanique", "Pompe à eau", 45000],
    [t2, 70, "entretien", "Amortisseurs", "Amortisseurs arrière", 60000]
  ];
  for (const [t, j, type, categorie, libelle, montant] of imp) {
    const x = addDays(t.date_mise_service, j);
    if (x < ref) depenses.push({ id: uuid(), taxi_id: t.id, date: x, type: type as Depense["type"], categorie, libelle, montant, charge_id: null, echeance: null, note: null });
  }
  depenses.push({ id: uuid(), taxi_id: null, date: addDays(ref, -40), type: "autre", categorie: "Administratif",
    libelle: "Frais de tenue de compte", montant: 12000, charge_id: null, echeance: null, note: null });
  d.depenses = depenses;

  // Salaires : mois passés soldés, mois courant avec une avance
  const salaires: Salaire[] = [];
  for (const c of [serge, eric]) {
    for (let m = monthStart(t2.date_mise_service); m < monthStart(ref); m = addMonths(m, 1)) {
      const s = salaireMois(d, c, m);
      if (s.du > 0) salaires.push({ id: uuid(), chauffeur_id: c.id, taxi_id: t2.id, periode: m, type: "salaire", montant: s.du,
        date_paiement: addDays(monthEnd(m), 2) > ref ? ref : addDays(monthEnd(m), 2), note: null });
    }
  }
  salaires.push({ id: uuid(), chauffeur_id: serge.id, taxi_id: t2.id, periode: monthStart(ref), type: "avance", montant: 40000,
    date_paiement: addDays(monthStart(ref), Math.min(9, Math.max(0, Number(ref.slice(8)) - 1))), note: "Avance demandée" });
  d.salaires = salaires;
  return d;
}
