#!/usr/bin/env python3
"""Cinematic slideshow film from real product photos.
Each shot: (photo id, box_start, box_end) boxes in fractions (cx, cy, h) where h = crop height fraction
of source height; width derived from output aspect. Linear camera move, smoothstep cross-dissolves,
circular timeline so the loop is seamless. Pipes raw frames to ffmpeg with a grade."""
import sys, json, subprocess, math
from PIL import Image, ImageFilter
SRC = '/workspace/catalogo/unicas/IMG-20261006-WA{}.jpg'
# brand-sign regions: same as scripts/process_images.py (never show other stores' names)
BLUR = {
    '0034': [(0.545, 0.10, 0.705, 0.35)], '0037': [(0.0, 0.705, 0.335, 0.726)],
    '0053': [(0.855, 0.0, 1.0, 0.20), (0.32, 0.655, 0.45, 0.74), (0.79, 0.72, 0.99, 0.83)],
    '0080': [(0.575, 0.43, 0.64, 0.495)], '0082': [(0.545, 0.425, 0.59, 0.50)],
    '0095': [(0.215, 0.185, 0.45, 0.30)], '0118': [(0.64, 0.12, 0.98, 0.29), (0.16, 0.28, 0.31, 0.37)],
}
_cache = {}
def load(k):
    if k not in _cache:
        im = Image.open(SRC.format(k)).convert('RGB')
        assert k not in BLUR, 'photo with brand sign: do not use in films'
        _cache[k] = im
    return _cache[k]

def crop_at(im, box, W, H):
    cx, cy, hf = box
    sw, sh = im.size
    ch = hf * sh; cw = ch * W / H
    if cw > sw: cw = sw; ch = cw * H / W
    x0 = min(max(cx * sw - cw / 2, 0), sw - cw); y0 = min(max(cy * sh - ch / 2, 0), sh - ch)
    s = cw / W
    return im.transform((W, H), Image.AFFINE, (s, 0, x0, 0, s, y0), resample=Image.BICUBIC)

def smooth(x): x = min(max(x, 0), 1); return x * x * (3 - 2 * x)

def render(cfg, out, preview=None):
    W, H, fps = cfg['w'], cfg['h'], cfg.get('fps', 24)
    d, ov = cfg['shot'], cfg['xfade']
    shots = cfg['shots']; n = len(shots)
    step = d - ov; T = n * step
    loop = cfg.get('loop', True)
    if not loop: T = n * step + ov
    N = int(round(T * fps))
    if preview:
        frames = []
        for k, a, b in shots:
            im = load(k); frames += [crop_at(im, a, W, H), crop_at(im, b, W, H)]
        tw = 180; th = int(tw * H / W)
        sheet = Image.new('RGB', (tw * len(frames), th), 'white')
        for i, f in enumerate(frames): sheet.paste(f.resize((tw, th)), (i * tw, 0))
        sheet.save(preview); return
    grade = cfg.get('grade', 'eq=contrast=1.05:saturation=0.9:gamma=0.98,colorbalance=rs=0.035:gs=-0.015:bs=0.03:rh=0.02:bh=-0.01,vignette=PI/5')
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
           '-vf', grade + ',format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(cfg.get('crf', 26)),
           '-profile:v', 'high', '-movflags', '+faststart', '-an', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(N):
        t = f / fps
        acc = None; wsum = 0
        for i, (k, a, b) in enumerate(shots):
            u = t - i * step
            if loop: u %= T
            if u < 0 or u >= d: continue
            w = 1.0
            if u < ov and (loop or i > 0): w = smooth(u / ov)
            if u > d - ov and (loop or i < n - 1): w = min(w, 1 - smooth((u - (d - ov)) / ov))
            q = u / d
            box = tuple(a[j] + (b[j] - a[j]) * q for j in range(3))
            img = crop_at(load(k), box, W, H)
            if acc is None: acc, wsum = img, w
            else:
                acc = Image.blend(acc, img, w / (wsum + w)); wsum += w
        p.stdin.write(acc.tobytes())
    p.stdin.close(); p.wait()
    print(out, N, 'frames')

if __name__ == '__main__':
    cfg = json.load(open(sys.argv[1]))
    if len(sys.argv) > 3 and sys.argv[2] == '--preview': render(cfg, None, sys.argv[3])
    else: render(cfg, sys.argv[2])
