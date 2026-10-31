/* Reads the real training plan and log of Inner Beast (same origin, so same localStorage) and rates each day.
   The classes and thresholds below are this app's own rule, not Layne Norton's. */

export type Demand = 'high' | 'moderate' | 'low' | 'rest';
export const DEMAND_LABEL: Record<Demand, string> = { high: 'HIGH DEMAND', moderate: 'MODERATE DEMAND', low: 'LOW DEMAND', rest: 'REST / RECOVERY' };

export interface Session { id: string; name: string; kind: string; min: number; focus?: string }
export interface Logged { block?: string; name: string; kind: string; min: number; rpe?: number }
export interface Training {
  /** True when the data really came from Inner Beast. */
  linked: boolean;
  /** Monday = 0. */
  week: Session[][];
  log: Record<string, Logged[]>;
}

export interface Limits { high: number; moderate: number }
export const DEFAULT_LIMITS: Limits = { high: 55, moderate: 25 };

/** Same weekly plan as Inner Beast; used only until that app has been opened in this browser. */
export const FALLBACK_WEEK: Session[][] = [
  [{ id: 'mon-shadow', name: 'Shadow Boxing', kind: 'rounds', min: 19, focus: 'jab' }, { id: 'mon-bw', name: 'Bodyweight Workout', kind: 'amrap', min: 10 }, { id: 'mon-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 19, focus: 'move' }],
  [{ id: 'tue-stretch', name: 'Full Body Stretching', kind: 'routine', min: 15 }, { id: 'tue-cal', name: 'Calisthenics', kind: 'workout', min: 60 }, { id: 'tue-easy', name: 'Easy Shadow Boxing', kind: 'rounds', min: 10, focus: 'slow' }],
  [{ id: 'wed-walk', name: 'Walk (10K Steps)', kind: 'walk', min: 90 }, { id: 'wed-med', name: 'Meditation', kind: 'wimhof', min: 10 }],
  [{ id: 'thu-rope', name: 'Jumping Rope', kind: 'rounds', min: 19, focus: 'rope' }, { id: 'thu-shadow', name: 'Shadow Boxing', kind: 'rounds', min: 11, focus: 'combo' }, { id: 'thu-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 39, focus: 'power' }],
  [{ id: 'fri-stretch', name: 'Full Body Stretching', kind: 'routine', min: 15 }, { id: 'fri-cal', name: 'Calisthenics', kind: 'workout', min: 60 }, { id: 'fri-easy', name: 'Easy Shadow Boxing', kind: 'rounds', min: 10, focus: 'distance' }],
  [{ id: 'sat-mob', name: 'Mobility Training', kind: 'routine', min: 30 }, { id: 'sat-med', name: 'Meditation', kind: 'wimhof', min: 10 }, { id: 'sat-breath', name: 'Breathing Exercises', kind: 'breath', min: 10 }],
  [{ id: 'sun-jog', name: 'Jogging', kind: 'run', min: 20 }, { id: 'sun-legs', name: 'Wall Sit', kind: 'rounds', min: 19, focus: 'legs' }, { id: 'sun-lunges', name: 'Lunges', kind: 'workout', min: 15 }],
];

/** Effort per minute, by session type. An estimate from the type, never a measurement. */
export function weight(s: Pick<Session, 'kind' | 'focus'>): number {
  if (s.kind === 'rounds') return s.focus === 'slow' || s.focus === 'distance' ? 0.3 : s.focus === 'power' || s.focus === 'move' ? 1 : 0.8;
  return ({ amrap: 1, workout: 0.7, row: 0.9, run: 0.6, routine: 0.2, walk: 0.2, race: 1, coach: 0.6 } as Record<string, number>)[s.kind] ?? 0;
}

const combat = (s: Pick<Session, 'kind' | 'focus'>) => s.kind === 'rounds' && weight(s) >= 0.8;
const strength = (s: Pick<Session, 'kind'>) => s.kind === 'workout' || s.kind === 'amrap';

export interface Rating { demand: Demand; load: number; reason: string }

/** `rpeBoost` lifts the load when the user rated a logged session as very hard. */
export function classify(list: (Pick<Session, 'kind' | 'focus' | 'name' | 'min'> & { rpe?: number })[], limits: Limits = DEFAULT_LIMITS): Rating {
  const real = list.filter((s) => weight(s) > 0);
  if (!real.length) return { demand: 'rest', load: 0, reason: 'Fără antrenament solicitant.' };
  const load = Math.round(real.reduce((sum, s) => sum + s.min * weight(s) * (s.rpe != null && s.rpe >= 8 ? 1.2 : 1), 0));
  const names = real.filter((s) => weight(s) >= 0.3).map((s) => s.name);
  const text = names.length ? names.join(' + ') : real.map((s) => s.name).join(' + ');
  if (real.some(combat) && real.some(strength)) return { demand: 'high', load, reason: `${text}: box și forță în aceeași zi.` };
  if (load >= limits.high) return { demand: 'high', load, reason: `${text}: încărcare estimată ${load}.` };
  if (load >= limits.moderate) return { demand: 'moderate', load, reason: `${text}: încărcare estimată ${load}.` };
  return { demand: 'low', load, reason: `${text}: efort ușor, încărcare estimată ${load}.` };
}

type Store = { getItem(k: string): string | null };

export function readTraining(store: Store): Training {
  let week: Session[][] | null = null;
  try {
    const raw = store.getItem('beast:plan:v1');
    const parsed = raw ? JSON.parse(raw) as { week?: Session[][] } : null;
    if (Array.isArray(parsed?.week) && parsed.week.length === 7) week = parsed.week;
  } catch { week = null; }
  const log: Training['log'] = {};
  try {
    const raw = store.getItem('beast:v1');
    const state = raw ? JSON.parse(raw) as { log?: { date: string; block?: string; name: string; kind: string; dur: number; data?: Record<string, unknown> }[] } : null;
    for (const e of state?.log ?? []) {
      const rpe = Number(e.data?.['rpe']);
      (log[e.date] ??= []).push({ block: e.block, name: e.name, kind: e.kind, min: Math.round((Number(e.dur) || 0) / 60), rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : undefined });
    }
  } catch { /* unreadable log: plan only */ }
  return { linked: !!week, week: week ?? FALLBACK_WEEK, log };
}

export interface DayPlan { planned: Session[]; done: Logged[]; rating: Rating; basis: 'planned' | 'actual' | 'manual'; plannedRating: Rating }

/** Past days are rated on what was done, today and later on the plan. A manual choice always wins. */
export function dayPlan(t: Training, date: string, today: string, weekdayIdx: number, override?: Demand, limits?: Limits): DayPlan {
  const planned = t.week[weekdayIdx] ?? [];
  const done = t.log[date] ?? [];
  const plannedRating = classify(planned, limits);
  if (override) return { planned, done, plannedRating, basis: 'manual', rating: { ...plannedRating, demand: override, reason: 'Clasificare aleasă de tine.' } };
  const withFocus = done.map((d) => ({ ...d, focus: planned.find((p) => p.id === d.block)?.focus }));
  if (date < today) return { planned, done, plannedRating, basis: 'actual', rating: done.length ? classify(withFocus, limits) : { demand: 'rest', load: 0, reason: planned.length ? 'Antrenamentul planificat nu a fost făcut.' : 'Zi de odihnă.' } };
  if (date === today && done.length) {
    const left = planned.filter((p) => !done.some((d) => d.block === p.id));
    return { planned, done, plannedRating, basis: 'planned', rating: classify([...withFocus, ...left], limits) };
  }
  return { planned, done, plannedRating, basis: 'planned', rating: plannedRating };
}
