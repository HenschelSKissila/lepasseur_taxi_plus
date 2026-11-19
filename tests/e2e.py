"""Parcours complet dans Chromium (mode local, sans Supabase).
Usage : npm run build:local && npx vite preview --port 4173  puis  python3 tests/e2e.py
"""
import os, sys, re
from playwright.sync_api import sync_playwright

URL = os.environ.get("URL", "http://localhost:4173")
OUT = os.path.join(os.path.dirname(__file__), "screens"); os.makedirs(OUT, exist_ok=True)
CHROME = next((p for p in ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"] if os.path.exists(p)), None)
erreurs, echecs = [], []

def ok(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: echecs.append(msg)

def shot(page, nom): page.screenshot(path=f"{OUT}/{nom}.png", full_page=False)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="fr-FR",
                        timezone_id="Africa/Brazzaville", service_workers="allow")
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and erreurs.append(m.text))
    page.on("pageerror", lambda e: erreurs.append(str(e)))

    print("— Premier lancement")
    page.goto(URL); page.wait_for_selector("text=Bienvenue dans votre gestion de taxis")
    ok(True, "écran d'accueil vierge affiché"); shot(page, "01-accueil-vide")
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller !== null || true")
    m = page.evaluate("fetch('/manifest.webmanifest').then(r=>r.json())")
    ok(m["display"] == "standalone" and any(i.get("purpose") == "maskable" for i in m["icons"]), "manifeste PWA valide (standalone, icône maskable)")

    print("— Démonstration")
    page.click("text=Voir une démonstration"); page.wait_for_selector(".hero")
    ok(page.locator(".flux .f").count() == 3, "entrées / sorties / solde affichés")
    ok(page.locator(".cat").count() >= 3, f"détail des dépenses par catégorie ({page.locator('.cat').count()})")
    page.locator(".cat button").first.click()
    ok(page.locator(".cat .lines div").count() > 0, "une catégorie se déplie jusqu'aux lignes")
    ok(page.locator(".recharts-surface").count() >= 2, "graphiques rendus")
    txt = page.inner_text("main")
    ok(not re.search(r"NaN|undefined|Infinity", txt), "aucune valeur NaN / undefined")
    shot(page, "02-tableau-de-bord-mobile")
    page.mouse.wheel(0, 900); page.wait_for_timeout(300); shot(page, "03-tableau-de-bord-bas")

    print("— Notifications")
    page.click("button.bell"); page.wait_for_selector(".sheet.on")
    n0 = page.locator(".notif").count(); ok(n0 > 0, f"centre de notifications : {n0} alerte(s)")
    shot(page, "04-notifications")
    page.locator(".notif .x").first.click(); page.wait_for_timeout(200)
    ok(page.locator(".notif").count() == n0 - 1, "une notification se supprime avec ✕")
    page.keyboard.press("Escape"); page.wait_for_timeout(400)

    print("— Saisie du jour")
    page.goto(URL + "/saisie"); page.wait_for_selector(".taxi-card")
    cartes = page.locator(".taxi-card"); ok(cartes.count() == 2, "une carte par taxi actif")
    c = cartes.first
    c.locator(".chip", has_text="22").first.click()
    c.locator("button", has_text=re.compile("Enregistrer|Mettre à jour")).click()
    page.wait_for_selector(".toast.on"); ok("enregistré" in page.inner_text(".toast"), "journée enregistrée")
    shot(page, "05-saisie")

    print("— Taxis")
    page.goto(URL + "/taxis"); page.wait_for_selector(".tcard"); ok(page.locator(".tcard").count() == 2, "liste des taxis"); shot(page, "06-taxis")
    page.locator(".tcard").first.click(); page.wait_for_selector(".hero")
    shot(page, "07-taxi-vue")
    page.click("role=tab[name='Journal']"); page.wait_for_selector(".cal"); shot(page, "08-taxi-journal")
    page.locator(".cal .d.todo, .cal .d.w1, .cal .d.w2, .cal .d.w3").first.click(); page.wait_for_selector(".sheet.on")
    ok(page.locator(".sheet.on .money-wrap.xl").count() == 1, "fiche journée depuis le calendrier"); shot(page, "09-fiche-journee")
    page.keyboard.press("Escape"); page.wait_for_timeout(400)
    page.click("role=tab[name='Investissement']"); page.wait_for_selector(".tbl")
    ok("2 819 750" in page.inner_text("main").replace("\u00a0", " ").replace("\u202f", " "), "investissement de 2 819 750 FCFA et budget de démarrage"); shot(page, "10-taxi-invest")

    print("— Dépenses")
    page.goto(URL + "/depenses"); page.wait_for_selector(".tabs")
    ok(page.locator("text=En retard").count() > 0, "échéance en retard détectée")
    page.locator("button.act", has_text="Payer").first.click(); page.wait_for_selector(".sheet.on")
    page.click("text=Marquer comme payé"); page.wait_for_selector(".toast.on")
    ok("Paiement" in page.inner_text(".toast"), "échéance payée")
    shot(page, "11-depenses")
    page.locator(".ph button", has_text="Dépense").last.click(); page.wait_for_selector(".sheet.on")
    page.fill(".sheet.on .money-wrap.xl input", "45000"); page.fill(".sheet.on input[placeholder^='Ex.']", "Pompe à essence")
    page.click(".sheet.on >> text=Enregistrer")
    page.wait_for_selector(".toast.on >> text=Dépense enregistrée"); ok(True, "imprévu ajouté")
    page.click("role=tab[name='Historique']"); page.wait_for_timeout(300); shot(page, "12-depenses-historique")

    print("— Chauffeurs & salaires")
    page.goto(URL + "/chauffeurs"); page.wait_for_selector(".card")
    ok(page.locator("text=Reste à payer").count() >= 1, "calcul du reste à payer")
    shot(page, "13-chauffeurs")

    print("— Rapports")
    page.goto(URL + "/rapports"); page.wait_for_selector(".tbl"); shot(page, "14-rapports")
    page.click("role=tab[name='Simulateur']"); page.wait_for_selector(".range"); shot(page, "15-simulateur")

    print("— Paramètres")
    page.goto(URL + "/parametres"); page.wait_for_selector("#synchro"); shot(page, "16-parametres")

    print("— Hors ligne")
    page.goto(URL + "/"); page.wait_for_selector(".hero")
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    ctx.set_offline(True)
    page.reload(); page.wait_for_selector(".hero", timeout=15000)
    ok(True, "l'application se recharge sans réseau (service worker)")
    page.goto(URL + "/taxis"); page.wait_for_selector(".tcard", timeout=15000)
    ok(True, "navigation hors ligne vers une autre page")
    page.goto(URL + "/saisie"); page.wait_for_selector(".taxi-card")
    page.locator(".taxi-card").nth(1).locator("[data-v='repos']").click(); page.wait_for_timeout(400)
    page.reload(); page.wait_for_selector(".taxi-card")
    ok(page.locator(".taxi-card").nth(1).locator(".badge.green").count() == 1, "saisie hors ligne conservée après rechargement")
    ctx.set_offline(False)

    print("— Bureau, thème sombre")
    page.set_viewport_size({"width": 1366, "height": 900})
    page.goto(URL + "/"); page.wait_for_selector(".hero"); page.wait_for_timeout(500); shot(page, "17-bureau")
    page.evaluate("localStorage.setItem('lptp-theme','dark')"); page.reload(); page.wait_for_selector(".hero"); page.wait_for_timeout(500)
    shot(page, "18-bureau-sombre")
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(URL + "/saisie"); page.wait_for_selector(".taxi-card"); shot(page, "19-mobile-sombre")

    print("— Création d'un taxi (mode local, après la démo)")
    page.evaluate("localStorage.setItem('lptp-theme','light')")
    page.goto(URL + "/parametres"); page.click("text=Quitter la démonstration"); page.wait_for_selector("text=Bienvenue dans votre gestion de taxis")
    page.click("text=Ajouter un taxi"); page.wait_for_selector(".step-dots")
    page.click("text=Continuer"); page.wait_for_selector(".choice")
    page.click("text=Continuer"); page.wait_for_selector(".inv-row")
    ok("2 819 750" in page.inner_text("main").replace("\u00a0", " ").replace("\u202f", " "), "frais de démarrage pré-remplis (2 819 750 FCFA)"); shot(page, "20-assistant-invest")
    page.click("text=Continuer"); page.wait_for_selector(".summary")
    ok("3 006 250" in page.inner_text("main").replace("\u00a0", " "), "budget de démarrage 3 006 250 FCFA (taxes payées au démarrage incluses)")
    ok(page.locator("text=Patente").count() == 1 and page.locator("text=BCDA").count() == 1, "patente et droits d'auteur proposés"); shot(page, "21-assistant-previsionnel")
    page.click("text=Créer le taxi"); page.wait_for_selector(".hero")
    ok("Taxi 01" in page.inner_text("main"), "taxi créé")
    page.click("role=tab[name='Investissement']"); page.wait_for_selector(".tbl")
    ok("3 006 250" in page.inner_text("main").replace("\u00a0", " "), "premières échéances enregistrées comme payées"); shot(page, "22-fiche-budget")
    page.reload(); page.wait_for_selector(".hero"); ok("Taxi 01" in page.inner_text("main"), "taxi conservé après rechargement")

    b.close()

reels = [e for e in erreurs if "favicon" not in e]
print(f"\nErreurs console : {len(reels)}"); [print("   ", e[:200]) for e in reels[:10]]
print("\n✓ parcours réussi" if not echecs and not reels else f"\n✗ {len(echecs)} échec(s)")
sys.exit(1 if echecs or reels else 0)
