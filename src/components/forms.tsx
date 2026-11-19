/* Formulaires en feuille modale, partagés par plusieurs écrans. Tous écrivent via le magasin hors ligne. */
import { useEffect, useState } from "react";
import { store, useDonnees } from "../lib/store";
import { MODES, FREQ, CAT_CHARGE, CAT_IMPREVU, CAT_ENTRETIEN, CAT_AUTRE, depJournee, salaireMois, type Echeance } from "../lib/finance";
import { REMUNERATION, nouveauChauffeur } from "../lib/defaults";
import { idJournee, idPaiement, uuid } from "../lib/ids";
import { fmt, fcfa, today, dateLong, dateCourt, monthStart, monthEnd, moisLabel, mKey } from "../lib/format";
import type { Charge, Chauffeur, Depense, Journee, Salaire, Taxi, TypeDepense, TypeSalaire, Remuneration, Frequence, StatutJournee } from "../lib/types";
import { Field, Money, Seg, Sheet, Kpi, useUI } from "./ui";
import { Icon } from "./Icon";

/* ========================================================= journée */
export function JourneeForm({ taxi, date, onClose }: { taxi: Taxi | null; date: string; onClose: () => void }) {
  const d = useDonnees();
  const { toast } = useUI();
  const ex = taxi ? d.journees.find(j => j.taxi_id === taxi.id && j.date === date) : undefined;
  const vierge = (): Journee => ({ id: taxi ? idJournee(taxi.id, date) : "", taxi_id: taxi?.id || "", chauffeur_id: taxi?.chauffeur_id || null,
    date, statut: "travail", recette: 0, carburant: 0, entretien: 0, autres: 0, prelevement: 0, km: null, note: null });
  const [j, setJ] = useState<Journee>(ex || vierge());
  useEffect(() => { setJ(ex ? { ...ex } : vierge()); }, [taxi?.id, date]);
  if (!taxi) return <Sheet open={false} onClose={onClose} titre="">{null}</Sheet>;
  const m = MODES[taxi.mode];
  const set = (p: Partial<Journee>) => setJ(x => ({ ...x, ...p }));
  const travail = j.statut === "travail";
  const marge = j.recette - depJournee(j);
  const kmPrec = d.journees.filter(x => x.taxi_id === taxi.id && x.date < date && x.km).sort((a, b) => b.date.localeCompare(a.date))[0]?.km;

  const enregistrer = async () => {
    const o: Journee = travail ? j : { ...j, recette: 0, carburant: 0, prelevement: 0, km: null };
    if (travail && !o.recette && !depJournee(o)) return toast("Saisissez au moins la recette.");
    if (o.km && kmPrec && o.km < kmPrec) return toast(`Compteur inférieur au précédent (${fmt(kmPrec)} km).`);
    const avant = ex ? { ...ex } : null;
    await store.enregistrer("journees", o);
    onClose();
    toast(ex ? "Journée mise à jour" : "Journée enregistrée", {
      label: "Annuler", fn: () => avant ? store.enregistrer("journees", avant) : store.supprimer("journees", o.id) });
  };
  const supprimer = async () => {
    if (!ex) return;
    const avant = { ...ex };
    await store.supprimer("journees", ex.id); onClose();
    toast("Journée supprimée", { label: "Annuler", fn: () => store.enregistrer("journees", avant) });
  };

  return <Sheet open onClose={onClose} titre={`${taxi.nom} · ${dateLong(date)}`} sous={ex ? "Modifier la journée" : m.nom}
    pied={<div className="btns">
      {ex && <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={supprimer} aria-label="Supprimer"><Icon n="trash" /></button>}
      <button className="btn" onClick={enregistrer}><Icon n="check" /> Enregistrer</button></div>}>
    <Seg<StatutJournee> className="status" value={j.statut} onChange={v => set({ statut: v })}
      options={[["travail", "Travail"], ["repos", "Repos"], ["panne", "Panne / garage"]]} />
    <div className="spacer" />
    {travail && <>
      <Field label={m.recette} hint={taxi.objectif_recette_jour ? `objectif ${fmt(taxi.objectif_recette_jour)}` : undefined}>
        <Money xl autoFocus value={j.recette} onChange={v => set({ recette: v })} />
      </Field>
      <div className="chips">{m.rapide.map(v => <button key={v} className={`chip ${j.recette === v ? "on" : ""}`} onClick={() => set({ recette: v })}>{fmt(v)}</button>)}</div>
      <div className="spacer" />
    </>}
    <div className="row2">
      {travail && m.carburant && <Field label="Carburant"><Money value={j.carburant} onChange={v => set({ carburant: v })} /></Field>}
      <Field label="Entretien / réparation"><Money value={j.entretien} onChange={v => set({ entretien: v })} /></Field>
      <Field label="Autres frais"><Money value={j.autres} onChange={v => set({ autres: v })} /></Field>
      {travail && <Field label="Compteur km" hint={kmPrec ? `préc. ${fmt(kmPrec)}` : undefined}>
        <input className="input mono" inputMode="numeric" value={j.km ? fmt(j.km) : ""} placeholder="—"
          onChange={e => set({ km: parseInt(e.target.value.replace(/\D/g, "")) || null })} /></Field>}
      {travail && m.prelevement && <Field label="Prélèvement perso"><Money value={j.prelevement} onChange={v => set({ prelevement: v })} /></Field>}
    </div>
    {travail && m.prelevement && <p className="hint">Le prélèvement personnel n'est pas une charge : il réduit la trésorerie, pas la marge.</p>}
    {travail && d.chauffeurs.length > 0 && <Field label="Chauffeur du jour">
      <select className="input" value={j.chauffeur_id || ""} onChange={e => set({ chauffeur_id: e.target.value || null })}>
        <option value="">— Aucun / propriétaire —</option>
        {d.chauffeurs.filter(c => c.actif || c.id === j.chauffeur_id).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select></Field>}
    <Field label="Note"><input className="input" value={j.note || ""} placeholder="Versement incomplet, course aéroport, contrôle…"
      onChange={e => set({ note: e.target.value || null })} /></Field>
    <div className="grid g2">
      <Kpi l="Dépenses du jour" v={fmt(depJournee(j))} c="var(--chart-2)" />
      <Kpi l="Marge du jour" v={fmt(marge)} c="var(--chart-1)" neg={marge < 0} />
    </div>
  </Sheet>;
}

/* ================================================= paiement d'échéance */
export function PaiementForm({ echeance, onClose }: { echeance: Echeance | null; onClose: () => void }) {
  const { toast } = useUI();
  const [m, setM] = useState(0);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  useEffect(() => { if (echeance) { setM(echeance.montant); setDate(today()); setNote(""); } }, [echeance?.cle]);
  if (!echeance) return null;
  const c = echeance.charge;
  const ok = async () => {
    if (!m) return toast("Montant obligatoire.");
    const dep: Depense = { id: idPaiement(c.id, echeance.date), taxi_id: c.taxi_id, date, type: "fixe", categorie: c.categorie,
      libelle: c.libelle, montant: m, charge_id: c.id, echeance: echeance.date, note: note || null };
    await store.enregistrer("depenses", dep); onClose();
    toast("Paiement enregistré", { label: "Annuler", fn: () => store.supprimer("depenses", dep.id) });
  };
  return <Sheet open onClose={onClose} titre="Enregistrer le paiement" sous={`${c.libelle} · échéance du ${dateCourt(echeance.date)}`}
    pied={<button className="btn block" onClick={ok}><Icon n="check" /> Marquer comme payé</button>}>
    <Field label="Montant payé"><Money xl autoFocus value={m} onChange={setM} /></Field>
    <Field label="Date du paiement"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
    <Field label="Note"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="N° de quittance…" /></Field>
  </Sheet>;
}

/* ========================================================== dépense */
const TYPES: Record<Exclude<TypeDepense, "fixe">, { nom: string; cats: string[] }> = {
  imprevu: { nom: "Imprévu", cats: CAT_IMPREVU }, entretien: { nom: "Entretien", cats: CAT_ENTRETIEN }, autre: { nom: "Autre", cats: CAT_AUTRE }
};
export function DepenseForm({ open, initial, taxiDefaut, onClose }: { open: boolean; initial?: Depense | null; taxiDefaut?: string | null; onClose: () => void }) {
  const d = useDonnees();
  const { toast } = useUI();
  const vierge = (): Depense => ({ id: uuid(), taxi_id: taxiDefaut ?? d.taxis.find(t => t.actif)?.id ?? null, date: today(), type: "imprevu",
    categorie: CAT_IMPREVU[0], libelle: "", montant: 0, charge_id: null, echeance: null, note: null });
  const [x, setX] = useState<Depense>(initial || vierge());
  useEffect(() => { if (open) setX(initial ? { ...initial } : vierge()); }, [open, initial?.id]);
  if (!open) return null;
  const set = (p: Partial<Depense>) => setX(v => ({ ...v, ...p }));
  const cats = x.type === "fixe" ? CAT_CHARGE : TYPES[x.type].cats;
  const ok = async () => {
    if (!x.montant) return toast("Montant obligatoire.");
    const o = { ...x, libelle: x.libelle.trim() || x.categorie };
    await store.enregistrer("depenses", o); onClose();
    toast("Dépense enregistrée", { label: "Annuler", fn: () => initial ? store.enregistrer("depenses", initial) : store.supprimer("depenses", o.id) });
  };
  const suppr = async () => {
    if (!initial) return;
    await store.supprimer("depenses", initial.id); onClose();
    toast("Dépense supprimée", { label: "Annuler", fn: () => store.enregistrer("depenses", initial) });
  };
  return <Sheet open onClose={onClose} titre={initial ? "Modifier la dépense" : "Nouvelle dépense"} sous="Imprévu, entretien ou dépense ponctuelle hors journal."
    pied={<div className="btns">{initial && <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={suppr} aria-label="Supprimer"><Icon n="trash" /></button>}
      <button className="btn" onClick={ok}><Icon n="check" /> Enregistrer</button></div>}>
    {x.type !== "fixe" && <><Seg<Exclude<TypeDepense, "fixe">> value={x.type as any} onChange={v => set({ type: v, categorie: TYPES[v].cats[0] })}
      options={Object.entries(TYPES).map(([k, v]) => [k as any, v.nom])} /><div className="spacer" /></>}
    <Field label="Montant"><Money xl autoFocus value={x.montant} onChange={v => set({ montant: v })} /></Field>
    <div className="row2">
      <Field label="Catégorie"><select className="input" value={x.categorie} onChange={e => set({ categorie: e.target.value })}>
        {[...new Set([...cats, x.categorie])].map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Date"><input type="date" className="input" value={x.date} onChange={e => set({ date: e.target.value })} /></Field>
    </div>
    <Field label="Taxi concerné"><select className="input" value={x.taxi_id || ""} onChange={e => set({ taxi_id: e.target.value || null })}>
      <option value="">Commune à toute la flotte</option>
      {d.taxis.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></Field>
    <Field label="Description"><input className="input" value={x.libelle} onChange={e => set({ libelle: e.target.value })} placeholder="Ex. remplacement alternateur" /></Field>
  </Sheet>;
}

/* ================================================= charge récurrente */
export function ChargeForm({ open, initial, taxiDefaut, onClose }: { open: boolean; initial?: Charge | null; taxiDefaut?: string | null; onClose: () => void }) {
  const d = useDonnees();
  const { toast, confirmer } = useUI();
  const vierge = (): Charge => ({ id: uuid(), taxi_id: taxiDefaut ?? d.taxis.find(t => t.actif)?.id ?? null, libelle: "", categorie: CAT_CHARGE[0],
    montant: 0, frequence: "annuel", date_debut: today(), actif: true });
  const [c, setC] = useState<Charge>(initial || vierge());
  useEffect(() => { if (open) setC(initial ? { ...initial } : vierge()); }, [open, initial?.id]);
  if (!open) return null;
  const set = (p: Partial<Charge>) => setC(v => ({ ...v, ...p }));
  const ok = async () => {
    if (!c.libelle.trim() || !c.montant) return toast("Libellé et montant obligatoires.");
    await store.enregistrer("charges", { ...c, libelle: c.libelle.trim() }); onClose(); toast("Charge enregistrée");
  };
  const suppr = async () => {
    if (!initial) return;
    onClose();
    if (await confirmer("Supprimer cette charge ?", "Les paiements déjà enregistrés sont conservés ; les échéances futures disparaissent.", "Supprimer", true)) {
      await store.supprimer("charges", initial.id);
      toast("Charge supprimée", { label: "Annuler", fn: () => store.enregistrer("charges", initial) });
    }
  };
  return <Sheet open onClose={onClose} titre={initial ? "Modifier la charge" : "Nouvelle charge récurrente"} sous="Elle génère automatiquement ses échéances et ses rappels."
    pied={<div className="btns">{initial && <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={suppr} aria-label="Supprimer"><Icon n="trash" /></button>}
      <button className="btn" onClick={ok}><Icon n="check" /> Enregistrer</button></div>}>
    <Field label="Libellé"><input className="input" autoFocus value={c.libelle} onChange={e => set({ libelle: e.target.value })} placeholder="Assurance, visite technique…" /></Field>
    <Field label="Montant par échéance"><Money value={c.montant} onChange={v => set({ montant: v })} /></Field>
    <div className="row2">
      <Field label="Catégorie"><select className="input" value={c.categorie} onChange={e => set({ categorie: e.target.value })}>
        {[...new Set([...CAT_CHARGE, c.categorie])].map(x => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Fréquence"><select className="input" value={c.frequence} onChange={e => set({ frequence: e.target.value as Frequence })}>
        {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}</select></Field>
      <Field label="Première échéance"><input type="date" className="input" value={c.date_debut} onChange={e => set({ date_debut: e.target.value })} /></Field>
      <Field label="Taxi"><select className="input" value={c.taxi_id || ""} onChange={e => set({ taxi_id: e.target.value || null })}>
        <option value="">Toute la flotte</option>{d.taxis.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></Field>
    </div>
    {initial && <div className="switch"><div><b>Charge active</b><span>Désactivée, elle ne génère plus d'échéances.</span></div>
      <button type="button" className="toggle" role="switch" aria-checked={c.actif} onClick={() => set({ actif: !c.actif })} /></div>}
    <p className="note">{c.frequence === "unique" ? "Paiement unique, non mensualisé." : <>Soit <b>{fcfa(c.montant / FREQ[c.frequence].mois)}</b> par mois, intégré au prévisionnel et au seuil de rentabilité.</>}</p>
  </Sheet>;
}

/* ========================================================== chauffeur */
export function ChauffeurForm({ open, initial, onClose }: { open: boolean; initial?: Chauffeur | null; onClose: () => void }) {
  const { toast, confirmer } = useUI();
  const [c, setC] = useState<Chauffeur>(initial || nouveauChauffeur());
  useEffect(() => { if (open) setC(initial ? { ...initial } : nouveauChauffeur()); }, [open, initial?.id]);
  if (!open) return null;
  const set = (p: Partial<Chauffeur>) => setC(v => ({ ...v, ...p }));
  const ok = async () => {
    if (!c.nom.trim()) return toast("Le nom est obligatoire.");
    if (c.remuneration === "pourcentage" && (c.pourcentage <= 0 || c.pourcentage > 100)) return toast("Pourcentage entre 1 et 100.");
    await store.enregistrer("chauffeurs", { ...c, nom: c.nom.trim() }); onClose(); toast("Chauffeur enregistré");
  };
  const suppr = async () => {
    if (!initial) return; onClose();
    if (await confirmer(`Supprimer ${initial.nom} ?`, "Son historique de salaires sera aussi supprimé. Pour garder l'historique, désactivez-le plutôt.", "Supprimer", true)) {
      const st = store.data.salaires.filter(s => s.chauffeur_id === initial.id);
      await store.lot([["salaires", st, true], ["chauffeurs", [initial], true]]);
      toast("Chauffeur supprimé");
    }
  };
  return <Sheet open onClose={onClose} titre={initial ? initial.nom : "Nouveau chauffeur"} sous="Identité et mode de rémunération."
    pied={<div className="btns">{initial && <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={suppr} aria-label="Supprimer"><Icon n="trash" /></button>}
      <button className="btn" onClick={ok}><Icon n="check" /> Enregistrer</button></div>}>
    <Field label="Nom complet"><input className="input" autoFocus value={c.nom} onChange={e => set({ nom: e.target.value })} /></Field>
    <div className="row2">
      <Field label="Téléphone"><input className="input" type="tel" value={c.telephone || ""} onChange={e => set({ telephone: e.target.value })} /></Field>
      <Field label="N° de permis"><input className="input" value={c.numero_permis || ""} onChange={e => set({ numero_permis: e.target.value })} /></Field>
    </div>
    <Field label="Date d'embauche"><input type="date" className="input" value={c.date_embauche || ""} onChange={e => set({ date_embauche: e.target.value || null })} /></Field>
    <Field label="Rémunération"><select className="input" value={c.remuneration} onChange={e => set({ remuneration: e.target.value as Remuneration })}>
      {Object.entries(REMUNERATION).map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}</select></Field>
    <p className="hint">{REMUNERATION[c.remuneration].detail}</p>
    {(c.remuneration === "salaire_fixe" || c.remuneration === "journalier") &&
      <Field label={c.remuneration === "journalier" ? "Montant par jour travaillé" : "Salaire mensuel"}><Money value={c.montant} onChange={v => set({ montant: v })} /></Field>}
    {c.remuneration === "pourcentage" && <Field label="Pourcentage des recettes">
      <input className="input mono" inputMode="decimal" value={c.pourcentage || ""} onChange={e => set({ pourcentage: Math.min(100, parseFloat(e.target.value.replace(",", ".")) || 0) })} placeholder="30" /></Field>}
    {initial && <div className="switch"><div><b>Chauffeur actif</b><span>Inactif, il n'apparaît plus dans la saisie.</span></div>
      <button type="button" className="toggle" role="switch" aria-checked={c.actif} onClick={() => set({ actif: !c.actif })} /></div>}
  </Sheet>;
}

/* ============================================ paiement de salaire */
export function SalaireForm({ chauffeur, mois, typeDefaut = "salaire", onClose }: { chauffeur: Chauffeur | null; mois: string; typeDefaut?: TypeSalaire; onClose: () => void }) {
  const d = useDonnees();
  const { toast } = useUI();
  const [type, setType] = useState<TypeSalaire>(typeDefaut);
  const [m, setM] = useState(0);
  const [date, setDate] = useState(today());
  const [taxi, setTaxi] = useState("");
  const [note, setNote] = useState("");
  const s = chauffeur ? salaireMois(d, chauffeur, mois) : null;
  useEffect(() => {
    if (!chauffeur || !s) return;
    setType(typeDefaut); setM(typeDefaut === "salaire" ? Math.max(0, s.reste) : 0);
    setDate(mKey(today()) === mKey(mois) ? today() : monthEnd(mois));
    setTaxi(d.taxis.find(t => t.chauffeur_id === chauffeur.id)?.id || ""); setNote("");
  }, [chauffeur?.id, mois, typeDefaut]);
  if (!chauffeur || !s) return null;
  const ok = async () => {
    if (!m) return toast("Montant obligatoire.");
    const p: Salaire = { id: uuid(), chauffeur_id: chauffeur.id, taxi_id: taxi || null, periode: monthStart(mois), type, montant: m,
      date_paiement: date, note: note || null };
    await store.enregistrer("salaires", p); onClose();
    toast(type === "retenue" ? "Retenue enregistrée" : "Paiement enregistré", { label: "Annuler", fn: () => store.supprimer("salaires", p.id) });
  };
  return <Sheet open onClose={onClose} titre={chauffeur.nom} sous={`${moisLabel(mKey(mois))} · reste dû ${fmt(s.reste)} FCFA`}
    pied={<button className="btn block" onClick={ok}><Icon n="check" /> Enregistrer</button>}>
    <Seg<TypeSalaire> value={type} onChange={setType} options={[["salaire", "Salaire"], ["avance", "Avance"], ["prime", "Prime"], ["retenue", "Retenue"]]} />
    <p className="hint" style={{ marginTop: 8 }}>{{ salaire: "Paiement du salaire du mois.", avance: "Versée avant la fin du mois, déduite du reste dû.",
      prime: "Versement en plus du salaire, sans le réduire.", retenue: "Déduction (dégât, manquant) : réduit le dû, aucune sortie d'argent." }[type]}</p>
    <Field label="Montant"><Money xl autoFocus value={m} onChange={setM} /></Field>
    <div className="row2">
      <Field label="Date"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Taxi (imputation)"><select className="input" value={taxi} onChange={e => setTaxi(e.target.value)}>
        <option value="">Flotte</option>{d.taxis.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></Field>
    </div>
    <Field label="Note"><input className="input" value={note} onChange={e => setNote(e.target.value)} /></Field>
  </Sheet>;
}
