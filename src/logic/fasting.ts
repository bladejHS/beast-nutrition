/* Fasting: three fixed protocols and the guided 8-week progression. Nothing here ever advances a phase by itself:
   only `decide` moves the program, and only when the user chooses. */
import { addDays } from './review.ts';

export type Fixed = '12:12' | '14:10' | '16:8';
export const FIXED: Fixed[] = ['12:12', '14:10', '16:8'];
export const fastHours = (p: Fixed) => Number(p.split(':')[0]);

export const PHASES: { name: string; ratio: Fixed; days: number; focus: string }[] = [
  { name: 'FOUNDATION', ratio: '12:12', days: 7, focus: 'Mese la ore constante.' },
  { name: 'ADAPTATION', ratio: '14:10', days: 7, focus: 'O fereastră de mâncat puțin mai scurtă.' },
  { name: 'CONSISTENCY', ratio: '16:8', days: 42, focus: 'O rutină constantă și ușor de ținut. Opțional.' },
];
export const PROGRAM_DAYS = 56;

export interface Ratings { energy: number; hunger: number; sleep: number; training: number; wellbeing: number; nutrition: number }
export interface Assessment extends Ratings { date: string; phase: number; dizzy: boolean; action: Decision }
export type Decision = 'advance' | 'repeat' | 'extend' | 'back' | 'stop' | 'skip' | 'stay';

export interface Progressive {
  phase: number;
  phaseStart: string;
  /** Days added with "extend". */
  extra: number;
  /** The user chose to stay on this ratio for as long as they like. */
  stay: boolean;
  pausedSince: string | null;
  /** Paused days inside the current phase. */
  pausedDays: number;
  startedAt: string;
  /** Days of earlier phases counted toward the 8 weeks. */
  doneBefore: number;
  assessments: Assessment[];
}

export interface FastState {
  /** What runs now: at most one, so schedules cannot conflict. */
  active: { type: 'fixed'; protocol: Fixed; since: string } | { type: 'prog' } | null;
  /** First hour of eating, "HH:MM". */
  eatStart: string;
  /** Per weekday (Monday = 0), for days with a different schedule. */
  dayStart: Record<number, string>;
  prog: Progressive | null;
  /** date → the fast was kept. */
  log: Record<string, boolean>;
  /** date → ratio that applied, kept when the schedule changes. */
  ratioLog: Record<string, Fixed>;
  history: { label: string; from: string; to: string }[];
}

export const freshFasting = (): FastState => ({ active: null, eatStart: '10:00', dayStart: {}, prog: null, log: {}, ratioLog: {}, history: [] });

const diff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

export const phaseLength = (p: Progressive) => (PHASES[p.phase]?.days ?? 0) + p.extra;

export function dayInPhase(p: Progressive, today: string): number {
  const paused = p.pausedDays + (p.pausedSince ? diff(p.pausedSince, today) : 0);
  return Math.max(0, diff(p.phaseStart, today) - paused) + 1;
}

export const daysLeft = (p: Progressive, today: string) => Math.max(0, phaseLength(p) - dayInPhase(p, today) + 1);
/** Planned days are over: an assessment is offered, nothing changes on its own. */
export const assessmentDue = (p: Progressive, today: string) => !p.stay && !p.pausedSince && dayInPhase(p, today) > phaseLength(p);
export const programPct = (p: Progressive, today: string) => Math.min(100, ((p.doneBefore + Math.min(dayInPhase(p, today) - 1, PHASES[p.phase]!.days)) / PROGRAM_DAYS) * 100);

export function currentRatio(f: FastState): Fixed | null {
  if (!f.active) return null;
  if (f.active.type === 'fixed') return f.active.protocol;
  if (!f.prog || f.prog.pausedSince) return null;
  return PHASES[f.prog.phase]!.ratio;
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const toTime = (m: number) => `${String(Math.floor(((m + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((m + 1440) % 1440) % 60).padStart(2, '0')}`;

export interface Window { ratio: Fixed; start: string; end: string; eatMin: number }

export function windowFor(f: FastState, weekdayIdx: number): Window | null {
  const ratio = currentRatio(f);
  if (!ratio) return null;
  const start = f.dayStart[weekdayIdx] ?? f.eatStart;
  const eatMin = (24 - fastHours(ratio)) * 60;
  return { ratio, start, end: toTime(toMin(start) + eatMin), eatMin };
}

export interface Status { eating: boolean; minutesLeft: number }

/** Where `now` (minutes after midnight) sits in the day's window. */
export function status(w: Window, now: number): Status {
  const start = toMin(w.start);
  const since = (now - start + 1440) % 1440;
  return since < w.eatMin ? { eating: true, minutesLeft: w.eatMin - since } : { eating: false, minutesLeft: 1440 - since };
}

export function activate(f: FastState, next: FastState['active'], today: string): FastState {
  const out = { ...f, history: [...f.history] };
  const old = f.active;
  if (old) {
    out.history.push({ label: old.type === 'fixed' ? old.protocol : 'Progresiv', from: old.type === 'fixed' ? old.since : f.prog?.startedAt ?? today, to: today });
  }
  out.active = next;
  if (next?.type === 'prog' && !f.prog) {
    out.prog = { phase: 0, phaseStart: today, extra: 0, stay: false, pausedSince: null, pausedDays: 0, startedAt: today, doneBefore: 0, assessments: [] };
  }
  return out;
}

/** Warning signs from the assessment (1 to 10, 10 = best). */
export function advice(r: Ratings, dizzy: boolean): { level: 'ok' | 'hold' | 'reduce'; text: string } {
  if (dizzy || r.energy <= 3 || r.training <= 3 || r.nutrition <= 3 || r.wellbeing <= 3) {
    return { level: 'reduce', text: 'Oboseala, amețeala, antrenamentele slabe sau mesele greu de atins sunt semne să scurtezi postul sau să oprești programul. Dacă persistă, discută cu un medic.' };
  }
  const low = Object.values(r).filter((v) => v <= 5).length;
  if (low >= 2) return { level: 'hold', text: 'Unele răspunsuri sunt la limită. Repetă faza sau rămâi aici cât e nevoie.' };
  return { level: 'ok', text: 'Te simți bine. Poți avansa, dar poți și rămâne aici pentru totdeauna: nu e o competiție.' };
}

export function decide(p: Progressive, action: Decision, today: string, ratings?: Ratings, dizzy = false): Progressive {
  const out: Progressive = { ...p, assessments: [...p.assessments] };
  if (ratings) out.assessments.push({ ...ratings, date: today, phase: p.phase, dizzy, action });
  const fresh = (phase: number, doneBefore: number) => { out.phase = phase; out.doneBefore = doneBefore; out.phaseStart = today; out.extra = 0; out.pausedDays = 0; out.pausedSince = null; out.stay = false; };
  const counted = (phase: number) => PHASES.slice(0, phase).reduce((s, x) => s + x.days, 0);
  if ((action === 'advance' || action === 'skip') && p.phase < 2) fresh(p.phase + 1, counted(p.phase + 1));
  if (action === 'repeat') fresh(p.phase, p.doneBefore);
  if (action === 'back') { const to = Math.max(0, p.phase - 1); fresh(to, counted(to)); }
  if (action === 'extend') out.extra = p.extra + 7;
  if (action === 'stay') out.stay = true;
  return out;
}

export const pause = (p: Progressive, today: string): Progressive => ({ ...p, pausedSince: today });
export const resume = (p: Progressive, today: string): Progressive => ({ ...p, pausedDays: p.pausedDays + (p.pausedSince ? diff(p.pausedSince, today) : 0), pausedSince: null });

export function adherence(f: FastState, today: string, days = 7) {
  let kept = 0, known = 0;
  for (let i = 1; i <= days; i++) {
    const v = f.log[addDays(today, -i)];
    if (v != null) { known++; if (v) kept++; }
  }
  return { kept, known };
}
