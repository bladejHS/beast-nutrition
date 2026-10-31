import type { Plan, Profile } from './calc.ts';
import type { CheckIn } from './review.ts';
import type { Food } from './foods.ts';
import { freshFasting, type FastState } from './fasting.ts';
import { DEFAULT_FACTORS, type Factors } from './carbs.ts';
import { DEFAULT_LIMITS, type Demand, type Limits } from './training.ts';
import { MICRO_KEYS, type Drink, type Measure, type MicroKey, type Supp, type SweatTest } from './wellness.ts';
import type { Meal, Prefs } from './mealplan.ts';
import type { Report } from './report.ts';

export interface Entry { id: string; name: string; g: number; kcal: number; p: number; c: number; f: number; fiber: number; m?: Partial<Record<MicroKey, number>> }

/** What a day's fuel target was, frozen once the day is over. */
export interface Snap { c: number; kcal: number; p: number; f: number; demand: Demand; reason: string }

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
}

const KEY = 'beast-nutrition:v2';
export const MEALS = ['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4', 'Masa 5'];
export const empty = (): State => ({ v: 1, profile: null, plan: null, days: {}, weights: {}, checkins: {}, custom: [], recent: [],
  fast: freshFasting(),
  fuel: { cycling: false, factors: { ...DEFAULT_FACTORS }, limits: { ...DEFAULT_LIMITS }, overrides: {}, snap: {}, sig: '', trainingHour: '17:00', prefs: { meals: 4, exclude: '', allergies: '', maxCook: 30, budget: 0 }, plan: {}, shopDone: [] },
  drinks: {}, sweat: [], waterMlKg: 35, remindMin: 0, supps: [], suppLog: {}, measures: [], reports: {} });

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) as Partial<State> } : empty();
  } catch {
    return empty();
  }
}

/** False when the browser refused to save. */
export function save(s: State): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function parseBackup(text: string): State {
  const data = JSON.parse(text) as Partial<State>;
  if (data.v !== 1 || typeof data.days !== 'object') throw new Error('Fișierul nu este un backup BEAST NUTRITION.');
  return { ...empty(), ...data };
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
