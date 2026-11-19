import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { store, useDonnees } from "../lib/store";
import { MODES, bilan, periode, plan, investTaxi } from "../lib/finance";
import { nouveauTaxi, investDefaut, chargesDefaut, PLAN_DEFAUT, nouveauChauffeur, REMUNERATION } from "../lib/defaults";
import { uuid, idPaiement } from "../lib/ids";
import { fmt, fcfa, pct, court, today, monthStart, dateCourt, addMonths } from "../lib/format";
import type { Charge, Chauffeur, Investissement, Mode, Remuneration, Taxi } from "../lib/types";
import { Field, Money, Empty, Bar, useUI } from "../components/ui";
import { Icon } from "../components/Icon";

export function TaxisListe() {
  const d = useDonnees();
  const nav = useNavigate();
  const [archives, setArchives] = useState(false);
  const t = today();
  const liste = d.taxis.filter(x => archives || x.actif).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return <>
    <div className="ph"><div><h1 className="h1">Mes taxis</h1><p className="lead">{d.taxis.filter(x => x.actif).length} en service · investissement total {fcfa(d.investissements.reduce((s, i) => s + i.montant, 0))}</p></div>
      <button className="btn" onClick={() => nav("/taxis/nouveau")}><Icon n="plus" /> Ajouter un taxi</button></div>
    {d.taxis.some(x => !x.actif) && <label className="toolbar" style={{ gap: 10, fontSize: 13.5, fontWeight: 600 }}>
      <input type="checkbox" checked={archives} onChange={e => setArchives(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />Afficher les taxis archivés</label>}
    {!liste.length ? <div className="card"><Empty icon="car" titre="Aucun taxi">Ajoutez votre premier véhicule pour commencer le suivi.</Empty></div> :
      <div className="tgrid">{liste.map(x => {
        const b = bilan(d, x.id, t), m = periode(d, x.id, monthStart(t), t), ch = d.chauffeurs.find(c => c.id === x.chauffeur_id);
        return <Link key={x.id} to={`/taxis/${x.id}`} className="tcard">
          <div className="taxi-head" style={{ marginBottom: 12 }}>
            <span className="plate">{x.immatriculation || "—"}</span>
            <div className="tx"><b>{x.nom}</b><span>{x.modele}{x.annee ? ` ${x.annee}` : ""}{ch ? ` · ${ch.nom}` : ""}</span></div>
            <span className={`badge ${x.actif ? (x.mode === "direct" ? "blue" : x.mode === "perso" ? "gold" : "green") : ""}`}>{x.actif ? MODES[x.mode].court : "Archivé"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
            <span className="mut">Investissement récupéré</span><b className="mono">{pct(b.part, 0)}</b></div>
          <Bar part={b.part} tone={b.rembourse ? "gold" : ""} />
          <div className="mini">
            <div><small>Solde du mois</small><b className={m.marge < 0 ? "neg" : ""}>{court(m.marge)}</b></div>
            <div><small>Investi</small><b>{court(b.I)}</b></div>
            <div><small>Retour</small><b style={{ fontSize: 12.5 }}>{b.rembourse ? "atteint" : b.dateRetour ? dateCourt(b.dateRetour).replace(/ \d{4}$/, "") : "—"}</b></div>
          </div>
        </Link>;
      })}</div>}
  </>;
}

/* ============================================================ assistant */
type ChargeLigne = Charge & { garder: boolean; payee: boolean };

export function TaxiNouveau() {
  const d = useDonnees();
  const nav = useNavigate();
  const { toast } = useUI();
  const [etape, setEtape] = useState(0);
  const [taxi, setTaxi] = useState<Taxi>(() => nouveauTaxi("versement", d.taxis.length + 1));
  const [inv, setInv] = useState<Investissement[]>(() => investDefaut(taxi.id));
  const [charges, setCharges] = useState<ChargeLigne[]>(() => chargesDefaut(taxi.id, taxi.date_mise_service).map(c => ({ ...c, garder: true, payee: c.date_debut === taxi.date_mise_service })));
  const [nouveauCh, setNouveauCh] = useState<Chauffeur | null>(null);
  const set = (p: Partial<Taxi>) => setTaxi(t => ({ ...t, ...p }));
  const totalInv = inv.reduce((s, i) => s + i.montant, 0);
  const totalAmort = inv.filter(i => i.amortissable).reduce((s, i) => s + i.montant, 0);
  const premieres = charges.filter(c => c.garder && c.payee && c.date_debut === taxi.date_mise_service).reduce((s, c) => s + c.montant, 0);

  const apercu = useMemo(() => {
    const ch = nouveauCh && nouveauCh.nom ? nouveauCh : d.chauffeurs.find(c => c.id === taxi.chauffeur_id);
    const dd = { ...d, taxis: [taxi], chauffeurs: ch ? [ch] : [], investissements: inv,
      charges: charges.filter(c => c.garder) } as typeof d;
    return plan(dd, { ...taxi, chauffeur_id: ch?.id || null });
  }, [taxi, inv, charges, nouveauCh, d]);

  const choisirMode = (mode: Mode) => set({ mode, ...PLAN_DEFAUT[mode] });
  const valider = () => {
    if (etape === 0 && !taxi.nom.trim()) return toast("Donnez un nom au taxi (ex. Taxi 01).");
    if (etape === 2 && totalInv <= 0) return toast("Indiquez au moins le prix d'achat.");
    if (etape < 3) return setEtape(etape + 1);
    creer();
  };
  const creer = async () => {
    const ops: Array<[any, any[]]> = [];
    let t = { ...taxi, nom: taxi.nom.trim() };
    if (nouveauCh?.nom.trim()) { ops.push(["chauffeurs", [{ ...nouveauCh, nom: nouveauCh.nom.trim() }]]); t.chauffeur_id = nouveauCh.id; }
    ops.push(["taxis", [t]], ["investissements", inv.filter(i => i.libelle.trim() && i.montant >= 0)],
      ["charges", charges.filter(c => c.garder && c.montant > 0).map(({ garder, payee, ...c }) => ({ ...c, taxi_id: t.id }))],
      ["depenses", charges.filter(c => c.garder && c.payee && c.montant > 0 && c.date_debut === t.date_mise_service).map(c => ({
        id: idPaiement(c.id, c.date_debut), taxi_id: t.id, date: c.date_debut, type: "fixe", categorie: c.categorie, libelle: c.libelle,
        montant: c.montant, charge_id: c.id, echeance: c.date_debut, note: "Payé au démarrage" }))]);
    await store.lot(ops);
    toast(`${t.nom} ajouté`);
    nav(`/taxis/${t.id}`, { replace: true });
  };

  return <div style={{ maxWidth: 640, margin: "0 auto" }}>
    <div className="step-dots">{[0, 1, 2, 3].map(i => <i key={i} className={i <= etape ? "on" : ""} />)}</div>
    {etape === 0 && <>
      <h1 className="h1">Le véhicule</h1><p className="lead">Identité du taxi et date de début d'exploitation.</p>
      <div className="card">
        <div className="row2">
          <Field label="Nom"><input className="input" autoFocus value={taxi.nom} onChange={e => set({ nom: e.target.value })} /></Field>
          <Field label="Immatriculation"><input className="input" value={taxi.immatriculation || ""} placeholder="BZV 0000 A" onChange={e => set({ immatriculation: e.target.value.toUpperCase() })} /></Field>
          <Field label="Marque et modèle"><input className="input" value={taxi.modele || ""} onChange={e => set({ modele: e.target.value })} /></Field>
          <Field label="Année"><input className="input" inputMode="numeric" value={taxi.annee || ""} placeholder="2013" onChange={e => set({ annee: parseInt(e.target.value) || null })} /></Field>
          <Field label="Mise en service"><input type="date" className="input" value={taxi.date_mise_service}
            onChange={e => { set({ date_mise_service: e.target.value }); setCharges(cs => cs.map(c => ({ ...c, date_debut: c.frequence === "mensuel" ? addMonths(e.target.value, 1) : e.target.value }))); }} /></Field>
          <Field label="Compteur au départ (km)"><input className="input mono" inputMode="numeric" value={taxi.km_initial ? fmt(taxi.km_initial) : ""}
            onChange={e => set({ km_initial: parseInt(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
        </div>
      </div>
    </>}

    {etape === 1 && <>
      <h1 className="h1">L'exploitation</h1><p className="lead">Qui conduit et combien le taxi doit rapporter.</p>
      {(Object.keys(MODES) as Mode[]).map(k => <button key={k} className="choice" role="radio" aria-checked={taxi.mode === k} onClick={() => choisirMode(k)}>
        <span className="rd" /><div><b>{MODES[k].nom}</b><span>{MODES[k].detail}</span></div></button>)}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row2">
          <Field label={taxi.mode === "versement" ? "Versement attendu / jour" : "Recette visée / jour"}><Money value={taxi.objectif_recette_jour} onChange={v => set({ objectif_recette_jour: v })} /></Field>
          <Field label="Jours travaillés / mois"><input className="input mono" inputMode="numeric" value={taxi.jours_par_mois}
            onChange={e => set({ jours_par_mois: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} /></Field>
          {MODES[taxi.mode].carburant && <Field label="Carburant prévu / jour"><Money value={taxi.carburant_jour_prevu} onChange={v => set({ carburant_jour_prevu: v })} /></Field>}
          <Field label="Entretien prévu / mois"><Money value={taxi.entretien_mois_prevu} onChange={v => set({ entretien_mois_prevu: v })} /></Field>
        </div>
        {taxi.mode !== "perso" && <>
          <Field label="Chauffeur">
            <select className="input" value={nouveauCh ? "__nouveau" : taxi.chauffeur_id || ""} onChange={e => {
              if (e.target.value === "__nouveau") { setNouveauCh({ ...nouveauChauffeur(), remuneration: taxi.mode === "direct" ? "pourcentage" : "versement", pourcentage: taxi.mode === "direct" ? 30 : 0 }); set({ chauffeur_id: null }); }
              else { setNouveauCh(null); set({ chauffeur_id: e.target.value || null }); } }}>
              <option value="">— Plus tard —</option>
              {d.chauffeurs.filter(c => c.actif).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              <option value="__nouveau">+ Nouveau chauffeur…</option>
            </select></Field>
          {nouveauCh && <div className="row2">
            <Field label="Nom du chauffeur"><input className="input" value={nouveauCh.nom} onChange={e => setNouveauCh({ ...nouveauCh, nom: e.target.value })} /></Field>
            <Field label="Rémunération"><select className="input" value={nouveauCh.remuneration} onChange={e => setNouveauCh({ ...nouveauCh, remuneration: e.target.value as Remuneration })}>
              {Object.entries(REMUNERATION).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}</select></Field>
            {nouveauCh.remuneration === "pourcentage" && <Field label="% des recettes"><input className="input mono" inputMode="decimal" value={nouveauCh.pourcentage || ""}
              onChange={e => setNouveauCh({ ...nouveauCh, pourcentage: Math.min(100, parseFloat(e.target.value) || 0) })} /></Field>}
            {(nouveauCh.remuneration === "salaire_fixe" || nouveauCh.remuneration === "journalier") &&
              <Field label={nouveauCh.remuneration === "journalier" ? "Par jour" : "Par mois"}><Money value={nouveauCh.montant} onChange={v => setNouveauCh({ ...nouveauCh, montant: v })} /></Field>}
          </div>}
        </>}
      </div>
    </>}

    {etape === 2 && <>
      <h1 className="h1">Frais de démarrage</h1><p className="lead">Pré-remplis avec les prix observés à Brazzaville (environ 3 millions FCFA tout compris). Ajustez chaque ligne à vos devis.</p>
      {([[true, "Acquisition et mise en conformité", "Amortis sur la durée de vie du véhicule."],
         [false, "Frais consommés au démarrage", "Récupérés par la marge, sans valeur de revente (plein, nettoyage…)."]] as Array<[boolean, string, string]>).map(([am, titre, aide]) =>
        <div key={String(am)} className="card" style={{ marginBottom: 12 }}>
          <h3>{titre}</h3><p className="sub" style={{ marginBottom: 10 }}>{aide}</p>
          {inv.filter(i => i.amortissable === am).map(i => <div key={i.id} className="inv-row">
            <input className="input" value={i.libelle} onChange={e => setInv(inv.map(x => x.id === i.id ? { ...x, libelle: e.target.value } : x))} aria-label="Libellé" />
            <input className="input money" inputMode="numeric" value={i.montant ? fmt(i.montant) : ""} aria-label="Montant"
              onChange={e => setInv(inv.map(x => x.id === i.id ? { ...x, montant: parseInt(e.target.value.replace(/\D/g, "")) || 0 } : x))} />
            <button className="icon-btn" aria-label="Retirer" onClick={() => setInv(inv.filter(x => x.id !== i.id))}><Icon n="x" /></button>
          </div>)}
          <button className="link" style={{ marginTop: 6 }} onClick={() => setInv([...inv, { id: uuid(), taxi_id: taxi.id, libelle: "", montant: 0, ordre: inv.length, amortissable: am }])}>+ Ajouter une ligne</button>
        </div>)}
      <div className="card">
        <div className="kv"><span>Acquisition (amortissable)</span><b>{fmt(totalAmort)}</b></div>
        <div className="kv"><span>Frais consommés</span><b>{fmt(totalInv - totalAmort)}</b></div>
        <div className="total-line"><span>Investissement à rembourser</span><b>{fcfa(totalInv)}</b></div>
        <p className="sub" style={{ marginTop: 8 }}>L'assurance, la patente, les droits d'auteur, la taxe de roulage et le stationnement sont annuels : ils sont à l'étape suivante, avec la possibilité de les marquer « payés au démarrage ».</p>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row2">
          <Field label="Amortissement (années)"><input className="input mono" inputMode="numeric" value={taxi.duree_amortissement}
            onChange={e => set({ duree_amortissement: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })} /></Field>
          <Field label="Valeur de revente estimée"><Money value={taxi.valeur_residuelle} onChange={v => set({ valeur_residuelle: v })} /></Field>
        </div>
        <Field label="Fonds d'imprévus" hint="% des recettes mis de côté"><input className="input mono" inputMode="numeric" value={Math.round(taxi.taux_imprevus * 100)}
          onChange={e => set({ taux_imprevus: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)) / 100 })} /></Field>
        <p className="note">Amortissement : <b>{fcfa(Math.max(0, totalAmort - taxi.valeur_residuelle) / taxi.duree_amortissement / 12)}</b> par mois pendant {taxi.duree_amortissement} ans.</p>
      </div>
    </>}

    {etape === 3 && <>
      <h1 className="h1">Impôts, taxes et charges</h1><p className="lead">Charges récurrentes du taxi : elles génèrent un échéancier avec rappels. Cochez « payé » pour celles réglées au démarrage.</p>
      <div className="card flush"><div className="list">
        {charges.map(c => <div key={c.id} className="li">
          <input type="checkbox" checked={c.garder} onChange={e => setCharges(charges.map(x => x.id === c.id ? { ...x, garder: e.target.checked } : x))}
            style={{ width: 20, height: 20, accentColor: "var(--brand)" }} aria-label={`Garder ${c.libelle}`} />
          <div className="tx"><b>{c.libelle}</b><span>{({ mensuel: "Chaque mois", trimestriel: "Chaque trimestre", semestriel: "Tous les 6 mois", annuel: "Chaque année", unique: "Une fois" })[c.frequence]}
            {c.libelle === "Taxe de roulage" ? " · exonération taxi à vérifier en mairie" : ""}</span>
            {c.garder && c.date_debut === taxi.date_mise_service && <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 650, marginTop: 4, color: "var(--brand)" }}>
              <input type="checkbox" checked={c.payee} onChange={e => setCharges(charges.map(x => x.id === c.id ? { ...x, payee: e.target.checked } : x))}
                style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />payé au démarrage</label>}</div>
          <input className="input money" style={{ width: 120, minHeight: 40 }} inputMode="numeric" value={c.montant ? fmt(c.montant) : ""}
            onChange={e => setCharges(charges.map(x => x.id === c.id ? { ...x, montant: parseInt(e.target.value.replace(/\D/g, "")) || 0 } : x))} aria-label="Montant" />
        </div>)}
      </div></div>
      <div className="sec"><h2>Budget de démarrage</h2></div>
      <div className="summary">
        <div><span>Acquisition et mise en conformité</span><b>{fmt(totalAmort)}</b></div>
        <div><span>Plein, nettoyage et frais consommés</span><b>{fmt(totalInv - totalAmort)}</b></div>
        <div><span>Premières échéances payées (assurance, taxes…)</span><b>{fmt(premieres)}</b></div>
        <div className="hl"><span>Trésorerie nécessaire au démarrage</span><b>{fcfa(totalInv + premieres)}</b></div>
      </div>
      <div className="sec"><h2>Prévisionnel mensuel</h2></div>
      <div className="summary">
        <div><span>Recettes prévues</span><b>{fcfa(apercu.recette)}</b></div>
        <div><span>Carburant, entretien, salaire</span><b>− {fmt(apercu.variable)}</b></div>
        <div><span>Charges fixes (mensualisées)</span><b>− {fmt(apercu.fixes)}</b></div>
        <div><span>Provision imprévus</span><b>− {fmt(apercu.imprevus)}</b></div>
        <div className="hl"><span>Marge mensuelle prévue</span><b>{fcfa(apercu.marge)}</b></div>
        <div><span>Retour sur l'investissement ({fcfa(totalInv)})</span><b>{apercu.retourMois ? `${apercu.retourMois.toFixed(1).replace(".", ",")} mois` : "non atteint"}</b></div>
        <div><span>Seuil de rentabilité</span><b>{fmt(apercu.seuilJour)} / jour</b></div>
      </div>
    </>}

    <div className="btns" style={{ marginTop: 18 }}>
      <button className="btn ghost" onClick={() => etape ? setEtape(etape - 1) : nav(-1)}>{etape ? "Retour" : "Annuler"}</button>
      <button className="btn" onClick={valider}>{etape < 3 ? "Continuer" : <><Icon n="check" /> Créer le taxi</>}</button>
    </div>
  </div>;
}

export { investTaxi };
