/* The shopping list as you buy it (2026-11-11, the user shops at Lidl, Kaufland and Profi): the plan's grams are for
   cooked food, the shelf sells raw, and in packs. Each food says what goes in the basket, how much raw makes one gram
   of the plan (cooked rice weighs about three times the raw), and the usual pack on Romanian shelves. Pack sizes differ
   between brands and shops, so the user can correct any one, and that stays saved (Fuel.packs). Meals already eaten
   and days already gone are left out by the caller. */
import type { Food } from './foods.ts';
import type { Meal } from './mealplan.ts';

export const AISLES = ['Carne și pește', 'Lactate și ouă', 'Legume și fructe', 'Pâine, cereale și paste', 'Leguminoase și conserve', 'Uleiuri, nuci și semințe', 'Altele'] as const;
export type Aisle = (typeof AISLES)[number];
export type Unit = 'g' | 'ml' | 'buc';

export interface Buy {
  /** What goes in the basket. */
  name: string;
  aisle: Aisle;
  /** Grams (or ml) bought for one gram of the plan. */
  ratio: number;
  /** One piece, in grams of the plan, when it is bought by the piece (eggs, bananas, cans). */
  each?: number;
  /** Pack size in the unit; 0 = loose, bought by weight. */
  pack: number;
  unit: Unit;
  /** How the pack looks on the shelf. */
  label: string;
}

const g = (name: string, aisle: Aisle, ratio: number, pack: number, label: string): Buy => ({ name, aisle, ratio, pack, unit: 'g', label });
const pcs = (name: string, aisle: Aisle, each: number, pack: number, label: string): Buy => ({ name, aisle, ratio: 1, each, pack, unit: 'buc', label });
const loose = (name: string, aisle: Aisle, ratio: number): Buy => ({ name, aisle, ratio, pack: 0, unit: 'g', label: 'la kilogram' });
const MEAT = 'Carne și pește', DAIRY = 'Lactate și ouă', VEG = 'Legume și fructe', GRAIN = 'Pâine, cereale și paste', CAN = 'Leguminoase și conserve', FAT = 'Uleiuri, nuci și semințe', OTHER = 'Altele';

/** Cooked meat loses about a quarter of its weight; rice, pasta and dry pulses take up two to three times theirs in water. */
export const BUY: Record<string, Buy> = {
  'Piept de pui, gătit': g('Piept de pui, crud', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Piept de pui, crud': g('Piept de pui, crud', MEAT, 1, 500, 'caserolă 500 g'),
  'Pulpă de pui, gătită, fără piele': g('Pulpe de pui dezosate, crude', MEAT, 1.4, 500, 'caserolă 500 g'),
  'Piept de curcan, gătit': g('Piept de curcan, crud', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Carne tocată de vită 90%, gătită': g('Carne tocată de vită, crudă', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Carne tocată de vită 80%, gătită': g('Carne tocată de vită, crudă', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Mușchi de vită, gătit': g('Mușchi de vită, crud', MEAT, 1.35, 500, 'caserolă 500 g'),
  'Mușchi de porc, gătit': g('Mușchi de porc, crud', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Cotlet de porc, gătit': g('Cotlet de porc, crud', MEAT, 1.33, 500, 'caserolă 500 g'),
  'Somon gătit': g('File de somon, crud', MEAT, 1.25, 250, 'pachet 2 × 125 g'),
  'Somon crud': g('File de somon, crud', MEAT, 1, 250, 'pachet 2 × 125 g'),
  'Cod gătit': g('File de cod, congelat', MEAT, 1.25, 400, 'pungă congelată 400 g'),
  'Macrou gătit': g('Macrou, crud', MEAT, 1.25, 300, 'caserolă 300 g'),
  'Creveți gătiți': g('Creveți fierți, congelați', MEAT, 1, 250, 'pungă congelată 250 g'),
  'Ton la conservă în apă': pcs('Ton în apă, conservă', CAN, 112, 1, 'conservă 160 g, 112 g scurs'),
  'Sardine în ulei': pcs('Sardine în ulei, conservă', CAN, 90, 1, 'conservă 125 g, 90 g scurs'),
  'Albuș de ou': pcs('Ouă', DAIRY, 33, 10, 'cofraj de 10'),
  'Ou întreg, crud': pcs('Ouă', DAIRY, 50, 10, 'cofraj de 10'),
  'Ou fiert': pcs('Ouă', DAIRY, 50, 10, 'cofraj de 10'),
  'Ou ochi': pcs('Ouă', DAIRY, 46, 10, 'cofraj de 10'),
  'Iaurt grecesc degresat': g('Iaurt grecesc 0%', DAIRY, 1, 400, 'cutie 400 g'),
  'Iaurt grecesc 2%': g('Iaurt grecesc 2%', DAIRY, 1, 400, 'cutie 400 g'),
  'Iaurt natural': g('Iaurt natural', DAIRY, 1, 400, 'cutie 400 g'),
  'Brânză de vaci': g('Brânză de vaci', DAIRY, 1, 500, 'caserolă 500 g'),
  'Mozzarella': g('Mozzarella', DAIRY, 1, 125, 'pungă 125 g'),
  'Parmezan': g('Parmezan', DAIRY, 1, 100, 'bucată 100 g'),
  'Telemea tip feta': g('Telemea', DAIRY, 1, 250, 'caserolă 250 g'),
  'Cașcaval tip cheddar': g('Cașcaval', DAIRY, 1, 300, 'bucată 300 g'),
  'Lapte integral 3,25%': { name: 'Lapte 3,5%', aisle: DAIRY, ratio: 0.97, pack: 1000, unit: 'ml', label: 'cutie 1 L' },
  'Lapte 2%': { name: 'Lapte 1,5%', aisle: DAIRY, ratio: 0.97, pack: 1000, unit: 'ml', label: 'cutie 1 L' },
  'Lapte degresat': { name: 'Lapte 0,1%', aisle: DAIRY, ratio: 0.97, pack: 1000, unit: 'ml', label: 'cutie 1 L' },
  'Whey (proteină din zer)': g('Proteină whey', OTHER, 1, 1000, 'pungă 1 kg'),
  'Ovăz fulgi, crud': g('Fulgi de ovăz', GRAIN, 1, 500, 'pungă 500 g'),
  'Orez alb fiert': g('Orez alb', GRAIN, 0.35, 1000, 'pungă 1 kg'),
  'Orez alb crud': g('Orez alb', GRAIN, 1, 1000, 'pungă 1 kg'),
  'Orez brun fiert': g('Orez brun', GRAIN, 0.4, 1000, 'pungă 1 kg'),
  'Paste fierte': g('Paste', GRAIN, 0.42, 500, 'pungă 500 g'),
  'Paste crude': g('Paste', GRAIN, 1, 500, 'pungă 500 g'),
  'Quinoa fiartă': g('Quinoa', GRAIN, 0.37, 500, 'pungă 500 g'),
  'Cuscus fiert': g('Cuscus', GRAIN, 0.4, 500, 'pungă 500 g'),
  'Mălai crud': g('Mălai', GRAIN, 1, 1000, 'pungă 1 kg'),
  'Pâine integrală': g('Pâine integrală', GRAIN, 1, 500, 'pâine 500 g'),
  'Pâine albă': g('Pâine albă', GRAIN, 1, 500, 'pâine 500 g'),
  'Pâine de secară': g('Pâine de secară', GRAIN, 1, 500, 'pâine 500 g'),
  'Lipie tortilla': g('Lipii tortilla', GRAIN, 1, 370, 'pachet 6 bucăți, 370 g'),
  'Linte fiartă': g('Linte uscată', CAN, 0.4, 500, 'pungă 500 g'),
  'Năut fiert': pcs('Năut, conservă', CAN, 240, 1, 'conservă 400 g, 240 g scurs'),
  'Fasole boabe fiartă': pcs('Fasole boabe, conservă', CAN, 240, 1, 'conservă 400 g, 240 g scurs'),
  'Fasole neagră fiartă': pcs('Fasole neagră, conservă', CAN, 240, 1, 'conservă 400 g, 240 g scurs'),
  'Porumb dulce': pcs('Porumb dulce, conservă', CAN, 285, 1, 'conservă 340 g, 285 g scurs'),
  'Mazăre verde fiartă': g('Mazăre congelată', VEG, 1, 450, 'pungă congelată 450 g'),
  'Fasole verde': g('Fasole verde congelată', VEG, 1, 450, 'pungă congelată 450 g'),
  'Tofu': g('Tofu', OTHER, 1, 200, 'pachet 200 g'),
  'Cartofi fierți': g('Cartofi', VEG, 1.15, 2000, 'sac 2 kg'),
  'Cartofi la cuptor': g('Cartofi', VEG, 1.25, 2000, 'sac 2 kg'),
  'Cartofi dulci la cuptor': loose('Cartofi dulci', VEG, 1.25),
  'Broccoli fiert': loose('Broccoli', VEG, 1.4),
  'Broccoli crud': loose('Broccoli', VEG, 1.4),
  'Conopidă': loose('Conopidă', VEG, 1.5),
  'Spanac crud': g('Spanac baby', VEG, 1, 125, 'caserolă 125 g'),
  'Salată verde': pcs('Salată verde', VEG, 200, 1, 'căpățână'),
  'Roșii': loose('Roșii', VEG, 1.05),
  'Castraveți': loose('Castraveți', VEG, 1.05),
  'Ardei gras roșu': loose('Ardei gras roșu', VEG, 1.15),
  'Ceapă': loose('Ceapă', VEG, 1.1),
  'Morcovi': loose('Morcovi', VEG, 1.15),
  'Dovlecei': loose('Dovlecei', VEG, 1.05),
  'Vinete': loose('Vinete', VEG, 1.1),
  'Varză': loose('Varză', VEG, 1.2),
  'Ciuperci': g('Ciuperci', VEG, 1.05, 500, 'caserolă 500 g'),
  'Banană': pcs('Banane', VEG, 118, 1, 'bucată'),
  'Măr': pcs('Mere', VEG, 170, 1, 'bucată'),
  'Pară': pcs('Pere', VEG, 165, 1, 'bucată'),
  'Portocală': pcs('Portocale', VEG, 130, 1, 'bucată'),
  'Kiwi': pcs('Kiwi', VEG, 70, 1, 'bucată'),
  'Piersică': pcs('Piersici', VEG, 140, 1, 'bucată'),
  'Avocado': pcs('Avocado', VEG, 136, 1, 'bucată'),
  'Afine': g('Afine', VEG, 1, 125, 'caserolă 125 g'),
  'Zmeură': g('Zmeură', VEG, 1, 125, 'caserolă 125 g'),
  'Căpșuni': g('Căpșuni', VEG, 1.05, 500, 'caserolă 500 g'),
  'Struguri': loose('Struguri', VEG, 1.05),
  'Prună': loose('Prune', VEG, 1.1),
  'Ananas': loose('Ananas', VEG, 1.9),
  'Curmale': g('Curmale', VEG, 1, 200, 'pungă 200 g'),
  'Stafide': g('Stafide', VEG, 1, 200, 'pungă 200 g'),
  'Ulei de măsline': { name: 'Ulei de măsline', aisle: FAT, ratio: 1 / 0.91, pack: 750, unit: 'ml', label: 'sticlă 750 ml' },
  'Ulei de floarea-soarelui': { name: 'Ulei de floarea-soarelui', aisle: FAT, ratio: 1 / 0.92, pack: 1000, unit: 'ml', label: 'sticlă 1 L' },
  'Nuci': g('Miez de nucă', FAT, 1, 200, 'pungă 200 g'),
  'Migdale': g('Migdale', FAT, 1, 200, 'pungă 200 g'),
  'Caju': g('Caju', FAT, 1, 200, 'pungă 200 g'),
  'Alune de pădure': g('Alune de pădure', FAT, 1, 200, 'pungă 200 g'),
  'Arahide': g('Arahide', FAT, 1, 200, 'pungă 200 g'),
  'Unt de arahide': g('Unt de arahide', FAT, 1, 350, 'borcan 350 g'),
  'Semințe de chia': g('Semințe de chia', FAT, 1, 200, 'pungă 200 g'),
  'Semințe de in': g('Semințe de in', FAT, 1, 250, 'pungă 250 g'),
  'Semințe de dovleac': g('Semințe de dovleac', FAT, 1, 150, 'pungă 150 g'),
  'Semințe de floarea-soarelui': g('Semințe de floarea-soarelui', FAT, 1, 200, 'pungă 200 g'),
  'Miere': g('Miere', OTHER, 1, 500, 'borcan 500 g'),
  'Ciocolată neagră 70–85%': g('Ciocolată neagră', OTHER, 1, 100, 'tabletă 100 g'),
};

/** Plan foods weighed after cooking: the shelf sells them raw (or dry). */
const COOKED = /gătit|gătită|fiert|fiartă|fierți|fierte|la cuptor/i;

export interface ShopItem {
  key: string;
  name: string;
  aisle: Aisle;
  unit: Unit;
  /** What the plan needs, raw, in the unit (pieces already rounded up). */
  need: number;
  /** Plan grams it comes from, for the line under the name. */
  planG: number;
  cooked: boolean;
  /** Pack size in the unit, the user's when set; 0 = loose. */
  pack: number;
  packs: number;
  label: string;
  /** The food has no entry in BUY: the amount is the plan's, the pack unknown. */
  guess: boolean;
}

/** How a food is bought: the table, the user's own food with its pack, or the plan's grams as they are. */
export function buyOf(f: Food): { buy: Buy; guess: boolean } {
  const b = BUY[f.name];
  if (b) return { buy: b, guess: false };
  if (f.source === 'mine') return { buy: { name: f.name, aisle: OTHER, ratio: 1, pack: f.pack ?? 0, unit: 'g', label: f.pack ? `pachet ${f.pack} g` : 'gramajul de pe ambalaj' }, guess: !f.pack };
  return { buy: { name: f.name, aisle: OTHER, ratio: 1, pack: 0, unit: 'g', label: '' }, guess: true };
}

export function shopList(days: Meal[][], db: Map<string, Food>, packs: Record<string, number> = {}): ShopItem[] {
  const acc = new Map<string, { buy: Buy; amount: number; planG: number; cooked: boolean; guess: boolean }>();
  for (const m of days.flat()) {
    if (m.done) continue;
    for (const it of m.items) {
      const f = db.get(it.foodId);
      if (!f || it.g <= 0) continue;
      const { buy, guess } = buyOf(f);
      const amount = buy.unit === 'buc' ? it.g / (buy.each ?? 100) : it.g * buy.ratio;
      const cur = acc.get(buy.name) ?? { buy, amount: 0, planG: 0, cooked: false, guess };
      cur.amount += amount;
      cur.planG += it.g;
      cur.cooked ||= buy.unit !== 'buc' && COOKED.test(f.name) && Math.abs(buy.ratio - 1) > 0.05;
      cur.guess &&= guess;
      acc.set(buy.name, cur);
    }
  }
  const order = (a: Aisle) => AISLES.indexOf(a);
  return [...acc.entries()].map(([key, x]) => {
    const pack = packs[key] ?? x.buy.pack;
    // pieces are whole; loose food is weighed, so it rounds up to 50 g
    const need = x.buy.unit === 'buc' ? Math.ceil(x.amount - 1e-6) : pack ? Math.ceil(x.amount) : Math.ceil(x.amount / 50) * 50;
    const count = pack ? Math.ceil(need / pack - 1e-6) : 0;
    const label = packs[key] && packs[key] !== x.buy.pack ? (x.buy.unit === 'buc' ? `pachet de ${pack}` : `pachet ${pack} ${x.buy.unit}`) : x.buy.label;
    return { key, name: x.buy.name, aisle: x.buy.aisle, unit: x.buy.unit, need, planG: Math.round(x.planG), cooked: x.cooked, pack, packs: count, label, guess: x.guess };
  }).sort((a, b) => order(a.aisle) - order(b.aisle) || a.name.localeCompare(b.name, 'ro'));
}

const fmt = (v: number, unit: Unit) => (unit === 'buc' ? `${v}` : v >= 1000 ? `${(v / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${unit === 'ml' ? 'L' : 'kg'}` : `${v} ${unit}`);

/** "2 × caserolă 500 g", "1 cofraj de 10", "≈ 950 g, la kilogram". */
export function shopLine(x: ShopItem): { buy: string; qty: string; what: string; note: string } {
  const qty = x.unit === 'buc' ? `${x.pack > 1 ? x.packs : x.need} ×` : x.pack ? `${x.packs} ×` : `≈ ${fmt(x.need, x.unit)}`;
  const what = x.unit === 'buc' || x.pack ? x.label : 'la kilogram';
  const buy = x.unit !== 'buc' && !x.pack ? `${qty}, ${what}` : `${qty} ${what}`;
  const need = x.unit === 'buc' ? `ai nevoie de ${x.need} ${x.name === 'Ouă' ? (x.need === 1 ? 'ou' : 'ouă') : x.need === 1 ? 'bucată' : 'bucăți'}` : `ai nevoie de ${fmt(x.need, x.unit)}${x.cooked ? ` ${x.aisle === 'Pâine, cereale și paste' || x.aisle === 'Leguminoase și conserve' ? 'uscat' : 'crud'} (${fmt(x.planG, 'g')} gătit în plan)` : ''}`;
  return { buy, qty, what, note: x.guess ? `${need}; verifică gramajul pe raft` : need };
}
