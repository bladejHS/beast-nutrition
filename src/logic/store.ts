import type { Plan, Profile } from './calc.ts';
import type { CheckIn } from './review.ts';
import type { Food } from './foods.ts';

export interface Entry { id: string; name: string; g: number; kcal: number; p: number; c: number; f: number; fiber: number }

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
}

const KEY = 'beast-nutrition:v2';
export const MEALS = ['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4'];
export const empty = (): State => ({ v: 1, profile: null, plan: null, days: {}, weights: {}, checkins: {}, custom: [], recent: [] });

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

export const dayMeals = (s: State, date: string): Entry[][] => s.days[date] ?? MEALS.map(() => []);

export function totals(meals: Entry[][]) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  for (const e of meals.flat()) {
    t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.fiber += e.fiber;
  }
  return t;
}

export function entryFrom(food: Pick<Food, 'name' | 'kcal' | 'p' | 'c' | 'f' | 'fiber'>, g: number): Entry {
  const k = g / 100;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return { id: crypto.randomUUID(), name: food.name, g, kcal: Math.round(food.kcal * k), p: r(food.p), c: r(food.c), f: r(food.f), fiber: r(food.fiber) };
}
