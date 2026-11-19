import { PRESETS, type Preset } from "../lib/periode";
import type { Taxi } from "../lib/types";

export function Filtres({ preset, setPreset, taxi, setTaxi, taxis, sansTaxi }: {
  preset: Preset; setPreset: (p: Preset) => void; taxi: string; setTaxi: (t: string) => void; taxis: Taxi[]; sansTaxi?: boolean;
}) {
  return <div className="toolbar">
    <div className="chips" role="group" aria-label="Période">
      {PRESETS.map(([k, l]) => <button key={k} className={`chip ${preset === k ? "on" : ""}`} style={{ fontFamily: "var(--sans)" }}
        aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
    </div>
    {!sansTaxi && taxis.length > 1 && <select className="input" value={taxi} onChange={e => setTaxi(e.target.value)} aria-label="Taxi">
      <option value="">Toute la flotte</option>
      {taxis.map(t => <option key={t.id} value={t.id}>{t.nom}{t.actif ? "" : " (archivé)"}</option>)}
    </select>}
  </div>;
}
