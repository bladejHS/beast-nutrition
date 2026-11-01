/* Nutrient timing around training. The grams never add to the day: they come out of its target, which stays what
   the plan and the carb distribution set. General guidance of this app, not Layne Norton's. In-session carbohydrate
   follows Thomas, Erdman & Burke 2016 (ACSM, Academy of Nutrition and Dietetics, Dietitians of Canada). */
import { weight, type Demand, type Session, type Weights } from './training.ts';

export type Tolerance = 'low' | 'normal' | 'high';
export const TOLERANCE_LABEL: Record<Tolerance, string> = { low: 'Sensibil', normal: 'Normal', high: 'Rezistent' };
/** Minutes between a full meal and training, by digestive tolerance. */
export const IDEAL_GAP: Record<Tolerance, number> = { low: 180, normal: 120, high: 90 };

const toMin = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m; };
export const toTime = (min: number) => { const v = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

/** Meal times across the eating window, on whole 5 minutes. */
export function mealTimes(start: string, eatMin: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => toTime(Math.round((toMin(start) + (n > 1 ? (eatMin * 0.9 * i) / (n - 1) : 0)) / 5) * 5));
}

/** How far apart meals stay when training pushes one of them later, in minutes. */
const MEAL_SPACING = 90;

/**
 * A meal that would fall during training moves to just after it, and the meals behind it keep their order.
 * `moved`: the first meal that had to move, null when none did.
 */
export function aroundSession(times: string[], start: string, minutes: number): { times: string[]; moved: number | null } {
  const from = toMin(start), to = from + minutes;
  const out = [...times];
  let moved: number | null = null;
  for (let i = 0; i < out.length; i++) {
    const at = toMin(out[i]!);
    if (at > from && at < to + 15) { out[i] = toTime(Math.ceil((to + 20) / 5) * 5); moved ??= i; }
    else if (moved != null && at < toMin(out[i - 1]!) + MEAL_SPACING) out[i] = toTime(toMin(out[i - 1]!) + MEAL_SPACING);
  }
  return { times: out, moved };
}

/** What one meal gets of the day: protein evenly, carbs and fat by their shares. */
export function mealGoal(day: { p: number; c: number; f: number }, n: number, i: number, shares: number[], fatShares?: number[]) {
  const p = Math.round(day.p / n), c = Math.round(day.c * shares[i]!), f = Math.round(day.f * (fatShares?.[i] ?? 1 / n));
  return { p, c, f, kcal: p * 4 + c * 4 + f * 9 };
}

/** Water in the hours before training, from body weight: 5–7 ml/kg (ACSM, Sawka 2007). */
export const waterBefore = (kg: number) => [Math.round((kg * 5) / 50) * 50, Math.round((kg * 7) / 50) * 50] as const;

export interface SportRow { label: string; value: string; ref: string; ok: boolean }

/** The day against sports-nutrition references. Information only: in a deficit carbs usually sit under them, and nothing is changed for it. */
export function sportRows(day: { p: number; c: number; f: number }, kg: number, meals: number, demand: Demand): SportRow[] {
  const per = (g: number) => (g / kg).toFixed(1).replace('.', ',');
  const range: Record<Demand, [number, number]> = { rest: [3, 5], low: [3, 5], moderate: [5, 7], high: [6, 10] };
  const [lo, hi] = range[demand];
  const dose = day.p / meals;
  return [
    { label: 'Carbohidrați', value: `${per(day.c)} g/kg`, ref: `${lo}–${hi} g/kg`, ok: day.c / kg >= lo },
    { label: 'Proteină pe masă', value: `${Math.round(dose)} g`, ref: `peste ${Math.round(kg * 0.4)} g`, ok: dose >= kg * 0.4 },
    { label: 'Grăsimi', value: `${per(day.f)} g/kg`, ref: 'peste 0,5 g/kg', ok: day.f / kg >= 0.5 },
  ];
}

export interface Intra { level: 'none' | 'small' | 'optional' | 'advised'; minutes: number; gLow: number; gHigh: number; total: number; text: string }

/** Only hard minutes count: a long easy session asks for nothing during it. */
export function intraAdvice(sessions: Session[], tolerance: Tolerance, weights?: Weights): Intra {
  const minutes = sessions.filter((s) => weight(s, weights) >= 0.6).reduce((a, s) => a + s.min, 0);
  const none = (level: Intra['level'], text: string): Intra => ({ level, minutes, gLow: 0, gHigh: 0, total: 0, text });
  if (minutes < 45) return none('none', 'Sub 45 de minute solicitante nu ai nevoie de carbohidrați în timpul efortului. Apă.');
  if (minutes < 75) return none('small', 'Nu sunt necesari. Dacă ultima masă a fost acum mult timp, ajung cantități mici.');
  const gHigh = minutes < 90 || tolerance === 'low' ? 30 : 60;
  const total = Math.round((gHigh * minutes) / 60);
  if (minutes < 90) return { level: 'optional', minutes, gLow: 0, gHigh, total, text: `Opțional: până la ${gHigh} g pe oră, dacă îi tolerezi bine.` };
  return { level: 'advised', minutes, gLow: 30, gHigh, total, text: `Pentru o sesiune atât de lungă ajută ${gHigh === 30 ? '30' : '30–60'} g pe oră, luați treptat. Încearcă întâi la antrenament, nu într-o zi importantă.` };
}

export interface Pre { mealTime: string; gapMin: number; idealGap: number; p: number; c: number; f: number; slot: number; snackTime: string | null; snackC: number; tooClose: boolean; note: string }
export interface Post { mealTime: string; afterMin: number; p: number; c: number; f: number; slot: number; urgent: boolean; note: string; litres: number | null }

export interface TimingIn {
  start: string; sessions: Session[]; demand: Demand;
  day: { p: number; c: number; f: number };
  times: string[]; shares: number[]; trainingMeal: number | null;
  /** Share of the day's fat per meal; even when missing. */
  fatShares?: number[];
  tolerance: Tolerance; gap: number;
  /** Class of tomorrow, null when unknown. */
  tomorrow: Demand | null;
  /** Minutes from the end of this session to the next hard one, when known. */
  nextGapMin?: number | null;
  /** Average sweat rate in L/h, from the user's own tests. */
  sweatRate: number | null;
  weights?: Weights;
}
export interface Timing { start: string; end: string; minutes: number; pre: Pre | null; intra: Intra; post: Post | null; hasSession: boolean }

export function timing(x: TimingIn): Timing {
  const real = x.sessions.filter((s) => weight(s, x.weights) > 0 && s.min > 0);
  const minutes = real.reduce((a, s) => a + s.min, 0);
  const start = toMin(x.start);
  const end = start + minutes;
  const n = x.times.length;
  const slot = (i: number) => { const { p, c, f } = mealGoal(x.day, n, i, x.shares, x.fatShares); return { p, c, f, slot: i, mealTime: x.times[i]! }; };
  const base = { start: x.start, end: toTime(end), minutes, intra: intraAdvice(x.sessions, x.tolerance, x.weights), hasSession: real.length > 0 };
  if (x.trainingMeal == null) return { ...base, pre: null, post: null };
  const tm = x.trainingMeal;
  const idealGap = x.gap || IDEAL_GAP[x.tolerance];
  let pre: Pre | null = null;
  if (tm >= 0) {
    const s = slot(tm);
    const gapMin = start - toMin(s.mealTime);
    const tooClose = gapMin < 45;
    const far = gapMin > 240;
    const snackC = far ? Math.min(30, Math.round(s.c * 0.4)) : 0;
    const note = tooClose ? 'Masa e prea aproape de antrenament: mut-o mai devreme sau alege varianta ușoară.'
      : far ? 'Masa e departe de antrenament: o gustare ușoară înainte ajută, iar carbohidrații ei ies din ținta zilei.'
        : gapMin < idealGap ? 'Alege ceva ușor de digerat, cu puține grăsimi și fibre.'
          : 'Timp suficient pentru o masă normală, ușor de digerat.';
    pre = { ...s, gapMin, idealGap, snackTime: far ? toTime(start - 45) : null, snackC, tooClose, note };
  }
  let post: Post | null = null;
  if (tm + 1 < n) {
    const s = slot(tm + 1);
    // A fast refill only matters when the next hard session is under 8 hours away; over a day the total decides.
    const urgent = x.tomorrow === 'high' && (x.nextGapMin ?? Infinity) < 480;
    post = {
      ...s, afterMin: toMin(s.mealTime) - end, urgent,
      note: urgent ? 'Următoarea sesiune grea e la mai puțin de 8 ore, așa că nu sări această masă: proteină și carbohidrați cât mai curând.' : 'Nu e nevoie de grabă: contează totalul zilei, iar următoarea masă normală e suficientă.',
      litres: x.sweatRate != null ? Math.round((x.sweatRate * minutes) / 6) / 10 : null,
    };
  }
  return { ...base, pre, post };
}
