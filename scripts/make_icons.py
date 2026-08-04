"""Erzeugt einfache Platzhalter-Icons (icon-192.png, icon-512.png).
Nur einmalig zur Erstellung genutzt, kein Teil der ausgelieferten App.
"""
from PIL import Image, ImageDraw
import math
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
BG = (232, 135, 61, 255)  # --amber
FG = (33, 29, 24, 255)  # --ink


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # abgerundetes Quadrat als Hintergrund (maskable-freundlich: Motiv bleibt in sicherer Zone)
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    cx, cy = size / 2, size / 2 + size * 0.08
    dot_r = size * 0.045
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=FG)

    # drei NFC-Funkwellen-Bögen
    line_w = max(2, int(size * 0.035))
    for i, r in enumerate([size * 0.16, size * 0.24, size * 0.32]):
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.arc(bbox, start=225, end=315, fill=FG, width=line_w)

    img.save(os.path.join(OUT_DIR, f"icon-{size}.png"))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    make_icon(192)
    make_icon(512)
    print("Icons erzeugt in", os.path.abspath(OUT_DIR))
