/* Hydration, supplements, micronutrients and body measurements: everything here is arithmetic on saved data. */
import type { Sex } from './calc.ts';

// ---- Hydration ---------------------------------------------------------------
export interface Drink { id: string; time: string; ml: number; kind: string }
export interface SweatTest { id: string; date: string; pre: number; post: number; fluidL: number; urineL: number; hours: number; note: string }

export const sweatLoss = (t: Pick<SweatTest, 'pre' | 'post' | 'fluidL' | 'urineL'>) => t.pre - t.post + t.fluidL - t.urineL;
export function sweatRate(t: Pick<SweatTest, 'pre' | 'post' | 'fluidL' | 'urineL' | 'hours'>): number | null {
  if (!(t.hours > 0)) return null;
  const rate = sweatLoss(t) / t.hours;
  return rate >= 0 ? rate : null;
}
/** General guide of 35 ml/kg. Not from Fat Loss Forever, and adjustable in the app. */
export const waterTarget = (kg: number, mlPerKg = 35) => Math.round((kg * mlPerKg) / 50) * 50;

export function trainingFluid(minutes: number, tests: SweatTest[]) {
  const rates = tests.map(sweatRate).filter((r): r is number => r != null);
  if (!rates.length) return null;
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  return { rate: avg, litres: (avg * minutes) / 60 };
}

// ---- Supplements --------------------------------------------------------------
export interface Supp { id: string; product: string; brand: string; ingredient: string; serving: string; mgPerDay: number; time: string; freq: string; start: string; notes: string }

export interface StackIssue { level: 'info' | 'warn'; text: string }

const UPPER: Record<string, { mg: number; label: string }> = {
  cafeina: { mg: 400, label: 'EFSA consideră sigure până la 400 mg de cafeină pe zi la adulți' },
  magneziu: { mg: 250, label: 'EFSA stabilește 250 mg pe zi din suplimente' },
  'vitamina d': { mg: 0.1, label: 'EFSA stabilește o limită de 100 µg (4.000 UI) pe zi' },
};
const key = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function analyseStack(list: Supp[]): StackIssue[] {
  const out: StackIssue[] = [];
  const groups = new Map<string, Supp[]>();
  for (const x of list) groups.set(key(x.ingredient), [...(groups.get(key(x.ingredient)) ?? []), x]);
  for (const [name, items] of groups) {
    if (!name) continue;
    if (items.length > 1) out.push({ level: 'info', text: `${items[0]!.ingredient} apare în ${items.length} produse: ${items.map((i) => i.product).join(', ')}.` });
    const limit = UPPER[name];
    const total = items.reduce((s, i) => s + i.mgPerDay, 0);
    if (limit && total > limit.mg) out.push({ level: 'warn', text: `${items[0]!.ingredient}: ${total} mg pe zi. ${limit.label}.` });
  }
  const has = (n: string) => groups.has(n);
  if (has('omega-3') || has('omega 3')) out.push({ level: 'info', text: 'Omega-3 poate interacționa cu anticoagulantele. Întreabă medicul dacă iei astfel de tratament.' });
  return out;
}

// ---- Micronutrients -----------------------------------------------------------
/** Same order as MICROS in scripts/build-foods.mjs. */
export const MICRO_KEYS = ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b6', 'b12', 'folate', 'ca', 'mg', 'k', 'na', 'fe', 'zn', 'se', 'p'] as const;
export type MicroKey = (typeof MICRO_KEYS)[number] | 'iodine';

export interface MicroDef { key: MicroKey; name: string; unit: string; group: 'v' | 'm'; ref: (sex: Sex, age: number) => number; sources: string; limit?: boolean }

const by = (m: number, f: number) => (s: Sex) => (s === 'm' ? m : f);
/** Adult reference intakes (US National Academies RDA/AI, via NIH ODS). */
export const MICROS: MicroDef[] = [
  { key: 'vitA', name: 'Vitamina A', unit: 'µg', group: 'v', ref: by(900, 700), sources: 'ficat, ouă, morcovi, cartofi dulci' },
  { key: 'vitC', name: 'Vitamina C', unit: 'mg', group: 'v', ref: by(90, 75), sources: 'ardei, kiwi, citrice, broccoli' },
  { key: 'vitD', name: 'Vitamina D', unit: 'µg', group: 'v', ref: () => 15, sources: 'pește gras, ouă, lapte fortificat' },
  { key: 'vitE', name: 'Vitamina E', unit: 'mg', group: 'v', ref: () => 15, sources: 'migdale, semințe, uleiuri' },
  { key: 'vitK', name: 'Vitamina K', unit: 'µg', group: 'v', ref: by(120, 90), sources: 'spanac, varză, broccoli' },
  { key: 'b1', name: 'B1', unit: 'mg', group: 'v', ref: by(1.2, 1.1), sources: 'porc, cereale integrale, leguminoase' },
  { key: 'b2', name: 'B2', unit: 'mg', group: 'v', ref: by(1.3, 1.1), sources: 'lactate, ouă, carne' },
  { key: 'b3', name: 'B3', unit: 'mg', group: 'v', ref: by(16, 14), sources: 'pui, ton, arahide' },
  { key: 'b6', name: 'B6', unit: 'mg', group: 'v', ref: (s, a) => (a > 50 ? (s === 'm' ? 1.7 : 1.5) : 1.3), sources: 'pui, pește, cartofi, banane' },
  { key: 'b12', name: 'B12', unit: 'µg', group: 'v', ref: () => 2.4, sources: 'carne, pește, ouă, lactate' },
  { key: 'folate', name: 'Folat', unit: 'µg', group: 'v', ref: () => 400, sources: 'legume verzi, linte, năut' },
  { key: 'ca', name: 'Calciu', unit: 'mg', group: 'm', ref: (s, a) => (a > 70 || (s === 'f' && a > 50) ? 1200 : 1000), sources: 'lactate, tofu cu calciu, sardine' },
  { key: 'mg', name: 'Magneziu', unit: 'mg', group: 'm', ref: (s, a) => (s === 'm' ? (a > 30 ? 420 : 400) : (a > 30 ? 320 : 310)), sources: 'semințe, migdale, ovăz' },
  { key: 'k', name: 'Potasiu', unit: 'mg', group: 'm', ref: by(3400, 2600), sources: 'cartofi, fasole, banane' },
  { key: 'na', name: 'Sodiu', unit: 'mg', group: 'm', ref: () => 1500, sources: 'sare, alimente procesate', limit: true },
  { key: 'fe', name: 'Fier', unit: 'mg', group: 'm', ref: (s, a) => (s === 'f' && a <= 50 ? 18 : 8), sources: 'carne roșie, linte, spanac' },
  { key: 'zn', name: 'Zinc', unit: 'mg', group: 'm', ref: by(11, 8), sources: 'vită, semințe de dovleac' },
  { key: 'se', name: 'Seleniu', unit: 'µg', group: 'm', ref: () => 55, sources: 'ton, ouă, pui' },
  { key: 'iodine', name: 'Iod', unit: 'µg', group: 'm', ref: () => 150, sources: 'sare iodată, pește, lactate' },
  { key: 'p', name: 'Fosfor', unit: 'mg', group: 'm', ref: () => 700, sources: 'lactate, carne, leguminoase' },
];

export interface MicroEntry { kcal: number; m?: Partial<Record<MicroKey, number>> }

/** Sums known values; `coverage` is the share of calories with data, because missing data is not zero. */
export function microTotals(entries: MicroEntry[]) {
  const total: Partial<Record<MicroKey, number>> = {};
  const known: Partial<Record<MicroKey, number>> = {};
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  for (const e of entries) {
    for (const [k, v] of Object.entries(e.m ?? {}) as [MicroKey, number][]) {
      total[k] = (total[k] ?? 0) + v;
      known[k] = (known[k] ?? 0) + e.kcal;
    }
  }
  const coverage = (k: MicroKey) => (kcal ? (known[k] ?? 0) / kcal : 0);
  return { total, coverage, kcal };
}

// ---- Body ----------------------------------------------------------------------
export interface Measure { date: string; waist?: number; hips?: number; chest?: number; arm?: number; thigh?: number; bf?: number; height?: number }

/** Trailing 7-day mean for each weigh-in. */
export function movingAverage(weights: Record<string, number>): [string, number][] {
  const days = Object.keys(weights).sort();
  return days.map((d) => {
    const from = new Date(Date.parse(`${d}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
    const win = days.filter((x) => x >= from && x <= d).map((x) => weights[x]!);
    return [d, win.reduce((a, b) => a + b, 0) / win.length];
  });
}

export function monthly(weights: Record<string, number>): { month: string; avg: number }[] {
  const map = new Map<string, number[]>();
  for (const [d, v] of Object.entries(weights)) map.set(d.slice(0, 7), [...(map.get(d.slice(0, 7)) ?? []), v]);
  return [...map.entries()].sort().map(([month, l]) => ({ month, avg: l.reduce((a, b) => a + b, 0) / l.length }));
}

export const fatMass = (kg: number, bf: number) => ({ fat: (kg * bf) / 100, lean: kg * (1 - bf / 100) });
