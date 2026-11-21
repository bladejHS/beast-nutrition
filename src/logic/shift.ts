/* Shift work (2026-11-21, the user: "eu lucrez în 3 schimburi, nu fac mereu antrenamentul seara").
   Each day can carry its shift; the shift sets when the day's eating starts (from waking up) and when training is.
   The meal plan and the pre/post-training meals then follow that day, also when it runs past midnight (night shift).
   For night shifts: the larger meals stay before the shift and right after waking; the ones at work stay lighter,
   the usual advice for night work (circadian research on night eating, e.g. Chellappa 2021, Lowden 2010). */

export type Shift = 'morning' | 'afternoon' | 'night' | 'off';
export interface ShiftDef { wake: string; train: string }

export const SHIFTS: Shift[] = ['morning', 'afternoon', 'night', 'off'];
// the user, 2026-11-21: schimbul 1 = 06:00–14:00, schimbul 2 = 14:00–22:00, schimbul 3 = 22:00–06:00
export const SHIFT_LABEL: Record<Shift, string> = { morning: 'Schimbul 1', afternoon: 'Schimbul 2', night: 'Schimbul 3', off: 'Liber' };
export const SHIFT_SHORT: Record<Shift, string> = { morning: 'S1', afternoon: 'S2', night: 'S3', off: 'L' };
export const SHIFT_HOURS: Record<Shift, string> = { morning: '06:00–14:00', afternoon: '14:00–22:00', night: '22:00–06:00', off: 'zi liberă' };

/** Starting points; the user changes them under "Orele turelor". */
export const DEFAULT_SHIFTS: Record<Shift, ShiftDef> = {
  morning: { wake: '05:00', train: '16:00' },
  afternoon: { wake: '08:00', train: '10:30' },
  night: { wake: '13:00', train: '17:00' },
  off: { wake: '07:30', train: '11:00' },
};

const toMin = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (min: number) => { const v = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

/** The first meal: half an hour after waking up. */
export const firstMealAt = (wake: string) => toTime(toMin(wake) + 30);

/**
 * Minutes into the day, counted from a few hours before its first meal, so that a day that runs past midnight
 * (night shift: 13:30 … 00:20) keeps its order and training at 06:00 before an 08:00 breakfast still comes first.
 */
export const dayBase = (firstMeal: string) => toMin(firstMeal) - 240;
export const onClock = (t: string, base: number) => (((toMin(t) - base) % 1440) + 1440) % 1440;
