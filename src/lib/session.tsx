/* Session : compte Supabase, mode local (sans serveur) ou démonstration. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { store } from "./store";
import { genererDemo } from "./demo";
import { TABLES } from "./types";
import { assurerParametres, appliquerTheme, lireParametres } from "./parametres";

export type Espace = "distant" | "local" | "demo";
interface Session {
  espace: Espace; user: User | null; pret: boolean; connecte: boolean;
  entrerDemo: () => Promise<void>; quitterDemo: () => Promise<void>; deconnecter: () => Promise<void>;
}
const Ctx = createContext<Session>(null as unknown as Session);
export const useSession = () => useContext(Ctx);

const CLE_DEMO = "lptp-demo";
const demoActive = () => { try { return localStorage.getItem(CLE_DEMO) === "1"; } catch { return false; } };

async function remplirDemo() {
  if (store.data.taxis.length) return;
  const d = genererDemo();
  await store.lot(TABLES.map(t => [t, d[t] as any]));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Avec un serveur configuré, le compte est obligatoire : la démonstration n'existe qu'en mode local.
  if (supabase && demoActive()) { try { localStorage.removeItem(CLE_DEMO); } catch {} }
  const [espace, setEspace] = useState<Espace>(supabase ? "distant" : demoActive() ? "demo" : "local");
  const [user, setUser] = useState<User | null>(null);
  const [pret, setPret] = useState(false);

  async function ouvrir(e: Espace, u: User | null) {
    setPret(false);
    if (e === "demo") { await store.ouvrir("demo", null, false); await remplirDemo(); }
    else if (e === "local") await store.ouvrir("local", null, false);
    else if (u) await store.ouvrir(u.id, u.id, true);
    await assurerParametres();
    appliquerTheme(lireParametres().theme);
    setPret(true);
  }

  useEffect(() => {
    if (espace !== "distant") { ouvrir(espace, null); return; }
    let actif = true;
    // getSession lit la session mémorisée : fonctionne hors ligne.
    supabase!.auth.getSession().then(({ data }) => {
      if (!actif) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) ouvrir("distant", data.session.user); else setPret(true);
    });
    const { data: sub } = supabase!.auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_IN" && s?.user && s.user.id !== store.userId) { setUser(s.user); ouvrir("distant", s.user); }
      if (ev === "SIGNED_OUT") { setUser(null); store.fermer(); }
    });
    return () => { actif = false; sub.subscription.unsubscribe(); };
  }, [espace]);

  const api: Session = {
    espace, user, pret, connecte: espace !== "distant" || !!user,
    async entrerDemo() { if (supabase) return; localStorage.setItem(CLE_DEMO, "1"); setEspace("demo"); },
    async quitterDemo() { localStorage.removeItem(CLE_DEMO); await store.effacer("demo"); location.replace("/"); },
    async deconnecter() {
      if (espace === "demo") return api.quitterDemo();
      if (!supabase || !user) return;
      await store.synchroniser();
      const id = user.id;
      await supabase.auth.signOut();
      await store.effacer(id);         // aucune donnée ne reste sur un appareil partagé
    }
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
