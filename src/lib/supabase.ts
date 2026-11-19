import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Projet Supabase de LE PASSEUR TAXI+.
 * Les valeurs par défaut ci-dessous sont utilisées dans TOUS les modes (npm run dev, build, Netlify),
 * pour que l'application exige toujours une connexion. Une variable d'environnement les remplace.
 * La clé « publishable » est publique par nature : la sécurité repose sur la RLS de la base. */
const URL_DEFAUT = "https://zsnmuyltwdbrbrjlavvz.supabase.co";
const CLE_DEFAUT = "sb_publishable_Y3Q6x40GQKrxVaaAdWgbaA_4OE98RBY";

const env = import.meta.env;
/** Mode sans serveur : uniquement pour les tests automatisés (VITE_MODE_LOCAL=1). */
const forcerLocal = env.VITE_MODE_LOCAL === "1";
const brut = (env.VITE_SUPABASE_URL as string | undefined) || URL_DEFAUT;
export const SUPABASE_URL = brut.replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");   // tolère une adresse copiée avec /rest/v1/
const key = (env.VITE_SUPABASE_ANON_KEY as string | undefined) || CLE_DEFAUT;
export const SUPABASE_KEY = key;

export const supabase: SupabaseClient | null = forcerLocal ? null : createClient(SUPABASE_URL, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "lptp-auth" }
});

export const modeLocal = !supabase;
export const projetSupabase = SUPABASE_URL.replace(/^https?:\/\//, "");
export const VAPID_PUBLIC = (env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";
