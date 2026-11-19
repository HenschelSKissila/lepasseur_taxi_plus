import { useState } from "react";
import { useDonnees } from "../lib/store";
import { salaireMois } from "../lib/finance";
import { REMUNERATION } from "../lib/defaults";
import { fmt, fcfa, today, mKey, moisLabel, addMonths, dateMini, monthStart } from "../lib/format";
import type { Chauffeur, TypeSalaire } from "../lib/types";
import { Kpi, Sec, Empty, useUI } from "../components/ui";
import { Icon } from "../components/Icon";
import { ChauffeurForm, SalaireForm } from "../components/forms";
import { store } from "../lib/store";

export default function Chauffeurs() {
  const d = useDonnees();
  const { toast } = useUI();
  const [mois, setMois] = useState(mKey(today()));
  const [edit, setEdit] = useState<Chauffeur | null | undefined>(undefined);
  const [paie, setPaie] = useState<{ c: Chauffeur; type: TypeSalaire } | null>(null);
  const m0 = mois + "-01";
  const liste = [...d.chauffeurs].sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"));
  const lignes = liste.filter(c => c.actif || d.salaires.some(s => s.chauffeur_id === c.id && s.periode === m0)).map(c => ({ c, s: salaireMois(d, c, m0) }));
  const tot = lignes.reduce((t, { s }) => ({ du: t.du + s.du, verse: t.verse + s.verse, primes: t.primes + s.primes, reste: t.reste + Math.max(0, s.reste) }), { du: 0, verse: 0, primes: 0, reste: 0 });

  return <>
    <div className="ph"><div><h1 className="h1">Chauffeurs & salaires</h1><p className="lead">Salaire dû calculé automatiquement à partir du journal, avances et retenues comprises.</p></div>
      <button className="btn" onClick={() => setEdit(null)}><Icon n="plus" /> Ajouter un chauffeur</button></div>

    <div className="cal-head" style={{ maxWidth: 420 }}>
      <button className="icon-btn" onClick={() => setMois(mKey(addMonths(m0, -1)))} aria-label="Mois précédent"><Icon n="left" /></button>
      <h3>{moisLabel(mois)}</h3>
      <button className="icon-btn" disabled={mois >= mKey(today())} style={{ opacity: mois >= mKey(today()) ? .3 : 1 }} onClick={() => setMois(mKey(addMonths(m0, 1)))} aria-label="Mois suivant"><Icon n="right" /></button>
    </div>
    <div className="grid g4" style={{ marginBottom: 14 }}>
      <Kpi l="Total dû" v={fmt(tot.du)} c="var(--chart-4)" />
      <Kpi l="Déjà versé" v={fmt(tot.verse)} c="var(--chart-1)" d="salaires + avances" />
      <Kpi l="Primes" v={fmt(tot.primes)} />
      <Kpi l="Reste à payer" v={fmt(tot.reste)} neg={tot.reste > 0 && mois < mKey(today())} c="var(--chart-2)" />
    </div>

    {!lignes.length ? <div className="card"><Empty icon="users" titre="Aucun chauffeur">Ajoutez vos chauffeurs pour suivre versements et salaires.</Empty></div> :
      <div className="tgrid">{lignes.map(({ c, s }) => {
        const taxi = d.taxis.find(t => t.chauffeur_id === c.id);
        return <div key={c.id} className="card">
          <div className="taxi-head" style={{ marginBottom: 10 }}>
            <div className="li" style={{ padding: 0, border: 0, flex: 1, cursor: "pointer" }} onClick={() => setEdit(c)}>
              <div className="ic blue"><Icon n="users" /></div>
              <div className="tx"><b>{c.nom}{!c.actif && " (inactif)"}</b><span>{REMUNERATION[c.remuneration].nom}
                {c.remuneration === "pourcentage" ? ` · ${c.pourcentage} %` : c.montant ? ` · ${fmt(c.montant)}` : ""}{taxi ? ` · ${taxi.nom}` : ""}</span></div>
            </div>
            <button className="icon-btn" onClick={() => setEdit(c)} aria-label="Modifier"><Icon n="edit" /></button>
          </div>
          {c.remuneration === "versement" ? <>
            <p className="sub">Rémunéré par le surplus de ses courses. {s.jours} jour{s.jours > 1 ? "s" : ""} travaillé{s.jours > 1 ? "s" : ""}, versements reçus : <b className="mono">{fmt(s.recettes)}</b>.</p>
            {s.primes + s.avances > 0 && <div className="kv"><span>Primes / avances versées</span><b>{fmt(s.primes + s.avances)}</b></div>}
          </> : <>
            <div className="kv"><span>{c.remuneration === "pourcentage" ? `${c.pourcentage} % de ${fmt(s.recettes)}` : c.remuneration === "journalier" ? `${s.jours} j × ${fmt(c.montant)}` : "Salaire du mois"}</span><b>{fmt(s.base)}</b></div>
            {s.retenues > 0 && <div className="kv"><span>Retenues</span><b className="neg">− {fmt(s.retenues)}</b></div>}
            <div className="kv"><span>Versé (salaire + avances)</span><b>{fmt(s.verse)}</b></div>
            {s.primes > 0 && <div className="kv"><span>Primes</span><b>{fmt(s.primes)}</b></div>}
            <div className="kv" style={{ borderTop: "1.5px solid var(--line)" }}><span><b style={{ fontFamily: "var(--sans)" }}>Reste à payer</b></span>
              <b className={s.reste > 0 ? "neg" : "pos"} style={{ fontSize: 16 }}>{s.reste > 0 ? fcfa(s.reste) : s.reste < 0 ? `trop-perçu ${fmt(-s.reste)}` : "soldé"}</b></div>
          </>}
          <div className="btns" style={{ marginTop: 12 }}>
            {c.remuneration !== "versement" && <button className="btn sm" onClick={() => setPaie({ c, type: "salaire" })}>Payer</button>}
            <button className="btn sm ghost" onClick={() => setPaie({ c, type: "avance" })}>Avance</button>
            <button className="btn sm ghost" onClick={() => setPaie({ c, type: "prime" })}>Prime</button>
            <button className="btn sm ghost" onClick={() => setPaie({ c, type: "retenue" })}>Retenue</button>
          </div>
          {s.paiements.length > 0 && <><div className="spacer" />
            {s.paiements.map(p => <div key={p.id} className="kv" style={{ fontSize: 12.5 }}>
              <span>{dateMini(p.date_paiement)} · {({ salaire: "Salaire", avance: "Avance", prime: "Prime", retenue: "Retenue" })[p.type]}{p.note ? ` · ${p.note}` : ""}
                <button className="link" style={{ marginLeft: 8, fontSize: 12 }} onClick={async () => {
                  await store.supprimer("salaires", p.id);
                  toast("Paiement supprimé", { label: "Annuler", fn: () => store.enregistrer("salaires", p) }); }}>supprimer</button></span>
              <b className={p.type === "retenue" ? "neg" : ""}>{p.type === "retenue" ? "− " : ""}{fmt(p.montant)}</b></div>)}</>}
        </div>;
      })}</div>}

    {liste.some(c => !c.actif) && <><Sec titre="Chauffeurs inactifs" />
      <div className="card flush"><div className="list">{liste.filter(c => !c.actif).map(c =>
        <button key={c.id} className="li" onClick={() => setEdit(c)}><div className="ic"><Icon n="users" /></div>
          <div className="tx"><b>{c.nom}</b><span>{c.telephone || "—"}</span></div></button>)}</div></div></>}

    <ChauffeurForm open={edit !== undefined} initial={edit} onClose={() => setEdit(undefined)} />
    <SalaireForm chauffeur={paie?.c || null} mois={monthStart(m0)} typeDefaut={paie?.type} onClose={() => setPaie(null)} />
  </>;
}
