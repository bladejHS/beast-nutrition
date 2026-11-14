/* Food database: USDA FoodData Central generic foods (shipped with the app), USDA branded products
   (static shards in public/branded, read on demand) and Open Food Facts. */
import { sameCode } from './scan.ts';

export interface Food {
  id: string;
  name: string;
  en?: string;
  cat: string;
  /** Per 100 g. */
  kcal: number; p: number; c: number; f: number; fiber: number; sugar: number; sat: number; sodium: number;
  portions: [string, number][];
  /** Per 100 g, in MICRO_KEYS order; null = no data, never zero. */
  micro?: (number | null)[];
  source: 'usda' | 'fdc' | 'off' | 'mine' | 'spd';
  /** The label does not state fiber, so its 0 is not a real zero. */
  noFiber?: boolean;
  /** Allergens printed by the producer. */
  allergens?: string;
  /** The barcode, on a product the user saved by hand: the next scan finds it. */
  code?: string;
  /** On the user's own foods: what the meal plan may swap it in for, whether it belongs in sweet meals, and the pack it
   *  is sold in (grams), for the shopping list. */
  role?: FoodRole;
  sweet?: boolean;
  pack?: number;
}

export type FoodRole = 'protein' | 'carb' | 'fat' | 'veg';

type Row = [number, string, number, number, number, number, number, number, number, number, number, [string, number][], (number | null)[]];
interface Raw { cats: string[]; ro: [number, string][]; foods: Row[] }

/** Romanian word to the USDA word it means, so Romanian search reaches all 7,793 foods. */
export const TERMS: Record<string, string> = {
  pui: 'chicken', curcan: 'turkey', vita: 'beef', vitel: 'veal', porc: 'pork', miel: 'lamb', rata: 'duck', peste: 'fish',
  somon: 'salmon', ton: 'tuna', cod: 'cod', pastrav: 'trout', creveti: 'shrimp', ou: 'egg', oua: 'egg', lapte: 'milk',
  iaurt: 'yogurt', branza: 'cheese', cascaval: 'cheese', unt: 'butter', smantana: 'cream', ovaz: 'oats', orez: 'rice',
  paste: 'pasta', paine: 'bread', cartof: 'potato', cartofi: 'potatoes', fasole: 'beans', naut: 'chickpeas', linte: 'lentils',
  mazare: 'peas', rosii: 'tomatoes', rosie: 'tomato', castravete: 'cucumber', castraveti: 'cucumber', ardei: 'peppers',
  ceapa: 'onions', usturoi: 'garlic', morcov: 'carrots', morcovi: 'carrots', varza: 'cabbage', spanac: 'spinach',
  salata: 'lettuce', ciuperci: 'mushrooms', dovlecel: 'zucchini', dovlecei: 'zucchini', dovleac: 'pumpkin', vinete: 'eggplant',
  conopida: 'cauliflower', porumb: 'corn', mar: 'apples', mere: 'apples', banana: 'bananas', banane: 'bananas',
  portocala: 'oranges', portocale: 'oranges', lamaie: 'lemon', capsuni: 'strawberries', afine: 'blueberries', zmeura: 'raspberries',
  struguri: 'grapes', pepene: 'melons', para: 'pears', pere: 'pears', piersica: 'peaches', piersici: 'peaches', prune: 'plums',
  cirese: 'cherries', ananas: 'pineapple', nuci: 'walnuts', migdale: 'almonds', alune: 'hazelnuts', arahide: 'peanuts',
  seminte: 'seeds', ulei: 'oil', masline: 'olives', miere: 'honey', zahar: 'sugar', ciocolata: 'chocolate', cafea: 'coffee',
  ceai: 'tea', suc: 'juice', bere: 'beer', vin: 'wine', apa: 'water', sunca: 'ham', carnat: 'sausage', carnati: 'sausage',
  fiert: 'boiled', fiarta: 'boiled', copt: 'baked', prajit: 'fried', gatit: 'cooked', crud: 'raw', piept: 'breast',
  grecesc: 'greek', proteine: 'protein', proteina: 'protein', proteic: 'protein', baton: 'bar', batoane: 'bar', cereale: 'cereal', mustar: 'mustard',
  pulpa: 'thigh', aripi: 'wing', ficat: 'liver', supa: 'soup', sos: 'sauce', faina: 'flour', biscuiti: 'cookies', tort: 'cake',
};

export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * What else a word can mean on a shelf (2026-11-14, the user: "scriu Quark și să-mi sugereze iaurtul high protein
 * de la Pilos"). Each entry is tried in place of the word when the word itself finds little; the results are shown
 * as "Asemănătoare", after the exact ones. Folded spellings, one phrase per alternative.
 */
export const NEAR: Record<string, string[]> = {
  quark: ['skyr', 'protein iaurt', 'high protein pudding', 'high protein milk', 'high protein drink', 'cottage', 'branza proaspata', 'branza de vaci'],
  skyr: ['quark', 'protein iaurt', 'high protein pudding', 'iaurt grecesc'],
  cottage: ['branza de vaci', 'quark', 'branza proaspata'],
  iaurt: ['yogurt', 'joghurt', 'skyr'],
  yogurt: ['iaurt', 'skyr'],
  proteic: ['high protein', 'protein'], proteica: ['high protein', 'protein'], proteina: ['high protein', 'protein'], proteine: ['high protein', 'protein'],
  protein: ['proteic', 'proteica'],
  whey: ['protein', 'proteina'],
  pui: ['chicken'], chicken: ['pui'], curcan: ['turkey'], ton: ['tuna'], tuna: ['ton'],
  ovaz: ['oats', 'fulgi ovaz'], oats: ['ovaz'], ou: ['egg', 'oua'], oua: ['egg', 'ou'],
  lapte: ['milk', 'drink'], cascaval: ['cheese', 'gouda'], sunca: ['ham', 'piept'],
};

/** Edit distance, for typos ("qwark", "pilso"); small words only, so a plain table is enough. */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** True when `word` is a typo of the start of `key`: one letter off from 4 letters, two from 8. */
export function near(word: string, key: string): boolean {
  const room = word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
  if (!room) return false;
  for (const len of [word.length - 1, word.length, word.length + 1]) if (len > 0 && lev(word, key.slice(0, len)) <= room) return true;
  return false;
}

let db: Food[] | null = null;

export function parseDb(raw: Raw): Food[] {
  const ro = new Map(raw.ro);
  const list = raw.foods.map((r): Food => ({
    id: `u${r[0]}`, name: ro.get(r[0]) ?? r[1], en: r[1], cat: raw.cats[r[2]] ?? '',
    kcal: r[3], p: r[4], c: r[5], f: r[6], fiber: r[7], sugar: r[8], sat: r[9], sodium: r[10], portions: r[11], micro: r[12], source: 'usda',
  }));
  return list;
}

export interface MenuRow { n: string; k: number; p: number; c: number; f: number; s: number; z: number; sare: number; g: number | null; u: string; b: number | null; a: string;
  /** Fiber, when the restaurant declares it (KFC does, Splendid Chicken does not). */
  fb?: number }

/** Restaurant menus shipped with the app (public/menus, from each chain's own nutrition document; see scripts/kfc.py). */
export const MENUS: Array<{ file: string; chain: string; prefix: string }> = [
  { file: 'splendid.json', chain: 'Splendid Chicken', prefix: 's' },
  { file: 'menus/kfc.json', chain: 'KFC', prefix: 'kfc:' },
];

/** A restaurant menu: values per 100 g or ml, as declared by the restaurant. Splendid Chicken's ids stay `s<row>` (older
 *  logs and plans point at them); the other chains' ids come from the product name, so a new edition keeps them. */
export function parseMenu(rows: MenuRow[], chain = 'Splendid Chicken', prefix = 's'): Food[] {
  return rows.map((r, i) => ({
    id: prefix === 's' ? `s${i}` : `${prefix}${fold(r.n).replace(/[^a-z0-9]+/g, '-')}`, name: prefix === 's' ? r.n : `${r.n} · ${chain}`, cat: chain, kcal: r.k, p: r.p, c: r.c, f: r.f,
    fiber: r.fb ?? 0, sugar: r.z, sat: r.s, ...(r.fb == null ? { noFiber: true } : {}),
    sodium: Math.round((r.sare / 2.5) * 1000), source: 'spd', allergens: r.a,
    portions: r.g ? [[r.b && r.b > 1 ? `${r.b} buc. (${r.g} ${r.u})` : `1 porție (${r.g} ${r.u})`, r.g], ...(r.b && r.b > 1 ? [[`1 buc. (${Math.round(r.g / r.b)} ${r.u})`, Math.round(r.g / r.b)] as [string, number]] : [])] : [],
  }));
}

export async function loadFoods(): Promise<Food[]> {
  if (db) return db;
  const res = await fetch(`${import.meta.env.BASE_URL}foods.json`);
  if (!res.ok) throw new Error('Baza de alimente nu s-a încărcat.');
  db = parseDb(await res.json() as Raw);
  const menus = await Promise.all(MENUS.map(async (m) => {
    const r = await fetch(`${import.meta.env.BASE_URL}${m.file}`).catch(() => null);
    return r?.ok ? parseMenu(await r.json() as MenuRow[], m.chain, m.prefix) : [];
  }));
  db = [...menus.flat(), ...db];
  return db;
}

export const isRomanian = (f: Food) => f.name !== f.en;

/** Romanian names first, then matches in the USDA text; every word must match. A typo is forgiven only when nothing
 *  matches as typed: otherwise "quark" fills the list with Quarter Pounders and Quaker oats. */
export function search(list: Food[], query: string, limit = 40): Food[] {
  const exact = rank(list, query, limit, false);
  return exact.length ? exact : rank(list, query, limit, true);
}
/** Only what matches as typed. */
export const searchExact = (list: Food[], query: string, limit = 40): Food[] => rank(list, query, limit, false);

function rank(list: Food[], query: string, limit: number, fuzzy: boolean): Food[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: [number, Food][] = [];
  for (const f of list) {
    const ro = fold(f.name), en = fold(f.en ?? '');
    let score = 0;
    for (const w of words) {
      const alt = TERMS[w];
      if (ro.includes(w)) score += ro.startsWith(w) ? 6 : 4;
      else if (en.includes(w) || (alt && en.includes(alt))) score += alt && en.startsWith(alt) ? 2 : 1;
      // a typo still finds the food, when the exact words found nothing
      else if (fuzzy && `${ro} ${en}`.split(/[^a-z0-9]+/).some((t) => t.length >= 3 && near(w, t))) score += 0.5;
      else { score = -1; break; }
    }
    if (score < 0) continue;
    if (isRomanian(f)) score += 20;
    scored.push([score - (en.length || ro.length) / 200, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}

// ---- Branded products in static files: USDA (scripts/usda-branded.py) and the products sold in Romania from
// Open Food Facts (scripts/off-ro.py, ODbL). Same layout, read by the same code. ----
const BRANDED = 'branded/2026-10-29';
const OFF_RO = 'branded/off-ro-2026-11-11';
const CHUNK = 256;
/** How many product files one search may open; the brand sort keeps a brand inside few of them. */
const MAX_CHUNKS = 10;
const STOP = new Set(['and', 'the', 'with', 'of', 'in', 'for', 'or', 'an']);

/** A USDA row starts with its FDC number; an Open Food Facts row with its barcode, and ends with the pack size. */
export type BrandRow = [number | string, string, number, number, number, number, number | null, number | null, number | null, number | null, number, number, string, number?];
/** Reads one shard; null when it does not exist, which only means no word or code lands there. */
export type Loader = (path: string) => Promise<unknown>;

const fromPack = (folder: string): Loader => async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${folder}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Produsele de marcă nu s-au încărcat.');
  return res.json();
};
const fromSite = fromPack(BRANDED);
const fromOffRo = fromPack(OFF_RO);

const tokens = (q: string) => fold(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));

/** Product numbers are stored as base-36 gaps, which keeps the word files small. */
export function decodeIds(s: string): number[] {
  let n = 0;
  return s.split(',').map((d) => (n += parseInt(d, 36)));
}

export function brandRowToFood(r: BrandRow): Food {
  const [id, name, kcal, p, c, f, fiber, sugar, sat, sodium, size, ml, label, pack] = r;
  const unit = ml ? 'ml' : 'g';
  const off = typeof id === 'string';
  const portions: [string, number][] = size ? [[`${label || '1 porție'} (${size} ${unit})`, size]] : [];
  if (pack && pack !== size) portions.push([`tot pachetul (${pack} ${unit})`, pack]);
  return {
    id: off ? `o${id}` : `b${id}`, name, en: name, cat: off ? 'Produs de marcă · Open Food Facts România' : 'Produs de marcă · USDA',
    kcal, p, c, f, fiber: fiber ?? 0, sugar: sugar ?? 0, sat: sat ?? 0, sodium: sodium ?? 0,
    portions, source: off ? 'off' : 'fdc', ...(fiber == null ? { noFiber: true } : {}), ...(off ? { code: id } : {}),
  };
}

/** Every product with a word starting with `word`, or with its English meaning; with `fuzzy`, also a word one typo away. */
async function matches(word: string, load: Loader, fuzzy = false): Promise<Set<number>> {
  const out = new Set<number>();
  for (const w of new Set([word, TERMS[word] ?? word])) {
    // the word files are split by the first two letters; a typo in the second one ("qwark") looks in the files of
    // the same first letter with a vowel or one of the word's own letters second: a handful of small local files
    const heads = fuzzy && w.length >= 4 ? [...new Set([w.slice(0, 2), ...[...`aeiouy${w}`].map((c) => w[0] + c)])] : [w.slice(0, 2)];
    for (const h of heads) {
      const shard = await load(`w/${h}.json`) as Record<string, string> | null;
      for (const [key, ids] of Object.entries(shard ?? {})) if (key.startsWith(w) || (fuzzy && near(w, key))) decodeIds(ids).forEach((i) => out.add(i));
    }
  }
  return out;
}

export const searchUsdaBrands = (query: string, load: Loader = fromSite, limit = 40) => searchPack(query, load, limit);
/** The products sold in Romania, from the app's own files. */
export const searchOffRo = (query: string, load: Loader = fromOffRo, limit = 40) => searchPack(query, load, limit);

/**
 * Exact first. When that finds little, the near meanings of each word (NEAR) and, for a phrase that found nothing,
 * the phrase without one of its words; those come back apart, in `near`, so the screen can label them.
 */
async function searchPack(query: string, load: Loader, limit: number): Promise<{ foods: Food[]; total: number; near: Food[] }> {
  const words = tokens(query);
  if (!words.length) return { foods: [], total: 0, near: [] };
  const exact = await andSearch(words, load, limit);
  if (exact.total >= 8) return { ...exact, near: [] };
  const alts: string[][] = [];
  words.forEach((w, i) => (NEAR[w] ?? []).forEach((p) => alts.push([...words.slice(0, i), ...tokens(p), ...words.slice(i + 1)])));
  if (!exact.total && !alts.length && words.length > 1) words.forEach((_, i) => alts.push(words.filter((__, j) => j !== i)));
  const seen = new Set(exact.foods.map((f) => f.id));
  const close: Food[] = [];
  for (const alt of alts.slice(0, 8)) {
    if (close.length >= limit) break;
    for (const f of (await andSearch(alt, load, limit)).foods) if (!seen.has(f.id)) { seen.add(f.id); close.push(f); }
  }
  return { ...exact, near: close.slice(0, limit) };
}

async function andSearch(words: string[], load: Loader, limit: number): Promise<{ foods: Food[]; total: number }> {
  // a word that matches nothing as typed gets one typo of slack
  const sets = (await Promise.all(words.map(async (w) => { const s = await matches(w, load); return s.size ? s : matches(w, load, true); }))).sort((a, b) => a.size - b.size);
  const hits = [...sets[0]!].filter((i) => sets.every((s) => s.has(i)));
  const perChunk = new Map<number, number[]>();
  for (const i of hits) {
    const c = Math.floor(i / CHUNK);
    const list = perChunk.get(c);
    if (list) list.push(i % CHUNK); else perChunk.set(c, [i % CHUNK]);
  }
  const top = [...perChunk].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_CHUNKS);
  const rows = await Promise.all(top.map(async ([c, at]) => {
    const chunk = await load(`p/${c}.json`) as BrandRow[] | null;
    return at.map((i) => chunk?.[i]).filter((r): r is BrandRow => !!r);
  }));
  return { foods: search(rows.flat().map(brandRowToFood), words.join(' '), limit), total: hits.length };
}

export const usdaBarcode = (code: string, load: Loader = fromSite) => packBarcode(code, load);
export const offRoBarcode = (code: string, load: Loader = fromOffRo) => packBarcode(code, load);

async function packBarcode(code: string, load: Loader): Promise<Food | null> {
  const key = code.replace(/^0+/, '');
  const shard = await load(`b/${key.slice(-3)}.json`) as Record<string, number> | null;
  const n = shard?.[key];
  if (n == null) return null;
  const chunk = await load(`p/${Math.floor(n / CHUNK)}.json`) as BrandRow[] | null;
  const row = chunk?.[n % CHUNK];
  return row ? brandRowToFood(row) : null;
}

export const offToFood = (p: Record<string, unknown>): Food | null => {
  const n = (p['nutriments'] ?? {}) as Record<string, number>;
  const kcal = Number(n['energy-kcal_100g'] ?? (n['energy-kj_100g'] != null ? n['energy-kj_100g'] / 4.184 : NaN));
  const title = String(p['product_name_ro'] || p['product_name'] || p['product_name_en'] || '').trim();
  if (!title || !Number.isFinite(kcal)) return null;
  const v = (k: string) => Math.round((Number(n[k]) || 0) * 10) / 10;
  const brands = p['brands'];
  const brand = (Array.isArray(brands) ? String(brands[0] ?? '') : String(brands ?? '')).split(',')[0]?.trim();
  return {
    id: `o${String(p['code'])}`, name: `${title}${brand ? ` · ${brand}` : ''}`, cat: 'Produs de marcă · Open Food Facts',
    kcal: Math.round(kcal), p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g'), fiber: v('fiber_100g'),
    sugar: v('sugars_100g'), sat: v('saturated-fat_100g'), sodium: Math.round((Number(n['sodium_100g']) || 0) * 1000),
    portions: offPortions(p), source: 'off', ...(n['fiber_100g'] == null ? { noFiber: true } : {}),
  };
};

/** The serving and the whole pack, when the producer gave them in grams or millilitres. */
function offPortions(p: Record<string, unknown>): [string, number][] {
  const out: [string, number][] = [];
  const unit = (k: string) => (/^(ml|cl|l)$/i.test(String(p[k] ?? '')) ? 'ml' : 'g');
  const serving = Math.round(Number(p['serving_quantity']) * 10) / 10;
  if (serving > 0 && serving < 2000) out.push([`1 porție (${serving} ${unit('serving_quantity_unit')})`, serving]);
  const pack = Math.round(Number(p['product_quantity']));
  if (pack > 0 && pack < 5000 && pack !== serving) out.push([`tot pachetul (${pack} ${unit('product_quantity_unit')})`, pack]);
  return out;
}

const FIELDS = 'code,product_name,product_name_ro,product_name_en,brands,nutriments,serving_quantity,serving_quantity_unit,product_quantity,product_quantity_unit';

export async function searchBranded(query: string): Promise<Food[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open Food Facts nu răspunde.');
  const json = await res.json() as { products?: Record<string, unknown>[] };
  return (json.products ?? []).map(offToFood).filter((f): f is Food => !!f);
}

/** The user's own products first, then the Romanian shelf (offline), then USDA, then Open Food Facts online. */
export async function byBarcode(code: string, mine: Food[] = []): Promise<Food | null> {
  const own = mine.find((f) => f.code && sameCode(f.code, code));
  if (own) return own;
  const ro = await offRoBarcode(code).catch(() => null);
  if (ro) return ro;
  const usda = await usdaBarcode(code).catch(() => null);
  if (usda) return usda;
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const json = await res.json() as { status?: number; product?: Record<string, unknown> };
  return json.status === 1 && json.product ? offToFood({ code, ...json.product }) : null;
}
