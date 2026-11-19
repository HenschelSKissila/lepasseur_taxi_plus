"""Contrôle de publication PWABuilder / stores sur la version compilée (dossier dist/).
Usage : npm run build && python3 tests/pwa_check.py
"""
import json, os, re, sys
from PIL import Image
D = os.path.join(os.path.dirname(__file__), "..", "dist")
m = json.load(open(os.path.join(D, "manifest.webmanifest"), encoding="utf-8"))
echecs = []
def ok(c, t):
    print(("  ok   " if c else "  FAIL ") + t)
    if not c: echecs.append(t)
def fichier(src): return os.path.join(D, src.lstrip("/"))
def taille(src):
    f = fichier(src); return Image.open(f).size if os.path.exists(f) else None

print("— Champs du manifeste")
for k in ["id", "name", "short_name", "description", "start_url", "scope", "display", "lang", "dir", "orientation",
          "background_color", "theme_color", "categories", "icons", "screenshots", "shortcuts", "launch_handler", "display_override"]:
    ok(k in m and m[k] not in ("", [], None), f"champ « {k} » présent")
ok(len(m["short_name"]) <= 12, f"short_name ≤ 12 caractères ({m['short_name']})")
ok(len(m["description"]) >= 50, "description suffisamment détaillée")
ok(m.get("prefer_related_applications") is False, "prefer_related_applications = false")

print("— Icônes")
for i in m["icons"] + [ic for s in m["shortcuts"] for ic in s.get("icons", [])]:
    t = taille(i["src"]); w, h = map(int, i["sizes"].split("x"))
    ok(t == (w, h), f"{i['src']} existe et mesure {i['sizes']}{' (' + i.get('purpose', 'any') + ')' if i.get('purpose') else ''}")
ok(any(i["sizes"] == "512x512" and i.get("purpose", "any") == "any" for i in m["icons"]), "icône 512 × 512 « any »")
ok(any(i["sizes"] == "192x192" and i.get("purpose", "any") == "any" for i in m["icons"]), "icône 192 × 192 « any »")
ok(any(i.get("purpose") == "maskable" and i["sizes"] == "512x512" for i in m["icons"]), "icône maskable 512 × 512")

print("— Captures d'écran")
for s in m["screenshots"]:
    t = taille(s["src"]); w, h = map(int, s["sizes"].split("x"))
    ok(t == (w, h) and s.get("form_factor") in ("narrow", "wide") and s.get("label"), f"{s['src']} {s['sizes']} {s.get('form_factor')}")
ok(sum(s["form_factor"] == "narrow" for s in m["screenshots"]) >= 2, "au moins 2 captures mobiles (narrow)")
ok(any(s["form_factor"] == "wide" for s in m["screenshots"]), "au moins 1 capture bureau (wide)")

print("— Fichiers du site")
ok(os.path.exists(os.path.join(D, "sw.js")), "service worker sw.js")
idx = open(os.path.join(D, "index.html"), encoding="utf-8").read()
ok('rel="manifest"' in idx, "index.html relie le manifeste")
ok(os.path.exists(os.path.join(D, "confidentialite.html")), "page publique de confidentialité")
al = json.load(open(os.path.join(D, ".well-known", "assetlinks.json")))
ok(al[0]["target"]["package_name"] == "cg.lepasseur.taxiplus", "assetlinks.json présent (empreinte à renseigner après PWABuilder)")
sw = open(os.path.join(D, "sw.js"), encoding="utf-8").read()
ok("push" in sw and "notificationclick" in sw, "service worker : notifications push et clic")
ok("confidentialite" in sw, "service worker : la page de confidentialité n'est pas interceptée")
print("\n✓ prêt pour PWABuilder" if not echecs else f"\n✗ {len(echecs)} point(s) à corriger")
sys.exit(1 if echecs else 0)
