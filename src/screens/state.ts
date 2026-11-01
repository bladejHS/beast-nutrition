/* The fuel week as the screens need it, read fresh from the saved state and from Inner Beast. */
import { ctx } from '../app.ts';
import { weekday, type DayTarget } from '../logic/calc.ts';
import { mealCarbShares, type FuelDay } from '../logic/carbs.ts';
import { cycleWeek, freeze, targetOn, type CycleIn } from '../logic/cycle.ts';
import { windowFor } from '../logic/fasting.ts';
import { mondayOf } from '../logic/review.ts';
import { dayPlan, readTraining, type DayPlan, type Demand, type Training } from '../logic/training.ts';

export const training = (): Training => readTraining(localStorage);

export function cycleIn(t = training()): CycleIn {
  const s = ctx.get();
  return { plan: s.plan!, sex: s.profile!.sex, cycling: s.fuel.cycling, factors: s.fuel.factors, limits: s.fuel.limits, overrides: s.fuel.overrides, snap: s.fuel.snap, today: ctx.today(), training: t };
}

export const fuelWeek = (monday: string, t = training()): { days: FuelDay[]; plans: Record<string, DayPlan> } => cycleWeek(cycleIn(t), monday);
export const dayFuel = (date: string): DayTarget => targetOn(cycleIn(), date);

export function dayRating(date: string, t = training()): DayPlan {
  const s = ctx.get();
  return dayPlan(t, date, ctx.today(), weekday(date), s.fuel.overrides[date], s.fuel.limits);
}

export const notice = { text: '' };

/** Freezes today as it stands, and says when training changed the days ahead. */
export function syncFuel() {
  const s = ctx.get();
  if (!s.plan || !s.profile || !s.fuel.cycling) return;
  const { snaps, sig } = freeze(cycleIn());
  Object.assign(s.fuel.snap, snaps);
  if (s.fuel.sig && s.fuel.sig.slice(0, 10) === sig.slice(0, 10) && s.fuel.sig !== sig) notice.text = 'Antrenamentele s-au schimbat, așa că zilele rămase au fost recalculate. Totalul săptămânii e același.';
  if (s.fuel.sig !== sig) { s.fuel.sig = sig; ctx.commit(); }
}

/** Meal times, the meal before training, its tags and each meal's share of the carbs. */
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
  const before = times.reduce((best, x, i) => (x <= s.fuel.trainingHour ? i : best), 0);
  const trainingMeal = demand === 'rest' || demand === 'low' ? null : before;
  const tags = times.map((_, i) => (trainingMeal == null ? '' : i === trainingMeal ? 'Înainte de antrenament' : i === trainingMeal + 1 ? 'După antrenament' : ''));
  return { times, tags, demand, trainingMeal, shares: mealCarbShares(n, trainingMeal, demand) };
}
