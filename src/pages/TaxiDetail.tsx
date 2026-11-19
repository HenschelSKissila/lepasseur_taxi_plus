import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { store, useDonnees } from "../lib/store";
import { MODES, bilan, periode, serieMois, plan, tableauAmort, investTaxi, echeancier, mensualise, FREQ, depJournee, type Echeance } from "../lib/finance";
import { fmt, fcfa, pct, court, today, addDays, monthStart, mKey, moisLabel, dateCourt, dateMini, daysBetween, addMonths } from "../lib/format";
import { uuid } from "../lib/ids";
import type { Charge, Investissement, Mode, Taxi } from "../lib/types";
import { Field, Money, Kpi, Sec, Empty, Sheet, useUI } from "../components/ui";
import { Icon } from "../components/Icon";
import { CumulChart, JoursChart, Ring } from "../components/charts";
import { Calendrier } from "../components/Calendrier";
import { JourneeForm, ChargeForm, PaiementForm } from "../components/forms";

type Onglet = "vue" | "journal" | "invest" | "charges" | "reglages";

export default function TaxiDetail() {
  const { id } = useParams();
  const d = useDonnees();
  const nav = useNavigate();
  const taxi = d.taxis.find(t => t.id === id);
  const [onglet, setOnglet] = useState<Onglet>("vue");
  const [mois, setMois] = useState(mKey(today()));
  const [jour, setJour] = useState<string | null>(null);
  if (!taxi) return <div className="card"><Empty icon="car" titre="Taxi introuvable"><button className="btn" onClick={() => nav("/taxis")}>Retour aux taxis</button></Empty></div>;
  return <>
    <div className="ph">
      <div><button className="link" onClick={() => nav("/taxis")} style={{ fontSize: 13 }}>← Taxis</button>
        <h1 className="h1">{taxi.nom} {!taxi.actif && <span className="badge">Archivé</span>}</h1>
        <p className="lead">{[taxi.immatriculation, taxi.modele, taxi.annee].filter(Boolean).join(" · ")} · {MODES[taxi.mode].nom}</p></div>
      <button className="btn" onClick={() => setJour(today())}><Icon n="plus" /> Saisir aujourd'hui</button>
    </div>
    <div className="tabs" role="tablist">
      {([["vue", "Vue d'ensemble"], ["journal", "Journal"], ["invest", "Investissement"], ["charges", "Charges"], ["reglages", "Réglages"]] as [Onglet, string][]).map(([k, l]) =>
        <button key={k} role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>{l}</button>)}
    </div>
    {onglet === "vue" && <Vue taxi={taxi} />}
    {onglet === "journal" && <Journal taxi={taxi} mois={mois} setMois={setMois} onJour={setJour} />}
    {onglet === "invest" && <Invest taxi={taxi} />}
    {onglet === "charges" && <Charges taxi={taxi} />}
    {onglet === "reglages" && <Reglages taxi={taxi} />}
    <JourneeForm taxi={jour ? taxi : null} date={jour || today()} onClose={() => setJour(null)} />
  </>;
}

function Vue({ taxi }: { taxi: Taxi }) {
  const d = useDonnees();
  const t = today();
  const c = useMemo(() => {
    const b = bilan(d, taxi.id, t);
    const serie = serieMois(d, taxi.id, taxi.date_mise_service, t);
    const pts: Array<{ label: string; cumul: number | null; projection?: number | null }> = serie.map(m => ({ label: moisLabel(m.k, true), cumul: Math.round(m.cumul) }));
    if (!b.rembourse && b.dateRetour && b.jRestants && b.jRestants < 3 * 365 && pts.length) {
      pts[pts.length - 1].projection = pts[pts.length - 1].cumul;
      const nbMois = Math.ceil(b.jRestants / 30.4375);
      for (let i = 1; i <= nbMois; i++) pts.push({ label: moisLabel(mKey(addMonths(t, i)), true), cumul: null,
        projection: Math.round(Math.min(b.I, b.recupere + b.rythmeMois * i)) });
    }
    const jours = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29)).filter(x => x >= taxi.date_mise_service).map(x => {
      const j = d.journees.find(y => y.taxi_id === taxi.id && y.date === x);
      const mg = j ? j.recette - depJournee(j) : 0;
      return { label: x.slice(8).replace(/^0/, ""), marge: mg, info: `${dateMini(x)} · ${j ? (j.statut === "travail" ? `recette ${fmt(j.recette)}` : j.statut) : "non saisi"}` };
    });
    return { b, pts, jours, mois: periode(d, taxi.id, monthStart(t), t), pl: plan(d, taxi) };
  }, [d, taxi.id]);
  const { b, pts, jours, mois, pl } = c;
  const nJ = daysBetween(monthStart(t), t) + 1;
  const prevuMois = pl.marge * nJ / 30.4375;
  return <>
    <section className="hero">
      <div className="hero-row">
        <div className="ring"><Ring part={b.part} /><div className="c"><div><b>{Math.min(999, Math.round(b.part * 100))}%</b><span>récupéré</span></div></div></div>
        <div className="meta"><small>Depuis le {dateCourt(taxi.date_mise_service)}</small>
          <div className="big">{court(Math.max(0, b.recupere))} <span>/ {court(b.I)} FCFA</span></div>
          <p>{b.rembourse ? <>Investissement <b>remboursé</b>.</> : b.dateRetour ? <>Retour prévu le <b>{dateCourt(b.dateRetour)}</b> au rythme actuel.</> : <>Pas encore assez de données pour projeter le retour.</>}</p>
        </div>
      </div>
      <div className="stats">
        <div><small>Marge / mois</small><b>{court(b.rythmeMois)}</b></div>
        <div><small>ROI annualisé</small><b>{pct(b.roiAnnuel, 0)}</b></div>
        <div><small>Valeur nette</small><b>{court(b.vnc)}</b></div>
      </div>
    </section>
    <Sec titre="Ce mois-ci" />
    <div className="grid g4">
      <Kpi l="Entrées" v={fmt(mois.recettes)} c="var(--chart-1)" d={`${mois.travail} jours travaillés`} />
      <Kpi l="Sorties" v={fmt(mois.sorties)} c="var(--chart-2)" d={`dont ${fmt(mois.fixes)} de charges fixes`} />
      <Kpi l="Solde" v={fmt(mois.marge)} c="var(--chart-3)" neg={mois.marge < 0} d={`prévu ${fmt(prevuMois)} à date`} />
      <Kpi l="Recette moyenne" v={fmt(mois.recetteMoy)} neg={mois.travail > 0 && mois.recetteMoy < taxi.objectif_recette_jour * .9} d={`objectif ${fmt(taxi.objectif_recette_jour)}`} />
    </div>
    <div className="cols" style={{ marginTop: 14 }}>
      <div className="card"><h3>Récupération de l'investissement</h3><p className="sub" style={{ marginBottom: 8 }}>Marge cumulée et projection jusqu'au remboursement</p>
        <CumulChart data={pts} invest={b.I} /></div>
      <div>
        <div className="card"><h3>Marge des 30 derniers jours</h3><JoursChart data={jours} /></div>
        <div className="card" style={{ marginTop: 12 }}><h3>Repères</h3>
          <div className="kv"><span>Seuil de rentabilité</span><b>{fmt(pl.seuilJour)} / jour</b></div>
          <div className="kv"><span>Pour rembourser en 12 mois</span><b>{fmt(pl.cible12)} / jour</b></div>
          <div className="kv"><span>Marge prévue / mois</span><b>{fmt(pl.marge)}</b></div>
          <div className="kv"><span>Marge réelle / mois (60 j)</span><b className={b.rythmeMois < pl.marge * .9 ? "neg" : "pos"}>{fmt(b.rythmeMois)}</b></div>
          <div className="kv"><span>Fonds d'imprévus disponible</span><b className={b.fonds.solde < 0 ? "neg" : ""}>{fmt(b.fonds.solde)}</b></div>
        </div>
      </div>
    </div>
  </>;
}

function Journal({ taxi, mois, setMois, onJour }: { taxi: Taxi; mois: string; setMois: (m: string) => void; onJour: (d: string) => void }) {
  const d = useDonnees();
  const a = mois + "-01", b = addDays(addMonths(a, 1), -1);
  const p = periode(d, taxi.id, a, b < today() ? b : today());
  const liste = d.journees.filter(j => j.taxi_id === taxi.id && j.date >= a && j.date <= b).sort((x, y) => y.date.localeCompare(x.date));
  return <div className="cols">
    <Calendrier taxi={taxi} journees={d.journees} mois={mois} setMois={setMois} onJour={onJour} />
    <div>
      <div className="card rows-tight">
        <h3>Bilan de {moisLabel(mois)}</h3>
        <div className="kv"><span>Entrées</span><b className="pos">{fcfa(p.recettes)}</b></div>
        {p.carburant > 0 && <div className="kv"><span>Carburant</span><b>{fmt(p.carburant)}</b></div>}
        <div className="kv"><span>Entretien</span><b>{fmt(p.entretien)}</b></div>
        <div className="kv"><span>Charges fixes payées</span><b>{fmt(p.fixes)}</b></div>
        <div className="kv"><span>Imprévus</span><b>{fmt(p.imprevus)}</b></div>
        {p.salaires > 0 && <div className="kv"><span>Salaires</span><b>{fmt(p.salaires)}</b></div>}
        {(p.autresJ + p.autresH) > 0 && <div className="kv"><span>Autres</span><b>{fmt(p.autresJ + p.autresH)}</b></div>}
        <div className="kv" style={{ borderTop: "1.5px solid var(--line)" }}><span><b style={{ fontFamily: "var(--sans)" }}>Solde</b></span><b className={p.marge < 0 ? "neg" : "pos"}>{fcfa(p.marge)}</b></div>
        {p.prelevement > 0 && <div className="kv"><span>Prélèvements personnels</span><b>{fmt(p.prelevement)}</b></div>}
        <div className="kv"><span>Travail · repos · panne</span><b>{p.travail} · {p.repos} · {p.panne}</b></div>
      </div>
      <Sec titre="Détail" />
      <div className="card flush"><div className="list">
        {liste.length ? liste.map(j => { const mg = j.recette - depJournee(j); return <button key={j.id} className="li" onClick={() => onJour(j.date)}>
          <div className={`ic ${j.statut === "travail" ? (mg < 0 ? "red" : "green") : j.statut === "panne" ? "red" : ""}`}><Icon n={j.statut === "panne" ? "wrench" : j.statut === "repos" ? "moon" : "car"} /></div>
          <div className="tx"><b>{dateMini(j.date)}</b><span>{j.statut === "travail" ? `Recette ${fmt(j.recette)}${depJournee(j) ? ` · dépenses ${fmt(depJournee(j))}` : ""}` : j.statut === "panne" ? "Panne / garage" : "Repos"}{j.note ? ` · ${j.note}` : ""}</span></div>
          {(j.statut === "travail" || depJournee(j) > 0) && <div className={`am ${mg < 0 ? "neg" : ""}`}>{fmt(mg)}</div>}
        </button>; }) : <Empty icon="cal" titre="Aucune journée ce mois-ci" />}
      </div></div>
    </div>
  </div>;
}

function Invest({ taxi }: { taxi: Taxi }) {
  const d = useDonnees();
  const { toast } = useUI();
  const [edit, setEdit] = useState<Investissement | null>(null);
  const items = d.investissements.filter(i => i.taxi_id === taxi.id).sort((a, b) => a.ordre - b.ordre);
  const I = investTaxi(d, taxi.id), tab = tableauAmort(taxi, I);
  const ecoule = Math.max(0, Math.min(taxi.duree_amortissement, daysBetween(taxi.date_mise_service, today()) / 365.25));
  return <div className="cols">
    <div>
      <div className="card flush"><div className="list">
        {items.map(i => <button key={i.id} className="li" onClick={() => setEdit(i)}>
          <div className="tx"><b>{i.libelle}</b></div><div className="am">{fmt(i.montant)}</div><Icon n="edit" className="i mut" /></button>)}
        <div className="li" style={{ background: "var(--surface-2)" }}><div className="tx"><b>Investissement total</b></div><div className="am" style={{ fontSize: 17 }}>{fcfa(I)}</div></div>
      </div></div>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setEdit({ id: uuid(), taxi_id: taxi.id, libelle: "", montant: 0, ordre: items.length })}><Icon n="plus" /> Ajouter un poste</button>
    </div>
    <div>
      <div className="card rows-tight"><h3>Amortissement linéaire</h3>
        <div className="kv"><span>Base amortissable</span><b>{fmt(Math.max(0, I - taxi.valeur_residuelle))}</b></div>
        <div className="kv"><span>Par an · par mois</span><b>{fmt(tab.annuel)} · {fmt(tab.mensuel)}</b></div>
        <div className="kv"><span>Fin d'amortissement</span><b>{dateCourt(tab.fin)}</b></div>
        <div className="kv"><span>Valeur nette aujourd'hui</span><b>{fmt(I - tab.annuel * ecoule)}</b></div>
      </div>
      <div className="card flush" style={{ marginTop: 12 }}><div className="tbl-wrap"><table className="tbl" style={{ minWidth: 0 }}>
        <thead><tr><th>Année</th><th>Dotation</th><th>Cumul</th><th>Valeur nette</th></tr></thead>
        <tbody>{tab.lignes.map(l => <tr key={l.annee} className={today() >= l.debut && today() <= l.fin ? "cur" : ""}>
          <td>{l.annee} · {l.debut.slice(0, 4)}</td><td>{fmt(l.dotation)}</td><td>{fmt(l.cumul)}</td><td>{fmt(l.vnc)}</td></tr>)}</tbody>
      </table></div></div>
    </div>
    <Sheet open={!!edit} onClose={() => setEdit(null)} titre={edit && items.some(i => i.id === edit.id) ? "Modifier le poste" : "Nouveau poste"}
      pied={edit && <div className="btns">
        {items.some(i => i.id === edit.id) && <button className="btn danger" style={{ flex: "0 0 auto" }} aria-label="Supprimer"
          onClick={async () => { await store.supprimer("investissements", edit.id); setEdit(null); toast("Poste supprimé"); }}><Icon n="trash" /></button>}
        <button className="btn" onClick={async () => { if (!edit.libelle.trim()) return toast("Libellé obligatoire."); await store.enregistrer("investissements", edit); setEdit(null); toast("Investissement mis à jour"); }}>
          <Icon n="check" /> Enregistrer</button></div>}>
      {edit && <><Field label="Libellé"><input className="input" autoFocus value={edit.libelle} onChange={e => setEdit({ ...edit, libelle: e.target.value })} /></Field>
        <Field label="Montant"><Money xl value={edit.montant} onChange={v => setEdit({ ...edit, montant: v })} /></Field></>}
    </Sheet>
  </div>;
}

function Charges({ taxi }: { taxi: Taxi }) {
  const d = useDonnees();
  const [edit, setEdit] = useState<Charge | null | undefined>(undefined);
  const [payer, setPayer] = useState<Echeance | null>(null);
  const cs = d.charges.filter(c => c.taxi_id === taxi.id);
  const ech = echeancier(d, taxi.id, 60).filter(e => !e.payee);
  return <div className="cols">
    <div>
      <div className="card flush"><div className="list">
        {cs.length ? cs.map(c => <button key={c.id} className="li" onClick={() => setEdit(c)}>
          <div className="ic"><Icon n="repeat" /></div>
          <div className="tx"><b>{c.libelle}{!c.actif && " (inactive)"}</b><span>{FREQ[c.frequence].nom} · {c.categorie}</span></div>
          <div className="am">{fmt(c.montant)}<small>{c.frequence !== "unique" ? `${fmt(mensualise(c))}/mois` : "unique"}</small></div></button>)
          : <Empty icon="repeat" titre="Aucune charge récurrente" />}
      </div></div>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setEdit(null)}><Icon n="plus" /> Ajouter une charge</button>
    </div>
    <div><div className="card flush"><div className="list">
      {ech.length ? ech.map(e => <div key={e.cle} className="li">
        <div className={`ic ${e.statut === "retard" ? "red" : e.statut === "proche" ? "gold" : ""}`}><Icon n="receipt" /></div>
        <div className="tx"><b>{e.charge.libelle}</b><span>{e.statut === "retard" ? "En retard · " : ""}{dateCourt(e.date)}</span></div>
        <div className="am">{fmt(e.montant)}</div><button className="btn sm ghost act" onClick={() => setPayer(e)}>Payer</button></div>)
        : <Empty icon="check" titre="Aucune échéance dans les 60 jours" />}
    </div></div></div>
    <ChargeForm open={edit !== undefined} initial={edit} taxiDefaut={taxi.id} onClose={() => setEdit(undefined)} />
    <PaiementForm echeance={payer} onClose={() => setPayer(null)} />
  </div>;
}

function Reglages({ taxi }: { taxi: Taxi }) {
  const d = useDonnees();
  const nav = useNavigate();
  const { toast, confirmer } = useUI();
  const [t, setT] = useState<Taxi>({ ...taxi });
  const set = (p: Partial<Taxi>) => setT(x => ({ ...x, ...p }));
  const enregistrer = async () => {
    if (!t.nom.trim()) return toast("Le nom est obligatoire.");
    await store.enregistrer("taxis", { ...t, nom: t.nom.trim() }); toast("Taxi mis à jour");
  };
  const archiver = async () => { await store.enregistrer("taxis", { ...taxi, actif: !taxi.actif }); toast(taxi.actif ? "Taxi archivé" : "Taxi réactivé"); };
  const supprimer = async () => {
    if (!await confirmer(`Supprimer ${taxi.nom} ?`, "Toutes ses journées, dépenses, charges et son investissement seront supprimés définitivement, sur tous vos appareils. Pour conserver l'historique, archivez-le.", "Supprimer définitivement", true)) return;
    const de = (x: { taxi_id: string | null }) => x.taxi_id === taxi.id;
    await store.lot([["journees", d.journees.filter(de), true], ["depenses", d.depenses.filter(de), true], ["charges", d.charges.filter(de), true],
      ["investissements", d.investissements.filter(de), true], ["taxis", [taxi], true]]);
    toast("Taxi supprimé"); nav("/taxis", { replace: true });
  };
  return <div className="cols">
    <div className="card">
      <div className="row2">
        <Field label="Nom"><input className="input" value={t.nom} onChange={e => set({ nom: e.target.value })} /></Field>
        <Field label="Immatriculation"><input className="input" value={t.immatriculation || ""} onChange={e => set({ immatriculation: e.target.value.toUpperCase() })} /></Field>
        <Field label="Modèle"><input className="input" value={t.modele || ""} onChange={e => set({ modele: e.target.value })} /></Field>
        <Field label="Année"><input className="input" inputMode="numeric" value={t.annee || ""} onChange={e => set({ annee: parseInt(e.target.value) || null })} /></Field>
        <Field label="Mise en service"><input type="date" className="input" value={t.date_mise_service} onChange={e => set({ date_mise_service: e.target.value })} /></Field>
        <Field label="Mode"><select className="input" value={t.mode} onChange={e => set({ mode: e.target.value as Mode })}>
          {(Object.keys(MODES) as Mode[]).map(k => <option key={k} value={k}>{MODES[k].nom}</option>)}</select></Field>
        <Field label="Chauffeur attitré"><select className="input" value={t.chauffeur_id || ""} onChange={e => set({ chauffeur_id: e.target.value || null })}>
          <option value="">—</option>{d.chauffeurs.filter(c => c.actif || c.id === t.chauffeur_id).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></Field>
        <Field label="Objectif / jour"><Money value={t.objectif_recette_jour} onChange={v => set({ objectif_recette_jour: v })} /></Field>
        <Field label="Jours / mois"><input className="input mono" inputMode="numeric" value={t.jours_par_mois} onChange={e => set({ jours_par_mois: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} /></Field>
        <Field label="Carburant prévu / jour"><Money value={t.carburant_jour_prevu} onChange={v => set({ carburant_jour_prevu: v })} /></Field>
        <Field label="Entretien prévu / mois"><Money value={t.entretien_mois_prevu} onChange={v => set({ entretien_mois_prevu: v })} /></Field>
        <Field label="Amortissement (ans)"><input className="input mono" inputMode="numeric" value={t.duree_amortissement} onChange={e => set({ duree_amortissement: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })} /></Field>
        <Field label="Valeur résiduelle"><Money value={t.valeur_residuelle} onChange={v => set({ valeur_residuelle: v })} /></Field>
        <Field label="Fonds d'imprévus (%)"><input className="input mono" inputMode="numeric" value={Math.round(t.taux_imprevus * 100)} onChange={e => set({ taux_imprevus: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)) / 100 })} /></Field>
      </div>
      <button className="btn block" onClick={enregistrer}><Icon n="check" /> Enregistrer les modifications</button>
    </div>
    <div className="card">
      <h3>Cycle de vie</h3>
      <p className="sub" style={{ marginBottom: 12 }}>Un taxi vendu ou retiré peut être archivé : il disparaît de la saisie mais son historique reste dans les rapports.</p>
      <button className="btn ghost block" onClick={archiver}><Icon n="archive" /> {taxi.actif ? "Archiver ce taxi" : "Réactiver ce taxi"}</button>
      <button className="btn danger block" style={{ marginTop: 10 }} onClick={supprimer}><Icon n="trash" /> Supprimer définitivement</button>
    </div>
  </div>;
}
