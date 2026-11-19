import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDonnees } from "../lib/store";
import { serieMois, debut, bilan, plan, periode, detailDepenses, taxisActifs, investTotal } from "../lib/finance";
import { bornes, useFiltre } from "../lib/periode";
import { fmt, fcfa, pct, moisLabel, today, dateCourt, dateMini, cap } from "../lib/format";
import { exporterJournees, exporterDepenses, exporterSalaires, exporterJSON } from "../lib/export";
import { Field, Money, Kpi, Sec, Empty } from "../components/ui";
import { Icon } from "../components/Icon";
import { Filtres } from "../components/Filtres";
import { FluxChart } from "../components/charts";

type Onglet = "mensuel" | "prevu" | "simulateur" | "export";
const profil = () => { try { return JSON.parse(localStorage.getItem("lptp-profil") || "{}"); } catch { return {}; } };

export default function Rapports() {
  const d = useDonnees();
  const f = useFiltre();
  const [onglet, setOnglet] = useState<Onglet>("mensuel");
  const [impr, setImpr] = useState(false);
  const dd = debut(d, f.taxiId);
  const { a, b } = bornes(f.preset, dd);
  const serie = useMemo(() => serieMois(d, f.taxiId, a < dd ? dd : a, b), [d, a, b, f.taxiId]);
  const tot = periode(d, f.taxiId, a, b);
  const imprimer = () => { setImpr(true); setTimeout(() => { print(); setImpr(false); }, 250); };

  if (!d.taxis.length) return <div className="card"><Empty icon="chart" titre="Aucune donnée à analyser" /></div>;
  return <>
    <div className="ph"><div><h1 className="h1">Rapports</h1><p className="lead">Compte de résultat, prévu contre réel, simulation et exports.</p></div>
      <button className="btn ghost" onClick={imprimer}><Icon n="print" /> Rapport PDF</button></div>
    <div className="tabs" role="tablist">
      {([["mensuel", "Compte de résultat"], ["prevu", "Prévu vs réel"], ["simulateur", "Simulateur"], ["export", "Exports"]] as [Onglet, string][]).map(([k, l]) =>
        <button key={k} role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>{l}</button>)}
    </div>
    {onglet !== "simulateur" && onglet !== "export" && <Filtres preset={f.preset} setPreset={f.setPreset} taxi={f.taxi} setTaxi={f.setTaxi} taxis={d.taxis} />}

    {onglet === "mensuel" && <>
      <div className="card" style={{ marginBottom: 12 }}><FluxChart data={serie.map(m => ({ label: moisLabel(m.k, true), entrees: m.recettes, sorties: m.sorties, solde: m.marge }))} /></div>
      <div className="card flush"><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Mois</th><th>Entrées</th><th>Carburant</th><th>Entretien</th><th>Fixes</th><th>Imprévus</th><th>Salaires</th><th>Autres</th><th>Solde</th><th>Amort.</th><th>Résultat</th><th>Marge</th></tr></thead>
        <tbody>{serie.map(m => <tr key={m.k}><td>{cap(moisLabel(m.k))}</td><td>{fmt(m.recettes)}</td><td>{fmt(m.carburant)}</td><td>{fmt(m.entretien)}</td>
          <td>{fmt(m.fixes)}</td><td>{fmt(m.imprevus)}</td><td>{fmt(m.salaires)}</td><td>{fmt(m.autresJ + m.autresH)}</td>
          <td className={m.marge < 0 ? "neg" : ""}>{fmt(m.marge)}</td><td>{fmt(m.amort)}</td><td className={m.resultat < 0 ? "neg" : ""}>{fmt(m.resultat)}</td><td>{pct(m.tauxMarge, 0)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total</td><td>{fmt(tot.recettes)}</td><td>{fmt(tot.carburant)}</td><td>{fmt(tot.entretien)}</td><td>{fmt(tot.fixes)}</td><td>{fmt(tot.imprevus)}</td>
          <td>{fmt(tot.salaires)}</td><td>{fmt(tot.autresJ + tot.autresH)}</td><td>{fmt(tot.marge)}</td><td>{fmt(tot.amort)}</td><td>{fmt(tot.resultat)}</td><td>{pct(tot.tauxMarge, 0)}</td></tr></tfoot>
      </table></div></div>
    </>}

    {onglet === "prevu" && <div className="card flush"><div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Mois</th><th>Solde prévu</th><th>Solde réel</th><th>Écart</th><th>Réalisé</th></tr></thead>
      <tbody>{serie.map(m => <tr key={m.k}><td>{cap(moisLabel(m.k))}</td><td>{fmt(m.prevu)}</td><td>{fmt(m.marge)}</td>
        <td className={m.marge - m.prevu < 0 ? "neg" : "pos"}>{m.marge - m.prevu >= 0 ? "+" : ""}{fmt(m.marge - m.prevu)}</td><td>{m.prevu ? pct(m.marge / m.prevu, 0) : "—"}</td></tr>)}</tbody>
    </table></div><p className="sub" style={{ padding: "10px 16px" }}>Le prévu reprend les hypothèses de chaque taxi (objectif, jours, carburant, entretien, salaire, charges fixes et provision d'imprévus), au prorata des jours.</p></div>}

    {onglet === "simulateur" && <Simulateur />}

    {onglet === "export" && <div className="grid g2">
      <div className="card"><h3>Tableurs (Excel, Google Sheets)</h3><p className="sub" style={{ marginBottom: 12 }}>Fichiers CSV avec séparateur « ; », ouverts directement par Excel en français.</p>
        <div className="btns" style={{ flexDirection: "column" }}>
          <button className="btn ghost" onClick={() => exporterJournees(d)}><Icon n="download" /> Journées ({d.journees.length})</button>
          <button className="btn ghost" onClick={() => exporterDepenses(d)}><Icon n="download" /> Dépenses ({d.depenses.length})</button>
          <button className="btn ghost" onClick={() => exporterSalaires(d)}><Icon n="download" /> Salaires ({d.salaires.length})</button>
        </div></div>
      <div className="card"><h3>Sauvegarde complète</h3><p className="sub" style={{ marginBottom: 12 }}>Toutes les données dans un fichier JSON, restaurable depuis Paramètres.</p>
        <button className="btn block" onClick={() => exporterJSON(d)}><Icon n="download" /> Télécharger la sauvegarde</button>
        <div className="spacer" /><button className="btn ghost block" onClick={imprimer}><Icon n="print" /> Rapport imprimable / PDF</button></div>
    </div>}

    {impr && createPortal(<RapportImprimable taxiId={f.taxiId} a={a} b={b} />, document.body)}
  </>;
}

function Simulateur() {
  const d = useDonnees();
  const taxis = taxisActifs(d);
  const [id, setId] = useState(taxis[0]?.id || "");
  const t = taxis.find(x => x.id === id) || taxis[0];
  const base = t ? plan(d, t) : null;
  const [o, setO] = useState<{ recetteJour?: number; jours?: number; carburantJour?: number; invest?: number }>({});
  if (!t || !base) return <div className="card"><Empty icon="sliders" titre="Aucun taxi actif" /></div>;
  const s = plan(d, t, o);
  const val = { recetteJour: o.recetteJour ?? t.objectif_recette_jour, jours: o.jours ?? t.jours_par_mois, carburantJour: o.carburantJour ?? t.carburant_jour_prevu, invest: o.invest ?? base.I };
  return <div className="cols">
    <div className="card">
      {taxis.length > 1 && <Field label="Taxi"><select className="input" value={t.id} onChange={e => { setId(e.target.value); setO({}); }}>{taxis.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}</select></Field>}
      <Field label="Recette / versement par jour" hint={fmt(val.recetteJour)}><input type="range" className="range" min={5000} max={80000} step={500} value={val.recetteJour} onChange={e => setO({ ...o, recetteJour: +e.target.value })} /></Field>
      <Field label="Jours travaillés par mois" hint={String(val.jours)}><input type="range" className="range" min={10} max={31} value={val.jours} onChange={e => setO({ ...o, jours: +e.target.value })} /></Field>
      <Field label="Carburant par jour" hint={fmt(val.carburantJour)}><input type="range" className="range" min={0} max={30000} step={500} value={val.carburantJour} onChange={e => setO({ ...o, carburantJour: +e.target.value })} /></Field>
      <Field label="Investissement"><Money value={val.invest} onChange={v => setO({ ...o, invest: v })} /></Field>
      <button className="btn ghost sm" onClick={() => setO({})}>Revenir aux hypothèses du taxi</button>
    </div>
    <div>
      <div className="grid g2">
        <Kpi l="Marge mensuelle" v={fmt(s.marge)} neg={s.marge < 0} d={`actuel ${fmt(base.marge)}`} c="var(--chart-1)" />
        <Kpi l="Retour sur investissement" v={s.retourMois ? s.retourMois.toFixed(1).replace(".", ",") : "—"} unit={s.retourMois ? "mois" : ""} d={base.retourMois ? `actuel ${base.retourMois.toFixed(1).replace(".", ",")} mois` : ""} c="var(--chart-3)" />
        <Kpi l="ROI annuel" v={pct(s.roiAnnuel, 0)} />
        <Kpi l="Seuil de rentabilité" v={fmt(s.seuilJour)} unit="/ jour" />
      </div>
      <div className="summary" style={{ marginTop: 12 }}>
        <div><span>Recettes / mois</span><b>{fcfa(s.recette)}</b></div>
        <div><span>Carburant, entretien, salaire</span><b>− {fmt(s.variable)}</b></div>
        <div><span>Charges fixes</span><b>− {fmt(s.fixes)}</b></div>
        <div><span>Provision imprévus</span><b>− {fmt(s.imprevus)}</b></div>
        <div className="hl"><span>Marge</span><b>{fcfa(s.marge)}</b></div>
        <div><span>Recette / jour pour rembourser en 12 mois</span><b>{fmt(plan(d, t, { ...o, recetteJour: undefined }).cible12)}</b></div>
      </div>
    </div>
  </div>;
}

function RapportImprimable({ taxiId, a, b }: { taxiId: string | null; a: string; b: string }) {
  const d = useDonnees();
  const p = periode(d, taxiId, a, b), bl = bilan(d, taxiId, today());
  const serie = serieMois(d, taxiId, a < debut(d, taxiId) ? debut(d, taxiId) : a, b);
  const cats = detailDepenses(d, taxiId, a, b).slice(0, 12);
  const pr = profil();
  const nom = taxiId ? d.taxis.find(t => t.id === taxiId)?.nom : `Flotte (${d.taxis.length} taxi${d.taxis.length > 1 ? "s" : ""})`;
  return <div id="print">
    <div className="head"><div><h1>Rapport d'exploitation</h1><div>{pr.entreprise || "LE PASSEUR TAXI+"} · {nom}</div>
      <div>Période du {dateCourt(a)} au {dateCourt(b)}</div></div><img src="/img/logo-full.png" alt="" /></div>
    <div className="kp">
      <div><small>Entrées</small><b>{fmt(p.recettes)}</b></div><div><small>Sorties</small><b>{fmt(p.sorties)}</b></div>
      <div><small>Solde</small><b>{fmt(p.marge)}</b></div><div><small>Résultat après amortissement</small><b>{fmt(p.resultat)}</b></div>
      <div><small>Investissement</small><b>{fmt(investTotal(d, taxiId))}</b></div><div><small>Récupéré à ce jour</small><b>{pct(bl.part, 0)}</b></div>
      <div><small>Retour prévu</small><b>{bl.rembourse ? "atteint" : bl.dateRetour ? dateCourt(bl.dateRetour) : "—"}</b></div><div><small>ROI annualisé</small><b>{pct(bl.roiAnnuel, 0)}</b></div>
    </div>
    <h2>Compte de résultat mensuel</h2>
    <table><thead><tr><th>Mois</th><th>Entrées</th><th>Sorties</th><th>Solde</th><th>Amortissement</th><th>Résultat</th></tr></thead>
      <tbody>{serie.map(m => <tr key={m.k}><td>{cap(moisLabel(m.k))}</td><td>{fmt(m.recettes)}</td><td>{fmt(m.sorties)}</td><td>{fmt(m.marge)}</td><td>{fmt(m.amort)}</td><td>{fmt(m.resultat)}</td></tr>)}</tbody></table>
    <h2>Principales dépenses</h2>
    <table><thead><tr><th>Catégorie</th><th>Groupe</th><th>Opérations</th><th>Montant</th></tr></thead>
      <tbody>{cats.map(c => <tr key={c.cle}><td>{c.nom}</td><td>{c.groupe}</td><td>{c.lignes.length}</td><td>{fmt(c.total)}</td></tr>)}</tbody></table>
    <p className="foot">Montants en FCFA. Généré le {dateCourt(today())} par LE PASSEUR TAXI+ — du {dateMini(a)} au {dateMini(b)}.</p>
  </div>;
}

export { Sec };
