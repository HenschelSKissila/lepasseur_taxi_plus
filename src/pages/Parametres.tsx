import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { store, useDonnees, useSync } from "../lib/store";
import { useSession } from "../lib/session";
import { activerRappel, desactiverRappel, rappelAppareil, supportNotif, supportPush } from "../lib/notifications";
import { useParametres, majParametres, appliquerTheme } from "../lib/parametres";
import { exporterJSON, lireSauvegarde, tablesAvecDonnees } from "../lib/export";
import { heureRel } from "../lib/format";
import { TABLES } from "../lib/types";
import { Field, Seg, Sec, Toggle, useUI } from "../components/ui";
import { Icon } from "../components/Icon";
import { verifierMaj, versionApp } from "../lib/pwa";

const NOMS: Record<string, string> = { taxis: "taxi", journees: "journée", depenses: "dépense", charges: "charge", salaires: "salaire",
  chauffeurs: "chauffeur", investissements: "investissement", notifications: "notification" };

export default function Parametres() {
  const d = useDonnees();
  const s = useSync();
  const { espace, user, deconnecter, quitterDemo } = useSession();
  const { toast, confirmer } = useUI();
  const P = useParametres();
  const [appareil, setAppareil] = useState(rappelAppareil());
  const [profil, setProfil] = useState({ entreprise: P.entreprise, responsable: P.responsable, telephone: P.telephone, ville: P.ville });
  // Les réglages modifiés sur un autre appareil remplacent l'affichage tant qu'on n'édite pas ici
  const [edite, setEdite] = useState(false);
  useEffect(() => { if (!edite) setProfil({ entreprise: P.entreprise, responsable: P.responsable, telephone: P.telephone, ville: P.ville }); },
    [P.entreprise, P.responsable, P.telephone, P.ville]);
  const changer = (p: Partial<typeof profil>) => { setEdite(true); setProfil(x => ({ ...x, ...p })); };
  const fichier = useRef<HTMLInputElement>(null);
  const [install, setInstall] = useState<any>((window as any).__installPrompt || null);

  useEffect(() => {
    const f = (e: any) => { e.preventDefault(); (window as any).__installPrompt = e; setInstall(e); };
    addEventListener("beforeinstallprompt", f);
    if (location.hash === "#synchro") document.getElementById("synchro")?.scrollIntoView();
    return () => removeEventListener("beforeinstallprompt", f);
  }, []);

  const changerTheme = async (t: "auto" | "light" | "dark") => { appliquerTheme(t); await majParametres({ theme: t }); };
  const basculerRappel = async (v: boolean) => {
    if (v) { const r = await activerRappel(); setAppareil(r.ok); toast(r.message); }
    else { await desactiverRappel(); setAppareil(false); toast("Rappel quotidien désactivé sur le compte"); }
  };
  const testNotif = async () => {
    if (Notification.permission !== "granted") return toast("Activez d'abord le rappel.");
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("Test LE PASSEUR TAXI+", { body: "Les notifications fonctionnent. Glissez pour la supprimer.", icon: "/icons/icon-192.png", tag: "test" });
  };
  const sauverProfil = async () => {
    await majParametres({ ...profil, entreprise: profil.entreprise?.trim() || "LE PASSEUR TAXI+" });
    setEdite(false);
    toast(store.distant ? "Enregistré — visible sur tous vos appareils" : "Enregistré");
  };
  const importer = async (f: File) => {
    try {
      const data = lireSauvegarde(await f.text());
      const n = tablesAvecDonnees(data).reduce((t, k) => t + data[k].length, 0);
      if (!await confirmer("Restaurer cette sauvegarde ?", `${n} lignes (${data.taxis.length} taxi(s), ${data.journees.length} journées). Les lignes de même identifiant seront remplacées, les autres conservées.`, "Restaurer")) return;
      await store.lot(TABLES.map(t => [t, data[t] as any]));
      toast("Sauvegarde restaurée" + (store.distant ? " — envoi au serveur en cours" : ""));
    } catch (e: any) { toast(e.message || "Fichier illisible"); }
  };

  return <div style={{ maxWidth: 820 }}>
    <h1 className="h1">Paramètres</h1>
    <p className="lead">{espace === "distant" ? `Compte ${user?.email}` : espace === "demo" ? "Mode démonstration" : "Mode local : données sur cet appareil uniquement"}</p>

    <Sec titre="Entreprise" />
    <div className="card">
      <div className="row2">
        <Field label="Nom de l'entreprise"><input className="input" value={profil.entreprise || ""} placeholder="LE PASSEUR TAXI+" onChange={e => changer({ entreprise: e.target.value })} /></Field>
        <Field label="Responsable"><input className="input" value={profil.responsable || ""} onChange={e => changer({ responsable: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input" type="tel" value={profil.telephone || ""} onChange={e => changer({ telephone: e.target.value })} /></Field>
        <Field label="Ville"><input className="input" value={profil.ville || ""} placeholder="Brazzaville" onChange={e => changer({ ville: e.target.value })} /></Field>
      </div>
      <button className="btn sm" onClick={sauverProfil}>Enregistrer</button>
    </div>

    <Sec titre="Notifications" />
    <div className="card">
      <div className="switch"><div><b>Rappel quotidien à 20 h</b>
        <span>{!supportNotif() ? "Non pris en charge par ce navigateur." : supportPush() && espace === "distant"
          ? "Notification envoyée par le serveur si une journée n'est pas remplie, même application fermée."
          : "Rappel quand l'application est ouverte ou récemment utilisée. Le push serveur demande la configuration Supabase (voir guide)."}</span></div>
        <Toggle checked={P.rappel_actif} onChange={basculerRappel} label="Rappel quotidien" /></div>
      {P.rappel_actif && !appareil && supportNotif() && <div className="switch"><div><b>Cet appareil</b>
        <span>Le rappel est activé sur votre compte. Autorisez les notifications ici pour le recevoir aussi sur ce téléphone.</span></div>
        <button className="btn sm" onClick={() => basculerRappel(true)}>Autoriser</button></div>}
      <div className="switch"><div><b>Tester</b><span>Affiche une notification d'essai, supprimable d'un geste.</span></div>
        <button className="btn sm ghost" onClick={testNotif}>Envoyer</button></div>
      <p className="sub" style={{ marginTop: 8 }}>Les alertes (échéances, journées manquantes, salaires) s'affichent dans la cloche ; chacune se supprime avec ✕.</p>
    </div>

    <Sec titre="Synchronisation" />
    <div className="card" id="synchro">
      <div className="kv"><span>État</span><b>{({ local: "Données sur cet appareil", demo: "Démonstration (non synchronisée)", horsligne: "Hors ligne", synchro: "En cours…", ajour: "À jour", erreur: "Erreur" })[s.etat]}</b></div>
      {store.distant && <>
        <div className="kv"><span>Modifications en attente d'envoi</span><b>{s.enAttente}</b></div>
        <div className="kv"><span>Dernière synchronisation</span><b>{s.derniere ? heureRel(s.derniere) : "jamais"}</b></div>
        {s.message && <p className="err" style={{ marginTop: 10 }}>{s.message}</p>}
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => store.synchroniser()} disabled={s.etat === "synchro"}><Icon n="refresh" /> Synchroniser maintenant</button>
        {s.rejets.length > 0 && <><h3 style={{ marginTop: 16 }}>Lignes refusées par le serveur</h3>
          {s.rejets.map(r => <div key={r.k} className="kv"><span>{NOMS[r.table] || r.table} · {r.raison}</span>
            <span style={{ display: "flex", gap: 6 }}><button className="btn sm ghost" onClick={() => store.traiterRejet(r.k, true)}>Renvoyer</button>
              <button className="btn sm danger" onClick={() => store.traiterRejet(r.k, false)}>Ignorer</button></span></div>)}</>}
      </>}
      <p className="sub" style={{ marginTop: 10 }}>Chaque saisie est d'abord enregistrée sur l'appareil, puis envoyée dès qu'Internet est disponible. Rien n'est perdu hors connexion.</p>
    </div>

    <Sec titre="Apparence" />
    <div className="card"><Seg value={P.theme} onChange={changerTheme} options={[["auto", "Automatique"], ["light", "Clair"], ["dark", "Sombre"]]} /></div>

    <Sec titre="Données" />
    <div className="card">
      <div className="btns">
        <button className="btn ghost" onClick={() => exporterJSON(d)}><Icon n="download" /> Sauvegarde JSON</button>
        <button className="btn ghost" onClick={() => fichier.current?.click()}><Icon n="upload" /> Restaurer</button>
        <Link to="/rapports" className="btn ghost nl"><Icon n="file" /> Exports CSV</Link>
      </div>
      <input ref={fichier} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importer(f); e.target.value = ""; }} />
      <p className="sub" style={{ marginTop: 10 }}>{d.taxis.length} taxi(s) · {d.journees.length} journées · {d.depenses.length} dépenses · {d.salaires.length} paiements de salaire</p>
    </div>

    <Sec titre="Application" />
    <div className="card">
      <div className="kv"><span>Version</span><b>{versionApp}</b></div>
      <div className="kv"><span>Mises à jour</span><b style={{ fontFamily: "var(--sans)" }}>automatiques</b></div>
      <div className="btns" style={{ marginTop: 10 }}>
        <button className="btn sm ghost" onClick={async () => toast(await verifierMaj())}><Icon n="refresh" /> Vérifier maintenant</button>
        {install && <button className="btn sm gold" onClick={async () => { install.prompt(); await install.userChoice; setInstall(null); }}><Icon n="download" /> Installer l'application</button>}
      </div>
    </div>

    <Sec titre="Compte" />
    <div className="card">
      {espace === "distant" && <button className="btn ghost block" onClick={async () => {
        if (s.enAttente && !await confirmer("Données non envoyées", `${s.enAttente} modification(s) n'ont pas encore atteint le serveur. Vous déconnecter maintenant les perdrait. Continuer ?`, "Me déconnecter", true)) return;
        deconnecter(); }}><Icon n="logout" /> Se déconnecter</button>}
      {espace === "demo" && <button className="btn block" onClick={quitterDemo}>Quitter la démonstration</button>}
      {espace === "local" && <p className="sub">Pour synchroniser entre plusieurs téléphones, configurez Supabase (voir le guide de déploiement).</p>}
    </div>
  </div>;
}
