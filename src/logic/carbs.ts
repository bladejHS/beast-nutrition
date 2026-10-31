/* Carb cycling: moves carbohydrates between the days of one week. It is NOT from Fat Loss Forever.
   Calories, protein and fat come from calc.ts untouched; only the carbs change day to day, and the
   week's total carbs and calories stay equal to the plan. */
import { kcalFloor, targetFor, type DayTarget, type Plan, type Sex } from './calc.ts';
import { addDays } from './review.ts';
import type { Demand } from './training.ts';

export type Factors = Record<Demand, number>;
export const DEFAULT_FACTORS: Factors = { high: 1.25, moderate: 1, low: 0.85, rest: 0.75 };

export interface FuelDay extends DayTarget { date: string; demand: Demand; shift: number; fixed: boolean }

const MIN_CARBS = 50;

/**
 * `locked` holds the carbs already given to past days (their snapshots), which are never rewritten;
 * the rest of the week's carbs is shared among the remaining days by demand.
 */
export function weekFuel(plan: Plan, monday: string, demand: (date: string) => Demand, factors: Factors, sex: Sex, locked: Record<string, number> = {}): FuelDay[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const base = dates.map((d) => targetFor(plan, d));
  const open = dates.map((d, i) => (locked[d] == null ? i : -1)).filter((i) => i >= 0);
  const pool = base.reduce((s, t, i) => s + (locked[dates[i]!] != null ? t.c - locked[dates[i]!]! : 0), 0)
    + open.reduce((s, i) => s + base[i]!.c, 0);
  const weights = open.map((i) => base[i]!.c * factors[demand(dates[i]!)]);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const floor = (i: number) => Math.max(MIN_CARBS, Math.ceil((kcalFloor(sex) - base[i]!.p * 4 - base[i]!.f * 9) / 4));
  const carbs = new Map<number, number>();
  open.forEach((i, k) => carbs.set(i, Math.max(floor(i), (pool * weights[k]!) / total)));
  // Floors may overspend the pool: take the excess back from days above their floor, then fix rounding.
  let over = [...carbs.values()].reduce((a, b) => a + b, 0) - pool;
  for (const i of [...open].sort((a, b) => carbs.get(b)! - carbs.get(a)!)) {
    if (over <= 0) break;
    const room = carbs.get(i)! - floor(i);
    const cut = Math.min(room, over);
    carbs.set(i, carbs.get(i)! - cut);
    over -= cut;
  }
  open.forEach((i) => carbs.set(i, Math.round(carbs.get(i)!)));
  const biggest = [...open].sort((a, b) => carbs.get(b)! - carbs.get(a)!)[0];
  if (biggest != null) carbs.set(biggest, carbs.get(biggest)! + Math.round(pool) - [...carbs.values()].reduce((a, b) => a + b, 0));
  return dates.map((date, i) => {
    const t = base[i]!;
    const c = locked[date] ?? carbs.get(i)!;
    return { ...t, date, demand: demand(date), c, kcal: t.p * 4 + c * 4 + t.f * 9, shift: c - t.c, fixed: locked[date] != null };
  });
}

/** Weekly totals of the distribution against the protected plan. */
export function reconcile(plan: Plan, days: FuelDay[]) {
  const sum = (f: (t: { kcal: number; c: number; p: number; f: number }) => number, list: { kcal: number; c: number; p: number; f: number }[]) => list.reduce((s, t) => s + f(t), 0);
  const base = days.map((d) => targetFor(plan, d.date));
  return {
    kcalPlan: sum((t) => t.p * 4 + t.c * 4 + t.f * 9, base), kcalFuel: sum((t) => t.kcal, days),
    carbsPlan: sum((t) => t.c, base), carbsFuel: sum((t) => t.c, days),
    proteinSame: days.every((d, i) => d.p === base[i]!.p), fatSame: days.every((d, i) => d.f === base[i]!.f),
  };
}

/** Share of the day's carbs per meal: more around training on demanding days. Own rule. */
export function mealCarbShares(meals: number, trainingMeal: number | null, demand: Demand): number[] {
  const out = Array.from({ length: meals }, () => 1);
  if (trainingMeal != null && (demand === 'high' || demand === 'moderate')) {
    const extra = demand === 'high' ? 0.8 : 0.4;
    out[trainingMeal] = 1 + extra;
    if (trainingMeal + 1 < meals) out[trainingMeal + 1] = 1 + extra;
  }
  const total = out.reduce((a, b) => a + b, 0);
  return out.map((x) => x / total);
}
