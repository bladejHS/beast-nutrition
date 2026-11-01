# Turns branded.tsv from usda-extract.py into static shards the app reads on demand.
# Usage: python -I scripts/usda-branded.py <dir with branded.tsv> <output dir, e.g. public/branded/2026-10-29>
#   p/<n>.json   chunks of CHUNK products, sorted by brand so one search touches few chunks
#   w/<ab>.json  word -> product numbers (delta, base 36), keyed by the word's first two characters
#   b/<nnn>.json barcode without leading zeros -> product number, keyed by its last three digits
import collections
import csv
import json
import os
import re
import shutil
import sys
import unicodedata

CHUNK = 256
STOP = {'and', 'the', 'with', 'of', 'in', 'for', 'or', 'an'}
ALCOHOL = re.compile(r'beer|wine|liquor|spirit|cocktail|alcohol', re.I)
NOT_BRAND = {'not a branded item', 'n/a', 'none', ''}
csv.field_size_limit(10 ** 7)
sys.stdout.reconfigure(encoding='utf-8')
src, out = sys.argv[1], sys.argv[2]


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if not unicodedata.combining(c)).strip()


def words(s):
    return {w for w in re.split(r'[^a-z0-9]+', fold(s)) if len(w) >= 2 and w not in STOP}


def tidy(s):
    """USDA stores most names in capitals, which is hard to read in a list."""
    s = re.sub(r'\s+', ' ', s).strip(' ,')
    if s.upper() != s:
        return s
    return re.sub(r"[^\W\d_]+('[^\W\d_]+)?", lambda m: m.group(0).capitalize(), s.lower())


def num(v):
    return float(v) if v else None


def compact(v, d=1):
    r = round(v, d)
    return int(r) if r == int(r) else r


def valid(x, why):
    """The label values must be able to describe a real food."""
    if x['discontinued_date']:
        why['retras din vânzare'] += 1
        return False
    v = [num(x[k]) for k in ('kcal', 'p', 'c', 'f')]
    if None in v:
        why['fără macronutrienți'] += 1
        return False
    kcal, p, c, f = v
    if min(v) < 0 or p + c + f > 105 or kcal > 950:
        why['valori imposibile'] += 1
        return False
    atwater = 4 * p + 4 * c + 9 * f
    # Sugar alcohols and fiber bring calories well under 4/4/9; alcohol brings them above.
    if kcal < atwater * 0.5 - 20 or (kcal > atwater * 1.3 + 40 and not ALCOHOL.search(x['branded_food_category'])):
        why['calorii nepotrivite cu macro'] += 1
        return False
    return True


def serving(x):
    """[grams or ml, 1 if ml, label]; pack sizes in MG, IU or MC are mostly data errors, so they get no portion."""
    unit = {'g': 'g', 'grm': 'g', 'gm': 'g', 'ml': 'ml', 'mlt': 'ml'}.get(x['serving_size_unit'].lower())
    size = num(x['serving_size'])
    if not unit or not size or not 1 <= size <= 2000:
        return [0, 0, '']
    label = re.sub(r'\s+', ' ', x['household_serving_fulltext'].lower()).strip()
    label = re.sub(r'(onz|oza|ounces?)', 'oz', label)
    # A weight in the label would only repeat the size printed next to it.
    if not re.match(r'^[\d/.]+ ?[a-z]', label) or len(label) > 18 or re.search(r'\(|\d ?(g|grm|gm|ml|mlt)', label):
        label = ''
    return [compact(size), 1 if unit == 'ml' else 0, label]


why = collections.Counter()
best = {}
with open(os.path.join(src, 'branded.tsv'), encoding='utf-8', newline='') as fh:
    for x in csv.DictReader(fh, delimiter='\t', quoting=csv.QUOTE_NONE):
        code = x['gtin_upc'].lstrip('0')
        if not re.fullmatch(r'\d{6,14}', code):
            why['cod de bare invalid'] += 1
            continue
        # The newest usable record of a barcode wins; USDA keeps every older version of a product.
        if not valid(x, why):
            continue
        key = (x['available_date'], int(x['fdc']))
        cur = best.get(code)
        if cur is None or key > cur[0]:
            best[code] = (key, x)
        why['înregistrare veche'] += cur is not None

products = {}
for code, (_, x) in best.items():
    brand = x['brand_name'] or x['brand_owner']
    if brand.lower() in NOT_BRAND:
        brand = ''
    name, brand = tidy(x['desc'])[:90], tidy(brand)[:40]
    if not name:
        why['fără nume'] += 1
        continue
    vals = tuple(num(x[k]) for k in ('kcal', 'p', 'c', 'f', 'fiber', 'sugar', 'sat', 'sodium'))
    # The same product in another pack size has its own barcode but the same line in a list.
    key = (fold(name), fold(brand), vals)
    if key in products:
        products[key]['codes'].append(code)
        why['același produs, alt ambalaj'] += 1
    else:
        products[key] = {'fdc': int(x['fdc']), 'name': name, 'brand': brand, 'vals': vals, 'serving': serving(x), 'codes': [code]}

items = sorted(products.values(), key=lambda p: (fold(p['brand']), fold(p['name'])))
print(f'{len(items):,} produse', dict(why), flush=True)

shutil.rmtree(out, ignore_errors=True)
for d in 'pwb':
    os.makedirs(os.path.join(out, d))


def save(path, data):
    with open(os.path.join(out, path), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))


index = collections.defaultdict(list)
barcodes = collections.defaultdict(dict)
chunk = []
for n, p in enumerate(items):
    k, pr, c, f, fiber, sugar, sat, sodium = p['vals']
    shown = p['name'] if not p['brand'] or fold(p['brand']) in fold(p['name']) else f"{p['name']} · {p['brand']}"
    opt = lambda v, d=1: None if v is None else compact(v, d)
    chunk.append([p['fdc'], shown, compact(k, 0), compact(pr), compact(c), compact(f), opt(fiber), opt(sugar), opt(sat), opt(sodium, 0), *p['serving']])
    if len(chunk) == CHUNK or n == len(items) - 1:
        save(f'p/{n // CHUNK}.json', chunk)
        chunk = []
    for w in words(shown):
        index[w].append(n)
    for code in p['codes']:
        barcodes[code[-3:]][code] = n


def b36(n):
    s = ''
    while True:
        n, r = divmod(n, 36)
        s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n:
            return s


shards = collections.defaultdict(dict)
for w, ids in index.items():
    prev, parts = 0, []
    for i in ids:
        parts.append(b36(i - prev))
        prev = i
    shards[w[:2]][w] = ','.join(parts)
for key, shard in shards.items():
    save(f'w/{key}.json', shard)
for key, shard in barcodes.items():
    save(f'b/{key}.json', shard)
save('meta.json', {'products': len(items), 'chunk': CHUNK})
print(f'{len(index):,} cuvinte, {len(shards)} fișiere de cuvinte, {len(barcodes)} fișiere de coduri, {sum(len(p["codes"]) for p in items):,} coduri')
