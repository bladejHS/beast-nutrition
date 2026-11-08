/* The performance plan's arithmetic (2026-11-08), kept pure so it can be tested. It sits on top of the method of
   Fat Loss Forever and never changes it: calc.ts and review.ts stay as they are, the plan is only rebuilt through
   buildPlan() with the user's own choices. */
import { isBreakWeek, macrosFor, type Macros, type Plan } from './calc.ts';
import { addDays, mondayOf } from './review.ts';

/** Fat at or above `perKg` g per kg of body weight (0.5: the user's floor, and about the 20 % of energy the ACSM,
 *  AND and DC 2016 position puts as the lower limit): the carb share, within the plan's own 0.5–0.7, that gets
 *  there, or null when the plan already does. Calories and protein stay; only carbs and fat trade places. */
export function fatFloorShare(m: Macros, carbShare: number, weightKg: number, perKg = 0.5): number | null {
  const need = Math.ceil(weightKg * perKg);
  if (m.f >= need) return null;
  for (let pct = Math.round(Math.min(carbShare, 0.7) * 100) - 1; pct >= 50; pct--) {
    if (macrosFor(m.kcal, m.p, pct / 100).f >= need) return pct / 100;
  }
  return 0.5;
}

/** Protein for each of the day's meals, so every meal reaches the 0.4–0.55 g/kg that maximises muscle protein
 *  synthesis (Schoenfeld and Aragon, 2018). */
export const proteinPerMeal = (protein: number, meals: number) => Math.round(protein / Math.max(1, meals));

/** The Monday of the next week at maintenance, for a plan with diet breaks; null without them or after 52 weeks. */
export function nextBreak(plan: Pick<Plan, 'phase' | 'breaks' | 'startDate'>, today: string): string | null {
  if (plan.phase !== 'cut' || !plan.breaks) return null;
  const mon = mondayOf(today);
  for (let w = 0; w < 52; w++) {
    const d = addDays(mon, w * 7);
    if (isBreakWeek(plan as Plan, d)) return d;
  }
  return null;
}

/** "17:00" minus `min` minutes, as "HH:MM"; wraps around midnight. */
export function minusMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = ((((h ?? 0) * 60 + (m ?? 0) - min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Average of the nights noted in the last 7 days, or null when none was noted. */
export function sleepAverage(sleep: Record<string, number>, today: string): number | null {
  const nights = Array.from({ length: 7 }, (_, i) => sleep[addDays(today, -i)]).filter((h): h is number => typeof h === 'number' && h > 0);
  return nights.length ? nights.reduce((a, b) => a + b, 0) / nights.length : null;
}
