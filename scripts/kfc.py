# KFC România's own nutrition document ("Nutritionale si alergeni KFC.pdf", kfc.ro/documente, Editia 1, Revizia 22,
# 16.11.2023) turned into public/menus/kfc.json, the same row shape as public/splendid.json (src/logic/foods.ts MenuRow).
# Usage: pdftotext -layout kfc.pdf kfc.txt && python -I -X utf8 scripts/kfc.py kfc.txt public/menus/kfc.json
# Rows: per 100 g, as declared. A product's portion comes from its header line ("Meltz Picant 190g (14E) ...") or its
# piece line ("3 buc. 90g / 5 buc. 150g"); allergens from the "Alergeni:" line of the same block.
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
lines = [l.replace('�', '').replace('®', '').rstrip() for l in open(src, encoding='utf-8', errors='replace')]

NUM = r'(<\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|-)'
ROW = re.compile(r'^(\S.*?)\s{2,}' + r'\s+'.join([NUM] * 9) + r'\s*$')


def val(x):
    x = x.replace(',', '.').strip()
    if x == '-':
        return 0.0
    if x.startswith('<'):
        return 0.0  # "< 0.1": below what the label states
    return float(x)


def tidy(name):
    return re.sub(r'\s+', ' ', name).strip(' *')


# boxes, buckets and menus with a drink, and table lines broken across two rows, are not single products
def COMBO_OK(name):
    low = name.lower()
    if not name[0].isupper() or re.match(r'^(sau|cu|\d)', low):
        return False
    return not re.search(r'coca-cola|sprite|fanta|pepsi|box|ceva |smart meniu|bucket|portii|portie|nepicant cu|picant cu|cafea|preparat|royale', low)


rows, seen = [], set()
for i, line in enumerate(lines):
    m = ROW.match(line)
    if not m:
        continue
    name = tidy(m.group(1)).replace('Melz ', 'Meltz ')
    kj, kcal, fat, sat, carb, sugar, fiber, prot, salt = (val(m.group(k)) for k in range(2, 11))
    # whole menus (with the drink) are left out: their parts are listed one by one
    if not (0 < kcal <= 950) or name.lower().startswith(('denumire', 'meniu')) or name in seen or not COMBO_OK(name):
        continue
    # sanity: the label's kcal against 4/4/9 (fiber 2), a wrong column order would fail this
    atw = 4 * prot + 4 * carb + 9 * fat + 2 * fiber
    if atw and not (0.6 * atw - 25 <= kcal <= 1.35 * atw + 25):
        print('skip (kcal vs macro):', name, kcal, atw)
        continue
    seen.add(name)
    # the block above the table: its header with the weight, its pieces, its allergens
    block = lines[max(0, i - 40):i]
    start = max((k for k, l in enumerate(block) if l.startswith('Denumire produs')), default=-1)
    # the block begins after the previous product's table
    prev = [k for k, l in enumerate(block) if ROW.match(l)]
    if prev:
        block = block[prev[-1] + 1:]
    g, pcs, unit = None, None, 'g'
    key = name.split(' ')[0]
    for l in block:
        h = re.match(r'^' + re.escape(name.split(' ')[0]) + r'.*?\b(\d{2,4})\s?(g|ml)\b', l)
        if h:
            g, unit = int(h.group(1)), h.group(2)
            break
    for l in block:
        p = re.match(r'^\s*(\d+)\s*buc\.[^/]*?(\d{2,4})\s*g', l)
        if p:
            pcs, g = int(p.group(1)), int(p.group(2))
            break
    alg = next((l.split(':', 1)[1].strip().rstrip('.') for l in block if l.startswith('Alergeni')), '')
    rows.append({'n': name, 'k': round(kcal), 'p': prot, 'c': carb, 'f': fat, 's': sat, 'z': sugar, 'sare': salt, 'g': g, 'u': unit, 'b': pcs, 'a': alg, 'fb': fiber})

json.dump(rows, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(rows), 'products')
for r in rows:
    print(r['n'], r['k'], r['p'], r['c'], r['f'], r['g'], r['b'])
