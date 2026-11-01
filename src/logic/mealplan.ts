/* Meal generator. Quantities are solved from real food-database values to hit the day's targets;
   templates only say which foods go together. Rules from the user: oats only with whey, sweet and savory
   apart, varied meals. */
import type { Food } from './foods.ts';
import { fold } from './foods.ts';

export type Role = 'protein' | 'carb' | 'fat' | 'veg' | 'extra';
export interface Item { foodId: string; role: Role; g: number }
export interface Meal { id: string; name: string; steps: string; time: string; items: Item[]; done: boolean; tag: string }
export interface Macro { kcal: number; p: number; c: number; f: number; fiber: number }
export interface Prefs { meals: 3 | 4 | 5; exclude: string; allergies: string; maxCook: number; budget: number }

interface Template { name: string; sweet: boolean; steps: string; cook: number; protein: string[]; carb: string[]; fat: string[]; veg: string[] }

/** Names are Romanian names from the curated list, resolved against the database when generating. */
const TEMPLATES: Template[] = [
  { name: 'Ovăz cu whey și fructe', sweet: true, cook: 5, steps: 'Fierbe ovăzul în apă, ia-l de pe foc, amestecă whey-ul, adaugă fructele și nucile.', protein: ['Whey (proteină din zer)'], carb: ['Ovăz fulgi, crud'], fat: ['Nuci', 'Migdale'], veg: ['Afine', 'Banană', 'Căpșuni'] },
  { name: 'Iaurt grecesc cu fructe', sweet: true, cook: 3, steps: 'Pune iaurtul într-un bol, adaugă fructele, mierea și semințele.', protein: ['Iaurt grecesc degresat', 'Iaurt grecesc 2%'], carb: ['Miere', 'Banană'], fat: ['Semințe de chia', 'Migdale'], veg: ['Zmeură', 'Afine', 'Căpșuni'] },
  { name: 'Omletă cu pâine și legume', sweet: false, cook: 10, steps: 'Bate albușurile cu ouăle, gătește-le în tigaie cu uleiul, servește cu pâine și legume.', protein: ['Albuș de ou'], carb: ['Pâine integrală', 'Pâine de secară'], fat: ['Ou întreg, crud', 'Ulei de măsline'], veg: ['Roșii', 'Ardei gras roșu', 'Spanac crud'] },
  { name: 'Pui cu orez și broccoli', sweet: false, cook: 25, steps: 'Fierbe orezul, gătește puiul la tigaie sau la cuptor, fierbe broccoli, adaugă uleiul la final. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Piept de pui, gătit'], carb: ['Orez alb fiert', 'Orez brun fiert'], fat: ['Ulei de măsline'], veg: ['Broccoli fiert', 'Fasole verde'] },
  { name: 'Curcan cu cartofi și salată', sweet: false, cook: 30, steps: 'Coace curcanul și cartofii, amestecă salata cu uleiul. Cantitățile sunt pentru alimentele gata gătite.', protein: ['Piept de curcan, gătit'], carb: ['Cartofi la cuptor', 'Cartofi fierți', 'Cartofi dulci la cuptor'], fat: ['Ulei de măsline'], veg: ['Salată verde', 'Castraveți', 'Roșii'] },
  { name: 'Vită cu paste și legume', sweet: false, cook: 20, steps: 'Fierbe pastele, rumenește carnea, adaugă legumele și amestecă.', protein: ['Carne tocată de vită 90%, gătită'], carb: ['Paste fierte'], fat: ['Parmezan', 'Ulei de măsline'], veg: ['Dovlecei', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Somon cu cartofi și legume', sweet: false, cook: 25, steps: 'Coace somonul și cartofii, fierbe legumele la abur.', protein: ['Somon gătit'], carb: ['Cartofi fierți', 'Cuscus fiert'], fat: [], veg: ['Broccoli fiert', 'Conopidă', 'Morcovi'] },
  { name: 'Ton cu quinoa și legume', sweet: false, cook: 15, steps: 'Fierbe quinoa, amestec-o cu tonul scurs, legumele și uleiul.', protein: ['Ton la conservă în apă'], carb: ['Quinoa fiartă', 'Orez alb fiert'], fat: ['Ulei de măsline'], veg: ['Roșii', 'Castraveți', 'Ardei gras roșu'] },
  { name: 'Brânză de vaci cu pâine și legume', sweet: false, cook: 5, steps: 'Pune brânza pe farfurie, servește cu pâine și legume proaspete.', protein: ['Brânză de vaci'], carb: ['Pâine integrală'], fat: ['Avocado', 'Ulei de măsline'], veg: ['Roșii', 'Castraveți'] },
  { name: 'Linte cu pui și orez', sweet: false, cook: 25, steps: 'Fierbe lintea și orezul, gătește puiul, amestecă-le cu legumele.', protein: ['Piept de pui, gătit'], carb: ['Linte fiartă', 'Năut fiert'], fat: ['Ulei de măsline'], veg: ['Morcovi', 'Ceapă'] },
];

export const PAIRS: Record<Role, string[]> = {
  protein: ['Piept de pui, gătit', 'Piept de curcan, gătit', 'Somon gătit', 'Cod gătit', 'Ton la conservă în apă', 'Carne tocată de vită 90%, gătită', 'Mușchi de porc, gătit', 'Tofu', 'Albuș de ou', 'Brânză de vaci', 'Iaurt grecesc degresat', 'Whey (proteină din zer)', 'Creveți gătiți'],
  carb: ['Orez alb fiert', 'Orez brun fiert', 'Paste fierte', 'Cartofi fierți', 'Cartofi dulci la cuptor', 'Quinoa fiartă', 'Cuscus fiert', 'Pâine integrală', 'Ovăz fulgi, crud', 'Linte fiartă', 'Banană'],
  fat: ['Ulei de măsline', 'Avocado', 'Nuci', 'Migdale', 'Arahide', 'Semințe de chia'],
  veg: ['Broccoli fiert', 'Fasole verde', 'Roșii', 'Castraveți', 'Salată verde', 'Morcovi', 'Dovlecei', 'Ciuperci', 'Spanac crud', 'Conopidă'],
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

/** Targets per meal: protein evenly, fat evenly, carbs by training share. */
export function generateDay(day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, opts: { avoid?: string[]; firstSweet?: boolean } = {}): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  const n = carbShares.length;
  const usable = TEMPLATES.filter((t) => t.cook <= prefs.maxCook);
  const list = usable.length ? usable : TEMPLATES;
  const sweet = list.filter((t) => t.sweet), savory = list.filter((t) => !t.sweet);
  const meals: Meal[] = [];
  const left = { ...day };
  const avoid = opts.avoid ?? [];
  const firstSweet = opts.firstSweet ?? true;
  for (let i = 0; i < n; i++) {
    const pool = i === 0 && firstSweet && sweet.length ? sweet : savory.length ? savory : list;
    let meal: Meal | null = null;
    let best = Infinity;
    const shareLeft = carbShares.slice(i).reduce((x, y) => x + y, 0) || 1;
    const goal = { p: left.p / (n - i), c: (left.c * carbShares[i]!) / shareLeft, f: Math.max(0, left.f) / (n - i) };
    for (let k = 0; k < pool.length; k++) {
      const tpl = pool[(seed + i + k) % pool.length]!;
      if (avoid.includes(tpl.name) || meals.some((m) => m.name === tpl.name)) continue;
      const option = buildMeal(tpl, goal, byName, db, words, seed + i, times[i] ?? '', tags[i] ?? '');
      if (!option) continue;
      const got = macros(option.items, db);
      // Variety first: a later template wins only if it clearly fits better.
      const miss = Math.abs(got.f - goal.f) * 9 + Math.abs(got.c - goal.c) * 4 + Math.abs(got.p - goal.p) * 4;
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
export function regenerate(existing: Meal[], day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const kept = existing.filter((m) => m.done);
  const eaten = macros(kept.flatMap((m) => m.items), db);
  const free = times.map((_, i) => i).filter((i) => !kept.some((m) => m.time === times[i]));
  const open = free.slice(-Math.max(0, times.length - kept.length));
  if (!open.length) return kept;
  const left = { p: Math.max(0, day.p - eaten.p), c: Math.max(0, day.c - eaten.c), f: Math.max(0, day.f - eaten.f) };
  const fresh = generateDay(left, open.map((i) => carbShares[i]!), open.map((i) => times[i]!), open.map((i) => tags[i] ?? ''), foods, prefs, seed, { avoid: kept.map((m) => m.name), firstSweet: open[0] === 0 });
  return [...kept, ...fresh].sort((a, b) => a.time.localeCompare(b.time));
}

/** Other meals for the same slot, sized to the same macros, best fit first. */
export function mealOptions(goal: { p: number; c: number; f: number }, foods: Food[], prefs: Prefs, time: string, tag: string, seed: number, current = ''): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  return TEMPLATES.filter((t) => t.cook <= prefs.maxCook && t.name !== current)
    .map((t) => buildMeal(t, goal, byName, db, words, seed, time, tag))
    .filter((m): m is Meal => !!m)
    .map((m) => { const g = macros(m.items, db); return { m, miss: Math.abs(g.f - goal.f) * 9 + Math.abs(g.c - goal.c) * 4 + Math.abs(g.p - goal.p) * 4 }; })
    .sort((a, b) => a.miss - b.miss).slice(0, 3).map((x) => x.m);
}

export function substitute(meal: Meal, index: number, next: Food, db: Map<string, Food>): Meal {
  const items = meal.items.map((it, i) => (i === index ? { ...it, foodId: next.id } : it));
  db.set(next.id, next);
  const old = macros(meal.items, db);
  return { ...meal, items: solve(items, { p: old.p, c: old.c, f: old.f }, db) };
}

export function alternatives(role: Role, current: string, foods: Food[], prefs: Prefs): Food[] {
  const words = banned(prefs);
  return PAIRS[role].map((n) => foods.find((f) => f.name === n)).filter((f): f is Food => !!f && f.id !== current && allowed(f, words));
}

export function shoppingList(days: Meal[][], db: Map<string, Food>) {
  const map = new Map<string, number>();
  for (const m of days.flat()) for (const i of m.items) map.set(i.foodId, (map.get(i.foodId) ?? 0) + i.g);
  return [...map.entries()].map(([id, g]) => ({ id, name: db.get(id)?.name ?? id, g: Math.round(g) })).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

