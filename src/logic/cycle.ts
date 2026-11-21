/* The week as the app sees it: the real training rated day by day, and the carbs of the protected plan shared
   out accordingly. Pure, so the rules about history can be tested. Past days never move. */
import { type DayTarget, type Plan, type Sex } from './calc.ts';
import { dayTarget, weekFuel, type Factors, type Frozen, type FuelDay } from './carbs.ts';
import { addDays, mondayOf } from './review.ts';
import type { Snap } from './store.ts';
import { dayPlan, type DayPlan, type Demand, type Rules, type Training } from './training.ts';

export interface CycleIn {
  plan: Plan; sex: Sex; cycling: boolean; factors: Factors; rules: Partial<Rules>;
  overrides: Record<string, Demand>; snap: Record<string, Snap>; today: string; training: Training;
  /** Sessions the user cancelled, by date. */
  cancelled?: Record<string, string[]>;
  /** Only the user's own classes count; a day without one stays neutral. */
  manual?: boolean;
  /** In manual mode, the class the user gave each weekday (Monday first); a dated override still wins. */
  pattern?: (Demand | null)[];
  /** An easy day before a HIGH day gets a moderate share. On unless turned off. */
  prefuel?: boolean;
}

/** The class of one day, by the rules in force. */
export function rateDay(x: CycleIn, d: string, weekdayIdx: number): DayPlan {
  const picked = x.manual ? x.pattern?.[weekdayIdx] ?? null : null;
  const own = x.overrides[d] ?? picked ?? undefined;
  const p = dayPlan(x.training, d, x.today, weekdayIdx, own ?? (x.manual ? 'moderate' : undefined), x.rules, x.cancelled?.[d]);
  if (!x.manual || x.overrides[d]) return p;
  return { ...p, rating: { ...p.rating, reason: picked ? 'Ales de tine în săptămâna-tip.' : 'Mod manual: zi neclasificată, rămâne pe MODERATE.' } };
}

/** Monday 0 … Sunday 6. */
const weekdayOf = (d: string) => (new Date(`${d}T12:00:00`).getDay() + 6) % 7;

export function plansFor(x: CycleIn, monday: string): Record<string, DayPlan> {
  const out: Record<string, DayPlan> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    out[d] = rateDay(x, d, i);
  }
  return out;
}

export function cycleWeek(x: CycleIn, monday: string): { days: FuelDay[]; plans: Record<string, DayPlan> } {
  const plans = plansFor(x, monday);
  const locked: Record<string, Frozen> = {};
  for (const d of Object.keys(plans)) {
    if (d >= x.today) continue;
    const s = x.snap[d];
    const c = dayTarget(x.plan, d).c;
    locked[d] = s ? { c: s.c, base: s.b ?? s.c, p: s.p, f: s.f } : { c, base: c };
  }
  const demand = (d: string) => (d < x.today && x.snap[d]?.demand) || plans[d]!.rating.demand;
  const nextHigh = (d: string) => {
    if (x.prefuel === false) return false;
    const next = addDays(d, 1);
    return (plans[next] ?? rateDay(x, next, weekdayOf(next))).rating.demand === 'high';
  };
  return { plans, days: weekFuel(x.plan, monday, demand, x.factors, x.sex, locked, nextHigh) };
}

/** The target of one day: a frozen day stays as it was, whatever changed since. */
export function targetOn(x: CycleIn, date: string): DayTarget {
  const snap = x.snap[date];
  if (date < x.today && snap) return { ...dayTarget(x.plan, date), c: snap.c, kcal: snap.kcal, p: snap.p, f: snap.f, fiberMin: Math.round(snap.kcal / 100), fiberMax: Math.round((snap.kcal / 1000) * 15) };
  if (!x.cycling) return dayTarget(x.plan, date);
  return cycleWeek(x, mondayOf(date)).days.find((d) => d.date === date)!;
}

/** Snapshots of today and of any past day still missing one, plus the signature of the days ahead. */
export function freeze(x: CycleIn): { snaps: Record<string, Snap>; sig: string } {
  const { days, plans } = cycleWeek(x, mondayOf(x.today));
  const snaps: Record<string, Snap> = {};
  for (const d of days) {
    if (d.date > x.today || (d.date < x.today && x.snap[d.date])) continue;
    snaps[d.date] = { c: d.c, kcal: d.kcal, p: d.p, f: d.f, b: d.planC, demand: plans[d.date]!.rating.demand, planned: plans[d.date]!.plannedRating.demand, load: plans[d.date]!.rating.load, reason: plans[d.date]!.rating.reason };
  }
  return { snaps, sig: days.filter((d) => d.date >= x.today).map((d) => `${d.date}:${d.demand}`).join('|') };
}
