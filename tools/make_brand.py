# -*- coding: utf-8 -*-
"""Génère icônes PWA et logos d'interface depuis le logo officiel LE PASSEUR TAXI+.
Usage : python3 tools/make_brand.py chemin/vers/logo.jpeg
"""
import sys, os
from PIL import Image, ImageDraw
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/f833a477-4097-41ec-abff-883d9a1a197f.jpeg"
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VERT = (11, 92, 48)
BLANC = (255, 255, 255, 255)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(int)
encre = (255 - a.min(axis=2)) > 26


def bbox(y0, y1, x0=0, x1=None):
    sub = encre[y0:y1, x0:x1 or encre.shape[1]]
    ys = np.where(sub.sum(axis=1) > 1)[0]
    xs = np.where(sub.sum(axis=0) > 1)[0]
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)


# bandes blanches horizontales -> séparation symbole / typographie
rows = encre.sum(axis=1)
contenu = np.where(rows > 2)[0]
y_top, y_bot = contenu.min(), contenu.max() + 1
gap = next(y for y in range(y_top + 50, y_bot) if rows[y:y + 12].max() < 3)
SYMB = bbox(y_top, gap)
PLEIN = bbox(y_top, y_bot)


def tuile(t, plaque=0.68, symb=0.88, plein=False):
    ss = 4 * t
    out = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    if plein:
        d.rectangle([0, 0, ss, ss], fill=VERT + (255,))
    else:
        d.rounded_rectangle([0, 0, ss - 1, ss - 1], radius=int(ss * .22), fill=VERT + (255,))
    pw = ss * plaque; ph = pw * .62
    x0, y0 = (ss - pw) / 2, (ss - ph) / 2
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=int(ph * .24), fill=BLANC)
    s = im.crop(SYMB)
    k = min(pw * symb / s.width, ph * .86 / s.height)
    s = s.resize((round(s.width * k), round(s.height * k)), Image.LANCZOS)
    out.paste(s, (round((ss - s.width) / 2), round((ss - s.height) / 2)))
    return out.resize((t, t), Image.LANCZOS)


def sur_blanc(crop, largeur, pad=.05, couleurs=128):
    s = im.crop(crop); p = int(s.width * pad)
    o = Image.new("RGB", (s.width + 2 * p, s.height + 2 * p), (255, 255, 255))
    o.paste(s, (p, p))
    o = o.resize((largeur, round(o.height * largeur / o.width)), Image.LANCZOS)
    return o.quantize(colors=couleurs, dither=Image.FLOYDSTEINBERG)


def opt(img, path):
    img = img if img.mode in ("RGBA", "P") else img.convert("RGB")
    if img.mode != "P":
        img = img.quantize(colors=200, method=Image.FASTOCTREE)
    img.save(path, optimize=True)


I = os.path.join(APP, "public", "icons")
opt(tuile(192), f"{I}/icon-192.png")
opt(tuile(512), f"{I}/icon-512.png")
opt(tuile(512, plaque=.54, symb=.90, plein=True).convert("RGB"), f"{I}/icon-maskable-512.png")
opt(tuile(180, plein=True).convert("RGB"), f"{I}/apple-touch-icon.png")
PIN = bbox(y_top, y_top + 255, SYMB[0] + 20, SYMB[0] + 250)
for n in (32, 64):
    t = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    pin = im.crop(PIN); k = n * .92 / max(pin.size)
    pin = pin.resize((round(pin.width * k), round(pin.height * k)), Image.LANCZOS).convert("RGBA")
    bg = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle([0, 0, n - 1, n - 1], radius=n // 5, fill=BLANC)
    bg.paste(pin, ((n - pin.width) // 2, (n - pin.height) // 2))
    opt(bg, f"{I}/favicon-{n}.png")

G = os.path.join(APP, "public", "img")
sur_blanc(SYMB, 320).save(f"{G}/logo-mark.png", optimize=True)
sur_blanc(PLEIN, 520, .035, 96).save(f"{G}/logo-full.png", optimize=True)
print("symbole", SYMB, "complet", PLEIN)
