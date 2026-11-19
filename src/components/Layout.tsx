import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { Sheet, useUI } from "./ui";
import { store, useDonnees, useSync } from "../lib/store";
import { useSession } from "../lib/session";
import { alertesVisibles, masquer, verifierRappel, planifierRappelLocal } from "../lib/notifications";
import { heureRel } from "../lib/format";
import { useParametres, appliquerTheme } from "../lib/parametres";
import { rappelAppareil, activerRappel, supportNotif } from "../lib/notifications";

const TITRES: Record<string, string> = {
  "/": "Tableau de bord", "/saisie": "Saisie du jour", "/taxis": "Mes taxis", "/depenses": "Dépenses",
  "/chauffeurs": "Chauffeurs & salaires", "/rapports": "Rapports", "/parametres": "Paramètres", "/plus": "Plus"
};

export function SyncPill() {
  const s = useSync();
  const nav = useNavigate();
  const txt = { local: "Sur cet appareil", demo: "Démonstration", horsligne: s.enAttente ? `Hors ligne · ${s.enAttente} en attente` : "Hors ligne",
    synchro: "Synchronisation…", ajour: s.enAttente ? `${s.enAttente} en attente` : "À jour", erreur: "Erreur de synchro" }[s.etat];
  return <button className={`syncpill ${s.etat}`} onClick={() => nav("/parametres#synchro")}
    title={s.derniere ? `Dernière synchronisation ${heureRel(s.derniere)}` : undefined}>
    <i /><span>{txt}</span>{s.rejets.length > 0 && <b style={{ color: "var(--red)" }}>!</b>}
  </button>;
}

function Centre({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDonnees();
  const nav = useNavigate();
  const [tic, maj] = useState(0);
  const alertes = useMemo(() => alertesVisibles(), [d, open, tic]);
  const notifs = [...d.notifications].sort((a, b) => (b.created_at || b.updated_at || "").localeCompare(a.created_at || a.updated_at || ""));
  const aller = (lien: string, id?: string) => {
    if (id) { const n = store.get("notifications", id); n && !n.lu && store.enregistrer("notifications", { ...n, lu: true }); }
    onClose(); nav(lien);
  };
  const toutEffacer = async () => {
    masquer(alertes.map(a => a.cle));
    if (notifs.length) await store.supprimer("notifications", notifs.map(n => n.id));
    maj(x => x + 1);
  };
  const vide = !alertes.length && !notifs.length;
  return <Sheet open={open} onClose={onClose} titre="Notifications" sous={vide ? "Tout est en ordre." : "Touchez pour ouvrir, ✕ pour supprimer."}
    pied={vide ? undefined : <button className="btn ghost block" onClick={toutEffacer}><Icon n="trash" /> Tout effacer</button>}>
    {vide && <div className="empty"><Icon n="bell" /><b>Aucune notification</b>Les rappels et alertes apparaîtront ici.</div>}
    {alertes.map(a => <div key={a.cle} className={`notif ${a.niveau}`}>
      <span className="dot" />
      <div className="tx" onClick={() => aller(a.lien)}><b>{a.titre}</b><span>{a.detail}</span><small>Alerte automatique</small></div>
      <button className="x" aria-label="Supprimer" onClick={() => { masquer([a.cle]); maj(x => x + 1); }}><Icon n="x" /></button>
    </div>)}
    {notifs.map(n => <div key={n.id} className={`notif ${n.lu ? "lu" : ""}`}>
      <span className="dot" />
      <div className="tx" onClick={() => aller(n.lien || "/", n.id)}><b>{n.titre}</b>{n.corps && <span>{n.corps}</span>}
        <small>{heureRel(n.created_at || n.updated_at || new Date().toISOString())}</small></div>
      <button className="x" aria-label="Supprimer" onClick={() => store.supprimer("notifications", n.id)}><Icon n="x" /></button>
    </div>)}
  </Sheet>;
}

function Lien({ to, icon, children, end }: { to: string; icon: string; children: ReactNode; end?: boolean }) {
  return <NavLink to={to} end={end}><Icon n={icon} />{children}</NavLink>;
}

export function Layout() {
  const d = useDonnees();
  const { espace, user, deconnecter } = useSession();
  const loc = useLocation();
  const { toast } = useUI();
  const [centre, setCentre] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const nb = useMemo(() => alertesVisibles().length + d.notifications.filter(n => !n.lu).length, [d, centre]); // recalculé à la fermeture du centre
  const base = "/" + (loc.pathname.split("/")[1] || "");
  const titre = TITRES[base] || "LE PASSEUR TAXI+";

  useEffect(() => { const f = () => setScrolled(scrollY > 4); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  useEffect(() => { scrollTo(0, 0); }, [loc.pathname]);
  const P = useParametres();
  useEffect(() => { appliquerTheme(P.theme); }, [P.theme]);
  useEffect(() => { planifierRappelLocal(); verifierRappel(); }, [P.rappel_actif]);
  const [proposerRappel, setProposerRappel] = useState(false);
  useEffect(() => { setProposerRappel(P.rappel_actif && supportNotif() && !rappelAppareil()); }, [P.rappel_actif]);
  useEffect(() => {
    const on = () => toast("Connexion rétablie — envoi des données en attente");
    const off = () => toast("Hors ligne : vos saisies sont conservées sur l'appareil");
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  return <div className="app">
    <aside className="side">
      <div className="brand"><img src="/img/logo-full.png" alt="LE PASSEUR TAXI+" width={520} height={446} /><SyncPill /></div>
      <nav>
        <Lien to="/" icon="home" end>Tableau de bord</Lien>
        <Lien to="/saisie" icon="plus">Saisie du jour</Lien>
        <div className="grp">Gestion</div>
        <Lien to="/taxis" icon="car">Taxis</Lien>
        <Lien to="/depenses" icon="wallet">Dépenses</Lien>
        <Lien to="/chauffeurs" icon="users">Chauffeurs & salaires</Lien>
        <div className="grp">Pilotage</div>
        <Lien to="/rapports" icon="chart">Rapports</Lien>
        <Lien to="/parametres" icon="gear">Paramètres</Lien>
      </nav>
      <div className="veh">
        <small>{espace === "demo" ? "Mode démonstration" : espace === "local" ? "Mode local" : "Connecté"}</small>
        <b>{espace === "distant" ? user?.email : `${d.taxis.length} taxi${d.taxis.length > 1 ? "s" : ""}`}</b>
        <span>{d.taxis.filter(t => t.actif).length} actif{d.taxis.filter(t => t.actif).length > 1 ? "s" : ""} · {d.chauffeurs.filter(c => c.actif).length} chauffeur(s)</span>
        {(espace !== "local") && <button className="btn ghost sm block cta" onClick={deconnecter}><Icon n="logout" />{espace === "demo" ? "Quitter la démo" : "Déconnexion"}</button>}
      </div>
    </aside>

    <div>
      <header className={`top ${scrolled ? "scrolled" : ""}`}>
        <img className="logo" src="/img/logo-mark.png" alt="" width={320} height={193} />
        <div className="ttl"><small>Le Passeur Taxi+</small><b>{titre}</b></div>
        <div className="hide-desk"><SyncPill /></div>
        <button className="icon-btn bell" onClick={() => setCentre(true)} aria-label={`Notifications (${nb})`}>
          <Icon n="bell" />{nb > 0 && <b>{nb > 9 ? "9+" : nb}</b>}
        </button>
      </header>
      <main>
        {proposerRappel && <div className="offline-band"><Icon n="bell" />Le rappel de 20 h est activé sur votre compte.
          <button className="link" style={{ marginLeft: "auto" }} onClick={async () => { const r = await activerRappel(); toast(r.message); setProposerRappel(!r.ok); }}>Activer ici</button>
          <button className="link" style={{ color: "var(--muted)" }} onClick={() => setProposerRappel(false)}>Plus tard</button></div>}
        {espace === "demo" && <div className="demo-band"><Icon n="info" />Démonstration : données fictives sur cet appareil uniquement.
          <button onClick={deconnecter}>Quitter</button></div>}
        <Outlet />
      </main>
    </div>

    <nav className="nav" aria-label="Navigation principale">
      <NavLink to="/" end><Icon n="home" />Bord</NavLink>
      <NavLink to="/taxis"><Icon n="car" />Taxis</NavLink>
      <NavLink to="/saisie" className="fab-slot" aria-label="Saisie du jour"><span className="fab"><Icon n="plus" /></span><span>Saisie</span></NavLink>
      <NavLink to="/depenses"><Icon n="wallet" />Dépenses</NavLink>
      <NavLink to="/plus" className={["/plus", "/chauffeurs", "/rapports", "/parametres"].includes(base) ? "active" : ""}
        aria-current={["/plus", "/chauffeurs", "/rapports", "/parametres"].includes(base) ? "page" : undefined}><Icon n="menu" />Plus</NavLink>
    </nav>
    <Centre open={centre} onClose={() => setCentre(false)} />
  </div>;
}
