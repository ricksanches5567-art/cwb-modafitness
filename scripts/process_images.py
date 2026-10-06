#!/usr/bin/env python3
"""Converte as fotos originais (JPG) em WebP para o site.

Uso:  python3 scripts/process_images.py /caminho/para/fotos_originais

- Lê data/produtos_info.csv para saber quais fotos são usadas.
- Fotos grandes: img/p/<FOTO>.webp (máx. 1000 px no lado maior, qualidade 80)
- Miniaturas:    img/t/<FOTO>.webp (máx. 400 px no lado maior)
- BLUR: desfoca placas/letreiros com nome de outras lojas (coordenadas em
  frações da largura/altura da foto: x0, y0, x1, y1).
"""
import csv, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/catalogo/unicas'

BLUR = {
    'WA0034': [(0.545, 0.10, 0.705, 0.35)],                      # "STRENGTH ATHLETICISM FITNESS"
    'WA0037': [(0.0, 0.705, 0.335, 0.726), (0.0, 0.705, 0.031, 0.772),
               (0.275, 0.705, 0.335, 0.760)],                      # texto parcialmente coberto
    'WA0053': [(0.855, 0.0, 1.0, 0.20), (0.32, 0.655, 0.45, 0.74),
               (0.79, 0.72, 0.99, 0.83)],                        # "GYM COLLECTIVE" (neon e tapetes)
    'WA0080': [(0.575, 0.43, 0.64, 0.495)],                     # etiqueta pendurada (texto)
    'WA0082': [(0.545, 0.425, 0.59, 0.50)],                      # etiqueta pendurada (texto)
    'WA0095': [(0.215, 0.185, 0.45, 0.30)],                      # placa "ANGELA MODAS"
    'WA0118': [(0.64, 0.12, 0.98, 0.29), (0.16, 0.28, 0.31, 0.37)],  # neon "FIT & COLOR" + reflexo
}

def blur_regions(im, regions):
    w, h = im.size
    for x0, y0, x1, y1 in regions:
        box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        reg = im.crop(box)
        rw, rh = reg.size
        # pixeliza forte + desfoque gaussiano => texto ilegível
        small = reg.resize((max(1, rw // 40), max(1, rh // 40)), Image.BILINEAR)
        reg = small.resize((rw, rh), Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(rw, rh) / 12))
        im.paste(reg, box)
    return im

def save(im, path, size, q=80):
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)

def main():
    fotos = []
    with open(os.path.join(ROOT, 'data', 'produtos_info.csv'), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter=';'):
            fotos += r['Fotos'].split()
    os.makedirs(os.path.join(ROOT, 'img', 'p'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'img', 't'), exist_ok=True)
    for wa in fotos:
        src = os.path.join(SRC, f'IMG-20261006-{wa}.jpg')
        im = Image.open(src).convert('RGB')
        if wa in BLUR:
            im = blur_regions(im, BLUR[wa])
        save(im, os.path.join(ROOT, 'img', 'p', f'{wa}.webp'), 1000, 80)
        save(im, os.path.join(ROOT, 'img', 't', f'{wa}.webp'), 400, 76)
    print(len(fotos), 'fotos processadas')

if __name__ == '__main__':
    main()
