/* Carb cycling: moves carbohydrates between the days of one week. It is NOT from Fat Loss Forever.
   Calories, protein and fat come from calc.ts untouched; only the carbs change day to day, and the
   week's total carbs and calories stay equal to the plan, as long as no day has to leave its band. */
import { kcalFloor, targetFor, type DayTarget, type Macros, type Plan, type Sex } from './calc.ts';
import { addDays } from './review.ts';
import type { Demand } from './training.ts';

export type Factors = Record<Demand, number>;
export const DEFAULT_FACTORS: Factors = { high: 1.25, moderate: 1, low: 0.85, rest: 0.75 };

/** `planC`: the carbs the plan gave that day, when it was decided. `prefuel`: an easy day lifted because a hard one follows. */
export interface FuelDay extends DayTarget { date: string; demand: Demand; shift: number; planC: number; fixed: boolean; prefuel: boolean }

/** A finished day: what it got, and what the plan in force then would have given it. */
export interface Frozen { c: number; base: number; p?: number; f?: number }

const MIN_CARBS = 50;

/** Carbs that make the macros add up to the calories: calc.ts rounds each macro to 5 g, which alone can miss by 30 kcal a day. */
export const exactCarbs = (m: Macros) => Math.max(0, Math.round((m.kcal - m.p * 4 - m.f * 9) / 4));

const fibre = (kcal: number) => ({ fiberMin: Math.round(kcal / 100), fiberMax: Math.round((kcal / 1000) * 15) });

/** One day of the plan, with macros that add up exactly. Only the carbs move, by a few grams; protein and fat stay. */
export function dayTarget(plan: Plan, date: string): DayTarget {
  const t = targetFor(plan, date);
  const c = exactCarbs(t);
  const kcal = t.p * 4 + c * 4 + t.f * 9;
  return { ...t, c, kcal, ...fibre(kcal) };
}

/** How far a day's carbs may move from the plan, as multiples of it: the factors, plus a margin for evening out the week. */
export function dayBand(factors: Factors): { lo: number; hi: number } {
  const v = Object.values(factors);
  return { lo: Math.min(...v) * 0.85, hi: Math.max(...v) * 1.15 };
}

/** Shares `pool` by weight inside each day's limits. What fits nowhere stays unplaced, it never lands on one day. */
function share(pool: number, ids: number[], weight: (i: number) => number, lo: (i: number) => number, hi: (i: number) => number): Map<number, number> {
  const out = new Map<number, number>();
  let left = pool;
  let todo = [...ids];
  while (todo.length) {
    const total = todo.reduce((s, i) => s + weight(i), 0) || 1;
    const value = (i: number) => (left * weight(i)) / total;
    const stuck = todo.filter((i) => value(i) < lo(i) || value(i) > hi(i));
    if (!stuck.length) {
      for (const i of todo) out.set(i, value(i));
      break;
    }
    for (const i of stuck) out.set(i, value(i) < lo(i) ? lo(i) : hi(i));
    left -= stuck.reduce((s, i) => s + out.get(i)!, 0);
    todo = todo.filter((i) => !stuck.includes(i));
  }
  let rest = pool - [...out.values()].reduce((a, b) => a + b, 0);
  for (const i of ids) {
    const room = rest > 0 ? hi(i) - out.get(i)! : lo(i) - out.get(i)!;
    const move = rest > 0 ? Math.min(rest, room) : Math.max(rest, room);
    out.set(i, out.get(i)! + move);
    rest -= move;
  }
  return out;
}

/**
 * `locked` holds the days already over, which are never rewritten. Only what they moved away from their plan is
 * made up for by the days left: a plan edited mid-week changes those days, it is not paid back by the last one.
 */
export function weekFuel(plan: Plan, monday: string, demand: (date: string) => Demand, factors: Factors, sex: Sex, locked: Record<string, Frozen> = {}, prefuel: (date: string) => boolean = () => false): FuelDay[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const base = dates.map((d) => dayTarget(plan, d));
  const open = dates.map((d, i) => (locked[d] ? -1 : i)).filter((i) => i >= 0);
  const moved = dates.reduce((s, d) => s + (locked[d] ? locked[d].c - locked[d].base : 0), 0);
  const pool = open.reduce((s, i) => s + base[i]!.c, 0) - moved;
  const band = dayBand(factors);
  const lo = (i: number) => Math.max(MIN_CARBS, Math.ceil((kcalFloor(sex) - base[i]!.p * 4 - base[i]!.f * 9) / 4), Math.min(base[i]!.c, base[i]!.c * band.lo));
  const hi = (i: number) => Math.max(lo(i), base[i]!.c, base[i]!.c * band.hi);
  // The day before a hard session is not the place for the fewest carbs: an easy day then counts as moderate.
  const lifted = (d: string) => (demand(d) === 'low' || demand(d) === 'rest') && prefuel(d);
  const factor = (d: string) => (lifted(d) ? Math.max(factors[demand(d)], factors.moderate) : factors[demand(d)]);
  const carbs = share(pool, open, (i) => base[i]!.c * factor(dates[i]!), lo, hi);
  open.forEach((i) => carbs.set(i, Math.round(carbs.get(i)!)));
  // Rounding only: whole grams up to the total, on days that still have room.
  const sum = (f: (i: number) => number) => open.reduce((s, i) => s + f(i), 0);
  let diff = Math.min(Math.max(Math.round(pool), Math.ceil(sum(lo))), Math.floor(sum(hi))) - sum((i) => carbs.get(i)!);
  const order = [...open].sort((a, b) => carbs.get(b)! - carbs.get(a)!);
  for (let n = 0; diff !== 0 && n < order.length * 6; n++) {
    const i = order[n % order.length]!;
    const next = carbs.get(i)! + Math.sign(diff);
    if (next < lo(i) || next > hi(i)) continue;
    carbs.set(i, next);
    diff -= Math.sign(diff);
  }
  return dates.map((date, i) => {
    const t = base[i]!;
    const l = locked[date];
    if (l) {
      const p = l.p ?? t.p, f = l.f ?? t.f;
      const kcal = p * 4 + l.c * 4 + f * 9;
      return { ...t, ...fibre(kcal), date, demand: demand(date), c: l.c, p, f, kcal, shift: l.c - l.base, planC: l.base, fixed: true, prefuel: false };
    }
    const c = carbs.get(i)!;
    const kcal = t.p * 4 + c * 4 + t.f * 9;
    return { ...t, ...fibre(kcal), date, demand: demand(date), c, kcal, shift: c - t.c, planC: t.c, fixed: false, prefuel: lifted(date) };
  });
}

/** Weekly totals of the distribution against the plan in force on each day. */
export function reconcile(plan: Plan, days: FuelDay[]) {
  const base = days.map((d) => dayTarget(plan, d.date));
  return {
    kcalPlan: days.reduce((s, d) => s + d.p * 4 + d.planC * 4 + d.f * 9, 0), kcalFuel: days.reduce((s, d) => s + d.kcal, 0),
    carbsPlan: days.reduce((s, d) => s + d.planC, 0), carbsFuel: days.reduce((s, d) => s + d.c, 0),
    proteinSame: days.every((d, i) => d.fixed || d.p === base[i]!.p), fatSame: days.every((d, i) => d.fixed || d.f === base[i]!.f),
  };
}

/** Share of the day's carbs per meal: more around training on demanding days. Own rule. -1 = training before the first meal. */
export function mealCarbShares(meals: number, trainingMeal: number | null, demand: Demand): number[] {
  const out = Array.from({ length: meals }, () => 1);
  if (trainingMeal != null && (demand === 'high' || demand === 'moderate')) {
    const extra = demand === 'high' ? 0.8 : 0.4;
    if (trainingMeal >= 0) out[trainingMeal] = 1 + extra;
    if (trainingMeal + 1 < meals) out[trainingMeal + 1] = 1 + extra;
  }
  const total = out.reduce((a, b) => a + b, 0);
  return out.map((x) => x / total);
}

/** Fat slows digestion, so the meal before training on a demanding day carries half a share; the day's total stays. */
export function mealFatShares(meals: number, trainingMeal: number | null, demand: Demand): number[] {
  const out = Array.from({ length: meals }, () => 1);
  if (trainingMeal != null && trainingMeal >= 0 && (demand === 'high' || demand === 'moderate')) out[trainingMeal] = 0.5;
  const total = out.reduce((a, b) => a + b, 0);
  return out.map((x) => x / total);
}
