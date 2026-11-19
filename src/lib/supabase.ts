import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sans variables d'environnement, l'application tourne en mode local (appareil seul). */
export const supabase: SupabaseClient | null =
  url && key && !url.includes("votre-projet")
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "lptp-auth" }
      })
    : null;

export const modeLocal = !supabase;
export const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";
