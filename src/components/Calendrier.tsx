import { MODES, depJournee } from "../lib/finance";
import { D, addMonths, addDays, monthEnd, mKey, moisLabel, today, dateLong } from "../lib/format";
import type { Journee, Taxi } from "../lib/types";
import { Icon } from "./Icon";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Calendrier mensuel coloré selon la marge du jour par rapport à l'objectif. */
export function Calendrier({ taxi, journees, mois, setMois, onJour }: {
  taxi: Taxi; journees: Journee[]; mois: string; setMois: (m: string) => void; onJour: (date: string) => void;
}) {
  const t = today(), m0 = mois + "-01", m1 = monthEnd(m0);
  const parDate = new Map(journees.filter(j => j.taxi_id === taxi.id).map(j => [j.date, j]));
  const cible = taxi.objectif_recette_jour || 1, carb = MODES[taxi.mode].carburant;
  const cases: React.ReactNode[] = JOURS.map(j => <div key={j} className="dw">{j}</div>);
  for (let i = 0; i < (D(m0).getDay() + 6) % 7; i++) cases.push(<div key={"v" + i} className="d out" />);
  let manque = 0;
  for (let x = m0; x <= m1; x = addDays(x, 1)) {
    const j = parDate.get(x), off = x < taxi.date_mise_service || x > t;
    let cls = "d", txt = "";
    if (off) cls += " off";
    else if (!j) { cls += " todo"; txt = "—"; manque++; }
    else if (j.statut === "repos") { cls += " repos"; txt = "repos"; }
    else if (j.statut === "panne") { cls += " panne"; txt = "panne"; }
    else {
      const mg = j.recette - depJournee(j);
      cls += mg < 0 ? " loss" : mg >= cible * (carb ? .55 : .95) ? " w3" : mg >= cible * (carb ? .35 : .7) ? " w2" : " w1";
      txt = Math.abs(mg) >= 1000 ? (Math.round(mg / 500) / 2).toString().replace(".", ",").replace("-", "−") + "k" : String(mg);
    }
    if (x === t) cls += " today";
    cases.push(<button key={x} className={cls} disabled={off} onClick={() => onJour(x)} aria-label={dateLong(x)}>
      <span className="n">{D(x).getDate()}</span><span className="m">{txt}</span></button>);
  }
  const premier = mKey(taxi.date_mise_service), dernier = mKey(t);
  return <div className="card">
    <div className="cal-head">
      <button className="icon-btn" disabled={mois <= premier} style={{ opacity: mois <= premier ? .3 : 1 }} onClick={() => setMois(mKey(addMonths(m0, -1)))} aria-label="Mois précédent"><Icon n="left" /></button>
      <h3>{moisLabel(mois)}</h3>
      <button className="icon-btn" disabled={mois >= dernier} style={{ opacity: mois >= dernier ? .3 : 1 }} onClick={() => setMois(mKey(addMonths(m0, 1)))} aria-label="Mois suivant"><Icon n="right" /></button>
    </div>
    <div className="cal">{cases}</div>
    <div className="legend">
      <span><i style={{ background: "color-mix(in srgb,var(--brand) 30%,var(--surface))" }} />Objectif atteint</span>
      <span><i style={{ background: "color-mix(in srgb,var(--brand) 9%,var(--surface))" }} />Sous l'objectif</span>
      <span><i style={{ background: "var(--red-soft)" }} />Perte / panne</span>
      <span><i style={{ background: "var(--surface-2)", border: "1px dashed var(--faint)" }} />À saisir{manque ? ` (${manque})` : ""}</span>
    </div>
  </div>;
}
