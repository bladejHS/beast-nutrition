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

export interface Intra { level: 'none' | 'small' | 'optional' | 'advised'; minutes: number; gLow: number; gHigh: number; total: number; text: string }

/** Only hard minutes count: a long easy session asks for nothing during it. */
export function intraAdvice(sessions: Session[], tolerance: Tolerance, weights?: Weights): Intra {
  const minutes = sessions.filter((s) => weight(s, weights) >= 0.6).reduce((a, s) => a + s.min, 0);
  const none = (level: Intra['level'], text: string): Intra => ({ level, minutes, gLow: 0, gHigh: 0, total: 0, text });
  if (minutes < 45) return none('none', 'Sub 45 de minute solicitante nu ai nevoie de carbohidrați în timpul efortului. Apă.');
  if (minutes < 75) return none('small', 'Nu sunt necesari. Dacă simți că te ajută, ajung cantități mici sau o clătire a gurii cu o băutură cu carbohidrați.');
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
  tolerance: Tolerance; gap: number;
  /** Class of tomorrow, null when unknown. */
  tomorrow: Demand | null;
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
  const slot = (i: number) => ({ p: Math.round(x.day.p / n), c: Math.round(x.day.c * x.shares[i]!), f: Math.round(x.day.f / n), slot: i, mealTime: x.times[i]! });
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
        : gapMin < idealGap ? 'Alege o masă mai mică și ușor de digerat, cu puține grăsimi și fibre.'
          : 'Timp suficient pentru o masă normală, ușor de digerat.';
    pre = { ...s, gapMin, idealGap, snackTime: far ? toTime(start - 45) : null, snackC, tooClose, note };
  }
  let post: Post | null = null;
  if (tm + 1 < n) {
    const s = slot(tm + 1);
    const urgent = x.tomorrow === 'high';
    post = {
      ...s, afterMin: toMin(s.mealTime) - end, urgent,
      note: urgent ? 'Mâine urmează o zi HIGH, așa că nu sări această masă: proteină și carbohidrați cât mai curând după antrenament.' : 'Nu e nevoie de grabă: contează totalul zilei, iar următoarea masă normală e suficientă.',
      litres: x.sweatRate != null ? Math.round((x.sweatRate * minutes) / 6) / 10 : null,
    };
  }
  return { ...base, pre, post };
}
