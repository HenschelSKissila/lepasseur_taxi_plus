/* Valeurs par défaut — hypothèses Brazzaville, à ajuster par l'utilisateur. */
import type { Taxi, Investissement, Charge, Mode, Chauffeur } from "./types";
import { uuid } from "./ids";
import { today, addMonths } from "./format";

/** Frais de démarrage d'un taxi d'occasion à Brazzaville (estimations à confirmer localement).
 *  [libellé, montant, amortissable]
 *  - amortissable : bien durable, amorti sur la durée de vie du véhicule
 *  - non amortissable : dépense consommée au démarrage, récupérée par la marge mais sans valeur résiduelle
 *  L'assurance, la patente, les droits d'auteur, la taxe de roulage et le stationnement sont des
 *  charges annuelles : leur première échéance est payée au démarrage (voir chargesDefaut). */
export const INVEST_DEFAUT: Array<[string, number, boolean]> = [
  ["Achat du véhicule (occasion type Corolla)", 2300000, true],      // marché : 1,5 – 3 M
  ["Peinture complète vert / blanc", 200000, true],                   // 100 000 – 300 000
  ["Carte grise définitive", 30000, true],
  ["Certificat de vente", 20000, true],
  ["Numérotage taxi (obligatoire)", 20000, true],
  ["Réservation de plaque d'immatriculation", 100000, true],          // facultatif si le véhicule a déjà des plaques
  ["Révision mécanique avant mise en route", 80000, true],
  ["Équipements (extincteur, triangle, trousse)", 30000, true],
  ["Premier plein d'essence (50 L × 775)", 38750, false],             // prix officiel du super
  ["Nettoyage initial complet", 1000, false]                          // 700 – 1 000
];

export const PLAN_DEFAUT: Record<Mode, Pick<Taxi, "objectif_recette_jour" | "jours_par_mois" | "carburant_jour_prevu" | "entretien_mois_prevu">> = {
  // entretien prévu = entretien courant (~500 /jour, pneus, freins) + lavage (~5 000 /semaine)
  versement: { objectif_recette_jour: 20000, jours_par_mois: 26, carburant_jour_prevu: 0, entretien_mois_prevu: 35000 },
  direct: { objectif_recette_jour: 45000, jours_par_mois: 26, carburant_jour_prevu: 12500, entretien_mois_prevu: 35000 },
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
  INVEST_DEFAUT.map(([libelle, montant, amortissable], ordre) => ({ id: uuid(), taxi_id: taxiId, libelle, montant, ordre, amortissable }));

/** Charges récurrentes : impôts, taxes et frais périodiques. Les échéances annuelles tombent à la
 *  date de mise en service ; l'assistant propose de les marquer « payées au démarrage ». */
export const CHARGES_DEFAUT: Array<[string, string, number, Charge["frequence"], number]> = [
  // [libellé, catégorie, montant, fréquence, décalage en mois de la 1re échéance]
  ["Assurance responsabilité civile (usage taxi)", "Assurance", 100000, "annuel", 0],   // 60 000 – 120 000
  ["Patente", "Impôts & taxes", 36500, "annuel", 0],
  ["Droits d'auteur (BCDA) – musique à bord", "Impôts & taxes", 10000, "annuel", 0],
  ["Taxe de roulage", "Impôts & taxes", 10000, "annuel", 0],                            // 7 000 ou 10 000 selon CV ; exonération taxi à vérifier (LF 2026)
  ["Droit de stationnement", "Impôts & taxes", 5000, "annuel", 0],
  ["Visite technique", "Contrôle technique", 25000, "semestriel", 0],
  ["Vidange + filtres", "Entretien programmé", 20000, "mensuel", 1]
];
export function chargesDefaut(taxiId: string, mise: string): Charge[] {
  return CHARGES_DEFAUT.map(([libelle, categorie, montant, frequence, decalage]) =>
    ({ id: uuid(), taxi_id: taxiId, libelle, categorie, montant, frequence, date_debut: addMonths(mise, decalage), actif: true }));
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
