/* Meal generator. Quantities are solved from real food-database values to hit the day's targets;
   templates only say which foods go together. Rules from the user: oats only with whey, sweet and savory
   apart, varied meals. */
import type { Food } from './foods.ts';
import { fold } from './foods.ts';

export type Role = 'protein' | 'carb' | 'fat' | 'veg' | 'extra';
export interface Item { foodId: string; role: Role; g: number }
export interface Meal { id: string; name: string; steps: string; time: string; items: Item[]; done: boolean; tag: string;
  /** An extra small meal, on top of the day's slots. */
  snack?: boolean;
  /** Chosen by the user: stays when the day is rebuilt. */
  keep?: boolean }
export interface Macro { kcal: number; p: number; c: number; f: number; fiber: number }
export interface Prefs { meals: 3 | 4 | 5; exclude: string; allergies: string; maxCook: number; budget: number }

interface Template { name: string; sweet: boolean; steps: string; cook: number; protein: string[]; carb: string[]; fat: string[]; veg: string[];
  /** Slow to digest: not the meal before training. */
  heavy?: boolean }

/** Names are Romanian names from the curated list, resolved against the database when generating. */
const TEMPLATES: Template[] = [
  { name: 'Ovăz cu whey și fructe', sweet: true, cook: 5, steps: 'Fierbe ovăzul în apă, ia-l de pe foc, amestecă whey-ul, adaugă fructele și nucile.', protein: ['Whey (proteină din zer)'], carb: ['Ovăz fulgi, crud'], fat: ['Nuci', 'Migdale'], veg: ['Afine', 'Banană', 'Căpșuni'] },
  { name: 'Iaurt grecesc cu fructe', sweet: true, cook: 3, steps: 'Pune iaurtul într-un bol, adaugă fructele, mierea și semințele.', protein: ['Iaurt grecesc degresat', 'Iaurt grecesc 2%'], carb: ['Miere', 'Banană'], fat: ['Semințe de chia', 'Migdale'], veg: ['Zmeură', 'Afine', 'Căpșuni'] },
  { name: 'Omletă cu pâine și legume', sweet: false, cook: 10, steps: 'Bate albușurile cu ouăle, gătește-le în tigaie cu uleiul, servește cu pâine și legume.', protein: ['Albuș de ou'], carb: ['Pâine integrală', 'Pâine de secară'], fat: ['Ou întreg, crud', 'Ulei de măsline'], veg: ['Roșii', 'Ardei gras roșu', 'Spanac crud'] },
  { name: 'Pui cu orez și legume', sweet: false, cook: 25, steps: 'Fierbe orezul, gătește puiul la tigaie sau la cuptor, fierbe legumele, adaugă uleiul la final. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Piept de pui, gătit'], carb: ['Orez alb fiert', 'Orez brun fiert'], fat: ['Ulei de măsline'], veg: ['Broccoli fiert', 'Fasole verde'] },
  { name: 'Curcan cu cartofi și salată', sweet: false, cook: 30, steps: 'Coace curcanul și cartofii, amestecă salata cu uleiul. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Piept de curcan, gătit'], carb: ['Cartofi la cuptor', 'Cartofi fierți', 'Cartofi dulci la cuptor'], fat: ['Ulei de măsline'], veg: ['Salată verde', 'Castraveți', 'Roșii'] },
  { name: 'Vită cu paste și legume', sweet: false, cook: 20, heavy: true, steps: 'Fierbe pastele, rumenește carnea, adaugă legumele și amestecă.', protein: ['Carne tocată de vită 90%, gătită'], carb: ['Paste fierte'], fat: ['Parmezan', 'Ulei de măsline'], veg: ['Dovlecei', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Somon cu garnitură și legume', sweet: false, cook: 25, heavy: true, steps: 'Coace somonul, pregătește garnitura, fierbe legumele la abur.', protein: ['Somon gătit'], carb: ['Cartofi fierți', 'Cuscus fiert'], fat: [], veg: ['Broccoli fiert', 'Conopidă', 'Morcovi'] },
  { name: 'Ton cu garnitură și legume', sweet: false, cook: 15, steps: 'Fierbe garnitura, amestec-o cu tonul scurs, legumele și uleiul.', protein: ['Ton la conservă în apă'], carb: ['Quinoa fiartă', 'Orez alb fiert'], fat: ['Ulei de măsline'], veg: ['Roșii', 'Castraveți', 'Ardei gras roșu'] },
  { name: 'Brânză de vaci cu pâine și legume', sweet: false, cook: 5, steps: 'Pune brânza pe farfurie, servește cu pâine și legume proaspete.', protein: ['Brânză de vaci'], carb: ['Pâine integrală'], fat: ['Avocado', 'Ulei de măsline'], veg: ['Roșii', 'Castraveți'] },
  { name: 'Pui cu leguminoase', sweet: false, cook: 25, heavy: true, steps: 'Fierbe leguminoasele, gătește puiul, amestecă-le cu legumele.', protein: ['Piept de pui, gătit'], carb: ['Linte fiartă', 'Năut fiert'], fat: ['Ulei de măsline'], veg: ['Morcovi', 'Ceapă'] },
  // 2026-11-11, the user asked for more ways to replace a meal: Romanian classics and quick ones, the same rules
  { name: 'Pulpe de pui cu mămăligă și salată', sweet: false, cook: 30, heavy: true, steps: 'Fierbe mămăliga din mălai, coace pulpele dezosate, servește cu salată. Mălaiul e cântărit crud, puiul gătit.', protein: ['Pulpă de pui, gătită, fără piele'], carb: ['Mălai crud'], fat: [], veg: ['Varză', 'Roșii', 'Castraveți'] },
  { name: 'Vită cu cartofi și legume', sweet: false, cook: 30, heavy: true, steps: 'Rumenește mușchiul de vită, coace cartofii, gătește legumele, adaugă uleiul la final. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Mușchi de vită, gătit'], carb: ['Cartofi la cuptor', 'Cartofi fierți'], fat: ['Ulei de măsline'], veg: ['Fasole verde', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Porc cu orez și varză', sweet: false, cook: 25, steps: 'Gătește mușchiul de porc la tigaie, fierbe orezul, călește varza cu ardeiul. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Mușchi de porc, gătit'], carb: ['Orez brun fiert', 'Orez alb fiert'], fat: ['Ulei de măsline'], veg: ['Varză', 'Ardei gras roșu', 'Dovlecei'] },
  { name: 'Wrap cu pui și legume', sweet: false, cook: 15, steps: 'Gătește puiul, taie legumele, pune totul în lipie cu avocado sau un fir de ulei și rulează.', protein: ['Piept de pui, gătit', 'Piept de curcan, gătit'], carb: ['Lipie tortilla'], fat: ['Avocado', 'Ulei de măsline'], veg: ['Salată verde', 'Roșii', 'Ardei gras roșu'] },
  { name: 'Cod cu cartofi și legume', sweet: false, cook: 20, steps: 'Coace codul cu lămâie, fierbe cartofii și legumele, adaugă uleiul la final.', protein: ['Cod gătit'], carb: ['Cartofi fierți', 'Cartofi dulci la cuptor'], fat: ['Ulei de măsline'], veg: ['Broccoli fiert', 'Morcovi', 'Spanac crud'] },
  { name: 'Creveți cu paste și legume', sweet: false, cook: 20, steps: 'Fierbe pastele, călește creveții cu legumele în ulei, amestecă și presară parmezan.', protein: ['Creveți gătiți'], carb: ['Paste fierte'], fat: ['Ulei de măsline', 'Parmezan'], veg: ['Dovlecei', 'Roșii', 'Spanac crud'] },
  { name: 'Tofu cu orez și legume', sweet: false, cook: 20, steps: 'Rumenește tofu-ul la tigaie, fierbe orezul, gătește legumele cu puțin sos de soia.', protein: ['Tofu'], carb: ['Orez alb fiert', 'Quinoa fiartă'], fat: [], veg: ['Broccoli fiert', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Ouă cu cartofi și salată', sweet: false, cook: 20, steps: 'Fierbe ouăle și cartofii, servește cu salată. Albușurile în plus le fierbi separat sau le faci omletă.', protein: ['Albuș de ou'], carb: ['Cartofi fierți'], fat: ['Ou fiert', 'Ou întreg, crud'], veg: ['Salată verde', 'Roșii', 'Castraveți'] },
  { name: 'Bol mexican cu pui', sweet: false, cook: 20, heavy: true, steps: 'Încălzește fasolea neagră și porumbul, adaugă puiul gătit, roșiile, ardeiul și avocado.', protein: ['Piept de pui, gătit'], carb: ['Fasole neagră fiartă', 'Porumb dulce'], fat: ['Avocado'], veg: ['Roșii', 'Ardei gras roșu', 'Ceapă'] },
  { name: 'Pâine cu unt de arahide, banană și whey', sweet: true, cook: 3, steps: 'Unge pâinea cu unt de arahide, pune banana feliată; whey-ul îl bei cu apă sau lapte.', protein: ['Whey (proteină din zer)'], carb: ['Pâine integrală'], fat: ['Unt de arahide'], veg: ['Banană'] },
  { name: 'Shake de whey cu fructe', sweet: true, cook: 3, steps: 'Mixează whey-ul cu apă, fructele și nucile sau semințele.', protein: ['Whey (proteină din zer)'], carb: ['Banană', 'Curmale'], fat: ['Unt de arahide', 'Migdale'], veg: ['Căpșuni', 'Afine', 'Zmeură'] },
];

export const PAIRS: Record<Role, string[]> = {
  protein: ['Piept de pui, gătit', 'Piept de curcan, gătit', 'Pulpă de pui, gătită, fără piele', 'Somon gătit', 'Cod gătit', 'Macrou gătit', 'Ton la conservă în apă', 'Carne tocată de vită 90%, gătită', 'Mușchi de vită, gătit', 'Mușchi de porc, gătit', 'Creveți gătiți', 'Tofu', 'Albuș de ou', 'Brânză de vaci', 'Iaurt grecesc degresat', 'Iaurt grecesc 2%', 'Whey (proteină din zer)'],
  carb: ['Orez alb fiert', 'Orez brun fiert', 'Paste fierte', 'Cartofi fierți', 'Cartofi la cuptor', 'Cartofi dulci la cuptor', 'Quinoa fiartă', 'Cuscus fiert', 'Mălai crud', 'Pâine integrală', 'Pâine de secară', 'Lipie tortilla', 'Linte fiartă', 'Năut fiert', 'Fasole boabe fiartă', 'Fasole neagră fiartă', 'Mazăre verde fiartă', 'Porumb dulce',
    'Ovăz fulgi, crud', 'Banană', 'Miere', 'Măr', 'Pară', 'Curmale', 'Stafide', 'Struguri'],
  fat: ['Ulei de măsline', 'Avocado', 'Parmezan', 'Telemea tip feta', 'Semințe de dovleac', 'Semințe de floarea-soarelui', 'Semințe de in', 'Nuci', 'Migdale', 'Caju', 'Alune de pădure', 'Arahide', 'Unt de arahide', 'Semințe de chia'],
  veg: ['Broccoli fiert', 'Fasole verde', 'Roșii', 'Castraveți', 'Salată verde', 'Morcovi', 'Dovlecei', 'Ciuperci', 'Spanac crud', 'Conopidă', 'Ardei gras roșu', 'Varză', 'Vinete', 'Ceapă',
    'Afine', 'Căpșuni', 'Zmeură', 'Banană', 'Măr', 'Pară', 'Piersică', 'Kiwi', 'Portocală', 'Ananas'],
  extra: [],
};

const allowed = (f: Food, words: string[]) => !words.some((w) => w && (fold(f.name).includes(w) || fold(f.en ?? '').includes(w)));
export const banned = (p: Prefs) => `${p.exclude},${p.allergies}`.split(',').map(fold).filter(Boolean);

export function macros(items: Item[], db: Map<string, Food>): Macro {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  for (const it of items) {
    const f = db.get(it.foodId);
    if (!f) continue;
    const k = it.g / 100;
    t.kcal += f.kcal * k; t.p += f.p * k; t.c += f.c * k; t.f += f.f * k; t.fiber += f.fiber * k;
  }
  return t;
}

/** Solves grams so the meal reaches protein, then carbs, then fat. */
export function solve(items: Item[], target: { p: number; c: number; f: number }, db: Map<string, Food>): Item[] {
  const out = items.map((i) => ({ ...i }));
  const get = (r: Role) => out.find((i) => i.role === r);
  const food = (i?: Item) => (i ? db.get(i.foodId) : undefined);
  const prot = get('protein'), carb = get('carb'), fat = get('fat');
  const veg = out.filter((i) => i.role === 'veg');
  const vp = veg.reduce((s, i) => s + (food(i)?.p ?? 0) * i.g / 100, 0);
  const vc = veg.reduce((s, i) => s + (food(i)?.c ?? 0) * i.g / 100, 0);
  const vf = veg.reduce((s, i) => s + (food(i)?.f ?? 0) * i.g / 100, 0);
  const pf = food(prot), cf = food(carb), ff = food(fat);
  let pG = 0, cG = 0, fG = 0;
  for (let n = 0; n < 8; n++) {
    pG = pf && pf.p > 0 ? Math.max(0, (target.p - vp - (cf?.p ?? 0) * cG / 100 - (ff?.p ?? 0) * fG / 100) / pf.p * 100) : 0;
    cG = cf && cf.c > 0 ? Math.max(0, (target.c - vc - (pf?.c ?? 0) * pG / 100 - (ff?.c ?? 0) * fG / 100) / cf.c * 100) : 0;
    fG = ff && ff.f > 0 ? Math.max(0, (target.f - vf - (pf?.f ?? 0) * pG / 100 - (cf?.f ?? 0) * cG / 100) / ff.f * 100) : 0;
  }
  const round = (g: number) => Math.round(g / 5) * 5;
  if (prot) prot.g = Math.max(10, round(pG));
  if (carb) carb.g = round(cG);
  if (fat) fat.g = Math.max(0, Math.round(fG));
  return out.filter((i) => i.g > 0);
}

export const MEAL_TAGS = ['', 'Înainte de antrenament', 'După antrenament'];

export function buildMeal(tpl: Template, target: { p: number; c: number; f: number }, byName: Map<string, Food>, db: Map<string, Food>, words: string[], seed: number, time: string, tag: string): Meal | null {
  const pick = (list: string[]) => {
    const ok = list.map((n) => byName.get(n)).filter((f): f is Food => !!f && allowed(f, words));
    return ok.length ? ok[seed % ok.length]! : undefined;
  };
  const p = pick(tpl.protein), c = pick(tpl.carb), f = pick(tpl.fat);
  if (!p || !c) return null;
  const vegs = [pick(tpl.veg)].filter((x): x is Food => !!x);
  const items: Item[] = [{ foodId: p.id, role: 'protein', g: 0 }, { foodId: c.id, role: 'carb', g: 0 }];
  if (f) items.push({ foodId: f.id, role: 'fat', g: 0 });
  for (const v of vegs) items.push({ foodId: v.id, role: 'veg', g: tpl.sweet ? 80 : 150 });
  return { id: crypto.randomUUID(), name: tpl.name, steps: tpl.steps, time, tag, done: false, items: solve(items, target, db) };
}

/** The most anyone would eat of one food in a meal, in grams. */
const CAP: Record<Role, number> = { protein: 350, carb: 450, fat: 45, veg: 400, extra: 200 };
const bulk = (items: Item[]) => items.reduce((s, i) => s + Math.max(0, i.g - CAP[i.role]), 0);
export const PRE_TAG = 'Înainte de antrenament';

/** `recent`: meals of the nearby days. They stay possible, but the day prefers others. */
type GenOpts = { avoid?: string[]; firstSweet?: boolean; fatShares?: number[]; recent?: string[] };

/**
 * Eight tries, scored by how far the day lands from its macros, in kcal, plus any portion nobody would eat.
 * Among those about as good as the best one, the seed chooses, so a new plan is both accurate and different.
 */
export function generateDay(day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, opts: GenOpts = {}): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const tries = Array.from({ length: 8 }, (_, k) => {
    const meals = oneDay(day, carbShares, times, tags, foods, prefs, seed + k * 17, opts);
    const got = macros(meals.flatMap((m) => m.items), db);
    return { meals, key: meals.map((m) => m.name).join('|'), miss: Math.abs(got.f - day.f) * 9 + Math.abs(got.c - day.c) * 4 + Math.abs(got.p - day.p) * 4 + bulk(meals.flatMap((m) => m.items)) * 4 + (carbShares.length - meals.length) * 1000 };
  });
  const lowest = Math.min(...tries.map((t) => t.miss));
  const repeats = (t: { meals: Meal[] }) => t.meals.filter((m) => opts.recent?.includes(m.name)).length;
  const near = tries.filter((t) => t.miss <= lowest + 15);
  const fewest = Math.min(...near.map(repeats));
  const fresh = near.filter((t) => repeats(t) === fewest);
  const close = fresh.filter((t, i) => fresh.findIndex((x) => x.key === t.key) === i);
  return close[Math.abs(seed) % close.length]!.meals;
}

/** Targets per meal: protein evenly, fat by its share, carbs by training share. */
function oneDay(day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, opts: GenOpts): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  const n = carbShares.length;
  const fatShares = opts.fatShares ?? carbShares.map(() => 1 / n);
  // only meals this kitchen can make: a template whose foods are missing would only shift the rotation
  const can = (names: string[]) => names.some((n) => { const f = byName.get(n); return !!f && allowed(f, words); });
  const usable = TEMPLATES.filter((t) => t.cook <= prefs.maxCook && can(t.protein) && can(t.carb));
  const list = usable.length ? usable : TEMPLATES;
  const sweet = list.filter((t) => t.sweet), savory = list.filter((t) => !t.sweet);
  const meals: Meal[] = [];
  const left = { ...day };
  const avoid = opts.avoid ?? [];
  const firstSweet = opts.firstSweet ?? true;
  for (let i = 0; i < n; i++) {
    const pool = (i === 0 && firstSweet && sweet.length ? sweet : savory.length ? savory : list).filter((t) => !(t.heavy && tags[i] === PRE_TAG));
    let meal: Meal | null = null;
    let best = Infinity;
    const shareLeft = carbShares.slice(i).reduce((x, y) => x + y, 0) || 1;
    const fatLeft = fatShares.slice(i).reduce((x, y) => x + y, 0) || 1;
    const goal = { p: left.p / (n - i), c: (left.c * carbShares[i]!) / shareLeft, f: (Math.max(0, left.f) * fatShares[i]!) / fatLeft };
    for (let k = 0; k < pool.length; k++) {
      const tpl = pool[(seed + i + k) % pool.length]!;
      if (avoid.includes(tpl.name) || meals.some((m) => m.name === tpl.name)) continue;
      const option = buildMeal(tpl, goal, byName, db, words, seed + i, times[i] ?? '', tags[i] ?? '');
      if (!option) continue;
      const got = macros(option.items, db);
      // Variety first: a later template wins only if it clearly fits better.
      const miss = Math.abs(got.f - goal.f) * 9 + Math.abs(got.c - goal.c) * 4 + Math.abs(got.p - goal.p) * 4 + bulk(option.items) * 4 + (opts.recent?.filter((x) => x === tpl.name).length ?? 0) * 70;
      if (miss + 40 < best) { best = miss; meal = option; }
    }
    if (meal) {
      meals.push(meal);
      // What a food brings beyond its share (the fat in salmon) is taken back from the next meals.
      const got = macros(meal.items, db);
      left.p -= got.p; left.c -= got.c; left.f -= got.f;
    }
  }
  return meals;
}

/** Rebuilds a day around what was already eaten: logged meals stay exactly as they are, the rest share what is left. */
export function regenerate(existing: Meal[], day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, fatShares?: number[], recent?: string[]): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const kept = existing.filter((m) => m.done || m.snack || m.keep);
  const full = kept.filter((m) => !m.snack);
  const eaten = macros(kept.flatMap((m) => m.items), db);
  const free = times.map((_, i) => i).filter((i) => !full.some((m) => m.time === times[i]));
  const open = free.slice(-Math.max(0, times.length - full.length));
  if (!open.length) return kept;
  const left = { p: Math.max(0, day.p - eaten.p), c: Math.max(0, day.c - eaten.c), f: Math.max(0, day.f - eaten.f) };
  const fresh = generateDay(left, open.map((i) => carbShares[i]!), open.map((i) => times[i]!), open.map((i) => tags[i] ?? ''), foods, prefs, seed, { avoid: full.map((m) => m.name), firstSweet: open[0] === 0, ...(fatShares ? { fatShares: open.map((i) => fatShares[i]!) } : {}), ...(recent ? { recent } : {}) });
  return [...kept, ...fresh].sort((a, b) => a.time.localeCompare(b.time));
}

/** Other meals for the same slot, sized to the same macros, best fit first. */
export function mealOptions(goal: { p: number; c: number; f: number }, foods: Food[], prefs: Prefs, time: string, tag: string, seed: number, current = ''): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  return TEMPLATES.filter((t) => t.cook <= prefs.maxCook && t.name !== current && !(t.heavy && tag === PRE_TAG))
    .map((t) => buildMeal(t, goal, byName, db, words, seed, time, tag))
    .filter((m): m is Meal => !!m)
    .map((m) => { const g = macros(m.items, db); return { m, miss: Math.abs(g.f - goal.f) * 9 + Math.abs(g.c - goal.c) * 4 + Math.abs(g.p - goal.p) * 4 + bulk(m.items) * 4 }; })
    .sort((a, b) => a.miss - b.miss).slice(0, 6).map((x) => x.m);
}

/** Small and easy to digest. Grams come from the carbs asked for and the food's real values. */
const SNACKS: { name: string; steps: string; foods: [string, number][] }[] = [
  { name: 'Banană', steps: 'Se mănâncă simplu, fără altceva.', foods: [['Banană', 1]] },
  { name: 'Iaurt grecesc cu miere', steps: 'Amestecă mierea în iaurt.', foods: [['Miere', 0.75], ['Iaurt grecesc degresat', 0.25]] },
  { name: 'Pâine albă cu miere', steps: 'Unge pâinea cu miere.', foods: [['Pâine albă', 0.65], ['Miere', 0.35]] },
];

export function snackOptions(carbs: number, foods: Food[], prefs: Prefs, time: string, tag: string): Meal[] {
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  return SNACKS.flatMap((s) => {
    const found = s.foods.map(([n, part]) => ({ food: byName.get(n), part }));
    if (found.some((x) => !x.food || !allowed(x.food, words) || x.food.c <= 0)) return [];
    const items: Item[] = found.map((x) => ({ foodId: x.food!.id, role: 'carb', g: Math.max(5, Math.round(((carbs * x.part) / x.food!.c) * 100 / 5) * 5) }));
    return [{ id: crypto.randomUUID(), name: s.name, steps: s.steps, time, tag, done: false, snack: true, items }];
  });
}

export function substitute(meal: Meal, index: number, next: Food, db: Map<string, Food>): Meal {
  const items = meal.items.map((it, i) => (i === index ? { ...it, foodId: next.id } : it));
  db.set(next.id, next);
  const old = macros(meal.items, db);
  return { ...meal, items: solve(items, { p: old.p, c: old.c, f: old.f }, db) };
}

/** Foods that belong in a sweet bowl, and foods that belong next to meat and vegetables. */
const SWEET = new Set(['Ovăz fulgi, crud', 'Banană', 'Miere', 'Whey (proteină din zer)', 'Iaurt grecesc degresat', 'Iaurt grecesc 2%', 'Afine', 'Căpșuni', 'Zmeură', 'Nuci', 'Migdale', 'Semințe de chia',
  'Măr', 'Pară', 'Piersică', 'Kiwi', 'Portocală', 'Ananas', 'Curmale', 'Stafide', 'Struguri', 'Caju', 'Alune de pădure', 'Unt de arahide']);
const OATS = 'Ovăz fulgi, crud';
const WHEY = 'Whey (proteină din zer)';

/**
 * What can replace a food in a meal. The user's rules hold here too: oats only next to whey, and a meal stays
 * sweet or savory. `inMeal`: the foods the meal keeps, by name.
 */
export function alternatives(role: Role, current: string, foods: Food[], prefs: Prefs, inMeal: string[] = []): Food[] {
  const words = banned(prefs);
  // the user's own foods say themselves whether they are sweet (src/screens/mine.ts)
  const mine = foods.filter((f) => f.source === 'mine');
  const sweetOf = (n: string) => { const m = mine.find((f) => f.name === n); return m ? !!m.sweet : SWEET.has(n); };
  const sweetMeal = inMeal.some(sweetOf) && inMeal.every(sweetOf);
  const fits = (n: string) => {
    if (n === OATS && !inMeal.includes(WHEY)) return false;
    if (inMeal.includes(OATS) && role === 'protein') return n === WHEY;
    return !inMeal.length || sweetOf(n) === sweetMeal;
  };
  const own = mine.filter((f) => f.role === role && f.id !== current && fits(f.name) && allowed(f, words));
  const listed = PAIRS[role].filter(fits).map((n) => foods.find((f) => f.name === n && f.source !== 'mine')).filter((f): f is Food => !!f && f.id !== current && allowed(f, words));
  return [...own, ...listed];
}

export function shoppingList(days: Meal[][], db: Map<string, Food>) {
  const map = new Map<string, number>();
  for (const m of days.flat()) for (const i of m.items) map.set(i.foodId, (map.get(i.foodId) ?? 0) + i.g);
  return [...map.entries()].map(([id, g]) => ({ id, name: db.get(id)?.name ?? id, g: Math.round(g) })).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

