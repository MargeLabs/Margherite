import os, sys
from PIL import Image, ImageChops
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'e2e-shots', 'fid')
names = sorted({f.rsplit('_', 1)[0] for f in os.listdir(os.path.join(root, 'mock'))})
flt = sys.argv[1] if len(sys.argv) > 1 else ''
bad = 0
for n in names:
    if flt and flt not in n: continue
    i = 0; diffs = []; missing = False
    while True:
        a = os.path.join(root, 'mock', f'{n}_{i}.png'); b = os.path.join(root, 'app', f'{n}_{i}.png')
        if not os.path.exists(a) and not os.path.exists(b): break
        if not (os.path.exists(a) and os.path.exists(b)): missing = True; break
        x = Image.open(a).convert('RGB'); y = Image.open(b).convert('RGB')
        d = ImageChops.difference(x, y); bb = d.getbbox()
        if bb is not None:
            strong = sum(1 for p in d.getdata() if max(p) > 24)
            diffs.append((i, bb, strong))
        i += 1
    # bruit de rendu : quelques dizaines de pixels de texte lissés différemment (le DOM, lui, est comparé à part)
    noise = all(d[2] < 1500 for d in diffs)
    ok = noise and not missing
    if not ok: bad += 1
    tag = 'IDENTIQUE ' if ok and not diffs else ('PROCHE     ' if ok else 'ÉCART      ')
    print(tag + n + ('' if not diffs else ('  px>24 par tranche : ' + str([(d[0], d[2]) for d in diffs]))) + ('  TRANCHES MANQUANTES' if missing else ''))
print('écarts :', bad, '/', len([n for n in names if not flt or flt in n]))

