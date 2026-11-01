# Pulls from a FoodData Central CSV zip only what a calorie and macro tracker needs.
# Reads the zip as a stream, so nothing is unpacked; food_nutrient.csv alone is 1.8 GB.
# Usage: python -I scripts/usda-extract.py <FoodData_Central_csv.zip> <out dir>
# Writes: generic.json (foundation, SR Legacy, FNDDS) and branded.tsv (every branded record).
import csv
import io
import json
import os
import sys
import time
import zipfile

csv.field_size_limit(10 ** 7)
zip_path, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
zf = zipfile.ZipFile(zip_path)
root = zf.namelist()[0].split('/')[0]
t0 = time.time()


def rows(name):
    with zf.open(f'{root}/{name}.csv') as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8', newline=''))


def log(msg):
    print(f'{time.time() - t0:6.0f}s {msg}', flush=True)


# nutrient_nbr -> nutrient id. Several ids can hold the same quantity; the first with a value wins.
nbr_to_id = {}
for r in rows('nutrient'):
    nbr_to_id.setdefault(r['nutrient_nbr'].removesuffix('.0'), []).append(r['id'])

MICROS = ['320', '401', '328', '323', '430', '404', '405', '406', '415', '418', '417', '301', '304', '306', '307', '303', '309', '317', '305']
# Slot -> nutrient ids in order of preference.
MAIN = {
    'kcal': ['1008', '2047', '2048'],
    'p': ['1003'],
    'c': ['1005', '1050'],
    'f': ['1004', '1085'],
    'fiber': ['1079', '2033'],
    'sugar': ['2000', '1063'],
    'sat': ['1258'],
    'sodium': ['1093'],
}
SLOTS = list(MAIN)
order = {}  # nutrient id -> (slot index, rank)
for s, ids in enumerate(SLOTS):
    for rank, nid in enumerate(MAIN[ids]):
        order[nid] = (s, rank)
micro_order = {}
for i, nbr in enumerate(MICROS):
    for rank, nid in enumerate(nbr_to_id.get(nbr, [])):
        micro_order[nid] = (i, rank)

sr = {r['fdc_id']: r['NDB_number'] for r in rows('sr_legacy_food')}
log(f'sr_legacy_food {len(sr)}')
fndds = {r['fdc_id']: r for r in rows('survey_fndds_food')}
log(f'survey_fndds_food {len(fndds)}')
wweia = {r['wweia_food_category']: r['wweia_food_category_description'] for r in rows('wweia_food_category')}
cats = {r['id']: r['description'] for r in rows('food_category')}
units = {r['id']: r['name'] for r in rows('measure_unit')}

GENERIC = {'foundation_food', 'sr_legacy_food', 'survey_fndds_food'}
generic = {}
branded = {}
types = {}
for r in rows('food'):
    t = r['data_type']
    types[t] = types.get(t, 0) + 1
    if t in GENERIC:
        cat = r['food_category_id']
        if t == 'survey_fndds_food':
            cat = wweia.get(fndds.get(r['fdc_id'], {}).get('wweia_category_code', ''), '')
        else:
            cat = cats.get(cat, cat)
        generic[r['fdc_id']] = {'fdc': r['fdc_id'], 'ndb': sr.get(r['fdc_id']), 'type': t, 'desc': r['description'], 'cat': cat, 'date': r['publication_date']}
    elif t == 'branded_food':
        branded[r['fdc_id']] = r['description']
log(f'food {types}')

slots = {}  # fdc -> list of [value, rank]
micros = {}
wanted = set(order) | set(micro_order)
seen = 0
for r in rows('food_nutrient'):
    seen += 1
    if seen % 5_000_000 == 0:
        log(f'food_nutrient {seen:,}')
    nid = r['nutrient_id']
    if nid not in wanted:
        continue
    fdc = r['fdc_id']
    is_generic = fdc in generic
    if not is_generic and fdc not in branded:
        continue
    try:
        v = float(r['amount'])
    except ValueError:
        continue
    if nid in order:
        s, rank = order[nid]
        cur = slots.setdefault(fdc, [None] * len(SLOTS))
        if cur[s] is None or rank < cur[s][1]:
            cur[s] = (v, rank)
    if is_generic and nid in micro_order:
        i, rank = micro_order[nid]
        cur = micros.setdefault(fdc, [None] * len(MICROS))
        if cur[i] is None or rank < cur[i][1]:
            cur[i] = (v, rank)
log(f'food_nutrient done {seen:,} rows, {len(slots):,} foods with values')


def values(fdc):
    cur = slots.get(fdc) or [None] * len(SLOTS)
    return [c[0] if c else None for c in cur]


portions = {}
for r in rows('food_portion'):
    if r['fdc_id'] not in generic:
        continue
    try:
        grams = float(r['gram_weight'])
    except ValueError:
        continue
    if grams <= 0:
        continue
    portions.setdefault(r['fdc_id'], []).append({
        'seq': int(r['seq_num'] or 999), 'amount': float(r['amount'] or 0), 'unit': units.get(r['measure_unit_id'], ''),
        'desc': r['portion_description'], 'mod': r['modifier'], 'g': grams,
    })
log(f'food_portion {len(portions):,} foods')

result = []
for fdc, g in generic.items():
    g['v'] = values(fdc)
    g['micro'] = [m[0] if m else None for m in micros.get(fdc, [None] * len(MICROS))]
    g['portions'] = sorted(portions.get(fdc, []), key=lambda p: p['seq'])
    result.append(g)
with open(os.path.join(out, 'generic.json'), 'w', encoding='utf-8') as fh:
    json.dump(result, fh, ensure_ascii=False)
log(f'generic.json {len(result):,}')

COLS = ['brand_owner', 'brand_name', 'subbrand_name', 'gtin_upc', 'serving_size', 'serving_size_unit', 'household_serving_fulltext',
        'branded_food_category', 'market_country', 'discontinued_date', 'modified_date', 'available_date', 'preparation_state_code', 'short_description']
clean = lambda s: s.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ').strip()
n = 0
with open(os.path.join(out, 'branded.tsv'), 'w', encoding='utf-8', newline='') as fh:
    fh.write('\t'.join(['fdc', 'desc', *COLS, *SLOTS]) + '\n')
    for r in rows('branded_food'):
        fdc = r['fdc_id']
        if fdc not in branded:
            continue
        v = values(fdc)
        fh.write('\t'.join([fdc, clean(branded[fdc]), *[clean(r[c]) for c in COLS], *['' if x is None else repr(x) for x in v]]) + '\n')
        n += 1
log(f'branded.tsv {n:,}')
