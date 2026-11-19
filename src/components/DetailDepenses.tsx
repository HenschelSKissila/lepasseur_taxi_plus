import { useState } from "react";
import { Icon } from "./Icon";
import { COULEURS } from "./charts";
import { fmt, dateMini } from "../lib/format";
import type { CatDep } from "../lib/finance";
import type { Taxi } from "../lib/types";

/** Liste des catégories de dépenses, dépliable jusqu'à la ligne individuelle. */
export function DetailDepenses({ cats, taxis, onLigne }: { cats: CatDep[]; taxis: Taxi[]; onLigne?: (l: CatDep["lignes"][number]) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const total = cats.reduce((s, c) => s + c.total, 0);
  const nomTaxi = (id: string | null) => id ? taxis.find(t => t.id === id)?.nom ?? "" : "Flotte";
  return <div className="card flush">
    {cats.map((c, i) => <div key={c.cle} className={`cat ${ouvert === c.cle ? "open" : ""}`}>
      <button onClick={() => setOuvert(ouvert === c.cle ? null : c.cle)} aria-expanded={ouvert === c.cle}>
        <span className="sw" style={{ background: COULEURS[i % COULEURS.length] }} />
        <span className="nm"><b>{c.nom}</b><span>{c.groupe} · {c.lignes.length} opération{c.lignes.length > 1 ? "s" : ""}</span></span>
        <span className="tot">{fmt(c.total)}<small>{total ? Math.round(c.total / total * 100) : 0} %</small></span>
        <Icon n="right" className="i chev" />
      </button>
      {ouvert === c.cle && <div className="lines">
        {c.lignes.slice(0, 60).map(l => <div key={l.id} onClick={() => onLigne?.(l)} style={{ cursor: onLigne ? "pointer" : undefined }}>
          <span><em>{dateMini(l.date)}</em>{l.libelle}{taxis.length > 1 && <em style={{ marginLeft: 8 }}>· {nomTaxi(l.taxi_id)}</em>}</span>
          <b>{fmt(l.montant)}</b></div>)}
        {c.lignes.length > 60 && <div><span className="mut">… {c.lignes.length - 60} lignes de plus (voir Rapports)</span></div>}
      </div>}
    </div>)}
  </div>;
}
