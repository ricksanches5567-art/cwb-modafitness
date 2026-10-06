#!/usr/bin/env python3
"""Gera as fotos do catálogo (carrossel) a partir das fotos ORIGINAIS.

Uso:  /workspace/tools/logo-venv/bin/python scripts/process_images.py [/caminho/fotos_originais]
      (precisa de numpy, Pillow e opencv-python-headless)

- As vistas de cada peça (recortes de frente/costas/cores, cortando legendas impressas)
  ficam em scripts/fotos_views.py. Saída: img/p/<CÓDIGO>-<n>.webp (até 1200 px, q85) e
  img/t/<CÓDIGO>-<n>.webp (até 760 px, q82, para os cards), mais data/fotos.json (tamanhos).
- Tratamento leve e realista, sem filtro de cor: redução suave de artefatos de JPEG
  (Non-Local Means, h=4), redução com INTER_AREA (sem moiré no tecido), máscara de nitidez
  suave depois de reduzir. Não muda forma, cor nem modelo da peça.
- BLUR: desfoca placas/letreiros com nome de outras lojas (frações x0, y0, x1, y1 da foto).
"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from fotos_views import VIEWS  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/catalogo/unicas'
GRANDE, PEQUENA = 1200, 760

BLUR = {
    'WA0034': [(0.545, 0.10, 0.705, 0.35)],                      # "STRENGTH ATHLETICISM FITNESS"
    'WA0037': [(0.0, 0.705, 0.335, 0.726), (0.0, 0.705, 0.031, 0.772),
               (0.275, 0.705, 0.335, 0.760)],                      # texto parcialmente coberto
    'WA0053': [(0.855, 0.0, 1.0, 0.20), (0.32, 0.655, 0.45, 0.74),
               (0.79, 0.72, 0.99, 0.83)],                        # "GYM COLLECTIVE" (neon e tapetes)
    'WA0080': [(0.575, 0.43, 0.64, 0.495)],                     # etiqueta pendurada (texto)
    'WA0082': [(0.545, 0.425, 0.59, 0.50)],                      # etiqueta pendurada (texto)
    'WA0095': [(0.215, 0.185, 0.45, 0.30)],                      # placa "ANGELA MODAS"
    'WA0105': [(0.0, 0.17, 0.215, 0.40)],                        # letreiro "ACTIVE COLLECTION"
    'WA0118': [(0.64, 0.12, 0.98, 0.29), (0.16, 0.28, 0.31, 0.37)],  # neon "FIT & COLOR" + reflexo
}

def blur_regions(im, regions):
    w, h = im.size
    for x0, y0, x1, y1 in regions:
        box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        reg = im.crop(box)
        rw, rh = reg.size
        small = reg.resize((max(1, rw // 40), max(1, rh // 40)), Image.BILINEAR)
        reg = small.resize((rw, rh), Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(rw, rh) / 12))
        im.paste(reg, box)
    return im

def tratar(im):
    """Denoise leve dos artefatos de compressão (preserva a textura real do tecido)."""
    a = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    a = cv2.fastNlMeansDenoisingColored(a, None, 4, 4, 7, 21)
    return Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGR2RGB))

def reduzir(im, lado):
    w, h = im.size
    s = min(1.0, lado / max(w, h))
    if s < 1.0:
        a = cv2.resize(np.asarray(im), (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
        im = Image.fromarray(a)
    return im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=45, threshold=2))

def main():
    os.makedirs(os.path.join(ROOT, 'img', 'p'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'img', 't'), exist_ok=True)
    cache, info = {}, {}
    for codigo, vistas in VIEWS.items():
        for n, (wa, caixa, rotulo) in enumerate(vistas, 1):
            if wa not in cache:
                im = Image.open(os.path.join(SRC, f'IMG-20261006-{wa}.jpg')).convert('RGB')
                if wa in BLUR:
                    im = blur_regions(im, BLUR[wa])
                cache[wa] = im
            im = cache[wa]
            if caixa:
                W, H = im.size
                im = im.crop((round(caixa[0] * W), round(caixa[1] * H), round(caixa[2] * W), round(caixa[3] * H)))
            im = tratar(im)
            vid = f'{codigo}-{n}'
            g = reduzir(im, GRANDE)
            g.save(os.path.join(ROOT, 'img', 'p', vid + '.webp'), 'WEBP', quality=85, method=6)
            reduzir(im, PEQUENA).save(os.path.join(ROOT, 'img', 't', vid + '.webp'), 'WEBP', quality=82, method=6)
            info[vid] = {'w': g.width, 'h': g.height, 'rotulo': rotulo, 'origem': wa}
    with open(os.path.join(ROOT, 'data', 'fotos.json'), 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=1)
    print(len(info), 'vistas geradas para', len(VIEWS), 'peças')

if __name__ == '__main__':
    main()
