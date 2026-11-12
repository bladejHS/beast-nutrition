/* The fuel week as the screens need it, read fresh from the saved state and from Inner Beast. */
import { ctx } from '../app.ts';
import { weekday, type DayTarget } from '../logic/calc.ts';
import { mealCarbShares, mealFatShares, type FuelDay } from '../logic/carbs.ts';
import { cycleWeek, freeze, rateDay, targetOn, type CycleIn } from '../logic/cycle.ts';
import { windowFor } from '../logic/fasting.ts';
import { loadFoods, type Food } from '../logic/foods.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { aroundSession, mealTimes, timing, type Timing } from '../logic/timing.ts';
import { readTraining, weight, type DayPlan, type Demand, type Rules, type Session, type Training } from '../logic/training.ts';
import { trainingFluid } from '../logic/wellness.ts';

/** One reading per render: a long training log takes real time to parse, and the screens ask for it many times. */
const cache = { training: null as Training | null, weeks: new Map<string, { days: FuelDay[]; plans: Record<string, DayPlan> }>(), targets: new Map<string, DayTarget>() };
export function freshFuel() { cache.training = null; cache.weeks.clear(); cache.targets.clear(); }

export function training(): Training {
  if (cache.training) return cache.training;
  const s = ctx.get();
  const t = readTraining(localStorage);
  const log: Training['log'] = {};
  for (const [d, list] of Object.entries(t.log)) { const rpe = s.fuel.feedback[d]?.rpe; log[d] = rpe ? list.map((x) => ({ ...x, rpe: x.rpe ?? rpe })) : list; }
  return (cache.training = { ...t, log, week: !s.fuel.sync && s.fuel.syncedWeek ? s.fuel.syncedWeek : t.week });
}

/** The user's rules, with sensitivity applied: above 1 the same training reaches a class sooner. */
export function rules(): Rules {
  const f = ctx.get().fuel;
  return { limits: { high: f.limits.high / f.sensitivity, moderate: f.limits.moderate / f.sensitivity }, weights: f.weights, boxStrength: f.boxStrength };
}

export function cycleIn(t = training()): CycleIn {
  const s = ctx.get();
  return { plan: s.plan!, sex: s.profile!.sex, cycling: s.fuel.cycling, factors: s.fuel.factors, rules: rules(), overrides: s.fuel.overrides, snap: s.fuel.snap, today: ctx.today(), training: t, cancelled: s.fuel.cancelled, manual: s.fuel.mode === 'manual', prefuel: s.fuel.prefuel };
}

export function fuelWeek(monday: string, t = training()): { days: FuelDay[]; plans: Record<string, DayPlan> } {
  const hit = cache.weeks.get(monday);
  if (hit) return hit;
  const week = cycleWeek(cycleIn(t), monday);
  cache.weeks.set(monday, week);
  return week;
}

export function dayFuel(date: string): DayTarget {
  const hit = cache.targets.get(date);
  if (hit) return hit;
  const target = targetOn(cycleIn(), date);
  cache.targets.set(date, target);
  return target;
}
export const dayRating = (date: string, t = training()): DayPlan => rateDay(cycleIn(t), date, weekday(date));

export const notice = { text: '' };
/** Set by whatever changed the numbers, so the next render shows the recalculation. */
export const fx = { recalc: false };

/** Freezes today as it stands, keeps the last plan seen, and says when training changed the days ahead. */
export function syncFuel() {
  const s = ctx.get();
  if (!s.plan || !s.profile) return;
  if (s.fuel.sync) {
    const t = readTraining(localStorage);
    if (t.linked && JSON.stringify(t.week) !== JSON.stringify(s.fuel.syncedWeek)) { s.fuel.syncedWeek = t.week; ctx.commit(); }
  }
  if (!s.fuel.cycling) return;
  const { snaps, sig } = freeze(cycleIn());
  // Saved now: a day the app was only opened on must still keep the target it showed.
  const changed = Object.entries(snaps).some(([d, v]) => JSON.stringify(s.fuel.snap[d]) !== JSON.stringify(v));
  Object.assign(s.fuel.snap, snaps);
  if (changed) { ctx.commit(); freshFuel(); }
  if (s.fuel.sig && s.fuel.sig.slice(0, 10) === sig.slice(0, 10) && s.fuel.sig !== sig) notice.text = 'Antrenamentele s-au schimbat, așa că zilele rămase au fost recalculate.';
  if (s.fuel.sig !== sig) { s.fuel.sig = sig; ctx.commit(); }
}

export const latestKg = () => { const s = ctx.get(); return Object.entries(s.weights).sort().at(-1)?.[1] ?? s.profile!.weightKg; };

export const trainingTime = (date: string) => { const f = ctx.get().fuel; return f.times[weekday(date)] || f.trainingHour; };

/** The sessions of a day that really count: not cancelled, with a duration and an effort. */
export function sessionsOn(date: string, t = training()): Session[] {
  const s = ctx.get();
  const off = s.fuel.cancelled[date] ?? [];
  return dayRating(date, t).planned.filter((x) => !off.includes(x.id) && x.min > 0 && weight(x, s.fuel.weights) > 0);
}

/**
 * Meal times, the meal before training (-1 = training comes first), its tags and each meal's share of the carbs.
 * A meal that would fall during a hard session moves to just after it. `outside`: that pushed it past the fasting window.
 */
export function mealSlots(date: string) {
  const s = ctx.get();
  const n = Math.min(4, s.fuel.prefs.meals);
  const w = windowFor(s.fast, weekday(date));
  const demand: Demand = (s.fuel.cycling ? fuelWeek(mondayOf(date)).days.find((d) => d.date === date)?.demand : undefined) ?? dayRating(date).rating.demand;
  const start = trainingTime(date);
  const easy = demand === 'rest' || demand === 'low';
  const placed = aroundSession(mealTimes(w?.start ?? '08:00', w ? w.eatMin : 720, n), start, easy ? 0 : sessionsOn(date).reduce((a, x) => a + x.min, 0));
  const times = placed.times;
  const before = times.reduce((best, x, i) => (x <= start ? i : best), -1);
  const trainingMeal = easy ? null : before;
  const tags = times.map((_, i) => (trainingMeal == null ? '' : i === trainingMeal ? 'Înainte de antrenament' : i === trainingMeal + 1 ? 'După antrenament' : ''));
  return { times, tags, demand, trainingMeal, shares: mealCarbShares(n, trainingMeal, demand), fatShares: mealFatShares(n, trainingMeal, demand), outside: !!w && placed.moved != null && times.some((x) => x > w.end) };
}

export function timingFor(date: string): Timing {
  const s = ctx.get();
  const t = training();
  const sl = mealSlots(date);
  const next = addDays(date, 1);
  const [h = 0, m = 0] = trainingTime(date).split(':').map(Number);
  const [nh = 0, nm = 0] = trainingTime(next).split(':').map(Number);
  const minutes = sessionsOn(date, t).reduce((a, x) => a + x.min, 0);
  return timing({
    nextGapMin: nh * 60 + nm + 1440 - (h * 60 + m + minutes),
    start: trainingTime(date), sessions: sessionsOn(date, t), demand: sl.demand, day: dayFuel(date), times: sl.times, shares: sl.shares, fatShares: sl.fatShares, trainingMeal: sl.trainingMeal,
    tolerance: s.fuel.tolerance, gap: s.fuel.preGap, tomorrow: fuelWeek(mondayOf(next), t).days.find((d) => d.date === next)?.demand ?? null, sweatRate: trainingFluid(60, s.sweat)?.rate ?? null, weights: s.fuel.weights,
  });
}

/** The food database, loaded once when first needed. */
export const pantry = { foods: [] as Food[], map: new Map<string, Food>(), failed: false };
export async function loadPantry() {
  if (pantry.foods.length) return;
  pantry.foods = await loadFoods();
  pantry.map = new Map(pantry.foods.map((f) => [f.id, f]));
  for (const f of ctx.get().custom) pantry.map.set(f.id, f);
}

/** The pantry with the user's own foods in it: they can be planned, swapped and bought like the rest. */
export function kitchen(): Food[] {
  const mine = ctx.get().custom;
  for (const f of mine) pantry.map.set(f.id, f);
  return [...mine, ...pantry.foods];
}
