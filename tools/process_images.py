"""Crop the supplied reference photos into clean web assets.

Source: _ref/ (owner-supplied Instagram screenshots / stills).
Every crop removes the Instagram UI overlays (profile + mute icons in the
bottom corners) and thin screenshot borders. Nothing is retouched.
Run:  python tools/process_images.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "_ref", ROOT / "img"
OUT.mkdir(exist_ok=True)

# name: (source, (left, top, right, bottom))  — bottom trims IG icons
CROPS = {
    # full views
    "blush-front":      ("1.webp", (4, 4, 729, 1252)),
    "noir-turn":        ("2.webp", (4, 4, 713, 1250)),
    "noir-front":       ("3.webp", (6, 8, 724, 1254)),
    "plava-front":      ("4.webp", (4, 4, 709, 1212)),
    "plava-back":       ("5.webp", (0, 0, 664, 948)),
    "noir-back":        ("6.webp", (2, 2, 729, 880)),
    "plava-more":       ("7.png",  (0, 0, 534, 497)),
    "zuta-back":        ("8.png",  (0, 0, 588, 709)),
    "grupa":            ("9.webp", (0, 0, 715, 827)),
    # per-look crops from the group photograph (left -> right: ivory, blush, blue, yellow, black)
    "ivory-grupa":      ("9.webp", (18, 150, 222, 712)),
    "blush-grupa":      ("9.webp", (148, 40, 332, 520)),
    "plava-grupa":      ("9.webp", (250, 190, 446, 727)),
    "zuta-grupa":       ("9.webp", (372, 90, 566, 715)),
    "noir-grupa":       ("9.webp", (510, 100, 715, 712)),
    # fabric / construction details
    "detalj-plava-cipka":   ("5.webp", (230, 420, 664, 900)),
    "detalj-plava-ledja":   ("5.webp", (190, 150, 560, 560)),
    "detalj-plava-masna":   ("7.png",  (140, 0, 470, 300)),
    "detalj-noir-sljokice": ("6.webp", (110, 380, 600, 740)),
    "detalj-zuta-ledja":    ("8.png",  (170, 150, 470, 470)),
    "detalj-blush-korset":  ("1.webp", (250, 620, 520, 960)),
}

for name, (src, box) in CROPS.items():
    im = Image.open(SRC / src).convert("RGB").crop(box)
    im.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"{name:22s} {im.size}")

# contact sheet for visual QA (not used by the site)
thumbs = [Image.open(OUT / f"{n}.webp") for n in CROPS]
H = 300
row = [t.resize((int(t.width * H / t.height), H)) for t in thumbs]
W = 1600; x = y = 0; sheet = Image.new("RGB", (W, H * 4), "white")
for t in row:
    if x + t.width > W: x = 0; y += H
    sheet.paste(t, (x, y)); x += t.width + 4
sheet.crop((0, 0, W, y + H)).save(ROOT / "tools" / "_contact.jpg", quality=80)
