/* Écran d'accès : obligatoire à l'ouverture tant qu'aucun compte n'est connecté.
 * Connexion ou création de compte par e-mail + mot de passe, sans vérification d'e-mail.
 * La session est mémorisée sur l'appareil : on reste connecté, y compris hors ligne,
 * jusqu'à une déconnexion volontaire. */
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Field } from "../components/ui";
import { Icon } from "../components/Icon";

type Vue = "connexion" | "inscription" | "oubli";

const traduire = (m: string) =>
  /Invalid login/i.test(m) ? "Adresse e-mail ou mot de passe incorrect."
  : /Email not confirmed/i.test(m) ? "La confirmation d'e-mail est encore active sur le serveur : exécutez le script SQL à jour ou désactivez « Confirm email » dans Supabase (voir guide)."
  : /rate limit/i.test(m) ? "Trop de tentatives en peu de temps. Patientez quelques minutes puis réessayez."
  : /already registered|already exists/i.test(m) ? "Un compte existe déjà avec cette adresse : connectez-vous."
  : /Password should be|at least 6/i.test(m) ? "Le mot de passe doit contenir au moins 6 caractères."
  : /valid email|invalid format/i.test(m) ? "Adresse e-mail invalide."
  : /fetch|network|Load failed/i.test(m) ? "Pas de connexion Internet. La première connexion nécessite Internet ; ensuite l'application fonctionne hors ligne."
  : m;

export default function Connexion() {
  const [vue, setVue] = useState<Vue>("connexion");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [nom, setNom] = useState("");
  const [voir, setVoir] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const aller = (v: Vue) => { setVue(v); setErr(""); setOk(""); };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk("");
    if (!supabase) return setErr("Serveur non configuré (VITE_SUPABASE_URL manquant).");
    if (vue === "inscription" && mdp !== mdp2) return setErr("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      const mail = email.trim().toLowerCase();
      if (vue === "connexion") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: mdp });
        if (error) throw error;
      } else if (vue === "inscription") {
        // Compte confirmé à sa création côté base ; la session est ouverte immédiatement.
        const { data, error } = await supabase.auth.signUp({ email: mail, password: mdp, options: { data: { nom: nom.trim() } } });
        if (error) throw error;
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({ email: mail, password: mdp });
          if (e2) throw e2;
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + "/parametres" });
        if (error) throw error;
        setOk(`Si un compte existe pour ${mail}, un lien de réinitialisation vient d'être envoyé.`);
      }
    } catch (x: any) { setErr(traduire(x?.message || String(x))); }
    finally { setBusy(false); }
  };

  const champMdp = (val: string, set: (v: string) => void, label: string, id: string, auto: string) =>
    <Field label={label}><div style={{ position: "relative" }}>
      <input id={id} className="input" type={voir ? "text" : "password"} required minLength={6} value={val}
        onChange={e => set(e.target.value)} autoComplete={auto} style={{ paddingRight: 48 }} />
      <button type="button" className="icon-btn" onClick={() => setVoir(!voir)} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        style={{ position: "absolute", right: 3, top: 3 }}><Icon n={voir ? "eyeOff" : "eye"} /></button>
    </div></Field>;

  return <div className="login">
    <form className="ob-card" onSubmit={soumettre} noValidate={false}>
      <img className="ob-logo" src="/img/logo-full.png" alt="LE PASSEUR TAXI+" width={520} height={446} />

      {vue !== "oubli" && <div className="seg" role="tablist" style={{ marginBottom: 18 }}>
        <button type="button" role="tab" aria-pressed={vue === "connexion"} onClick={() => aller("connexion")}>Se connecter</button>
        <button type="button" role="tab" aria-pressed={vue === "inscription"} onClick={() => aller("inscription")}>Créer un compte</button>
      </div>}

      <h1 className="h1" style={{ textAlign: "center", fontSize: 22 }}>
        {vue === "connexion" ? "Bon retour" : vue === "inscription" ? "Votre compte" : "Mot de passe oublié"}</h1>
      <p className="lead" style={{ textAlign: "center" }}>
        {vue === "connexion" ? "Connectez-vous pour retrouver vos taxis sur cet appareil."
          : vue === "inscription" ? "Un seul compte pour tous vos téléphones : mêmes taxis, mêmes données, mêmes réglages."
          : "Saisissez l'adresse de votre compte."}</p>

      {err && <div className="err" role="alert">{err}</div>}
      {ok && <div className="ok">{ok}</div>}

      {vue === "inscription" && <Field label="Votre nom"><input id="nom" className="input" value={nom} onChange={e => setNom(e.target.value)} autoComplete="name" /></Field>}
      <Field label="Adresse e-mail"><input id="email" className="input" type="email" inputMode="email" required value={email}
        onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" /></Field>
      {vue !== "oubli" && champMdp(mdp, setMdp, "Mot de passe", "mdp", vue === "connexion" ? "current-password" : "new-password")}
      {vue === "inscription" && champMdp(mdp2, setMdp2, "Confirmer le mot de passe", "mdp2", "new-password")}
      {vue === "inscription" && <p className="hint">Au moins 6 caractères. Aucun e-mail de vérification : le compte est utilisable immédiatement.</p>}

      <button className="btn block" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? "Veuillez patienter…" : vue === "connexion" ? "Se connecter" : vue === "inscription" ? "Créer mon compte" : "Envoyer le lien"}</button>

      <div style={{ textAlign: "center", marginTop: 14, fontSize: 13.5 }}>
        {vue === "connexion" && <button type="button" className="link" onClick={() => aller("oubli")}>Mot de passe oublié ?</button>}
        {vue === "oubli" && <button type="button" className="link" onClick={() => aller("connexion")}>← Retour à la connexion</button>}
      </div>
      <p className="sub" style={{ textAlign: "center", marginTop: 16 }}>Vous restez connecté sur cet appareil, même sans Internet, jusqu'à la déconnexion.</p>
    </form>
  </div>;
}
