import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./lib/session";
import { UIProvider, useUI } from "./components/ui";
import { Layout } from "./components/Layout";
import { Icon } from "./components/Icon";
import { demarrerPWA, annonceApresMaj } from "./lib/pwa";
import Dashboard from "./pages/Dashboard";
import Saisie from "./pages/Saisie";
import Connexion from "./pages/Connexion";

// Écrans secondaires chargés à la demande (et mis en cache pour le hors ligne)
const TaxisListe = lazy(() => import("./pages/Taxis").then(m => ({ default: m.TaxisListe })));
const TaxiNouveau = lazy(() => import("./pages/Taxis").then(m => ({ default: m.TaxiNouveau })));
const TaxiDetail = lazy(() => import("./pages/TaxiDetail"));
const Depenses = lazy(() => import("./pages/Depenses"));
const Chauffeurs = lazy(() => import("./pages/Chauffeurs"));
const Rapports = lazy(() => import("./pages/Rapports"));
const Parametres = lazy(() => import("./pages/Parametres"));

function Plus() {
  const items: Array<[string, string, string, string]> = [
    ["/chauffeurs", "users", "Chauffeurs & salaires", "Rémunérations, avances, primes et reste à payer"],
    ["/rapports", "chart", "Rapports", "Compte de résultat, prévu vs réel, simulateur, exports"],
    ["/parametres", "gear", "Paramètres", "Notifications, synchronisation, sauvegarde, compte"]
  ];
  return <><h1 className="h1">Plus</h1><div className="spacer" />
    <div className="card flush"><div className="list">{items.map(([to, ic, t, s]) =>
      <Link key={to} to={to} className="li nl" style={{ color: "inherit" }}><div className="ic green"><Icon n={ic} /></div>
        <div className="tx"><b>{t}</b><span>{s}</span></div><Icon n="right" className="i mut" /></Link>)}</div></div></>;
}

function Splash() { return <div className="splash"><img src="/img/logo-full.png" alt="Chargement…" /></div>; }

function Routeur() {
  const { pret, connecte } = useSession();
  const { toast } = useUI();
  useEffect(() => { demarrerPWA(toast); annonceApresMaj(); }, []);
  if (!pret) return <Splash />;
  if (!connecte) return <Connexion />;
  return <Suspense fallback={<Splash />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="saisie" element={<Saisie />} />
        <Route path="taxis" element={<TaxisListe />} />
        <Route path="taxis/nouveau" element={<TaxiNouveau />} />
        <Route path="taxis/:id" element={<TaxiDetail />} />
        <Route path="depenses" element={<Depenses />} />
        <Route path="chauffeurs" element={<Chauffeurs />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="plus" element={<Plus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </Suspense>;
}

export default function App() {
  return <BrowserRouter>
    <UIProvider><SessionProvider><Routeur /></SessionProvider></UIProvider>
  </BrowserRouter>;
}
