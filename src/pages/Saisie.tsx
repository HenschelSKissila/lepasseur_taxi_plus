import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store, useDonnees } from "../lib/store";
import { MODES, depJournee, taxisActifs } from "../lib/finance";
import { idJournee } from "../lib/ids";
import { fmt, today, addDays, dateLong } from "../lib/format";
import type { Journee, StatutJournee, Taxi } from "../lib/types";
import { Field, Money, Seg, Empty, useUI } from "../components/ui";
import { Icon } from "../components/Icon";
import { JourneeForm } from "../components/forms";
import { useSync } from "../lib/store";

/** Saisie rapide d'une journée pour tous les taxis actifs, sur un seul écran. */
export default function Saisie() {
  const d = useDonnees();
  const sync = useSync();
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [detail, setDetail] = useState<Taxi | null>(null);
  const taxis = taxisActifs(d).filter(t => t.date_mise_service <= date);
  const faits = taxis.filter(t => d.journees.some(j => j.taxi_id === t.id && j.date === date)).length;

  if (!d.taxis.length) return <div className="card"><Empty icon="car" titre="Aucun taxi">
    <p>Ajoutez d'abord un taxi pour saisir ses journées.</p>
    <button className="btn" onClick={() => nav("/taxis/nouveau")}><Icon n="plus" /> Ajouter un taxi</button></Empty></div>;

  return <>
    <div className="ph"><div><h1 className="h1">{dateLong(date)}</h1>
      <p className="lead">{taxis.length ? `${faits} / ${taxis.length} taxi${taxis.length > 1 ? "s" : ""} saisi${faits > 1 ? "s" : ""}` : "Aucun taxi en service à cette date"}</p></div>
      <div className="btns" style={{ flex: "0 0 auto" }}>
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent"><Icon n="left" /></button>
        <input type="date" className="input" style={{ width: 160, minHeight: 40 }} value={date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} />
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} style={{ opacity: date >= today() ? .3 : 1 }} aria-label="Jour suivant"><Icon n="right" /></button>
      </div>
    </div>
    {sync.etat === "horsligne" && <div className="offline-band"><Icon n="cloudOff" />Hors ligne : vos saisies sont enregistrées sur l'appareil et seront envoyées au retour de la connexion.</div>}
    <div className="cols">
      <div>{taxis.map(t => <CarteTaxi key={t.id + date} taxi={t} date={date} onDetail={() => setDetail(t)} />)}</div>
      <div>
        <div className="card">
          <h3>Comment saisir ?</h3>
          <div className="kv"><span>Versement</span><b style={{ fontFamily: "var(--sans)" }}>montant remis par le chauffeur</b></div>
          <div className="kv"><span>Direct / je conduis</span><b style={{ fontFamily: "var(--sans)" }}>recette brute + carburant</b></div>
          <div className="kv"><span>Repos ou panne</span><b style={{ fontFamily: "var(--sans)" }}>un toucher suffit</b></div>
          <p className="sub" style={{ marginTop: 10 }}>Les charges fixes, imprévus et salaires se saisissent dans Dépenses et Chauffeurs. Le rappel de 20 h vous prévient si une journée manque.</p>
        </div>
      </div>
    </div>
    <JourneeForm taxi={detail} date={date} onClose={() => setDetail(null)} />
  </>;
}

function CarteTaxi({ taxi, date, onDetail }: { taxi: Taxi; date: string; onDetail: () => void }) {
  const d = useDonnees();
  const { toast } = useUI();
  const ex = d.journees.find(j => j.taxi_id === taxi.id && j.date === date);
  const m = MODES[taxi.mode];
  const init = (): Journee => ex ? { ...ex } : { id: idJournee(taxi.id, date), taxi_id: taxi.id, chauffeur_id: taxi.chauffeur_id, date, statut: "travail",
    recette: 0, carburant: 0, entretien: 0, autres: 0, prelevement: 0, km: null, note: null };
  const [j, setJ] = useState<Journee>(init);
  const [modif, setModif] = useState(false);
  useEffect(() => { if (!modif) setJ(init()); }, [ex?.updated_at]);
  const set = (p: Partial<Journee>) => { setModif(true); setJ(x => ({ ...x, ...p })); };
  const travail = j.statut === "travail";
  const ch = d.chauffeurs.find(c => c.id === j.chauffeur_id);

  const enregistrer = async (statut?: StatutJournee) => {
    const o: Journee = { ...j, statut: statut || j.statut };
    if (o.statut !== "travail") Object.assign(o, { recette: 0, carburant: 0, prelevement: 0, km: null, chauffeur_id: null });
    else if (!o.recette && !depJournee(o)) return toast("Saisissez au moins la recette.");
    await store.enregistrer("journees", o);
    setModif(false);
    toast(`${taxi.nom} enregistré`);
  };
  return <div className={`taxi-card ${ex && !modif ? "done" : ""}`}>
    <div className="taxi-head">
      <span className="plate">{taxi.immatriculation || taxi.nom}</span>
      <div className="tx"><b>{taxi.nom}</b><span>{m.court}{ch ? ` · ${ch.nom}` : ""}</span></div>
      {ex && !modif ? <span className="badge green"><Icon n="check" size={13} />Saisi</span> : modif ? <span className="badge gold">Non enregistré</span> : null}
    </div>
    <Seg<StatutJournee> className="status" value={j.statut} onChange={v => { set({ statut: v }); if (v !== "travail") enregistrer(v); }}
      options={[["travail", "Travail"], ["repos", "Repos"], ["panne", "Panne"]]} />
    {travail && <>
      <div className="spacer" />
      <Field label={m.recette} hint={`objectif ${fmt(taxi.objectif_recette_jour)}`}><Money xl value={j.recette} onChange={v => set({ recette: v })} /></Field>
      <div className="chips">{m.rapide.map(v => <button key={v} className={`chip ${j.recette === v ? "on" : ""}`} onClick={() => set({ recette: v })}>{fmt(v)}</button>)}</div>
      <div className="spacer" />
      <div className="row2">
        {m.carburant && <Field label="Carburant"><Money value={j.carburant} onChange={v => set({ carburant: v })} /></Field>}
        <Field label="Entretien"><Money value={j.entretien} onChange={v => set({ entretien: v })} /></Field>
        {!m.carburant && <Field label="Autres frais"><Money value={j.autres} onChange={v => set({ autres: v })} /></Field>}
      </div>
      <div className="btns">
        <button className="btn ghost" onClick={onDetail} style={{ flex: "0 0 auto" }}>Plus de détails</button>
        <button className="btn" onClick={() => enregistrer()}><Icon n="check" /> {ex ? "Mettre à jour" : "Enregistrer"}</button>
      </div>
    </>}
    {!travail && ex && <p className="sub" style={{ marginTop: 10 }}>{j.statut === "repos" ? "Jour de repos enregistré." : "Jour d'immobilisation enregistré."}
      {" "}<button className="link" onClick={onDetail}>Ajouter un coût</button></p>}
  </div>;
}
