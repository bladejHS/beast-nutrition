/* Semaglutide (Wegovy) alongside the plan, added 2026-11-13 at the user's request.
 * The app does not prescribe. It keeps the doctor's dose and the injection day, tells when the next injection is due
 * (with the label's missed-dose rule), rotates the site, and reads the scale to say whether the next step of the
 * label's escalation is worth discussing. Sources: Wegovy SmPC/label (0.25 → 0.5 → 1 → 1.7 → 2.4 mg weekly, at least
 * 4 weeks per step; a missed dose is taken if the next one is more than 2 days away, otherwise skipped; more than
 * 2 weeks missed: re-start as the doctor decides; at least 3 days between two doses), STEP-1 (lean mass ~40 % of the
 * loss without training), T-REx 2026 (resistance training cuts lean loss by a quarter). */
import { weekday } from './calc.ts';
import { addDays } from './review.ts';
import { trendChange, weightTrend } from './trend.ts';

export const LADDER = [0.25, 0.5, 1, 1.7, 2.4] as const;
export const SITES = ['Abdomen stânga', 'Abdomen dreapta', 'Coapsă stângă', 'Coapsă dreaptă', 'Braț stâng', 'Braț drept'] as const;

export interface Shot {
  date: string;
  mg: number;
  site: number;
  /** Nausea in the two days after: 0 none, 1 light, 2 bothering, 3 strong. */
  nausea?: number;
}

export interface Glp1 {
  on: boolean;
  /** The dose the doctor prescribed now, mg per week. */
  mg: number;
  /** Injection weekday, 0 = Monday. */
  day: number;
  start: string;
  shots: Shot[];
  /** A vial of powder mixed with bacteriostatic water, instead of a pen. */
  vial?: Vial | null;
}

export interface Vial {
  /** Semaglutide in the vial, mg. */
  mg: number;
  /** Bacteriostatic water added, ml. */
  ml: number;
  /** Date it was mixed. */
  mixed: string;
}

export const freshGlp1 = (): Glp1 => ({ on: false, mg: LADDER[0], day: 2, start: '', shots: [] });

const gap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** The first injection weekday on or after `from`. */
export function onOrAfter(from: string, day: number): string {
  return addDays(from, (day - weekday(from) + 7) % 7);
}

export type Due =
  | { kind: 'off' }
  | { kind: 'upcoming'; date: string; days: number }
  | { kind: 'today'; date: string }
  /** Missed, and the next one is more than 2 days away: take it now. */
  | { kind: 'late'; missed: string; next: string }
  /** Missed, and the next one is 2 days away or less: skip it. */
  | { kind: 'skip'; missed: string; next: string }
  /** More than two weeks without a dose: the doctor decides how to start again. */
  | { kind: 'restart'; last: string };

export function due(g: Glp1, today: string): Due {
  if (!g.on) return { kind: 'off' };
  const last = g.shots.at(-1)?.date;
  if (last && gap(last, today) > 14 + 7) return { kind: 'restart', last };
  // the next slot keeps at least 3 days after the last dose, on the chosen weekday
  const first = onOrAfter(last ? addDays(last, 3) : g.start || today, g.day);
  if (today < first) return { kind: 'upcoming', date: first, days: gap(today, first) };
  // no dose yet: the first one is simply due, however long ago the planned start was
  if (today === first || !last) return { kind: 'today', date: today };
  // the latest slot that has already come
  const k = Math.floor(gap(first, today) / 7);
  const slot = addDays(first, k * 7);
  if (slot === today) return { kind: 'today', date: slot };
  const next = addDays(slot, 7);
  return gap(today, next) > 2 ? { kind: 'late', missed: slot, next } : { kind: 'skip', missed: slot, next };
}

/** The site after the last one, so the same spot is never used two weeks in a row. */
export const nextSite = (g: Glp1) => ((g.shots.at(-1)?.site ?? -1) + 1) % SITES.length;

/** How many weekly doses in a row, ending with the last, were at the prescribed dose. */
export function weeksAtDose(g: Glp1): number {
  let n = 0;
  for (let i = g.shots.length - 1; i >= 0 && g.shots[i]!.mg === g.mg; i--) n++;
  return n;
}

/** Weekly change of the weight trend in % of body weight (negative = losing), over the last two weeks. */
export function weeklyRate(weights: Record<string, number>, days = 14): number | null {
  const pts = weightTrend(weights, 0.25);
  const ch = trendChange(pts, days);
  const now = pts.at(-1)?.trend;
  return ch == null || !now ? null : ((ch / now) * 100 * 7) / days;
}

export type Step =
  | { kind: 'wait'; weeks: number }
  | { kind: 'data' }
  | { kind: 'nausea' }
  | { kind: 'fast'; rate: number }
  | { kind: 'hold'; rate: number }
  | { kind: 'up'; rate: number; to: number }
  | { kind: 'top'; rate: number };

/** What the scale and the stomach say about the dose. A suggestion for the doctor, never applied by the app. */
export function titration(g: Glp1, weights: Record<string, number>): Step {
  const weeks = weeksAtDose(g);
  if (weeks < 4) return { kind: 'wait', weeks: 4 - weeks };
  const recent = g.shots.slice(-2).map((x) => x.nausea ?? 0);
  if (recent.some((n) => n >= 2)) return { kind: 'nausea' };
  const r = weeklyRate(weights);
  if (r == null) return { kind: 'data' };
  const loss = -r;
  if (loss > 1.5) return { kind: 'fast', rate: loss };
  if (loss >= 0.5) return { kind: 'hold', rate: loss };
  const i = LADDER.findIndex((x) => x === g.mg);
  return i >= 0 && i < LADDER.length - 1 ? { kind: 'up', rate: loss, to: LADDER[i + 1]! } : { kind: 'top', rate: loss };
}

/** Units on a U-100 insulin syringe (100 units = 1 ml) for a dose, rounded to the half unit the small syringes show. */
export function units(doseMg: number, v: Pick<Vial, 'mg' | 'ml'>): number {
  if (!(v.mg > 0 && v.ml > 0)) return 0;
  return Math.round(((doseMg * v.ml) / v.mg) * 100 * 2) / 2;
}

/** The ml drawn for a dose. */
export const doseMl = (doseMg: number, v: Pick<Vial, 'mg' | 'ml'>) => (v.mg > 0 ? (doseMg * v.ml) / v.mg : 0);

/** Semaglutide left in the vial: what was mixed, minus every dose since. */
export function vialLeft(g: Glp1): number | null {
  const v = g.vial;
  if (!v) return null;
  const used = g.shots.filter((x) => x.date >= v.mixed).reduce((t, x) => t + x.mg, 0);
  return Math.max(0, v.mg - used);
}

/** Days since the vial was mixed. */
export const vialAge = (v: Vial, today: string) => gap(v.mixed, today);
