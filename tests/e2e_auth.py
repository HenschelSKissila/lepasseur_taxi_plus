"""Accès par compte (version de production, serveur Supabase simulé dans le navigateur).
Vérifie : écran de connexion obligatoire, création de compte sans vérification, session
conservée au rechargement et hors ligne, déconnexion, reconnexion.
Usage : npm run build && npx vite preview --port 4174  puis  python3 tests/e2e_auth.py
"""
import base64, json, os, re, sys, time
from playwright.sync_api import sync_playwright

URL = os.environ.get("URL", "http://localhost:4174")
OUT = os.path.join(os.path.dirname(__file__), "screens"); os.makedirs(OUT, exist_ok=True)
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
UID = "7b0c2f8e-5a3d-4f1e-9c2b-1d6e8a4f0b33"
comptes = {}          # email -> mot de passe (faux serveur d'authentification)
echecs = []

def ok(c, m):
    print(("  ok   " if c else "  FAIL ") + m)
    if not c: echecs.append(m)

def jwt(email):
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
    exp = int(time.time()) + 3600
    return f"{b({'alg':'HS256','typ':'JWT'})}.{b({'sub':UID,'email':email,'role':'authenticated','aud':'authenticated','exp':exp})}.c2ln"

def session(email):
    return {"access_token": jwt(email), "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600,
            "refresh_token": "rt-" + email, "user": {"id": UID, "aud": "authenticated", "role": "authenticated", "email": email,
            "email_confirmed_at": "2026-11-19T15:00:00Z", "app_metadata": {"provider": "email"}, "user_metadata": {}, "created_at": "2026-11-19T15:00:00Z"}}

def serveur(route):
    req = route.request; u = req.url
    corps = json.loads(req.post_data or "{}") if req.method in ("POST", "PUT", "PATCH") else {}
    if "/auth/v1/signup" in u:
        if corps["email"] in comptes: return route.fulfill(status=422, json={"msg": "User already registered", "error_code": "user_already_exists"})
        comptes[corps["email"]] = corps["password"]
        return route.fulfill(json=session(corps["email"]))      # aucune vérification d'e-mail
    if "/auth/v1/token" in u:
        if "refresh_token" in u: return route.fulfill(json=session(corps.get("refresh_token", "rt-x")[3:]))
        if comptes.get(corps.get("email")) != corps.get("password"):
            return route.fulfill(status=400, json={"error": "invalid_grant", "error_description": "Invalid login credentials", "msg": "Invalid login credentials"})
        return route.fulfill(json=session(corps["email"]))
    if "/auth/v1/logout" in u: return route.fulfill(status=204, body="")
    if "/auth/v1/user" in u: return route.fulfill(json=session("x@y.z")["user"])
    if "/rest/v1/" in u: return route.fulfill(status=200 if req.method == "GET" else 201, json=[])
    return route.fulfill(status=404, body="")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="fr-FR")
    ctx.route(re.compile(r"https://zsnmuyltwdbrbrjlavvz\.supabase\.co/.*"), serveur)
    page = ctx.new_page(); erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))

    print("— Ouverture")
    page.goto(URL); page.wait_for_selector("text=Bon retour")
    ok(page.locator("nav.nav").count() == 0, "écran de connexion affiché avant tout, sans accès à l'application")
    ok(page.locator("text=démonstration").count() == 0, "aucun contournement par la démonstration")
    page.goto(URL + "/taxis"); page.wait_for_selector("text=Bon retour")
    ok(True, "une adresse interne (/taxis) renvoie aussi vers la connexion")
    page.screenshot(path=f"{OUT}/30-connexion.png")

    print("— Création de compte")
    page.click("role=tab[name='Créer un compte']"); page.wait_for_selector("#mdp2")
    page.fill("#nom", "hks"); page.fill("#email", "hks@lepasseur.cg"); page.fill("#mdp", "taxi2026"); page.fill("#mdp2", "taxi2027")
    page.screenshot(path=f"{OUT}/31-inscription.png")
    page.click("button:has-text('Créer mon compte')"); page.wait_for_selector(".err")
    ok("ne correspondent pas" in page.inner_text(".err"), "mots de passe différents refusés")
    page.fill("#mdp2", "taxi2026"); page.click("button:has-text('Créer mon compte')"); 
    page.wait_for_selector("nav.nav", timeout=20000); page.screenshot(path=f"{OUT}/32-apres-inscription.png")
    ok("hks@lepasseur.cg" in comptes, "compte créé et session ouverte immédiatement, sans e-mail de vérification")

    print("— Rester connecté")
    page.reload(); page.wait_for_selector("nav.nav", timeout=20000)
    ok(True, "toujours connecté après rechargement")
    page.goto(URL + "/parametres"); page.wait_for_selector("text=Compte hks@lepasseur.cg")
    ok(True, "l'adresse du compte apparaît dans les paramètres")
    ctx.set_offline(True); page.reload(); page.wait_for_selector("#synchro", timeout=20000)
    ok(page.locator("text=Bon retour").count() == 0, "toujours connecté hors ligne")
    ctx.set_offline(False)

    print("— Déconnexion / reconnexion")
    page.goto(URL + "/parametres"); page.wait_for_selector("text=Se déconnecter")
    page.click("text=Se déconnecter"); page.wait_for_selector("text=Bon retour", timeout=20000)
    ok(True, "déconnexion : retour à l'écran de connexion")
    page.fill("#email", "hks@lepasseur.cg"); page.fill("#mdp", "mauvais1"); page.click("form button.btn.block")
    page.wait_for_selector(".err"); ok("incorrect" in page.inner_text(".err"), "mauvais mot de passe refusé avec un message clair")
    page.fill("#mdp", "taxi2026"); page.click("form button.btn.block")
    page.wait_for_selector("nav.nav", timeout=20000)
    ok(True, "reconnexion avec le bon mot de passe")
    b.close()

print(f"Erreurs JS : {len(erreurs)}"); [print("   ", e[:160]) for e in erreurs[:5]]
print("\n✓ accès par compte validé" if not echecs and not erreurs else f"\n✗ {len(echecs)} échec(s)")
sys.exit(1 if echecs or erreurs else 0)
