// =====================================================================
// Fonction Supabase « rappel-quotidien » (Deno).
// Appelée chaque heure par pg_cron. Pour chaque appareil abonné dont l'heure
// locale correspond à son heure de rappel (20 h par défaut), elle vérifie si
// tous les taxis actifs ont leur journée saisie ; sinon elle envoie une
// notification push et l'inscrit dans le centre de notifications.
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:vous@exemple.com)
//   CRON_SECRET (chaîne aléatoire, la même que dans supabase/cron_rappel.sql)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contact@lepasseur.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

/** Même algorithme que src/lib/ids.ts : l'application et le serveur produisent le même identifiant. */
function uuidStable(cle: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < cle.length; i++) {
    const k = cle.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  const hex = [h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Date (AAAA-MM-JJ) et heure locales dans un fuseau donné. */
function local(fuseau: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour) % 24 };
}

Deno.serve(async req => {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return new Response("Accès refusé", { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";   // test manuel

  const { data: abos, error } = await sb.from("push_abonnements").select("*").eq("actif", true);
  if (error) return new Response(error.message, { status: 500 });

  const bilan = { appareils: abos?.length ?? 0, envoyes: 0, complets: 0, expires: 0 };
  const parCompte = new Map<string, { date: string; manque: string[] | null }>();

  for (const a of abos ?? []) {
    // Rappel désactivé sur le compte (depuis n'importe quel appareil) : rien n'est envoyé.
    const { data: reglage } = await sb.from("parametres").select("rappel_actif, heure_rappel").eq("owner_id", a.owner_id).maybeSingle();
    if (reglage && !reglage.rappel_actif) continue;
    if (reglage?.heure_rappel != null) a.heure_rappel = reglage.heure_rappel;
    const { date, heure } = local(a.fuseau || "Africa/Brazzaville");
    if (!force && (heure !== a.heure_rappel || a.dernier_envoi === date)) continue;

    // Journées manquantes du compte (calculées une fois par compte et par date)
    const k = `${a.owner_id}@${date}`;
    if (!parCompte.has(k)) {
      const { data: taxis } = await sb.from("taxis").select("id, nom, date_mise_service").eq("owner_id", a.owner_id).eq("actif", true).is("deleted_at", null).lte("date_mise_service", date);
      const { data: js } = await sb.from("journees").select("taxi_id").eq("owner_id", a.owner_id).eq("date", date).is("deleted_at", null);
      const saisis = new Set((js ?? []).map(j => j.taxi_id));
      const manque = (taxis ?? []).filter(t => !saisis.has(t.id)).map(t => t.nom);
      parCompte.set(k, { date, manque });
      if (manque.length) {
        const cle = `rappel-${date}`;
        await sb.from("notifications").upsert({
          id: uuidStable(`notif:${a.owner_id}:${cle}`), owner_id: a.owner_id, cle, lien: "/saisie", lu: false,
          titre: "Remplissez l'état de la journée",
          corps: manque.length === 1 ? `La journée de ${manque[0]} n'est pas encore saisie.` : `${manque.length} taxis à saisir : ${manque.join(", ")}.`
        }, { onConflict: "id", ignoreDuplicates: true });
      }
    }
    const { manque } = parCompte.get(k)!;
    if (!manque?.length) { bilan.complets++; continue; }

    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify({
        title: "Remplissez l'état de la journée",
        body: manque.length === 1 ? `${manque[0]} : la journée n'est pas encore saisie.` : `${manque.length} taxis à saisir : ${manque.join(", ")}.`,
        url: "/saisie", tag: "rappel-jour"
      }), { TTL: 4 * 3600, urgency: "normal" });
      await sb.from("push_abonnements").update({ dernier_envoi: date }).eq("id", a.id);
      bilan.envoyes++;
    } catch (e: any) {
      // 404/410 : l'abonnement n'existe plus (application désinstallée) → on le désactive.
      if (e?.statusCode === 404 || e?.statusCode === 410) { await sb.from("push_abonnements").update({ actif: false }).eq("id", a.id); bilan.expires++; }
      else console.error("Échec d'envoi", a.endpoint.slice(0, 60), e?.statusCode, e?.body);
    }
  }
  return Response.json(bilan);
});
