/* Valeurs par défaut — hypothèses Brazzaville, à ajuster par l'utilisateur. */
import type { Taxi, Investissement, Charge, Mode, Chauffeur } from "./types";
import { uuid } from "./ids";
import { today, addMonths } from "./format";

/** Base d'environ 3 000 000 FCFA pour un taxi d'occasion mis en conformité. */
export const INVEST_DEFAUT: Array<[string, number]> = [
  ["Achat du véhicule (occasion)", 2400000],
  ["Peinture réglementaire vert / blanc", 120000],
  ["Carte grise (mutation)", 80000],
  ["Certificat de vente", 20000],
  ["Plaque d'immatriculation", 100000],
  ["Licence / autorisation de taxi", 100000],
  ["Révision complète avant mise en route", 80000],
  ["Équipements (extincteur, triangle, trousse)", 30000],
  ["Divers & frais de démarrage", 70000]
];

export const PLAN_DEFAUT: Record<Mode, Pick<Taxi, "objectif_recette_jour" | "jours_par_mois" | "carburant_jour_prevu" | "entretien_mois_prevu">> = {
  versement: { objectif_recette_jour: 20000, jours_par_mois: 26, carburant_jour_prevu: 0, entretien_mois_prevu: 30000 },
  direct: { objectif_recette_jour: 45000, jours_par_mois: 26, carburant_jour_prevu: 13000, entretien_mois_prevu: 40000 },
  perso: { objectif_recette_jour: 35000, jours_par_mois: 24, carburant_jour_prevu: 12000, entretien_mois_prevu: 35000 }
};

export function nouveauTaxi(mode: Mode = "versement", n = 1): Taxi {
  return {
    id: uuid(), nom: `Taxi ${String(n).padStart(2, "0")}`, immatriculation: "", modele: "Toyota Corolla", annee: null,
    date_mise_service: today(), km_initial: 0, mode, chauffeur_id: null, ...PLAN_DEFAUT[mode],
    duree_amortissement: 5, valeur_residuelle: 600000, taux_imprevus: 0.1, actif: true, note: null
  };
}

export const investDefaut = (taxiId: string): Investissement[] =>
  INVEST_DEFAUT.map(([libelle, montant], ordre) => ({ id: uuid(), taxi_id: taxiId, libelle, montant, ordre }));

export function chargesDefaut(taxiId: string, mise: string): Charge[] {
  const c: Array<[string, string, number, Charge["frequence"], string]> = [
    ["Assurance responsabilité civile", "Assurance", 250000, "annuel", mise],
    ["Visite technique", "Contrôle technique", 25000, "semestriel", mise],
    ["Taxe municipale / droit de stationnement", "Taxes & licences", 5000, "mensuel", mise],
    ["Vidange + filtres", "Entretien programmé", 25000, "mensuel", addMonths(mise, 1)]
  ];
  return c.map(([libelle, categorie, montant, frequence, date_debut]) =>
    ({ id: uuid(), taxi_id: taxiId, libelle, categorie, montant, frequence, date_debut, actif: true }));
}

export function nouveauChauffeur(): Chauffeur {
  return { id: uuid(), nom: "", telephone: "", numero_permis: "", date_embauche: today(), remuneration: "versement",
    montant: 0, pourcentage: 0, actif: true, note: null };
}

export const REMUNERATION = {
  versement: { nom: "Versement", detail: "Le chauffeur garde le surplus après son versement : pas de salaire." },
  salaire_fixe: { nom: "Salaire mensuel fixe", detail: "Montant fixe chaque mois." },
  journalier: { nom: "Paiement par jour", detail: "Montant par jour travaillé, compté depuis le journal." },
  pourcentage: { nom: "Pourcentage des recettes", detail: "Part des recettes qu'il a réalisées dans le mois." }
} as const;
