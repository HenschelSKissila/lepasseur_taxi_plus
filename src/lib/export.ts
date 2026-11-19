/* Exports : CSV compatibles Excel (séparateur « ; », UTF-8 avec BOM) et sauvegarde JSON complète. */
import type { Donnees, NomTable } from "./types";
import { TABLES } from "./types";
import { today } from "./format";

export function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (lignes: unknown[][]) => "﻿" + lignes.map(l => l.map(cell).join(";")).join("\r\n");

export function exporterJournees(d: Donnees) {
  const tx = new Map(d.taxis.map(t => [t.id, t.nom])), ch = new Map(d.chauffeurs.map(c => [c.id, c.nom]));
  const l: unknown[][] = [["Date", "Taxi", "Statut", "Chauffeur", "Recette", "Carburant", "Entretien", "Autres", "Prélèvement", "Km", "Note"]];
  [...d.journees].sort((a, b) => a.date.localeCompare(b.date)).forEach(j =>
    l.push([j.date, tx.get(j.taxi_id), j.statut, ch.get(j.chauffeur_id || "") || "", j.recette, j.carburant, j.entretien, j.autres, j.prelevement, j.km ?? "", j.note ?? ""]));
  telecharger(`journees-${today()}.csv`, csv(l), "text/csv;charset=utf-8");
}
export function exporterDepenses(d: Donnees) {
  const tx = new Map(d.taxis.map(t => [t.id, t.nom]));
  const l: unknown[][] = [["Date", "Taxi", "Type", "Catégorie", "Libellé", "Montant", "Échéance", "Note"]];
  [...d.depenses].sort((a, b) => a.date.localeCompare(b.date)).forEach(p =>
    l.push([p.date, p.taxi_id ? tx.get(p.taxi_id) : "Flotte", p.type, p.categorie, p.libelle, p.montant, p.echeance ?? "", p.note ?? ""]));
  telecharger(`depenses-${today()}.csv`, csv(l), "text/csv;charset=utf-8");
}
export function exporterSalaires(d: Donnees) {
  const ch = new Map(d.chauffeurs.map(c => [c.id, c.nom])), tx = new Map(d.taxis.map(t => [t.id, t.nom]));
  const l: unknown[][] = [["Date de paiement", "Chauffeur", "Mois", "Type", "Montant", "Taxi", "Note"]];
  [...d.salaires].sort((a, b) => a.date_paiement.localeCompare(b.date_paiement)).forEach(s =>
    l.push([s.date_paiement, ch.get(s.chauffeur_id), s.periode.slice(0, 7), s.type, s.montant, s.taxi_id ? tx.get(s.taxi_id) : "", s.note ?? ""]));
  telecharger(`salaires-${today()}.csv`, csv(l), "text/csv;charset=utf-8");
}
export function exporterJSON(d: Donnees) {
  telecharger(`le-passeur-taxi-plus-sauvegarde-${today()}.json`,
    JSON.stringify({ app: "le-passeur-taxi-plus", version: 2, exporte_le: new Date().toISOString(), donnees: d }, null, 1), "application/json");
}
/** Lit une sauvegarde et la valide. */
export function lireSauvegarde(texte: string): Donnees {
  const o = JSON.parse(texte);
  const src = o?.donnees ?? o;
  if (!src || !Array.isArray(src.taxis)) throw new Error("Fichier non reconnu : ce n'est pas une sauvegarde LE PASSEUR TAXI+.");
  const out = {} as Donnees;
  for (const t of TABLES) (out as any)[t] = Array.isArray(src[t]) ? src[t].map(({ owner_id, updated_at, deleted_at, ...r }: any) => r) : [];
  return out;
}
export const tablesAvecDonnees = (d: Donnees) => TABLES.filter((t: NomTable) => d[t].length);
