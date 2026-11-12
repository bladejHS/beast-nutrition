import type { Plan, Profile } from './calc.ts';
import type { CheckIn } from './review.ts';
import type { Food } from './foods.ts';
import { freshFasting, type FastState } from './fasting.ts';
import { DEFAULT_FACTORS, type Factors } from './carbs.ts';
import { DEFAULT_LIMITS, DEFAULT_WEIGHTS, type Demand, type Limits, type Session, type Weights } from './training.ts';
import type { Feedback } from './insights.ts';
import type { Tolerance } from './timing.ts';
import { MICRO_KEYS, type Drink, type Measure, type MicroKey, type Supp, type SweatTest } from './wellness.ts';
import type { Meal, Prefs } from './mealplan.ts';
import type { Report } from './report.ts';

export interface Entry {
  id: string; name: string; g: number; kcal: number; p: number; c: number; f: number; fiber: number; m?: Partial<Record<MicroKey, number>>;
  /** The planned meal this came from, so changing that meal changes what was logged. */
  from?: string;
}

/** What a day's fuel target was, frozen once the day is over. `b`: the plan's carbs that day, missing on older snapshots. `planned`: the class before training happened. */
export interface Snap { c: number; kcal: number; p: number; f: number; b?: number; demand: Demand; planned?: Demand; load?: number; reason: string }

export interface Fuel {
  cycling: boolean;
  factors: Factors;
  limits: Limits;
  overrides: Record<string, Demand>;
  snap: Record<string, Snap>;
  /** Signature of the week's demand, to notice schedule changes. */
  sig: string;
  trainingHour: string;
  prefs: Prefs;
  plan: Record<string, Meal[]>;
  shopDone: string[];
  /** Pack sizes the user corrected on the shopping list, by the item's name (src/logic/shop.ts). */
  packs: Record<string, number>;
  /** 'manual': only the classes the user sets. */
  mode: 'auto' | 'manual';
  /** Off: keeps using `syncedWeek`, the last plan read from Inner Beast. */
  sync: boolean;
  syncedWeek: Session[][] | null;
  /** Above 1 the same training rates higher. */
  sensitivity: number;
  weights: Weights;
  boxStrength: boolean;
  /** Monday = 0 → training time, when it differs from `trainingHour`. */
  times: Record<number, string>;
  /** Minutes between the pre-workout meal and training; 0 = from the tolerance. */
  preGap: number;
  tolerance: Tolerance;
  intra: boolean;
  /** An easy day before a HIGH day gets a moderate share of the carbs. */
  prefuel: boolean;
  /** date → sessions the user cancelled. */
  cancelled: Record<string, string[]>;
  feedback: Record<string, Feedback>;
}

export interface State {
  v: 1;
  profile: Profile | null;
  plan: Plan | null;
  /** date → 4 meals. */
  days: Record<string, Entry[][]>;
  weights: Record<string, number>;
  /** Monday of the week → check-in. */
  checkins: Record<string, CheckIn>;
  custom: Food[];
  recent: Food[];
  fast: FastState;
  fuel: Fuel;
  drinks: Record<string, Drink[]>;
  sweat: SweatTest[];
  waterMlKg: number;
  remindMin: number;
  supps: Supp[];
  suppLog: Record<string, string[]>;
  measures: Measure[];
  reports: Record<string, Report>;
  /** Date of the last backup downloaded. */
  backedUp: string;
}

const KEY = 'beast-nutrition:v2';
export const MEALS = ['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4', 'Masa 5'];
export const empty = (): State => ({ v: 1, profile: null, plan: null, days: {}, weights: {}, checkins: {}, custom: [], recent: [],
  fast: freshFasting(),
  fuel: { cycling: false, factors: { ...DEFAULT_FACTORS }, limits: { ...DEFAULT_LIMITS }, overrides: {}, snap: {}, sig: '', trainingHour: '17:00', prefs: { meals: 4, exclude: '', allergies: '', maxCook: 30, budget: 0 }, plan: {}, shopDone: [], packs: {},
    mode: 'auto', sync: true, syncedWeek: null, sensitivity: 1, weights: { ...DEFAULT_WEIGHTS }, boxStrength: true, times: {}, preGap: 0, tolerance: 'normal', intra: true, prefuel: true, cancelled: {}, feedback: {} },
  drinks: {}, sweat: [], waterMlKg: 35, remindMin: 0, supps: [], suppLog: {}, measures: [], reports: {}, backedUp: '' });

/** Saved states from older versions get the fields added since. */
function withDefaults(d: Partial<State>): State {
  const base = empty();
  return { ...base, ...d, fuel: { ...base.fuel, ...d.fuel } };
}

export function load(): State {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw) as Partial<State>) : empty();
  } catch {
    // A damaged save is kept aside, so the empty state that follows cannot overwrite it.
    try { if (raw) localStorage.setItem(`${KEY}:damaged`, raw); } catch { /* storage refused: nothing more can be done */ }
    return empty();
  }
}

/** True when a damaged save was set aside. */
export const hasDamagedSave = () => { try { return localStorage.getItem(`${KEY}:damaged`) != null; } catch { return false; } };

/** False when the browser refused to save. */
export function save(s: State): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Refuses a file that would leave the app unusable, before it replaces anything. */
export function parseBackup(text: string): State {
  let data: Partial<State>;
  try { data = JSON.parse(text) as Partial<State>; } catch { throw new Error('Fișierul nu este un backup BEAST NUTRITION.'); }
  if (data?.v !== 1 || typeof data.days !== 'object' || data.days === null) throw new Error('Fișierul nu este un backup BEAST NUTRITION.');
  const macros = data.plan?.macros, who = data.profile;
  if (data.plan != null && !(macros && macros.kcal > 0 && macros.p > 0)) throw new Error('Backup-ul nu are un plan valid.');
  if (who != null && !(who.age > 0 && who.weightKg > 0 && who.bf > 0)) throw new Error('Backup-ul nu are un profil valid.');
  return withDefaults(data);
}

export const dayMeals = (s: State, date: string): Entry[][] => MEALS.map((_, i) => s.days[date]?.[i] ?? []);

export function totals(meals: Entry[][]) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  for (const e of meals.flat()) {
    t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.fiber += e.fiber;
  }
  return t;
}

export function entryFrom(food: Pick<Food, 'name' | 'kcal' | 'p' | 'c' | 'f' | 'fiber'> & { micro?: (number | null)[] }, g: number): Entry {
  const k = g / 100;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  const m: Entry['m'] = {};
  food.micro?.forEach((v, i) => { if (v != null) m[MICRO_KEYS[i]!] = Math.round(v * k * 100) / 100; });
  return { id: crypto.randomUUID(), name: food.name, g, kcal: Math.round(food.kcal * k), p: r(food.p), c: r(food.c), f: r(food.f), fiber: r(food.fiber), ...(food.micro ? { m } : {}) };
}

/**
 * Swaps what a planned meal logged for `next` (empty = takes it out of the log), staying in the same meal slot.
 * Null when that meal was logged without a link, so nothing can be replaced safely.
 */
export function relog(days: Entry[][], mealId: string, next: Entry[], fallbackSlot: number, wasLogged: boolean): Entry[][] | null {
  const slot = days.findIndex((d) => d.some((e) => e.from === mealId));
  if (slot < 0 && wasLogged) return null;
  const at = slot >= 0 ? slot : fallbackSlot;
  return days.map((d, i) => { const kept = d.filter((e) => e.from !== mealId); return i === at ? [...kept, ...next.map((e) => ({ ...e, from: mealId }))] : kept; });
}
