/* Meal generator. Quantities are solved from real food-database values to hit the day's targets;
   templates only say which foods go together. Rules from the user: oats only with whey, sweet and savory
   apart, varied meals. */
import type { Food } from './foods.ts';
import { fold } from './foods.ts';
import { NIGHT_PROTEIN, OILY_FISH, RED_MEAT, SLOW_PROTEIN, slotOf, type Focus, type Slot } from './coach.ts';

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
  heavy?: boolean;
  /** Light, low in fat and fibre: fit for the meal before training (coach.ts). */
  light?: boolean;
  /** Casein-rich dairy as the protein: the meal before sleep (coach.ts). */
  night?: boolean }

/** Names are Romanian names from the curated list, resolved against the database when generating. */
const TEMPLATES: Template[] = [
  { name: 'Ovăz cu whey și fructe', sweet: true, cook: 5, steps: 'Fierbe ovăzul în apă, ia-l de pe foc, amestecă whey-ul, adaugă fructele și nucile.', protein: ['Whey (proteină din zer)'], carb: ['Ovăz fulgi, crud'], fat: ['Nuci', 'Migdale'], veg: ['Afine', 'Banană', 'Căpșuni'] },
  { name: 'Iaurt grecesc cu fructe', night: true, sweet: true, cook: 3, steps: 'Pune iaurtul într-un bol, adaugă fructele, mierea și semințele.', protein: ['Iaurt grecesc degresat', 'Iaurt grecesc 2%'], carb: ['Miere', 'Banană'], fat: ['Semințe de chia', 'Migdale'], veg: ['Zmeură', 'Afine', 'Căpșuni'] },
  { name: 'Omletă cu pâine și legume', sweet: false, cook: 10, steps: 'Bate albușurile cu ouăle, gătește-le în tigaie cu uleiul, servește cu pâine și legume.', protein: ['Albuș de ou'], carb: ['Pâine integrală', 'Pâine de secară'], fat: ['Ou întreg, crud', 'Ulei de măsline'], veg: ['Roșii', 'Ardei gras roșu', 'Spanac crud'] },
  { name: 'Pui cu orez și legume', light: true, sweet: false, cook: 25, steps: 'Fierbe orezul, gătește puiul la tigaie sau la cuptor, fierbe legumele, adaugă uleiul la final. Cantitățile sunt pentru alimentele crude, cântărite înainte de gătit.', protein: ['Piept de pui, crud'], carb: ['Orez alb crud', 'Orez brun crud'], fat: ['Ulei de măsline'], veg: ['Broccoli crud', 'Fasole verde'] },
  { name: 'Curcan cu cartofi și salată', sweet: false, cook: 30, steps: 'Coace curcanul și cartofii, amestecă salata cu uleiul. Cantitățile sunt pentru alimentele crude, cântărite înainte de gătit.', protein: ['Piept de curcan, crud'], carb: ['Cartofi cruzi', 'Cartofi dulci cruzi'], fat: ['Ulei de măsline'], veg: ['Salată verde', 'Castraveți', 'Roșii'] },
  { name: 'Vită cu paste și legume', sweet: false, cook: 20, heavy: true, steps: 'Fierbe pastele, rumenește carnea, adaugă legumele și amestecă.', protein: ['Carne tocată de vită 90%, crudă'], carb: ['Paste crude'], fat: ['Parmezan', 'Ulei de măsline'], veg: ['Dovlecei', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Somon cu garnitură și legume', sweet: false, cook: 25, heavy: true, steps: 'Coace somonul, pregătește garnitura, fierbe legumele la abur.', protein: ['Somon crud'], carb: ['Cartofi cruzi', 'Cuscus crud'], fat: [], veg: ['Broccoli crud', 'Conopidă', 'Morcovi'] },
  { name: 'Ton cu garnitură și legume', light: true, sweet: false, cook: 15, steps: 'Fierbe garnitura, amestec-o cu tonul scurs, legumele și uleiul.', protein: ['Ton la conservă în apă'], carb: ['Quinoa crudă', 'Orez alb crud'], fat: ['Ulei de măsline'], veg: ['Roșii', 'Castraveți', 'Ardei gras roșu'] },
  { name: 'Brânză de vaci cu pâine și legume', night: true, sweet: false, cook: 5, steps: 'Pune brânza pe farfurie, servește cu pâine și legume proaspete.', protein: ['Brânză de vaci'], carb: ['Pâine integrală'], fat: ['Avocado', 'Ulei de măsline'], veg: ['Roșii', 'Castraveți'] },
  { name: 'Pui cu leguminoase', sweet: false, cook: 25, heavy: true, steps: 'Fierbe leguminoasele, gătește puiul, amestecă-le cu legumele.', protein: ['Piept de pui, crud'], carb: ['Linte uscată', 'Năut uscat'], fat: ['Ulei de măsline'], veg: ['Morcovi', 'Ceapă'] },
  // 2026-11-11, the user asked for more ways to replace a meal: Romanian classics and quick ones, the same rules
  { name: 'Pulpe de pui cu mămăligă și salată', sweet: false, cook: 30, heavy: true, steps: 'Fierbe mămăliga din mălai, coace pulpele dezosate, servește cu salată. Totul e cântărit crud.', protein: ['Pulpă de pui, crudă, fără piele'], carb: ['Mălai crud'], fat: [], veg: ['Varză', 'Roșii', 'Castraveți'] },
  { name: 'Vită cu cartofi și legume', sweet: false, cook: 30, heavy: true, steps: 'Rumenește mușchiul de vită, coace cartofii, gătește legumele, adaugă uleiul la final. Cantitățile sunt pentru alimentele crude, cântărite înainte de gătit.', protein: ['Mușchi de vită, crud'], carb: ['Cartofi cruzi'], fat: ['Ulei de măsline'], veg: ['Fasole verde', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Porc cu orez și varză', light: true, sweet: false, cook: 25, steps: 'Gătește mușchiul de porc la tigaie, fierbe orezul, călește varza cu ardeiul. Cantitățile sunt pentru alimentele crude, cântărite înainte de gătit.', protein: ['Mușchi de porc, crud'], carb: ['Orez brun crud', 'Orez alb crud'], fat: ['Ulei de măsline'], veg: ['Varză', 'Ardei gras roșu', 'Dovlecei'] },
  { name: 'Wrap cu pui și legume', light: true, sweet: false, cook: 15, steps: 'Gătește puiul, taie legumele, pune totul în lipie cu avocado sau un fir de ulei și rulează.', protein: ['Piept de pui, crud', 'Piept de curcan, crud'], carb: ['Lipie tortilla'], fat: ['Avocado', 'Ulei de măsline'], veg: ['Salată verde', 'Roșii', 'Ardei gras roșu'] },
  { name: 'Cod cu cartofi și legume', sweet: false, cook: 20, steps: 'Coace codul cu lămâie, fierbe cartofii și legumele, adaugă uleiul la final.', protein: ['Cod, crud'], carb: ['Cartofi cruzi', 'Cartofi dulci cruzi'], fat: ['Ulei de măsline'], veg: ['Broccoli crud', 'Morcovi', 'Spanac crud'] },
  { name: 'Creveți cu paste și legume', light: true, sweet: false, cook: 20, steps: 'Fierbe pastele, călește creveții cu legumele în ulei, amestecă și presară parmezan.', protein: ['Creveți cruzi'], carb: ['Paste crude'], fat: ['Ulei de măsline', 'Parmezan'], veg: ['Dovlecei', 'Roșii', 'Spanac crud'] },
  { name: 'Tofu cu orez și legume', light: true, sweet: false, cook: 20, steps: 'Rumenește tofu-ul la tigaie, fierbe orezul, gătește legumele cu puțin sos de soia.', protein: ['Tofu'], carb: ['Orez alb crud', 'Quinoa crudă'], fat: [], veg: ['Broccoli crud', 'Ardei gras roșu', 'Ciuperci'] },
  { name: 'Ouă cu cartofi și salată', sweet: false, cook: 20, steps: 'Fierbe ouăle și cartofii, servește cu salată. Albușurile în plus le fierbi separat sau le faci omletă.', protein: ['Albuș de ou'], carb: ['Cartofi cruzi'], fat: ['Ou întreg, crud'], veg: ['Salată verde', 'Roșii', 'Castraveți'] },
  { name: 'Bol mexican cu pui', sweet: false, cook: 20, heavy: true, steps: 'Fierbe fasolea neagră (o noapte la înmuiat), gătește puiul, încălzește porumbul, adaugă roșiile, ardeiul și avocado. Totul e cântărit crud.', protein: ['Piept de pui, crud'], carb: ['Fasole neagră uscată', 'Porumb dulce'], fat: ['Avocado'], veg: ['Roșii', 'Ardei gras roșu', 'Ceapă'] },
  { name: 'Pâine cu unt de arahide, banană și whey', sweet: true, cook: 3, steps: 'Unge pâinea cu unt de arahide, pune banana feliată; whey-ul îl bei cu apă sau lapte.', protein: ['Whey (proteină din zer)'], carb: ['Pâine integrală'], fat: ['Unt de arahide'], veg: ['Banană'] },
  { name: 'Shake de whey cu fructe', sweet: true, cook: 3, steps: 'Mixează whey-ul cu apă, fructele și nucile sau semințele.', protein: ['Whey (proteină din zer)'], carb: ['Banană', 'Curmale'], fat: ['Unt de arahide', 'Migdale'], veg: ['Căpșuni', 'Afine', 'Zmeură'] },
  // 2026-11-15, more foods (the user asked): fish from Romanian shelves, buckwheat, bulgur, lean cuts; everything raw
  { name: 'Păstrăv cu cartofi noi și salată', sweet: false, cook: 25, steps: 'Coace păstrăvul cu lămâie, fierbe cartofii noi, amestecă salata cu uleiul. Totul e cântărit crud.', protein: ['Păstrăv, crud', 'Șalău, crud', 'Tilapia, crudă'], carb: ['Cartofi noi', 'Cartofi cruzi'], fat: ['Ulei de măsline'], veg: ['Salată verde', 'Rucola', 'Roșii'] },
  { name: 'Vită cu hrișcă și legume', sweet: false, cook: 25, heavy: true, steps: 'Fierbe hrișca, rumenește carnea de vită, călește legumele, adaugă uleiul la final. Totul e cântărit crud.', protein: ['Pulpă de vită, crudă', 'Carne tocată de vită 95%, crudă'], carb: ['Hrișcă crudă', 'Bulgur crud'], fat: ['Ulei de măsline'], veg: ['Ardei gras roșu', 'Ciuperci', 'Dovlecei'] },
  { name: 'Curcan cu bulgur și legume', sweet: false, cook: 25, steps: 'Fierbe bulgurul, gătește curcanul la tigaie, călește legumele, adaugă uleiul la final. Totul e cântărit crud.', protein: ['Pulpă de curcan, crudă', 'Piept de curcan, crud'], carb: ['Bulgur crud', 'Orz perlat crud'], fat: ['Ulei de măsline'], veg: ['Varză roșie', 'Morcovi', 'Fasole verde'] },
  { name: 'Ton proaspăt cu orez basmati și legume', light: true, sweet: false, cook: 20, steps: 'Fierbe orezul, frige tonul 1–2 minute pe fiecare parte, gătește legumele la abur, adaugă susanul. Totul e cântărit crud.', protein: ['Ton proaspăt, crud', 'Somon crud'], carb: ['Orez basmati crud', 'Orez brun crud'], fat: ['Semințe de susan', 'Ulei de măsline'], veg: ['Broccoli crud', 'Sparanghel', 'Morcovi'] },
  { name: 'Porc cu cartofi noi și varză', sweet: false, cook: 30, steps: 'Coace pulpa de porc și cartofii, călește varza cu ceapă. Totul e cântărit crud.', protein: ['Pulpă de porc, crudă', 'Cotlet de porc, crud', 'Mușchi de porc, crud'], carb: ['Cartofi noi', 'Cartofi cruzi'], fat: ['Ulei de măsline'], veg: ['Varză', 'Varză roșie', 'Ceapă'] },
  { name: 'Vițel cu mei și legume', sweet: false, cook: 25, steps: 'Fierbe meiul, rumenește vițelul, gătește legumele, adaugă uleiul la final. Totul e cântărit crud.', protein: ['Carne de vițel, crudă', 'Pulpă de vită, crudă'], carb: ['Mei crud', 'Hrișcă crudă'], fat: ['Ulei de măsline'], veg: ['Sfeclă roșie', 'Fasole verde', 'Dovlecei'] },
  { name: 'Pui cu paste integrale și legume', sweet: false, cook: 20, steps: 'Fierbe pastele, gătește puiul cu legumele în tigaie, adaugă uleiul și parmezanul. Totul e cântărit crud.', protein: ['Piept de pui, crud'], carb: ['Paste integrale crude'], fat: ['Ulei de măsline', 'Parmezan'], veg: ['Spanac crud', 'Roșii', 'Kale'] },
  { name: 'Skyr cu fructe și nuci', night: true, sweet: true, cook: 3, steps: 'Pune skyr-ul într-un bol, adaugă fructele, mierea și nucile.', protein: ['Skyr natur', 'Brânză cottage 1%'], carb: ['Miere', 'Banană', 'Mango'], fat: ['Nuci', 'Fistic', 'Migdale'], veg: ['Mure', 'Cireșe', 'Zmeură'] },
  // 2026-11-21, the coach: one more oily fish, so the week reaches two (omega-3)
  { name: 'Macrou cu cartofi și salată', sweet: false, cook: 25, heavy: true, steps: 'Coace macroul cu lămâie, fierbe cartofii, amestecă salata. Grăsimea vine din pește, așa că uleiul lipsește. Totul e cântărit crud.', protein: ['Macrou, crud', 'Hering, crud'], carb: ['Cartofi cruzi', 'Cartofi noi'], fat: [], veg: ['Salată verde', 'Varză', 'Roșii'] },
  { name: 'Linte roșie cu pui și legume', sweet: false, cook: 25, heavy: true, steps: 'Fierbe lintea roșie cu morcovii și ceapa, adaugă puiul gătit în tigaie și uleiul. Totul e cântărit crud.', protein: ['Piept de pui, crud', 'Pulpă de pui, crudă, fără piele'], carb: ['Linte roșie uscată', 'Fasole albă uscată'], fat: ['Ulei de măsline'], veg: ['Morcovi', 'Ceapă', 'Țelină apio'] },
];

export const PAIRS: Record<Role, string[]> = {
  protein: ['Piept de pui, crud', 'Pulpă de curcan, crudă', 'Pulpă de vită, crudă', 'Carne tocată de vită 95%, crudă', 'Pulpă de porc, crudă', 'Cotlet de porc, crud', 'Carne de vițel, crudă', 'Păstrăv, crud', 'Șalău, crud', 'Tilapia, crudă', 'Ton proaspăt, crud', 'Skyr natur', 'Brânză cottage 1%', 'Piept de curcan, crud', 'Pulpă de pui, crudă, fără piele', 'Somon crud', 'Cod, crud', 'Macrou, crud', 'Ton la conservă în apă', 'Carne tocată de vită 90%, crudă', 'Mușchi de vită, crud', 'Mușchi de porc, crud', 'Creveți cruzi', 'Tofu', 'Albuș de ou', 'Brânză de vaci', 'Iaurt grecesc degresat', 'Iaurt grecesc 2%', 'Whey (proteină din zer)'],
  carb: ['Hrișcă crudă', 'Bulgur crud', 'Mei crud', 'Orz perlat crud', 'Orez basmati crud', 'Paste integrale crude', 'Cartofi noi', 'Fasole albă uscată', 'Linte roșie uscată', 'Mango', 'Cireșe', 'Caise', 'Orez alb crud', 'Orez brun crud', 'Paste crude', 'Cartofi cruzi', 'Cartofi dulci cruzi', 'Quinoa crudă', 'Cuscus crud', 'Mălai crud', 'Pâine integrală', 'Pâine de secară', 'Lipie tortilla', 'Linte uscată', 'Năut uscat', 'Fasole boabe uscată', 'Fasole neagră uscată', 'Mazăre verde crudă', 'Porumb dulce', 'Ovăz fulgi, crud', 'Banană', 'Miere', 'Măr', 'Pară', 'Curmale', 'Stafide', 'Struguri'],
  fat: ['Fistic', 'Semințe de susan', 'Ulei de rapiță', 'Unt de migdale', 'Ulei de măsline', 'Avocado', 'Parmezan', 'Telemea tip feta', 'Semințe de dovleac', 'Semințe de floarea-soarelui', 'Semințe de in', 'Nuci', 'Migdale', 'Caju', 'Alune de pădure', 'Arahide', 'Unt de arahide', 'Semințe de chia'],
  veg: ['Sfeclă roșie', 'Rucola', 'Varză roșie', 'Varză de Bruxelles', 'Sparanghel', 'Kale', 'Praz', 'Țelină apio', 'Mure', 'Cireșe', 'Caise', 'Mandarine', 'Broccoli crud', 'Fasole verde', 'Roșii', 'Castraveți', 'Salată verde', 'Morcovi', 'Dovlecei', 'Ciuperci', 'Spanac crud', 'Conopidă', 'Ardei gras roșu', 'Varză', 'Vinete', 'Ceapă', 'Afine', 'Căpșuni', 'Zmeură', 'Banană', 'Măr', 'Pară', 'Piersică', 'Kiwi', 'Portocală', 'Ananas'],
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
  // to the gram: the plan is weighed raw on a kitchen scale, and 5 g of raw rice is 4 g of carbs
  const round = (g: number) => Math.round(g);
  if (prot) prot.g = Math.max(10, round(pG));
  if (carb) carb.g = round(cG);
  if (fat) fat.g = Math.max(0, Math.round(fG));
  return out.filter((i) => i.g > 0);
}

export const MEAL_TAGS = ['', 'Înainte de antrenament', 'După antrenament'];

/**
 * `how.slot` (coach.ts): before training the carb with the least fibre and one small portion of vegetables; at night
 * only slowly digested dairy as the protein; at the other savoury meals two vegetables, for fibre and fullness.
 * `how.prefer`: foods the week still needs (oily fish, red meat), taken when the template offers them.
 */
export function buildMeal(tpl: Template, target: { p: number; c: number; f: number }, byName: Map<string, Food>, db: Map<string, Food>, words: string[], seed: number, time: string, tag: string, how: { slot?: Slot; prefer?: string[] } = {}): Meal | null {
  const okOf = (list: string[]) => list.map((n) => byName.get(n)).filter((f): f is Food => !!f && allowed(f, words));
  const pick = (list: string[], off = 0) => {
    const ok = okOf(list);
    return ok.length ? ok[(seed + off) % ok.length]! : undefined;
  };
  const slot = how.slot ?? 'main';
  const liked = how.prefer ? okOf(tpl.protein).filter((f) => how.prefer!.includes(f.name)) : [];
  const slow = slot === 'night' ? okOf(tpl.protein).filter((f) => SLOW_PROTEIN.includes(f.name)) : [];
  const p = slow[seed % Math.max(1, slow.length)] ?? liked[seed % Math.max(1, liked.length)] ?? pick(tpl.protein);
  // fibre: the least before training, the most at the meals far from it (14 g per 1000 kcal over the day)
  const carbs = okOf(tpl.carb).sort((a, b) => a.fiber - b.fiber);
  const c = slot === 'pre' ? carbs[0] : carbs.at(-1), f = pick(tpl.fat);
  if (!p || !c) return null;
  // away from training the vegetables with the most fibre lead; before it, the gentlest
  const greens = okOf(tpl.veg).sort((a, b) => (slot === 'pre' ? a.fiber - b.fiber : b.fiber - a.fiber));
  const v1 = slot === 'pre' ? greens[0] : greens[seed % Math.min(2, greens.length || 1)], v2 = greens.find((g) => g.id !== v1?.id);
  const two = !tpl.sweet && slot !== 'pre' && v2 && v2.id !== v1?.id;
  const vegs = [v1, two ? v2 : undefined].filter((x): x is Food => !!x);
  const vegG = tpl.sweet ? 150 : slot === 'pre' ? 80 : 150;
  const items: Item[] = [{ foodId: p.id, role: 'protein', g: 0 }, { foodId: c.id, role: 'carb', g: 0 }];
  if (f) items.push({ foodId: f.id, role: 'fat', g: 0 });
  for (const v of vegs) items.push({ foodId: v.id, role: 'veg', g: vegG });
  return { id: crypto.randomUUID(), name: tpl.name, steps: tpl.steps, time, tag, done: false, items: solve(items, target, db) };
}

/** The most anyone would eat of one food in a meal, in grams. */
const CAP: Record<Role, number> = { protein: 350, carb: 450, fat: 45, veg: 400, extra: 200 };
const bulk = (items: Item[]) => items.reduce((s, i) => s + Math.max(0, i.g - CAP[i.role]), 0);
export const PRE_TAG = 'Înainte de antrenament';

/** `recent`: meals of the nearby days. They stay possible, but the day prefers others. */
type GenOpts = { avoid?: string[]; firstSweet?: boolean; fatShares?: number[]; recent?: string[]; focus?: Focus };

/**
 * Eight tries, scored by how far the day lands from its macros, in kcal, plus any portion nobody would eat.
 * Among those about as good as the best one, the seed chooses, so a new plan is both accurate and different.
 */
export function generateDay(day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, opts: GenOpts = {}): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const tries = Array.from({ length: 8 }, (_, k) => {
    const meals = polish(oneDay(day, carbShares, times, tags, foods, prefs, seed + k * 17, opts), day, db);
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

/**
 * The last word on precision (2026-11-15, the user: "asigură-te de precizia macronutrienților"). Whatever the day still
 * misses after each meal was sized (a fatty fish, rounding to the gram, a portion cap) is handed back to the meals,
 * the last one first: each is solved again for its own macros plus the gap, until the day lands within a gram or two.
 */
export function polish(meals: Meal[], day: { p: number; c: number; f: number }, db: Map<string, Food>): Meal[] {
  const out = meals.map((m) => ({ ...m, items: m.items.map((i) => ({ ...i })) }));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = out.length - 1; i >= 0; i--) {
      const got = macros(out.flatMap((m) => m.items), db);
      const gap = { p: day.p - got.p, c: day.c - got.c, f: day.f - got.f };
      if (Math.abs(gap.p) < 1 && Math.abs(gap.c) < 1.5 && Math.abs(gap.f) < 1) return out;
      const m = out[i]!;
      if (m.done || m.snack || m.keep) continue;
      const own = macros(m.items, db);
      const want = { p: Math.max(0, own.p + gap.p), c: Math.max(0, own.c + gap.c), f: Math.max(0, own.f + gap.f) };
      const next = solve(m.items, want, db);
      // a fix that needs an absurd portion is not a fix
      if (next.some((x) => x.g > CAP[x.role])) continue;
      out[i] = { ...m, items: next };
    }
  }
  return out;
}

/**
 * Targets per meal: protein evenly (the night meal ~35 g of slow dairy protein, the rest shared by the others), fat by its
 * share, carbs by training share. Before training only light templates; at night only the dairy ones; on a day the
 * week needs oily fish or red meat, the first ordinary meal that can, has it (coach.ts).
 */
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
  const slots = Array.from({ length: n }, (_, i) => slotOf(i, n, tags));
  const nightAt = slots.indexOf('night');
  const nightP = Math.min(NIGHT_PROTEIN, day.p / n);
  let focus: Focus = opts.focus ?? null;
  const wants = (t: Template) => (focus === 'fish' ? t.protein.some((x) => OILY_FISH.includes(x)) : focus === 'red' ? t.protein.some((x) => RED_MEAT.includes(x)) : false);
  for (let i = 0; i < n; i++) {
    const slot = slots[i]!;
    const first = i === 0 && firstSweet && sweet.length && slot !== 'night';
    let pool = (first ? sweet : savory.length ? savory : list).filter((t) => !(t.heavy && tags[i] === PRE_TAG));
    if (slot === 'pre') { const light = list.filter((t) => t.light); if (light.length) pool = light; }
    if (slot === 'night') { const night = list.filter((t) => t.night && t.protein.some((x) => SLOW_PROTEIN.includes(x) && byName.has(x) && allowed(byName.get(x)!, words))); if (night.length) pool = night; }
    if (focus && !first && (slot === 'main' || slot === 'post')) { const need = pool.filter(wants); if (need.length) pool = need; }
    // calcium every day: with no dairy meal at night (training late), the breakfast is the dairy one
    if (first && nightAt < 0) { const dairy = pool.filter((t) => t.protein.some((x) => SLOW_PROTEIN.includes(x))); if (dairy.length) pool = dairy; }
    let meal: Meal | null = null;
    let best = Infinity;
    const shareLeft = carbShares.slice(i).reduce((x, y) => x + y, 0) || 1;
    const fatLeft = fatShares.slice(i).reduce((x, y) => x + y, 0) || 1;
    const later = nightAt > i;
    const pGoal = slot === 'night' ? Math.min(nightP, left.p) : (left.p - (later ? nightP : 0)) / (n - i - (later ? 1 : 0));
    const goal = { p: pGoal, c: (left.c * carbShares[i]!) / shareLeft, f: (Math.max(0, left.f) * fatShares[i]!) / fatLeft };
    for (let k = 0; k < pool.length; k++) {
      const tpl = pool[(seed + i + k) % pool.length]!;
      if (avoid.includes(tpl.name) || meals.some((m) => m.name === tpl.name)) continue;
      const option = buildMeal(tpl, goal, byName, db, words, seed + i, times[i] ?? '', tags[i] ?? '', { slot, ...(focus ? { prefer: focus === 'fish' ? OILY_FISH : RED_MEAT } : {}) });
      if (!option) continue;
      const got = macros(option.items, db);
      // Variety first: a later template wins only if it clearly fits better.
      const miss = Math.abs(got.f - goal.f) * 9 + Math.abs(got.c - goal.c) * 4 + Math.abs(got.p - goal.p) * 4 + bulk(option.items) * 4 + (opts.recent?.filter((x) => x === tpl.name).length ?? 0) * 70;
      if (miss + 40 < best) { best = miss; meal = option; }
    }
    if (meal) {
      meals.push(meal);
      if (focus && meal.items.some((it) => (focus === 'fish' ? OILY_FISH : RED_MEAT).includes(db.get(it.foodId)?.name ?? ''))) focus = null;
      // What a food brings beyond its share (the fat in salmon) is taken back from the next meals.
      const got = macros(meal.items, db);
      left.p -= got.p; left.c -= got.c; left.f -= got.f;
    }
  }
  return meals;
}

/** Rebuilds a day around what was already eaten: logged meals stay exactly as they are, the rest share what is left. */
export function regenerate(existing: Meal[], day: { p: number; c: number; f: number }, carbShares: number[], times: string[], tags: string[], foods: Food[], prefs: Prefs, seed: number, fatShares?: number[], recent?: string[], focus?: Focus): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const kept = existing.filter((m) => m.done || m.snack || m.keep);
  const full = kept.filter((m) => !m.snack);
  const eaten = macros(kept.flatMap((m) => m.items), db);
  const free = times.map((_, i) => i).filter((i) => !full.some((m) => m.time === times[i]));
  const open = free.slice(-Math.max(0, times.length - full.length));
  if (!open.length) return kept;
  const left = { p: Math.max(0, day.p - eaten.p), c: Math.max(0, day.c - eaten.c), f: Math.max(0, day.f - eaten.f) };
  const fresh = generateDay(left, open.map((i) => carbShares[i]!), open.map((i) => times[i]!), open.map((i) => tags[i] ?? ''), foods, prefs, seed, { avoid: full.map((m) => m.name), firstSweet: open[0] === 0, ...(fatShares ? { fatShares: open.map((i) => fatShares[i]!) } : {}), ...(recent ? { recent } : {}), ...(focus ? { focus } : {}) });
  return [...kept, ...fresh].sort((a, b) => a.time.localeCompare(b.time));
}

/** Other meals for the same slot, sized to the same macros, best fit first. */
export function mealOptions(goal: { p: number; c: number; f: number }, foods: Food[], prefs: Prefs, time: string, tag: string, seed: number, current = ''): Meal[] {
  const db = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.filter((f) => f.name !== f.en).map((f) => [f.name, f]));
  const words = banned(prefs);
  const light = new Set(TEMPLATES.filter((t) => t.light).map((t) => t.name));
  return TEMPLATES.filter((t) => t.cook <= prefs.maxCook && t.name !== current && !(t.heavy && tag === PRE_TAG))
    .map((t) => buildMeal(t, goal, byName, db, words, seed, time, tag, { slot: tag === PRE_TAG ? 'pre' : 'main' }))
    .filter((m): m is Meal => !!m)
    // before training the light meals come first (coach.ts)
    .map((m) => { const g = macros(m.items, db); return { m, miss: Math.abs(g.f - goal.f) * 9 + Math.abs(g.c - goal.c) * 4 + Math.abs(g.p - goal.p) * 4 + bulk(m.items) * 4 + (tag === PRE_TAG && !light.has(m.name) ? 400 : 0) }; })
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
const SWEET = new Set(['Skyr natur', 'Brânză cottage 1%', 'Mango', 'Cireșe', 'Caise', 'Mure', 'Mandarine', 'Fistic', 'Unt de migdale', 'Ovăz fulgi, crud', 'Banană', 'Miere', 'Whey (proteină din zer)', 'Iaurt grecesc degresat', 'Iaurt grecesc 2%', 'Afine', 'Căpșuni', 'Zmeură', 'Nuci', 'Migdale', 'Semințe de chia',
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

