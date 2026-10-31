/* Food database: USDA FoodData Central (shipped with the app) plus Open Food Facts for branded products. */
export interface Food {
  id: string;
  name: string;
  en?: string;
  cat: string;
  /** Per 100 g. */
  kcal: number; p: number; c: number; f: number; fiber: number; sugar: number; sat: number; sodium: number;
  portions: [string, number][];
  source: 'usda' | 'off' | 'mine';
}

type Row = [number, string, number, number, number, number, number, number, number, number, number, [string, number][]];
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
  pulpa: 'thigh', aripi: 'wing', ficat: 'liver', supa: 'soup', sos: 'sauce', faina: 'flour', biscuiti: 'cookies', tort: 'cake',
};

export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

let db: Food[] | null = null;

export function parseDb(raw: Raw): Food[] {
  const ro = new Map(raw.ro);
  const list = raw.foods.map((r): Food => ({
    id: `u${r[0]}`, name: ro.get(r[0]) ?? r[1], en: r[1], cat: raw.cats[r[2]] ?? '',
    kcal: r[3], p: r[4], c: r[5], f: r[6], fiber: r[7], sugar: r[8], sat: r[9], sodium: r[10], portions: r[11], source: 'usda',
  }));
  return list;
}

export async function loadFoods(): Promise<Food[]> {
  if (db) return db;
  const res = await fetch(`${import.meta.env.BASE_URL}foods.json`);
  if (!res.ok) throw new Error('Baza de alimente nu s-a încărcat.');
  db = parseDb(await res.json() as Raw);
  return db;
}

export const isRomanian = (f: Food) => f.name !== f.en;

/** Romanian names first, then matches in the USDA text; every word must match. */
export function search(list: Food[], query: string, limit = 40): Food[] {
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
      else { score = -1; break; }
    }
    if (score < 0) continue;
    if (isRomanian(f)) score += 20;
    scored.push([score - (en.length || ro.length) / 200, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}

const offToFood = (p: Record<string, unknown>): Food | null => {
  const n = (p['nutriments'] ?? {}) as Record<string, number>;
  const kcal = Number(n['energy-kcal_100g'] ?? (n['energy-kj_100g'] != null ? n['energy-kj_100g'] / 4.184 : NaN));
  if (!p['product_name'] || !Number.isFinite(kcal)) return null;
  const v = (k: string) => Math.round((Number(n[k]) || 0) * 10) / 10;
  const brands = p['brands'];
  const brand = (Array.isArray(brands) ? String(brands[0] ?? '') : String(brands ?? '')).split(',')[0]?.trim();
  return {
    id: `o${String(p['code'])}`, name: `${String(p['product_name'])}${brand ? ` · ${brand}` : ''}`, cat: 'Produs de marcă',
    kcal: Math.round(kcal), p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g'), fiber: v('fiber_100g'),
    sugar: v('sugars_100g'), sat: v('saturated-fat_100g'), sodium: Math.round((Number(n['sodium_100g']) || 0) * 1000),
    portions: [], source: 'off',
  };
};

const FIELDS = 'code,product_name,brands,nutriments';

export async function searchBranded(query: string): Promise<Food[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open Food Facts nu răspunde.');
  const json = await res.json() as { products?: Record<string, unknown>[] };
  return (json.products ?? []).map(offToFood).filter((f): f is Food => !!f);
}

export async function byBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const json = await res.json() as { status?: number; product?: Record<string, unknown> };
  return json.status === 1 && json.product ? offToFood({ code, ...json.product }) : null;
}
