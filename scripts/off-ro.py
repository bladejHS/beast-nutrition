# Open Food Facts, the products sold in Romania, as static shards the app reads on demand (same layout as the USDA
# pack from usda-branded.py, so src/logic/foods.ts reads both with one code path).
# Usage: python -I -X utf8 scripts/off-ro.py <en.openfoodfacts.org.products.csv.gz> <output dir, e.g. public/branded/off-ro-2026-11-11>
#   p/<n>.json   chunks of CHUNK products, sorted by brand
#   w/<ab>.json  word -> product numbers (delta, base 36), keyed by the word's first two characters
#   b/<nnn>.json barcode without leading zeros -> product number, keyed by its last three digits
# Row: [code, name, kcal, p, c, f, fiber|null, sugar|null, sat|null, sodium mg|null, serving g/ml, 1 if ml, label, pack g/ml]
# Data: Open Food Facts, Open Database License (ODbL); the app names the source on every row and in the README.
import collections
import csv
import gzip
import json
import os
import re
import shutil
import sys
import time
import unicodedata

CHUNK = 256
STOP = {'and', 'the', 'with', 'of', 'in', 'for', 'or', 'an', 'si', 'cu', 'de', 'la', 'din'}
ALCOHOL = re.compile(r'bere|beer|vin\b|wine|lichior|liquor|vodka|whisk|rom\b|rum\b|spirit|cocktail|alcool|alcohol|tuica|palinca|coniac|brandy', re.I)
ML = re.compile(r'\d\s*(ml|cl|l|litr)\b', re.I)
csv.field_size_limit(10 ** 8)
sys.stdout.reconfigure(encoding='utf-8')
src, out = sys.argv[1], sys.argv[2]
# --partial: a truncated download, for a dry run of the script
PARTIAL = '--partial' in sys.argv[3:]


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if not unicodedata.combining(c)).strip()


def words(s):
    return {w for w in re.split(r'[^a-z0-9]+', fold(s)) if len(w) >= 2 and w not in STOP}


def tidy(s):
    s = re.sub(r'\s+', ' ', s).strip(' ,.-')
    if s.upper() != s or len(s) < 4:
        return s
    return re.sub(r"[^\W\d_]+('[^\W\d_]+)?", lambda m: m.group(0).capitalize(), s.lower())


def num(v):
    try:
        return float(v) if v not in ('', None) else None
    except ValueError:
        return None


def compact(v, d=1):
    r = round(v, d)
    return int(r) if r == int(r) else r


def kcal_of(x):
    k = num(x.get('energy-kcal_100g'))
    if k is None:
        kj = num(x.get('energy-kj_100g')) or num(x.get('energy_100g'))
        k = kj / 4.184 if kj is not None else None
    return k


def valid(vals, cat, why):
    kcal, p, c, f = vals
    if None in vals:
        why['fără macronutrienți'] += 1
        return False
    if min(vals) < 0 or p + c + f > 105 or kcal > 950:
        why['valori imposibile'] += 1
        return False
    atwater = 4 * p + 4 * c + 9 * f
    if kcal < atwater * 0.5 - 20 or (kcal > atwater * 1.3 + 40 and not ALCOHOL.search(cat)):
        why['calorii nepotrivite cu macro'] += 1
        return False
    return True


def amount(q, text):
    """A quantity in g or ml, from the number and the text printed next to it."""
    v = num(q)
    if not v or not 0.5 <= v <= 5000:
        return 0, 0
    return compact(v), 1 if ML.search(text or '') else 0


why = collections.Counter()
best = {}
t0 = time.time()
lines = 0
try:
  fh = gzip.open(src, 'rt', encoding='utf-8', errors='replace', newline='')
  with fh:
      header = next(csv.reader([fh.readline()], delimiter='\t', quoting=csv.QUOTE_NONE))
      col = {name: i for i, name in enumerate(header)}
      need = ['code', 'product_name', 'brands', 'quantity', 'product_quantity', 'serving_size', 'serving_quantity', 'countries_tags', 'categories_tags',
              'allergens', 'last_modified_t', 'energy-kcal_100g', 'energy-kj_100g', 'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g',
              'fiber_100g', 'sugars_100g', 'saturated-fat_100g', 'sodium_100g', 'salt_100g']
      missing = [n for n in need if n not in col]
      print('coloane lipsă (ignorate):', missing, flush=True)
      for line in fh:
          lines += 1
          if 'en:romania' not in line:
              continue
          row = next(csv.reader([line], delimiter='\t', quoting=csv.QUOTE_NONE))
          if len(row) != len(header):
              why['rând rupt'] += 1
              continue
          x = {n: row[col[n]] if n in col else '' for n in need}
          if 'en:romania' not in x['countries_tags'].split(','):
              continue
          code = x['code'].strip().lstrip('0')
          if not re.fullmatch(r'\d{6,14}', code):
              why['cod de bare invalid'] += 1
              continue
          kcal = kcal_of(x)
          vals = (kcal, num(x['proteins_100g']), num(x['carbohydrates_100g']), num(x['fat_100g']))
          if not valid(vals, x['categories_tags'] + ' ' + x['product_name'], why):
              continue
          name = tidy(x['product_name'])[:90]
          # a product entered with its barcode as its name is no use in a list
          if not name or re.fullmatch(r'[\d\s.,/-]*', name) or re.search(r'\d{8,}', name):
              why['fără nume'] += 1
              continue
          brand = tidy((x['brands'].split(',')[0] if x['brands'] else ''))[:40]
          sodium = num(x['sodium_100g'])
          if sodium is None and num(x['salt_100g']) is not None:
              sodium = num(x['salt_100g']) / 2.5
          serving, s_ml = amount(x['serving_quantity'], x['serving_size'])
          pack, p_ml = amount(x['product_quantity'], x['quantity'])
          ml = s_ml or p_ml
          ex = (num(x['fiber_100g']), num(x['sugars_100g']), num(x['saturated-fat_100g']), None if sodium is None else sodium * 1000)
          key = int(x['last_modified_t'] or 0)
          cur = best.get(code)
          if cur is None or key > cur[0]:
              best[code] = (key, {'code': code, 'name': name, 'brand': brand, 'vals': vals + ex, 'serving': [serving, ml, ''], 'pack': pack})
          if lines % 500000 == 0:
              print(f'{lines:,} rânduri, {len(best):,} produse, {time.time() - t0:.0f} s', flush=True)

except EOFError:
    if not PARTIAL:
        raise
    print('fișier trunchiat: continui cu ce s-a citit (--partial)', flush=True)

products = {}
for code, (_, p) in best.items():
    key = (fold(p['name']), fold(p['brand']), p['vals'])
    if key in products:
        products[key]['codes'].append(code)
        why['același produs, alt ambalaj'] += 1
    else:
        products[key] = {**p, 'codes': [code]}

items = sorted(products.values(), key=lambda p: (fold(p['brand']), fold(p['name'])))
print(f'{lines:,} rânduri citite, {len(items):,} produse', dict(why), flush=True)

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
    chunk.append([p['codes'][0], shown, compact(k, 0), compact(pr), compact(c), compact(f), opt(fiber), opt(sugar), opt(sat), opt(sodium, 0), *p['serving'], p['pack']])
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
save('meta.json', {'products': len(items), 'chunk': CHUNK, 'source': 'Open Food Facts, ODbL', 'country': 'ro'})
print(f'{len(index):,} cuvinte, {len(shards)} fișiere de cuvinte, {len(barcodes)} fișiere de coduri, {sum(len(p["codes"]) for p in items):,} coduri')
