import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDonnees } from "../lib/store";
import { echeancier, detailDepenses, debut, bilan, periode, FREQ, mensualise, fixesMensuelles, taxisDe, type Echeance } from "../lib/finance";
import { bornes, useFiltre } from "../lib/periode";
import { fmt, fcfa, dateCourt, dateMini, today } from "../lib/format";
import type { Charge, Depense } from "../lib/types";
import { Kpi, Sec, Empty, Bar } from "../components/ui";
import { Icon } from "../components/Icon";
import { Filtres } from "../components/Filtres";
import { Donut } from "../components/charts";
import { DetailDepenses } from "../components/DetailDepenses";
import { DepenseForm, ChargeForm, PaiementForm } from "../components/forms";

type Onglet = "echeances" | "historique" | "charges" | "fonds";

export default function Depenses() {
  const d = useDonnees();
  const [q, setQ] = useSearchParams();
  const [onglet, setOnglet] = useState<Onglet>((q.get("onglet") as Onglet) || "echeances");
  const f = useFiltre();
  const [dep, setDep] = useState<Depense | null | undefined>(q.get("ajout") ? null : undefined);
  const [charge, setCharge] = useState<Charge | null | undefined>(undefined);
  const [payer, setPayer] = useState<Echeance | null>(null);
  useEffect(() => { if (q.get("ajout") || q.get("onglet")) setQ({}, { replace: true }); }, []);
  const nomTaxi = (id: string | null) => id ? d.taxis.find(t => t.id === id)?.nom ?? "—" : "Flotte";

  return <>
    <div className="ph"><div><h1 className="h1">Dépenses</h1><p className="lead">Échéancier des charges, imprévus, entretien et historique complet.</p></div>
      <div className="btns" style={{ flex: "0 0 auto" }}>
        <button className="btn ghost" onClick={() => setCharge(null)}><Icon n="repeat" /> Charge récurrente</button>
        <button className="btn" onClick={() => setDep(null)}><Icon n="plus" /> Dépense</button></div>
    </div>
    <div className="tabs" role="tablist">
      {([["echeances", "Échéancier"], ["historique", "Historique"], ["charges", "Charges récurrentes"], ["fonds", "Fonds d'imprévus"]] as [Onglet, string][]).map(([k, l]) =>
        <button key={k} role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>{l}</button>)}
    </div>
    {onglet === "echeances" && <Echeancier onPayer={setPayer} nomTaxi={nomTaxi} />}
    {onglet === "historique" && <Historique f={f} onEdit={l => l.source === "depense" ? setDep(l.ref) : undefined} />}
    {onglet === "charges" && <ListeCharges onEdit={setCharge} nomTaxi={nomTaxi} />}
    {onglet === "fonds" && <Fonds onEdit={setDep} />}
    <DepenseForm open={dep !== undefined} initial={dep} onClose={() => setDep(undefined)} />
    <ChargeForm open={charge !== undefined} initial={charge} onClose={() => setCharge(undefined)} />
    <PaiementForm echeance={payer} onClose={() => setPayer(null)} />
  </>;
}

function Echeancier({ onPayer, nomTaxi }: { onPayer: (e: Echeance) => void; nomTaxi: (id: string | null) => string }) {
  const d = useDonnees();
  const ech = echeancier(d, null, 90);
  const ouvertes = ech.filter(e => !e.payee);
  const retard = ouvertes.filter(e => e.statut === "retard");
  const payees = d.depenses.filter(p => p.type === "fixe").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const ligne = (e: Echeance) => <div key={e.cle} className="li">
    <div className={`ic ${e.statut === "retard" ? "red" : e.statut === "proche" ? "gold" : ""}`}><Icon n="receipt" /></div>
    <div className="tx"><b>{e.charge.libelle}</b><span>{e.statut === "retard" ? "En retard · " : ""}{dateCourt(e.date)}{d.taxis.length > 1 ? ` · ${nomTaxi(e.charge.taxi_id)}` : ""}</span></div>
    <div className="am">{fmt(e.montant)}</div>
    <button className="btn sm ghost act" onClick={() => onPayer(e)}>Payer</button></div>;
  return <div className="cols">
    <div>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Kpi l="En retard" v={fmt(retard.reduce((s, e) => s + e.montant, 0))} neg={retard.length > 0} d={`${retard.length} échéance(s)`} />
        <Kpi l="30 prochains jours" v={fmt(ouvertes.filter(e => e.statut !== "retard" && e.date <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)).reduce((s, e) => s + e.montant, 0))} />
        <Kpi l="Charges fixes / mois" v={fmt(fixesMensuelles(d, null))} d="équivalent mensualisé" />
      </div>
      <div className="card flush"><div className="list">
        {ouvertes.length ? ouvertes.map(ligne) : <Empty icon="check" titre="Aucune échéance dans les 90 jours" />}
      </div></div>
    </div>
    <div>
      <Sec titre="Derniers paiements" />
      <div className="card flush"><div className="list">
        {payees.length ? payees.map(p => <div key={p.id} className="li"><div className="ic green"><Icon n="check" /></div>
          <div className="tx"><b>{p.libelle}</b><span>Payé le {dateMini(p.date)}{p.echeance ? ` · échéance ${dateMini(p.echeance)}` : ""}</span></div>
          <div className="am">{fmt(p.montant)}</div></div>) : <Empty icon="receipt" titre="Aucun paiement encore" />}
      </div></div>
    </div>
  </div>;
}

function Historique({ f, onEdit }: { f: ReturnType<typeof useFiltre>; onEdit: (l: any) => void }) {
  const d = useDonnees();
  const { a, b } = bornes(f.preset, debut(d, f.taxiId));
  const cats = useMemo(() => detailDepenses(d, f.taxiId, a, b), [d, a, b, f.taxiId]);
  const p = periode(d, f.taxiId, a, b);
  return <>
    <Filtres preset={f.preset} setPreset={f.setPreset} taxi={f.taxi} setTaxi={f.setTaxi} taxis={d.taxis} />
    <div className="grid g4" style={{ marginBottom: 14 }}>
      <Kpi l="Total des sorties" v={fmt(p.sorties)} c="var(--chart-2)" d={`${dateMini(a)} → ${dateMini(b)}`} />
      <Kpi l="Charges fixes" v={fmt(p.fixes)} />
      <Kpi l="Imprévus" v={fmt(p.imprevus)} neg={p.imprevus > p.recettes * .15} />
      <Kpi l="Entretien + carburant" v={fmt(p.entretien + p.carburant)} />
    </div>
    {cats.length ? <div className="cols">
      <DetailDepenses cats={cats} taxis={d.taxis} onLigne={onEdit} />
      <div className="card"><h3>Répartition</h3><div className="spacer" /><Donut items={cats} /></div>
    </div> : <div className="card"><Empty icon="wallet" titre="Aucune dépense sur cette période" /></div>}
  </>;
}

function ListeCharges({ onEdit, nomTaxi }: { onEdit: (c: Charge) => void; nomTaxi: (id: string | null) => string }) {
  const d = useDonnees();
  const cs = [...d.charges].sort((a, b) => (a.taxi_id || "").localeCompare(b.taxi_id || "") || a.libelle.localeCompare(b.libelle));
  return <>
    <p className="note" style={{ marginBottom: 12 }}>Total mensualisé : <b>{fcfa(fixesMensuelles(d, null))}</b> par mois pour la flotte. Ces montants alimentent le prévisionnel, le seuil de rentabilité et les rappels d'échéance.</p>
    <div className="card flush"><div className="list">
      {cs.length ? cs.map(c => <button key={c.id} className="li" onClick={() => onEdit(c)}>
        <div className="ic"><Icon n="repeat" /></div>
        <div className="tx"><b>{c.libelle}{!c.actif && " (inactive)"}</b><span>{FREQ[c.frequence].nom} · {c.categorie} · {nomTaxi(c.taxi_id)}</span></div>
        <div className="am">{fmt(c.montant)}<small>{c.frequence !== "unique" ? `${fmt(mensualise(c))}/mois` : "unique"}</small></div>
      </button>) : <Empty icon="repeat" titre="Aucune charge récurrente">Assurance, visite technique, taxe municipale…</Empty>}
    </div></div>
  </>;
}

function Fonds({ onEdit }: { onEdit: (d: Depense) => void }) {
  const d = useDonnees();
  const b = bilan(d, null, today());
  const imp = d.depenses.filter(p => p.type === "imprevu").sort((x, y) => y.date.localeCompare(x.date));
  return <div className="cols">
    <div className="card">
      <h3>Comment fonctionne le fonds ?</h3>
      <p className="sub" style={{ marginBottom: 12 }}>Une part de chaque recette (réglable par taxi, 10 % par défaut) est mise de côté virtuellement pour absorber pannes, accidents et amendes. Chaque imprévu saisi la consomme.</p>
      <div className="mono" style={{ fontSize: 30, letterSpacing: "-.04em" }}>{fcfa(b.fonds.solde)}</div>
      <div style={{ margin: "12px 0" }}><Bar part={b.fonds.provision ? Math.max(0, b.fonds.solde) / b.fonds.provision : 0} tone={b.fonds.solde < 0 ? "red" : ""} /></div>
      <div className="kv"><span>Provisionné</span><b>{fmt(b.fonds.provision)}</b></div>
      <div className="kv"><span>Consommé</span><b>{fmt(b.fonds.consomme)}</b></div>
      {taxisDe(d, null).length > 1 && taxisDe(d, null).map(t => { const x = bilan(d, t.id, today()); return <div className="kv" key={t.id}><span>{t.nom}</span><b className={x.fonds.solde < 0 ? "neg" : ""}>{fmt(x.fonds.solde)}</b></div>; })}
    </div>
    <div><Sec titre="Imprévus enregistrés" />
      <div className="card flush"><div className="list">
        {imp.length ? imp.map(p => <button key={p.id} className="li" onClick={() => onEdit(p)}><div className="ic red"><Icon n="alert" /></div>
          <div className="tx"><b>{p.libelle}</b><span>{p.categorie} · {dateMini(p.date)}</span></div><div className="am">{fmt(p.montant)}</div></button>)
          : <Empty icon="check" titre="Aucun imprévu" />}
      </div></div></div>
  </div>;
}
