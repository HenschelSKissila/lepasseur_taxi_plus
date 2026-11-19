import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { Field } from "../components/ui";

type Vue = "connexion" | "inscription" | "oubli";

export default function Connexion() {
  const { entrerDemo } = useSession();
  const [vue, setVue] = useState<Vue>("connexion");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [nom, setNom] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const traduire = (m: string) => /Invalid login/i.test(m) ? "Adresse e-mail ou mot de passe incorrect."
    : /Email not confirmed/i.test(m) ? "La confirmation d'e-mail est encore active sur le serveur : exécutez le script SQL à jour ou désactivez « Confirm email » dans Supabase (voir guide)."
    : /rate limit/i.test(m) ? "Trop de tentatives d'inscription en peu de temps. Désactivez « Confirm email » dans Supabase (voir guide) puis réessayez."
    : /already registered/i.test(m) ? "Un compte existe déjà avec cette adresse."
    : /Password should be/i.test(m) ? "Le mot de passe doit contenir au moins 6 caractères."
    : /fetch|network/i.test(m) ? "Pas de connexion Internet. La première connexion nécessite Internet ; ensuite l'application fonctionne hors ligne." : m;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try {
      if (vue === "connexion") {
        const { error } = await supabase!.auth.signInWithPassword({ email, password: mdp });
        if (error) throw error;
      } else if (vue === "inscription") {
        // Inscription sans vérification d'e-mail : le compte est confirmé à sa création côté base,
        // puis on ouvre la session immédiatement.
        const { data, error } = await supabase!.auth.signUp({ email, password: mdp, options: { data: { nom } } });
        if (error) throw error;
        if (!data.session) {
          const { error: e2 } = await supabase!.auth.signInWithPassword({ email, password: mdp });
          if (e2) throw e2;
        }
      } else {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/parametres" });
        if (error) throw error;
        setOk("Si un compte existe, un lien de réinitialisation a été envoyé à " + email + ".");
      }
    } catch (x: any) { setErr(traduire(x.message || String(x))); }
    finally { setBusy(false); }
  };

  return <div className="login">
    <form className="ob-card" onSubmit={soumettre}>
      <img className="ob-logo" src="/img/logo-full.png" alt="LE PASSEUR TAXI+" width={520} height={446} />
      <h1 className="h1" style={{ textAlign: "center" }}>{vue === "connexion" ? "Connexion" : vue === "inscription" ? "Créer un compte" : "Mot de passe oublié"}</h1>
      <p className="lead" style={{ textAlign: "center" }}>{vue === "inscription" ? "Un seul compte pour tous vos téléphones : mêmes taxis, mêmes données, mêmes réglages." : "Gérer · Suivre · Rentabiliser"}</p>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}
      {vue === "inscription" && <Field label="Votre nom"><input className="input" value={nom} onChange={e => setNom(e.target.value)} autoComplete="name" /></Field>}
      <Field label="Adresse e-mail"><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
      {vue !== "oubli" && <Field label="Mot de passe"><input className="input" type="password" required minLength={6} value={mdp} onChange={e => setMdp(e.target.value)}
        autoComplete={vue === "connexion" ? "current-password" : "new-password"} /></Field>}
      <button className="btn block" disabled={busy}>{busy ? "Veuillez patienter…" : vue === "connexion" ? "Se connecter" : vue === "inscription" ? "Créer mon compte" : "Envoyer le lien"}</button>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 13.5, flexWrap: "wrap", gap: 8 }}>
        {vue === "connexion" ? <>
          <button type="button" className="link" onClick={() => setVue("inscription")}>Créer un compte</button>
          <button type="button" className="link" onClick={() => setVue("oubli")}>Mot de passe oublié ?</button>
        </> : <button type="button" className="link" onClick={() => setVue("connexion")}>← Retour à la connexion</button>}
      </div>
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14, textAlign: "center" }}>
        <button type="button" className="btn ghost block" onClick={entrerDemo}>Essayer avec des données de démonstration</button>
        <p className="sub" style={{ marginTop: 8 }}>La démonstration reste sur cet appareil et n'utilise aucun compte.</p>
      </div>
    </form>
  </div>;
}
