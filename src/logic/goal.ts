/* The end of the diet (2026-11-14, the user picked it from my list of gaps): a final weight, the date of the
   selection, and what comes after. Two rules the plan didn't have:
   - the deficit stops before the selection: the tests are run at maintenance, with full glycogen and full strength,
     not three days after the last hard week of a diet. Three weeks before is the default.
   - after the diet, a band: the weight is held within ±1.5 kg of where the diet ended; the scale's trend above the
     band for a week means a small correction, not a new diet.
   Pure, so the advice can be tested. The plan's numbers still change only through the Plan and Corp screens. */
import type { Phase } from './calc.ts';
import type { TrendPoint } from './trend.ts';

export interface Goal {
  /** Final weight, kg. */
  kg: number;
  /** The selection date, or ''. */
  by: string;
  /** The trend weight when the goal was set. */
  from: number;
  /** Where the maintenance band is centred, once the diet ended. */
  hold?: number;
}

export const BAND = 1.5;
/** Weeks before the selection when the deficit stops. */
export const STOP_WEEKS = 3;

export type GoalState = 'far' | 'close' | 'reached' | 'stop' | 'late' | 'band' | 'above' | 'below' | 'nodata';

export interface GoalView {
  state: GoalState;
  now: number | null;
  start: number;
  /** Kg still to lose (never negative). */
  left: number;
  /** Share of the way done, 0–1. */
  done: number;
  /** Kg lost per week over the last 4 weeks of the trend; null with too little data. */
  rate: number | null;
  /** When the goal is reached at that rate. */
  eta: string | null;
  /** Weeks to the selection, or null. */
  weeksToBy: number | null;
  title: string;
  text: string;
  /** The phase the advice points to, offered as a button. */
  to?: Phase;
}

const day = (s: string) => Date.parse(`${s}T12:00:00Z`);
const gap = (a: string, b: string) => Math.round((day(b) - day(a)) / 864e5);
const addDays = (s: string, n: number) => new Date(day(s) + n * 864e5).toISOString().slice(0, 10);
const kg = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
export const dateRo = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Kg lost per week over the last `days` of the trend (positive = losing). */
export function lossRate(points: TrendPoint[], days = 28): number | null {
  const last = points.at(-1);
  if (!last) return null;
  const then = [...points].reverse().find((p) => gap(p.date, last.date) >= days) ?? (points.length >= 2 && gap(points[0]!.date, last.date) >= 14 ? points[0] : undefined);
  if (!then) return null;
  return ((then.trend - last.trend) / gap(then.date, last.date)) * 7;
}

export function goalView(g: Goal, points: TrendPoint[], phase: Phase, today: string): GoalView {
  const start = g.from;
  const now = points.at(-1)?.trend ?? null;
  const rate = lossRate(points);
  const weeksToBy = g.by && g.by > today ? gap(today, g.by) / 7 : null;
  const base = { now, start, rate, weeksToBy, left: 0, done: 0, eta: null as string | null };
  if (now == null) return { ...base, state: 'nodata', title: 'Cântărește-te', text: 'Ținta se urmărește pe trendul cântarului: cântărește-te dimineața, după baie, de câteva ori pe săptămână.' };

  // after the diet: hold the weight in a band
  if (phase !== 'cut') {
    const centre = g.hold ?? Math.max(g.kg, Math.min(now, start));
    const lo = centre - BAND, hi = centre + BAND;
    const head = phase === 'reverse' ? 'Reverse diet' : 'Menținere';
    if (now > hi) return { ...base, state: 'above', title: `${head}: peste bandă`, text: `Trendul e ${kg(now)} kg, cu ${kg(now - hi)} kg peste banda ${kg(lo)}–${kg(hi)} kg. Nu e o dietă nouă: o săptămână cu 5–10% mai puțin la carbohidrați și grăsimi, apoi vezi trendul din nou.` };
    if (now < lo) return { ...base, state: 'below', title: `${head}: sub bandă`, text: `Trendul e ${kg(now)} kg, sub banda ${kg(lo)}–${kg(hi)} kg. Dacă nu vrei să mai slăbești, urcă puțin caloriile.` };
    return { ...base, state: 'band', title: `${head}: în bandă`, text: `Trendul e ${kg(now)} kg, în banda ${kg(lo)}–${kg(hi)} kg.${phase === 'reverse' ? ' Cât timp rămâne aici, caloriile pot urca pas cu pas.' : ' Ce faci acum ține.'}` };
  }

  const left = Math.max(0, now - g.kg);
  const total = Math.max(0.1, start - g.kg);
  const done = Math.max(0, Math.min(1, (start - now) / total));
  const eta = rate && rate > 0.05 && left > 0 ? addDays(today, Math.round((left / rate) * 7)) : null;
  const v = { ...base, left, done, eta };

  if (left <= 0) return { ...v, state: 'reached', to: 'reverse', title: 'Ai ajuns la țintă', text: `Trendul e ${kg(now)} kg, ținta era ${kg(g.kg)} kg. Ieși din deficit acum, fără o săptămână de sărbătoare: reverse diet urcă caloriile pas cu pas până la menținere, iar greutatea rămâne într-o bandă de ±${kg(BAND)} kg.` };
  if (weeksToBy != null && weeksToBy <= STOP_WEEKS) return { ...v, state: 'stop', to: 'reverse', title: 'Oprește deficitul înaintea selecției', text: `Selecția e în ${Math.max(1, Math.round(weeksToBy))} ${Math.round(weeksToBy) === 1 ? 'săptămână' : 'săptămâni'}. Probele le dai la menținere, cu glicogenul plin și forța întreagă, nu din deficit. Ce a mai rămas din țintă (${kg(left)} kg) continui după.` };
  if (weeksToBy != null && eta && gap(eta, g.by) < STOP_WEEKS * 7) return { ...v, state: 'late', title: 'Ținta trece de selecție', text: `La ritmul de acum (${kg(rate!)} kg pe săptămână) ajungi la ${kg(g.kg)} kg pe ${dateRo(eta)}. Deficitul se oprește cu ${STOP_WEEKS} săptămâni înaintea selecției, deci la probe vei avea în jur de ${kg(Math.max(g.kg, now - rate! * Math.max(0, weeksToBy - STOP_WEEKS)))} kg. Nu grăbi ritmul: la probe contează forța, nu ultimul kilogram.` };
  if (left <= 3) return { ...v, state: 'close', title: `Mai ai ${kg(left)} kg`, text: `Aproape. Când trendul trece de ${kg(g.kg)} kg, aplicația îți propune ieșirea din deficit.${eta ? ` La ritmul de acum: pe ${dateRo(eta)}.` : ''}` };
  return { ...v, state: 'far', title: `Mai ai ${kg(left)} kg`, text: eta ? `La ritmul de acum (${kg(rate!)} kg pe săptămână) ajungi pe ${dateRo(eta)}.` : 'Ritmul se vede după două săptămâni de cântăriri.' };
}
