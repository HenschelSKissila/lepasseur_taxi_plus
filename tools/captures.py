"""Génère les captures d'écran du manifeste (PWABuilder / stores) à partir du mode démonstration.
Usage : npm run build:local && npx vite preview --port 4173  puis  python3 tools/captures.py
"""
import os
from playwright.sync_api import sync_playwright
URL = os.environ.get("URL", "http://localhost:4173")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "screenshots"); os.makedirs(OUT, exist_ok=True)
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
CSS = ".demo-band,.toast,.offline-band{display:none!important}"

def prep(page):
    page.add_style_tag(content=CSS); page.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 360, "height": 780}, device_scale_factor=3, locale="fr-FR")
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_selector("text=Voir une démonstration"); pg.click("text=Voir une démonstration"); pg.wait_for_selector(".hero")
    pg.evaluate("localStorage.setItem('lptp-theme','light')")
    for chemin, nom, attente in [("/", "mobile-tableau-de-bord", ".hero"), ("/saisie", "mobile-saisie", ".taxi-card"),
                                 ("/depenses", "mobile-depenses", ".tabs")]:
        pg.goto(URL + chemin); pg.wait_for_selector(attente); prep(pg); pg.screenshot(path=f"{OUT}/{nom}.png")
    pg.goto(URL + "/taxis"); pg.wait_for_selector(".tcard"); pg.locator(".tcard").first.click(); pg.wait_for_selector(".hero")
    prep(pg); pg.screenshot(path=f"{OUT}/mobile-taxi.png")
    pg.set_viewport_size({"width": 1920, "height": 1080})
    ctx2 = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1, locale="fr-FR", storage_state=ctx.storage_state())
    pg2 = ctx2.new_page()
    pg2.goto(URL + "/"); pg2.wait_for_selector(".hero"); prep(pg2); pg2.screenshot(path=f"{OUT}/bureau-tableau-de-bord.png")
    pg2.goto(URL + "/rapports"); pg2.wait_for_selector(".tbl"); prep(pg2); pg2.screenshot(path=f"{OUT}/bureau-rapports.png")
    b.close()
for f in sorted(os.listdir(OUT)):
    from PIL import Image
    im = Image.open(os.path.join(OUT, f)); im.convert("RGB").quantize(colors=256, method=Image.FASTOCTREE).save(os.path.join(OUT, f), optimize=True)
    print(f, im.size, os.path.getsize(os.path.join(OUT, f)) // 1024, "Ko")
