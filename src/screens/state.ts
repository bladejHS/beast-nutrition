/* The fuel week as the screens need it, read fresh from the saved state and from Inner Beast. */
import { ctx } from '../app.ts';
import { weekday, type DayTarget } from '../logic/calc.ts';
import { mealCarbShares, type FuelDay } from '../logic/carbs.ts';
import { cycleWeek, freeze, rateDay, targetOn, type CycleIn } from '../logic/cycle.ts';
import { windowFor } from '../logic/fasting.ts';
import { loadFoods, type Food } from '../logic/foods.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { timing, type Timing } from '../logic/timing.ts';
import { readTraining, type DayPlan, type Demand, type Rules, type Training } from '../logic/training.ts';
import { trainingFluid } from '../logic/wellness.ts';

export function training(): Training {
  const s = ctx.get();
  const t = readTraining(localStorage);
  const log: Training['log'] = {};
  for (const [d, list] of Object.entries(t.log)) { const rpe = s.fuel.feedback[d]?.rpe; log[d] = rpe ? list.map((x) => ({ ...x, rpe: x.rpe ?? rpe })) : list; }
  return { ...t, log, week: !s.fuel.sync && s.fuel.syncedWeek ? s.fuel.syncedWeek : t.week };
}

/** The user's rules, with sensitivity applied: above 1 the same training reaches a class sooner. */
export function rules(): Rules {
  const f = ctx.get().fuel;
  return { limits: { high: f.limits.high / f.sensitivity, moderate: f.limits.moderate / f.sensitivity }, weights: f.weights, boxStrength: f.boxStrength };
}

export function cycleIn(t = training()): CycleIn {
  const s = ctx.get();
  return { plan: s.plan!, sex: s.profile!.sex, cycling: s.fuel.cycling, factors: s.fuel.factors, rules: rules(), overrides: s.fuel.overrides, snap: s.fuel.snap, today: ctx.today(), training: t, cancelled: s.fuel.cancelled, manual: s.fuel.mode === 'manual' };
}

export const fuelWeek = (monday: string, t = training()): { days: FuelDay[]; plans: Record<string, DayPlan> } => cycleWeek(cycleIn(t), monday);
export const dayFuel = (date: string): DayTarget => targetOn(cycleIn(), date);
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
  Object.assign(s.fuel.snap, snaps);
  if (s.fuel.sig && s.fuel.sig.slice(0, 10) === sig.slice(0, 10) && s.fuel.sig !== sig) notice.text = 'Antrenamentele s-au schimbat, așa că zilele rămase au fost recalculate. Totalul săptămânii e același.';
  if (s.fuel.sig !== sig) { s.fuel.sig = sig; ctx.commit(); }
}

export const trainingTime = (date: string) => { const f = ctx.get().fuel; return f.times[weekday(date)] || f.trainingHour; };

/** Meal times, the meal before training (-1 = training comes first), its tags and each meal's share of the carbs. */
export function mealSlots(date: string) {
  const s = ctx.get();
  const n = s.fuel.prefs.meals;
  const w = windowFor(s.fast, weekday(date));
  const [h = 8, m = 0] = (w?.start ?? '08:00').split(':').map(Number);
  const span = w ? w.eatMin : 720;
  const times = Array.from({ length: n }, (_, i) => {
    const t = h * 60 + m + (n > 1 ? (span * 0.9 * i) / (n - 1) : 0);
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.round(t % 60 / 5) * 5 % 60).padStart(2, '0')}`;
  });
  const demand: Demand = (s.fuel.cycling ? fuelWeek(mondayOf(date)).days.find((d) => d.date === date)?.demand : undefined) ?? dayRating(date).rating.demand;
  const start = trainingTime(date);
  const before = times.reduce((best, x, i) => (x <= start ? i : best), -1);
  const trainingMeal = demand === 'rest' || demand === 'low' ? null : before;
  const tags = times.map((_, i) => (trainingMeal == null ? '' : i === trainingMeal ? 'Înainte de antrenament' : i === trainingMeal + 1 ? 'După antrenament' : ''));
  return { times, tags, demand, trainingMeal, shares: mealCarbShares(n, trainingMeal, demand) };
}

export function timingFor(date: string): Timing {
  const s = ctx.get();
  const t = training();
  const sl = mealSlots(date);
  const off = s.fuel.cancelled[date] ?? [];
  const next = addDays(date, 1);
  return timing({
    start: trainingTime(date), sessions: dayRating(date, t).planned.filter((x) => !off.includes(x.id)), demand: sl.demand, day: dayFuel(date), times: sl.times, shares: sl.shares, trainingMeal: sl.trainingMeal,
    tolerance: s.fuel.tolerance, gap: s.fuel.preGap, tomorrow: fuelWeek(mondayOf(next), t).days.find((d) => d.date === next)?.demand ?? null, sweatRate: trainingFluid(60, s.sweat)?.rate ?? null, weights: s.fuel.weights,
  });
}

/** The food database, loaded once when first needed. */
export const pantry = { foods: [] as Food[], map: new Map<string, Food>() };
export async function loadPantry() {
  if (pantry.foods.length) return;
  pantry.foods = await loadFoods();
  pantry.map = new Map(pantry.foods.map((f) => [f.id, f]));
}
