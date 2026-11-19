import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDonnees } from "../lib/store";
import { useSession } from "../lib/session";
import { bilan, periode, serieMois, detailDepenses, echeancier, debut, joursManquants, taxisActifs, type Echeance } from "../lib/finance";
import { bornes, useFiltre } from "../lib/periode";
import { fmt, fcfa, pct, court, today, dateCourt, dateMini, moisLabel, addMonths, monthStart, maxD } from "../lib/format";
import { alertesVisibles } from "../lib/notifications";
import { Icon } from "../components/Icon";
import { Kpi, Sec, Bar, Empty } from "../components/ui";
import { Filtres } from "../components/Filtres";
import { FluxChart, Donut, Ring } from "../components/charts";
import { DetailDepenses } from "../components/DetailDepenses";
import { PaiementForm } from "../components/forms";

export default function Dashboard() {
  const d = useDonnees();
  const nav = useNavigate();
  const { espace, entrerDemo } = useSession();
  const f = useFiltre();
  const [payer, setPayer] = useState<Echeance | null>(null);
  const t = today();

  const calc = useMemo(() => {
    if (!d.taxis.length) return null;
    const dd = debut(d, f.taxiId);
    const { a, b } = bornes(f.preset, dd);
    const p = periode(d, f.taxiId, a, b);
    const bl = bilan(d, f.taxiId, t);
    // au moins 6 mois d'historique dans le graphique
    const gA = maxD(dd, a < monthStart(addMonths(t, -5)) ? a : monthStart(addMonths(t, -5)));
    const serie = serieMois(d, f.taxiId, gA, b).map(m => ({ label: moisLabel(m.k, true), entrees: m.recettes, sorties: m.sorties, solde: m.marge }));
    const cats = detailDepenses(d, f.taxiId, a, b);
    const ech = echeancier(d, f.taxiId, 45, t).filter(e => !e.payee).slice(0, 5);
    return { a, b, p, bl, serie, cats, ech };
  }, [d, f.preset, f.taxiId]);

  if (!calc) return <div className="card pad-l" style={{ maxWidth: 620, margin: "20px auto", textAlign: "center" }}>
    <img src="/img/logo-full.png" alt="" style={{ width: 220, maxWidth: "70%", margin: "6px auto 14px", display: "block" }} />
    <h1 className="h1">Bienvenue dans votre gestion de taxis</h1>
    <p className="lead">Ajoutez votre premier taxi : l'application calcule ensuite votre marge, l'amortissement et la date à laquelle votre investissement sera remboursé.</p>
    <div className="btns" style={{ maxWidth: 420, margin: "0 auto" }}>
      <button className="btn" onClick={() => nav("/taxis/nouveau")}><Icon n="plus" /> Ajouter un taxi</button>
      {espace === "local" && <button className="btn ghost" onClick={entrerDemo}>Voir une démonstration</button>}
    </div>
  </div>;

  const { p, bl, serie, cats, ech, a, b } = calc;
  const actifs = taxisActifs(d);
  const aSaisir = joursManquants(d, t, 1);
  const al = alertesVisibles().slice(0, 4);
  let proj: React.ReactNode;
  if (bl.rembourse) proj = <>Investissement <b>entièrement remboursé</b>. Chaque franc de marge est désormais du bénéfice.</>;
  else if (bl.dateRetour) proj = <>Au rythme des 60 derniers jours, investissement remboursé le <b>{dateCourt(bl.dateRetour)}</b> (dans {bl.jRestants} jours).</>;
  else if (bl.saisies < 5) proj = <>Saisissez quelques journées pour obtenir une projection de la date de retour.</>;
  else proj = <>Marge récente nulle ou négative : <b>aucune date de retour</b> ne peut être projetée.</>;

  return <>
    <Filtres preset={f.preset} setPreset={f.setPreset} taxi={f.taxi} setTaxi={f.setTaxi} taxis={d.taxis} />

    <section className="hero">
      <div className="hero-row">
        <div className="ring"><Ring part={bl.part} /><div className="c"><div><b>{Math.min(999, Math.round(bl.part * 100))}%</b><span>récupéré</span></div></div></div>
        <div className="meta">
          <small>Retour sur investissement · {f.taxiId ? d.taxis.find(x => x.id === f.taxiId)?.nom : "flotte"}</small>
          <div className="big">{court(Math.max(0, bl.recupere))} <span>/ {court(bl.I)} FCFA</span></div>
          <p>{proj}</p>
        </div>
      </div>
      <div className="stats">
        <div><small>Marge mensuelle</small><b>{court(bl.rythmeMois)}</b></div>
        <div><small>ROI annualisé</small><b>{pct(bl.roiAnnuel, 0)}</b></div>
        <div><small>Valeur nette des véhicules</small><b>{court(bl.vnc)}</b></div>
      </div>
    </section>

    {actifs.length > 0 && <div className="card today-card" style={{ marginTop: 12 }}>
      <div className="li" style={{ padding: 0, border: 0, flex: 1 }}>
        <div className={`ic ${aSaisir.length ? "gold" : "green"}`}><Icon n={aSaisir.length ? "cal" : "check"} /></div>
        <div className="tx"><b>{aSaisir.length ? `Aujourd'hui : ${aSaisir.length} taxi${aSaisir.length > 1 ? "s" : ""} à saisir` : "Journée d'aujourd'hui complète"}</b>
          <span>{aSaisir.length ? aSaisir.map(x => x.taxi.nom).join(", ") : `${actifs.length} taxi${actifs.length > 1 ? "s" : ""} saisi${actifs.length > 1 ? "s" : ""}`}</span></div>
      </div>
      <button className={`btn ${aSaisir.length ? "" : "ghost sm"}`} onClick={() => nav("/saisie")}>{aSaisir.length ? <><Icon n="plus" /> Saisir</> : "Voir"}</button>
    </div>}

    <Sec titre={`Entrées et sorties · ${dateMini(a)} → ${dateMini(b)}`}><Link to="/rapports" className="link">Rapports</Link></Sec>
    <div className="flux">
      <div className="f in"><small><Icon n="arrowDown" size={14} />Entrées</small><b>{fmt(p.recettes)}</b><span>{p.travail} jours travaillés</span></div>
      <div className="f out"><small><Icon n="arrowUp" size={14} />Sorties</small><b>{fmt(p.sorties)}</b><span>{p.recettes ? pct(p.sorties / p.recettes, 0) : "—"} des entrées</span></div>
      <div className="f net"><small>Solde</small><b>{p.marge >= 0 ? "" : "−"}{fmt(Math.abs(p.marge))}</b><span>après amortissement : {fmt(p.resultat)}</span></div>
    </div>

    <div className="cols" style={{ marginTop: 14 }}>
      <div>
        <div className="card">
          <h3>Évolution mensuelle</h3>
          <p className="sub" style={{ marginBottom: 10 }}>Entrées, sorties et solde de chaque mois</p>
          <FluxChart data={serie} />
        </div>

        <Sec titre="Détail des dépenses" />
        {cats.length ? <>
          <div className="card" style={{ marginBottom: 10 }}><Donut items={cats} /></div>
          <DetailDepenses cats={cats} taxis={d.taxis} />
        </> : <div className="card"><Empty icon="wallet" titre="Aucune dépense sur la période" /></div>}

        <div className="grid g3" style={{ marginTop: 14 }}>
          <Kpi l="Recette moyenne / jour" v={fmt(p.recetteMoy)} c="var(--chart-1)" />
          <Kpi l="Salaires versés" v={fmt(p.salaires)} c="var(--chart-4)" />
          <Kpi l="Imprévus" v={fmt(p.imprevus)} c="var(--chart-2)" />
          <Kpi l="Carburant" v={fmt(p.carburant)} />
          <Kpi l="Entretien" v={fmt(p.entretien)} />
          <Kpi l="Jours de panne" v={String(p.panne)} neg={p.panne >= 3} />
        </div>
      </div>

      <div>
        {al.length > 0 && <><Sec titre="À surveiller" />
          {al.map(x => <button key={x.cle} className={`alert ${x.niveau}`} onClick={() => nav(x.lien)}>
            <span className="dot" /><div><b>{x.titre}</b><span>{x.detail}</span></div></button>)}</>}

        <Sec titre="Prochaines échéances"><Link to="/depenses" className="link">Tout voir</Link></Sec>
        <div className="card flush"><div className="list">
          {ech.length ? ech.map(e => <div key={e.cle} className="li">
            <div className={`ic ${e.statut === "retard" ? "red" : e.statut === "proche" ? "gold" : ""}`}><Icon n="receipt" /></div>
            <div className="tx"><b>{e.charge.libelle}</b><span>{e.statut === "retard" ? `En retard · ${dateMini(e.date)}` : dateCourt(e.date)}
              {d.taxis.length > 1 && e.charge.taxi_id ? ` · ${d.taxis.find(x => x.id === e.charge.taxi_id)?.nom}` : ""}</span></div>
            <div className="am">{fmt(e.montant)}</div>
            <button className="btn sm ghost act" onClick={() => setPayer(e)}>Payer</button>
          </div>) : <Empty icon="check" titre="Rien à payer dans les 45 jours" />}
        </div></div>

        <Sec titre="Fonds d'imprévus" />
        <div className="card">
          <div className="mut" style={{ fontSize: 12, fontWeight: 650 }}>Disponible</div>
          <div className={`mono ${bl.fonds.solde < 0 ? "neg" : ""}`} style={{ fontSize: 24 }}>{fcfa(bl.fonds.solde)}</div>
          <div style={{ margin: "12px 0 10px" }}><Bar part={bl.fonds.provision ? Math.max(0, bl.fonds.solde) / bl.fonds.provision : 0}
            tone={bl.fonds.solde < 0 ? "red" : bl.fonds.solde < bl.fonds.provision * .3 ? "gold" : ""} /></div>
          <div className="kv"><span>Provisionné sur les recettes</span><b>{fmt(bl.fonds.provision)}</b></div>
          <div className="kv"><span>Consommé par les imprévus</span><b>{fmt(bl.fonds.consomme)}</b></div>
        </div>

        {d.taxis.length > 1 && !f.taxiId && <>
          <Sec titre="Classement des taxis" />
          <div className="card flush"><div className="list">
            {d.taxis.map(x => ({ x, b: bilan(d, x.id, t), p: periode(d, x.id, a, b) })).sort((m, n) => n.p.marge - m.p.marge).map(({ x, b: bx, p: px }) =>
              <Link key={x.id} to={`/taxis/${x.id}`} className="li nl" style={{ color: "inherit" }}>
                <div className="ic green"><Icon n="car" /></div>
                <div className="tx"><b>{x.nom}</b><span>{Math.round(bx.part * 100)} % récupéré{x.actif ? "" : " · archivé"}</span></div>
                <div className={`am ${px.marge < 0 ? "neg" : ""}`}>{fmt(px.marge)}<small>solde période</small></div>
              </Link>)}
          </div></div>
        </>}
      </div>
    </div>
    <PaiementForm echeance={payer} onClose={() => setPayer(null)} />
  </>;
}
