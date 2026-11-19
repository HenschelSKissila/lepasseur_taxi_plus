/* Sélection de période partagée par le tableau de bord, les dépenses et les rapports. */
import { useState } from "react";
import { today, monthStart, monthEnd, addMonths, addDays } from "./format";

export type Preset = "mois" | "moisprec" | "trim" | "annee" | "tout" | "perso";
export const PRESETS: Array<[Preset, string]> = [["mois", "Ce mois"], ["moisprec", "Mois préc."], ["trim", "3 mois"], ["annee", "Année"], ["tout", "Tout"]];

export function bornes(p: Preset, debutDonnees: string, perso?: { a: string; b: string }) {
  const t = today();
  switch (p) {
    case "mois": return { a: monthStart(t), b: t };
    case "moisprec": { const m = monthStart(addMonths(monthStart(t), -1)); return { a: m, b: monthEnd(m) }; }
    case "trim": return { a: monthStart(addMonths(t, -2)), b: t };
    case "annee": return { a: t.slice(0, 4) + "-01-01", b: t };
    case "tout": return { a: debutDonnees < t ? debutDonnees : addDays(t, -30), b: t };
    case "perso": return perso || { a: monthStart(t), b: t };
  }
}

/** Mémorise le choix de période et de taxi d'un écran à l'autre pendant la session. */
const memo: { preset: Preset; taxi: string } = { preset: "mois", taxi: "" };
export function useFiltre() {
  const [preset, setP] = useState<Preset>(memo.preset);
  const [taxi, setT] = useState<string>(memo.taxi);
  return {
    preset, taxi, taxiId: taxi || null,
    setPreset: (p: Preset) => { memo.preset = p; setP(p); },
    setTaxi: (t: string) => { memo.taxi = t; setT(t); }
  };
}
