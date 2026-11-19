/* Formatage FCFA et dates locales (AAAA-MM-JJ, sans décalage UTC). */

export const NB = "\u00A0"; // espace insécable (la fine U+202F manque dans certaines polices)

export const fmt = (n: number | null | undefined) =>
  Math.round(n || 0).toLocaleString("fr-FR").replace(/[\s ]/g, NB);
export const fcfa = (n: number | null | undefined) => fmt(n) + NB + "FCFA";
export const pct = (n: number, d = 1) =>
  (Number.isFinite(n) ? (n * 100).toFixed(d).replace(".", ",") : "—") + NB + "%";
export function court(n: number) {
  const a = Math.abs(n || 0), s = n < 0 ? "−" : "";
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(".", ",").replace(/,?0+$/, "") + NB + "M";
  if (a >= 1e3) return s + Math.round(a / 1e3) + NB + "k";
  return s + Math.round(a);
}
export const parseNum = (v: unknown) => {
  const d = String(v ?? "").replace(/[^\d]/g, "");
  return d ? parseInt(d, 10) : 0;
};

/* ------------------------------------------------------------- dates */
const p2 = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const D = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const today = () => iso(new Date());
export const addDays = (s: string, n: number) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
export function addMonths(s: string, n: number) {
  const d = D(s), j = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(j, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return iso(d);
}
export const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 864e5);
export const monthStart = (s: string) => s.slice(0, 8) + "01";
export const monthEnd = (s: string) => { const d = D(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
export const mKey = (s: string) => s.slice(0, 7);
export const minD = (a: string, b: string) => (a < b ? a : b);
export const maxD = (a: string, b: string) => (a > b ? a : b);

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const moisLabel = (k: string, c = false) => {
  const [y, m] = k.split("-");
  return c ? `${MOIS_C[+m - 1]} ${y.slice(2)}` : `${MOIS[+m - 1]} ${y}`;
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dateLong = (s: string) => cap(D(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
export const dateCourt = (s: string) => D(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export const dateMini = (s: string) => D(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const heureRel = (isoTs: string) => {
  const s = (Date.now() - new Date(isoTs).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(isoTs).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
