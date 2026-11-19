/* Types métier — miroir exact des tables Supabase (supabase/migrations). */

export type Mode = "versement" | "direct" | "perso";
export type StatutJournee = "travail" | "repos" | "panne";
export type TypeDepense = "fixe" | "imprevu" | "entretien" | "autre";
export type Frequence = "mensuel" | "trimestriel" | "semestriel" | "annuel" | "unique";
export type Remuneration = "versement" | "salaire_fixe" | "journalier" | "pourcentage";
export type TypeSalaire = "salaire" | "avance" | "prime" | "retenue";

/** Colonnes communes de synchronisation. */
export interface Ligne {
  id: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/** Réglages du compte, partagés par tous les appareils (une seule ligne, id = identifiant du compte). */
export interface Parametres extends Ligne {
  entreprise: string;
  responsable: string | null;
  telephone: string | null;
  ville: string | null;
  theme: "auto" | "light" | "dark";
  rappel_actif: boolean;
  heure_rappel: number;
  alertes_masquees: string[];
}

export interface Taxi extends Ligne {
  nom: string;
  immatriculation: string | null;
  modele: string | null;
  annee: number | null;
  date_mise_service: string;
  km_initial: number;
  mode: Mode;
  chauffeur_id: string | null;
  objectif_recette_jour: number;
  jours_par_mois: number;
  carburant_jour_prevu: number;
  entretien_mois_prevu: number;
  duree_amortissement: number;
  valeur_residuelle: number;
  taux_imprevus: number;
  actif: boolean;
  note: string | null;
}

export interface Investissement extends Ligne {
  taxi_id: string;
  libelle: string;
  montant: number;
  ordre: number;
  /** false = frais de démarrage consommés (plein initial, nettoyage) : récupérés mais non amortis. */
  amortissable: boolean;
}

export interface Chauffeur extends Ligne {
  nom: string;
  telephone: string | null;
  numero_permis: string | null;
  date_embauche: string | null;
  remuneration: Remuneration;
  montant: number;
  pourcentage: number;
  actif: boolean;
  note: string | null;
}

export interface Journee extends Ligne {
  taxi_id: string;
  chauffeur_id: string | null;
  date: string;
  statut: StatutJournee;
  recette: number;
  carburant: number;
  entretien: number;
  autres: number;
  prelevement: number;
  km: number | null;
  note: string | null;
}

export interface Charge extends Ligne {
  taxi_id: string | null;
  libelle: string;
  categorie: string;
  montant: number;
  frequence: Frequence;
  date_debut: string;
  actif: boolean;
}

export interface Depense extends Ligne {
  taxi_id: string | null;
  date: string;
  type: TypeDepense;
  categorie: string;
  libelle: string;
  montant: number;
  charge_id: string | null;
  echeance: string | null;
  note: string | null;
}

export interface Salaire extends Ligne {
  chauffeur_id: string;
  taxi_id: string | null;
  periode: string;
  type: TypeSalaire;
  montant: number;
  date_paiement: string;
  note: string | null;
}

export interface Notif extends Ligne {
  cle: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  lu: boolean;
}

export interface Tables {
  parametres: Parametres;
  taxis: Taxi;
  investissements: Investissement;
  chauffeurs: Chauffeur;
  journees: Journee;
  charges: Charge;
  depenses: Depense;
  salaires: Salaire;
  notifications: Notif;
}
export type NomTable = keyof Tables;
export const TABLES: NomTable[] = ["parametres", "chauffeurs", "taxis", "investissements", "charges", "journees", "depenses", "salaires", "notifications"];

/** Jeu de données complet chargé en mémoire (lignes non supprimées). */
export type Donnees = { [K in NomTable]: Tables[K][] };
