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
import type { Auto } from './glp1auto.ts';

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
  /** The user's own blood-sugar readings (2026-11-21). */
  glucose?: Glucose[];
  /** Date the doctor went through the contraindications, noted by the user (2026-11-21, protocol phase 0). */
  screened?: string;
  /** The app holds the next step of the ladder: losing too fast, or a low blood sugar (logic/glp1auto.ts). */
  hold?: boolean;
  /** What the app applied by itself, and the switch for it (logic/glp1auto.ts). */
  auto?: Auto;
}

export interface Vial {
  /** Semaglutide in the vial, mg. */
  mg: number;
  /** Bacteriostatic water added, ml. */
  ml: number;
  /** Date it was mixed. */
  mixed: string;
}

export const freshGlp1 = (): Glp1 => ({ on: false, mg: LADDER[0], day: 2, start: '', shots: [], glucose: [] });

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
  | { kind: 'held' }
  | { kind: 'wait'; weeks: number }
  | { kind: 'data' }
  | { kind: 'nausea' }
  | { kind: 'lowsugar' }
  | { kind: 'fast'; rate: number }
  | { kind: 'hold'; rate: number }
  | { kind: 'up'; rate: number; to: number }
  | { kind: 'top'; rate: number };

/** What the scale and the stomach say about the dose. A suggestion for the doctor, never applied by the app. */
const lowSugar = (g: Glp1) => { const end = g.glucose?.at(-1)?.date; return !!end && (g.glucose ?? []).some((x) => x.mg < 70 && gap(x.date, end) < 14); };

export function titration(g: Glp1, weights: Record<string, number>): Step {
  // the app put a hold on the ladder by itself (logic/glp1auto.ts); nothing below may propose a step up
  if (g.hold) return { kind: 'held' };
  const weeks = weeksAtDose(g);
  if (weeks < 4) return { kind: 'wait', weeks: 4 - weeks };
  const recent = g.shots.slice(-2).map((x) => x.nausea ?? 0);
  if (recent.some((n) => n >= 2)) return { kind: 'nausea' };
  // a low reading on the user's meter in the last 2 weeks: no step up before the doctor has seen it
  if (lowSugar(g)) return { kind: 'lowsugar' };
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

/* ---- Blood sugar from the user's own meter (2026-11-21, the user: "o să-mi iau eu glicemia și vreau un feedback în
   semaglutidă"). Thresholds: ADA Standards of Care 2025 (fasting 70–99 normal, 100–125 impaired, ≥126 the diabetes
   range on two days; 2 h after a meal <140 normal, 140–199 impaired, ≥200 high; under 70 low, under 54 serious).
   A home meter is a guide, not a diagnosis: the doctor confirms with laboratory glucose and HbA1c. */

/** When the reading was taken: on waking before food, 2 hours after a meal, or any other time. */
export type GlucoseWhen = 'fasting' | 'post' | 'other';
export interface Glucose { id: string; date: string; time: string; mg: number; when: GlucoseWhen }

export type GlucoseLevel = 'low' | 'ok' | 'raised' | 'high';
export function glucoseLevel(x: Pick<Glucose, 'mg' | 'when'>): GlucoseLevel {
  if (x.mg < 70) return 'low';
  if (x.when === 'fasting') return x.mg < 100 ? 'ok' : x.mg < 126 ? 'raised' : 'high';
  return x.mg < 140 ? 'ok' : x.mg < 200 ? 'raised' : 'high';
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export interface GlucoseFeedback {
  /** Average fasting reading of the last 7 days and of the 7 before, mg/dL. */
  fasting: number | null; before: number | null;
  /** Average fasting reading of the first week on semaglutide, to compare against. */
  start: number | null;
  post: number | null;
  lows: number; serious: boolean;
  level: 'none' | 'good' | 'watch' | 'doctor' | 'urgent';
  title: string; text: string;
}

export function glucoseFeedback(list: Glucose[], today: string, start = ''): GlucoseFeedback {
  const within = (from: number, to: number) => list.filter((x) => { const d = gap(x.date, today); return d >= from && d < to; });
  const fastIn = (xs: Glucose[]) => avg(xs.filter((x) => x.when === 'fasting').map((x) => x.mg));
  const last = within(0, 7), prev = within(7, 14), two = within(0, 14);
  const fasting = fastIn(last), before = fastIn(prev);
  const first = start ? list.filter((x) => x.date >= start && gap(start, x.date) < 7) : [];
  const startAvg = fastIn(first);
  const post = avg(last.filter((x) => x.when === 'post').map((x) => x.mg));
  const lows = two.filter((x) => x.mg < 70).length, serious = two.some((x) => x.mg < 54);
  const highs = last.filter((x) => glucoseLevel(x) === 'high').length;
  const base = { fasting, before, start: startAvg, post, lows, serious };
  if (!list.length) return { ...base, level: 'none', title: 'Nicio glicemie notată', text: 'Notează glicemia pe nemâncate dimineața, înainte de cafea, de 2–3 ori pe săptămână, și din când în când la 2 ore după masa mare.' };
  if (serious) return { ...base, level: 'urgent', title: 'Glicemie sub 54 mg/dL', text: 'E o hipoglicemie serioasă. Data viitoare iei imediat 15–20 g zahăr rapid (suc, tablete de glucoză) și măsori din nou după 15 minute. Spune medicului înainte de următoarea doză; nu urca doza.' };
  if (lows) return { ...base, level: 'doctor', title: `${lows} ${lows === 1 ? 'valoare' : 'valori'} sub 70 mg/dL în 2 săptămâni`, text: 'Pe semaglutidă singură e rar: de obicei vine din mese prea mici sau sărite, mai ales înainte de antrenament. Mănâncă toate mesele din plan și nu urca doza până nu vorbești cu medicul.' };
  if (highs >= 2) return { ...base, level: 'doctor', title: 'Glicemii mari de mai multe ori', text: `${highs} valori în zona mare săptămâna asta (pe nemâncate ≥126 sau după masă ≥200 mg/dL). Glucometrul nu pune diagnostic: cere medicului glicemie din laborator și HbA1c.` };
  const parts: string[] = [];
  if (fasting != null) parts.push(`Pe nemâncate, media săptămânii: ${fasting} mg/dL${fasting < 100 ? ', normal' : fasting < 126 ? ', puțin crescută' : ', mare'}.`);
  if (fasting != null && before != null) parts.push(fasting < before - 2 ? `Scade față de săptămâna trecută (${before}).` : fasting > before + 4 ? `Crește față de săptămâna trecută (${before}): urmărește mesele cu mulți carbohidrați rapizi seara.` : `Stabilă față de săptămâna trecută (${before}).`);
  if (fasting != null && startAvg != null && startAvg - fasting >= 5) parts.push(`De la începutul tratamentului a scăzut cu ${startAvg - fasting} mg/dL.`);
  if (post != null) parts.push(`La 2 ore după masă: ${post} mg/dL${post < 140 ? ', bine' : ', peste 140'}.`);
  if (!parts.length) parts.push('Ai doar valori luate la alte ore. Pentru o comparație, măsoară pe nemâncate dimineața.');
  const watch = (fasting != null && fasting >= 100) || (post != null && post >= 140);
  return { ...base, level: watch ? 'watch' : 'good', title: watch ? 'De urmărit' : 'Glicemia arată bine', text: `${parts.join(' ')}${watch ? ' Semaglutida și slăbitul o coboară de obicei în câteva săptămâni; dacă rămâne așa, spune-i medicului.' : ''}` };
}
