/* What the body actually burns, measured instead of predicted (2026-11-22).

   The plan starts from a formula (Müller BMR × activity, calc.ts). A formula is a guess: it can miss by 15% in either
   direction, and in a long deficit the real number drifts down. This file replaces the guess with arithmetic on what
   already happened — energy balance over a window:

       maintenance ≈ mean daily intake + (trend weight lost per day) × kcal per kg of tissue

   Everything comes from data the app already keeps: the food logged on each day and the morning weights. Days without
   food logged are left out rather than counted as zero, and the estimate says how much it trusts itself, so the rest
   of the app can refuse to act on three days of half-logging.

   The weight side is the slope of a line fitted through every weigh-in of the window, never two mornings subtracted:
   a single morning carries a kilogram of water, glycogen and gut content, which is 7000 kcal of noise on a 14-day
   window. A least-squares slope uses all of them and has no lag, unlike the smoothed line the charts draw (trend.ts),
   whose first point is one raw weight and whose last trails the truth by a few tenths of a kilogram. */

/** Energy in a kilogram of the mixture lost in a deficit (mostly fat, some lean, some water). The textbook 7700
 *  kcal/kg is pure fat; a mixed loss in someone with a lot of fat to lose runs a little cheaper. */
export const KCAL_PER_KG = 7300;

/** Below this many days with food logged, the estimate is not used for decisions. */
export const MIN_LOGGED = 10;
/** The window the estimate reads. Long enough to drown the noise, short enough to follow a drifting metabolism. */
export const WINDOW = 21;

export interface IntakeDay { date: string; kcal: number }

export interface Tdee {
  /** The estimate, kcal a day. */
  kcal: number;
  /** 0–1: how much of the window had food logged, and whether the weight line is long enough. */
  confidence: number;
  /** Days of the window with food logged. */
  logged: number;
  /** Days between the first and last weight used. */
  span: number;
  /** Mean of the logged days. */
  intake: number;
  /** Kilograms the fitted line moved over the span (negative = lost). */
  trendKg: number;
  /** Kilograms a day, from the fit. */
  slope: number;
  /** Standard error of that slope, kg a day. */
  slopeSe: number;
  /** True while the 95% band of the slope still contains zero: the scale has not decided. */
  flat: boolean;
  /** True when there is enough to act on. */
  usable: boolean;
}

const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
export const addDaysUtc = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Rounds to 10 kcal: the precision the arithmetic deserves. */
const round10 = (v: number) => Math.round(v / 10) * 10;

/** Least squares on (day, kg): the kilograms a day the window is really moving, and how sure that is.
 *  `se` is the standard error of the slope; the 95% band is roughly the slope ± 2 × se. When that band still
 *  contains zero, the scale has not actually decided anything yet. */
export function fitLine(points: Array<[number, number]>): { slope: number; se: number } {
  const n = points.length;
  if (n < 3) return { slope: 0, se: Infinity };
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  if (den === 0) return { slope: 0, se: Infinity };
  const slope = num / den;
  const b = my - slope * mx;
  const ss = points.reduce((s, [x, y]) => s + (y - (slope * x + b)) ** 2, 0);
  const se = Math.sqrt(ss / Math.max(1, n - 2) / den);
  return { slope, se };
}


/**
 * The window's estimate. `intake` holds only the days the user actually logged; a day logged at a tenth of its target
 * is still counted, because judging what is "real" belongs to the caller, not here.
 */
export function estimateTdee(intake: IntakeDay[], weights: Record<string, number>, today: string, window = WINDOW): Tdee {
  const from = addDaysUtc(today, -(window - 1));
  const days = intake.filter((x) => x.date >= from && x.date <= today && x.kcal > 0);
  const kept = Object.entries(weights).filter(([d]) => d >= from && d <= today).sort(([a], [b]) => a.localeCompare(b));
  const first = kept[0], last = kept.at(-1);
  const span = first && last ? dayGap(first[0], last[0]) : 0;
  const fit = kept.length >= 3 ? fitLine(kept.map(([d, kg]) => [dayGap(first![0], d), kg])) : { slope: 0, se: Infinity };
  const slope = fit.slope;
  const trendKg = slope * span;
  const mean = days.length ? days.reduce((s, x) => s + x.kcal, 0) / days.length : 0;
  // the slope is already per day, which is what the energy balance applies to
  const perDay = slope * KCAL_PER_KG;
  const kcal = mean > 0 ? round10(mean - perDay) : 0;
  const cover = days.length / window;
  const spanPart = Math.min(1, span / 14) * Math.min(1, kept.length / 10);
  const confidence = Math.max(0, Math.min(1, Math.round(cover * spanPart * 100) / 100));
  return {
    kcal,
    confidence,
    logged: days.length,
    span,
    intake: Math.round(mean),
    trendKg: Math.round(trendKg * 100) / 100,
    slope: Math.round(slope * 1000) / 1000,
    slopeSe: Number.isFinite(fit.se) ? Math.round(fit.se * 1000) / 1000 : Infinity,
    flat: !(Math.abs(slope) > 2 * fit.se),
    usable: days.length >= MIN_LOGGED && span >= 10 && kcal > 0,
  };
}

/**
 * How far the measured maintenance sits from the one the plan is built on, as a percentage.
 * Positive: the body burns more than the plan assumes.
 */
export const tdeeDrift = (t: Tdee, planned: number): number | null =>
  t.usable && planned > 0 ? Math.round(((t.kcal - planned) / planned) * 1000) / 10 : null;

/** The weekly rate the current target would produce at the measured maintenance, in % of body mass. */
export function expectedRate(t: Tdee, targetKcal: number, bodyKg: number): number | null {
  if (!t.usable || bodyKg <= 0) return null;
  const kgPerWeek = ((t.kcal - targetKcal) * 7) / KCAL_PER_KG;
  return Math.round(((kgPerWeek / bodyKg) * 100) * 100) / 100;
}
