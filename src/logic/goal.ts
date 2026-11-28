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
  /** Where the road to the date starts: the day the goal was set and the trend that day (2026-11-28). */
  line?: { date: string; kg: number };
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
  if (weeksToBy != null && eta && gap(eta, g.by) < STOP_WEEKS * 7) return { ...v, state: 'late', title: 'Ținta trece de selecție', text: `La ritmul de acum (${kg(rate!)} kg pe săptămână) ajungi la ${kg(g.kg)} kg pe ${dateRo(eta)}. Deficitul se oprește cu ${STOP_WEEKS} săptămâni înaintea selecției, deci la probe vei avea în jur de ${kg(Math.max(g.kg, now - rate! * Math.max(0, weeksToBy - STOP_WEEKS)))} kg. Caloriile se ajustează ca să prinzi data, fără să treacă de limita sigură de slăbire.` };
  if (left <= 3) return { ...v, state: 'close', title: `Mai ai ${kg(left)} kg`, text: `Aproape. Când trendul trece de ${kg(g.kg)} kg, aplicația îți propune ieșirea din deficit.${eta ? ` La ritmul de acum: pe ${dateRo(eta)}.` : ''}` };
  return { ...v, state: 'far', title: `Mai ai ${kg(left)} kg`, text: eta ? `La ritmul de acum (${kg(rate!)} kg pe săptămână) ajungi pe ${dateRo(eta)}.` : 'Ritmul se vede după două săptămâni de cântăriri.' };
}

// ---- the road to the goal: segments and the chance (2026-11-15) -------------------------------------------------
// The user: "vreau să fie împărțite kg până la target în segmente și să-mi zică aplicația procentajul care sunt
// șansele să ajung la acel target până la data stabilită".

export interface Segment { from: number; to: number; done: number }

/** The kilos from the start to the goal, cut into even stretches of about 5 kg (3 to 8 of them). */
export function segments(g: Goal, now: number): Segment[] {
  const total = g.from - g.kg;
  if (!(total > 0)) return [];
  const n = Math.max(3, Math.min(8, Math.round(total / 5)));
  const size = total / n;
  return Array.from({ length: n }, (_, i) => {
    const from = g.from - i * size, to = from - size;
    return { from, to, done: Math.max(0, Math.min(1, (from - now) / size)) };
  });
}

/** Normal CDF (Abramowitz–Stegun 7.1.26). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface Chance {
  /** 0–100, or null without a date. */
  pct: number | null;
  /** Kg per week the goal needs from today to the day the deficit stops. */
  need: number | null;
  /** Kg per week the forecast uses: the scale's own pace, blended with the plan's while there are few weeks. */
  pace: number;
  /** The forecast weight on the day the deficit stops. */
  at: number | null;
  /** The day the deficit stops (STOP_WEEKS before the selection). */
  deadline: string | null;
  weeks: number | null;
}

/**
 * How likely the goal is by the date. The forecast: the weekly pace in percent of body weight (so it slows as the
 * weight drops), from the trend of the last 4 weeks, blended with the plan's pace while there are fewer than 6 weeks
 * of weighing. The spread: the week-to-week noise of the trend, plus 30 % doubt about the pace itself (weeks of good
 * and bad adherence, plateaus). The chance is the share of that spread that ends at or under the goal.
 */
export function chance(g: Goal, points: TrendPoint[], planPace: number, today: string): Chance {
  const now = points.at(-1)?.trend ?? g.from;
  const deadline = g.by ? addDays(g.by, -STOP_WEEKS * 7) : null;
  const span = points.length ? gap(points[0]!.date, points.at(-1)!.date) : 0;
  const seen = lossRate(points);
  const w = seen == null ? 0 : Math.min(1, span / 42);
  const pace = Math.max(0, (seen ?? 0) * w + planPace * (1 - w));
  const left = now - g.kg;
  if (!deadline) return { pct: null, need: null, pace, at: null, deadline: null, weeks: null };
  const weeks = gap(today, deadline) / 7;
  if (left <= 0) return { pct: 100, need: 0, pace, at: now, deadline, weeks };
  if (weeks <= 0) return { pct: 0, need: null, pace, at: now, deadline, weeks };
  const p = pace / now;
  const at = now * Math.pow(1 - p, weeks);
  // the week-to-week noise of the trend over the last 8 weeks, 0.5 kg when there is too little to tell
  const weekly: number[] = [];
  for (let i = points.length - 1; i > 0 && weekly.length < 8; ) {
    let j = i - 1;
    while (j >= 0 && gap(points[j]!.date, points[i]!.date) < 7) j--;
    if (j < 0) break;
    weekly.push(points[j]!.trend - points[i]!.trend);
    i = j;
  }
  const mean = weekly.length ? weekly.reduce((a, b) => a + b, 0) / weekly.length : 0;
  const sdw = weekly.length >= 3 ? Math.sqrt(weekly.reduce((a, b) => a + (b - mean) ** 2, 0) / (weekly.length - 1)) : 0.5;
  const sd = Math.sqrt(weeks * sdw * sdw + (0.3 * (now - at)) ** 2) || 0.5;
  const pct = Math.round(Math.max(1, Math.min(99, phi((g.kg - at) / sd) * 100)));
  return { pct, need: left / weeks, pace, at, deadline, weeks };
}

// ---- the pace the date asks for, and the weight for every date on the way (2026-11-28) ---------------------------
// The user: "ajustarea macronutrienților vreau să fie făcută ca să ating targetul de kg până la data stabilită de mine"
// and "la fiecare dată, pe o anumită perioadă de timp, câte kg trebuie să am ca să ating targetul".

/** The slowest weekly rate the app aims for, % of body weight: under it, a cut is not worth its cost. */
export const MIN_RATE = 0.25;

export interface GoalPace {
  /** The day the deficit stops: STOP_WEEKS before the selection. */
  deadline: string;
  weeks: number;
  /** What the date asks for, kg and % of today's weight per week. */
  needKg: number;
  needPct: number;
  /** What the plan will aim for: the need, never over the cap for this body fat, never under MIN_RATE. */
  pct: number;
  capped: boolean;
  /** Where the capped pace lands on the deadline. */
  at: number;
}

/** The weekly rate that takes `now` to the goal by the deadline, compounding (each week a share of the weight then). */
export function goalPace(g: Goal, now: number, today: string, cap: number): GoalPace | null {
  if (!g.by) return null;
  const deadline = addDays(g.by, -STOP_WEEKS * 7);
  const weeks = gap(today, deadline) / 7;
  if (weeks < 1 || now <= g.kg) return null;
  const needPct = (1 - Math.pow(g.kg / now, 1 / weeks)) * 100;
  const pct = Math.round(Math.max(MIN_RATE, Math.min(cap, needPct)) * 100) / 100;
  return { deadline, weeks, needKg: (now - g.kg) / weeks, needPct, pct, capped: needPct > cap, at: now * Math.pow(1 - pct / 100, weeks) };
}

export interface Milestone {
  date: string;
  /** The weight the road asks for on that date. */
  kg: number;
  /** The trend on that date, for the dates already passed. */
  got: number | null;
  kind: 'past' | 'now' | 'next' | 'stop' | 'by';
}

/** The trend weight on a date: the last point on or before it. */
const trendAt = (points: TrendPoint[], date: string) => [...points].reverse().find((p) => p.date <= date)?.trend ?? null;

/**
 * The road from the day the goal was set to the deadline, one weight per step: every week up to 16 weeks, every
 * two weeks up to 40, every four after. The road compounds like goalPace, so a straight percentage a week.
 */
export function milestones(g: Goal, points: TrendPoint[], today: string): Milestone[] {
  if (!g.by) return [];
  const start = g.line ?? { date: today, kg: points.at(-1)?.trend ?? g.from };
  const deadline = addDays(g.by, -STOP_WEEKS * 7);
  const total = gap(start.date, deadline);
  if (total < 7 || start.kg <= g.kg) return [];
  const at = (d: string) => start.kg * Math.pow(g.kg / start.kg, Math.min(1, gap(start.date, d) / total));
  const weeks = total / 7;
  const step = (weeks <= 16 ? 1 : weeks <= 40 ? 2 : 4) * 7;
  const dates: string[] = [];
  for (let d = addDays(start.date, step); d < deadline; d = addDays(d, step)) dates.push(d);
  dates.push(deadline);
  let marked = false;
  const out: Milestone[] = dates.map((date) => {
    const past = date < today;
    let kind: Milestone['kind'] = past ? 'past' : 'next';
    if (!past && !marked) { kind = 'now'; marked = true; }
    if (date === deadline) kind = date < today ? 'past' : 'stop';
    return { date, kg: at(date), got: past ? trendAt(points, date) : null, kind };
  });
  out.push({ date: g.by, kg: g.kg, got: null, kind: 'by' });
  return out;
}
