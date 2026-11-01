/* Reads the real training plan and log of Inner Beast (same origin, so same localStorage) and rates each day.
   The classes and thresholds below are this app's own rule, not Layne Norton's. */

export type Demand = 'high' | 'moderate' | 'low' | 'rest';
export const DEMAND_LABEL: Record<Demand, string> = { high: 'HIGH DEMAND', moderate: 'MODERATE DEMAND', low: 'LOW DEMAND', rest: 'REST' };
export const CARB_LABEL: Record<Demand, string> = { high: 'HIGH CARB', moderate: 'MODERATE CARB', low: 'LOWER CARB', rest: 'RECOVERY' };

/** `alt` marks a slot with two options: only the picked one is here, `other` is what was left out. */
export interface Session { id: string; name: string; kind: string; min: number; focus?: string; alt?: { other: string; detail?: string } }
/** A session as done, kept apart from the plan. `detail`: the volume the log has, such as rounds or metres. */
export interface Logged { block?: string; name: string; kind: string; min: number; rpe?: number; detail?: string }
export interface Training {
  /** True when the data really came from Inner Beast. */
  linked: boolean;
  /** Monday = 0. */
  week: Session[][];
  log: Record<string, Logged[]>;
  /** Hours slept, as noted in Inner Beast. */
  sleep: Record<string, number>;
}

export interface Limits { high: number; moderate: number }
export const DEFAULT_LIMITS: Limits = { high: 55, moderate: 25 };

export type WeightKey = 'boxHard' | 'boxTech' | 'boxEasy' | 'footwork' | 'legs' | 'amrap' | 'workout' | 'row' | 'run' | 'race' | 'coach' | 'routine' | 'walk';
export type Weights = Record<WeightKey, number>;
/** Effort per minute by session type. An estimate of this app, not a validated measure of carbohydrate needs. */
export const DEFAULT_WEIGHTS: Weights = { boxHard: 1, boxTech: 0.8, boxEasy: 0.3, footwork: 0.8, legs: 0.8, amrap: 1, workout: 0.7, row: 0.9, run: 0.6, race: 1, coach: 0.6, routine: 0.2, walk: 0.2 };
export const WEIGHT_LABEL: Record<WeightKey, string> = { boxHard: 'Sac: putere, mișcare', boxTech: 'Box tehnic, combinații', boxEasy: 'Box lent, distanță', footwork: 'Coardă, scară', legs: 'Intervale picioare', amrap: 'AMRAP', workout: 'Forță, calistenie', row: 'Machine Row', run: 'Alergare', race: 'Simulare de concurs', coach: 'Antrenor cu cameră', routine: 'Mobilitate, stretching', walk: 'Mers' };

export interface Rules { limits: Limits; weights: Weights; boxStrength: boolean }
export const DEFAULT_RULES: Rules = { limits: DEFAULT_LIMITS, weights: DEFAULT_WEIGHTS, boxStrength: true };

/** What each boxing block trains, in the words of the plan. */
export const FOCUS_LABEL: Record<string, string> = { jab: 'Jab & Footwork', move: 'Punches & Movement', combo: 'Combinations', power: 'Angle Changes & Power', slow: 'Controlled & Clean', distance: 'Distance Work' };

/** Same weekly plan as Inner Beast; used only until that app has been opened in this browser. */
export const FALLBACK_WEEK: Session[][] = [
  [{ id: 'mon-shadow', name: 'Shadow Boxing', kind: 'rounds', min: 25, focus: 'jab' }, { id: 'mon-bw', name: 'Bodyweight Workout', kind: 'amrap', min: 10 }, { id: 'mon-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 19, focus: 'move' }],
  [{ id: 'tue-stretch', name: 'Full Body Stretching', kind: 'routine', min: 15 }, { id: 'tue-cal', name: 'Calisthenics', kind: 'workout', min: 60 }, { id: 'tue-easy', name: 'Easy Shadow Boxing', kind: 'rounds', min: 10, focus: 'slow' }],
  [{ id: 'wed-walk', name: 'Walk (10K Steps)', kind: 'walk', min: 75 }, { id: 'wed-shower', name: 'Cold & Warm Showers', kind: 'shower', min: 10 }, { id: 'wed-med', name: 'Meditation', kind: 'wimhof', min: 12 }],
  [{ id: 'thu-rope', name: 'Jumping Rope', kind: 'rounds', min: 25, focus: 'rope', alt: { other: 'Agility Ladder' } }, { id: 'thu-shadow', name: 'Shadow Boxing', kind: 'rounds', min: 11, focus: 'combo' }, { id: 'thu-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 39, focus: 'power', alt: { other: 'Machine Row' } }],
  [{ id: 'fri-stretch', name: 'Full Body Stretching', kind: 'routine', min: 15 }, { id: 'fri-cal', name: 'Calisthenics', kind: 'workout', min: 60 }, { id: 'fri-easy', name: 'Easy Shadow Boxing', kind: 'rounds', min: 10, focus: 'distance' }],
  [{ id: 'sat-mob', name: 'Mobility Training', kind: 'routine', min: 30 }, { id: 'sat-med', name: 'Meditation', kind: 'wimhof', min: 10 }, { id: 'sat-breath', name: 'Breathing Exercises', kind: 'breath', min: 10 }],
  [{ id: 'sun-jog', name: 'Jogging', kind: 'run', min: 20 }, { id: 'sun-legs', name: 'Wall Sit', kind: 'rounds', min: 19, focus: 'legs' }, { id: 'sun-lunges', name: 'Lunges', kind: 'workout', min: 15 }],
];

export function weightKey(s: Pick<Session, 'kind' | 'focus'>): WeightKey | null {
  if (s.kind === 'rounds') {
    if (s.focus === 'slow' || s.focus === 'distance') return 'boxEasy';
    if (s.focus === 'power' || s.focus === 'move') return 'boxHard';
    if (s.focus === 'rope' || s.focus === 'ladder') return 'footwork';
    return s.focus === 'legs' ? 'legs' : 'boxTech';
  }
  return (['amrap', 'workout', 'row', 'run', 'routine', 'walk', 'race', 'coach'] as const).find((k) => k === s.kind) ?? null;
}

export const weight = (s: Pick<Session, 'kind' | 'focus'>, w: Weights = DEFAULT_WEIGHTS): number => { const k = weightKey(s); return k ? w[k] : 0; };

/** Hard boxing rounds. Rope, ladder and leg intervals use the same timer but are not boxing. */
const combat = (s: Pick<Session, 'kind' | 'focus'>) => { const k = weightKey(s); return k === 'boxHard' || k === 'boxTech'; };
const strength = (s: Pick<Session, 'kind'>) => s.kind === 'workout' || s.kind === 'amrap';

export interface LoadPart { id: string; name: string; min: number; intensity: number; load: number; rpe?: number }
export interface Rating { demand: Demand; load: number; reason: string; parts: LoadPart[] }

/** Very hard sessions count more and very easy ones less, when the user rated them. */
const rpeBoost = (rpe?: number) => (rpe == null ? 1 : rpe >= 8 ? 1.2 : rpe <= 4 ? 0.85 : 1);

export function classify(list: (Pick<Session, 'kind' | 'focus' | 'name' | 'min'> & { id?: string; rpe?: number })[], rules: Partial<Rules> = {}): Rating {
  const r = { ...DEFAULT_RULES, ...rules };
  const real = list.filter((s) => weight(s, r.weights) > 0 && s.min > 0);
  if (!real.length) return { demand: 'rest', load: 0, reason: 'Fără antrenament solicitant.', parts: [] };
  const parts = real.map((s) => { const intensity = weight(s, r.weights); return { id: s.id ?? s.name, name: s.name, min: s.min, intensity, load: s.min * intensity * rpeBoost(s.rpe), ...(s.rpe != null ? { rpe: s.rpe } : {}) }; });
  const load = Math.round(parts.reduce((sum, p) => sum + p.load, 0));
  const named = real.filter((s) => weight(s, r.weights) >= 0.3).map((s) => s.name);
  const text = named.length ? named.join(' + ') : real.map((s) => s.name).join(' + ');
  if (r.boxStrength && real.some(combat) && real.some(strength)) return { demand: 'high', load, reason: `${text}: box și forță în aceeași zi.`, parts };
  if (load >= r.limits.high) return { demand: 'high', load, reason: `${text}: încărcare estimată ${load}.`, parts };
  if (load >= r.limits.moderate) return { demand: 'moderate', load, reason: `${text}: încărcare estimată ${load}.`, parts };
  return { demand: 'low', load, reason: `${text}: efort ușor, încărcare estimată ${load}.`, parts };
}

type Store = { getItem(k: string): string | null };
type LogRow = { date: string; block?: string; name: string; kind: string; dur: number; data?: Record<string, unknown> };

/** The work the log recorded, in the units Inner Beast saved it. */
function volume(e: LogRow): string | undefined {
  const d = e.data ?? {};
  const n = (k: string) => Number(d[k]) || 0;
  if (e.kind === 'rounds' && n('rounds')) return `${n('rounds')}${n('planned') ? ` din ${n('planned')}` : ''} runde`;
  if (e.kind === 'row' && n('meters')) return `${n('meters').toLocaleString('ro-RO')}${n('target') ? ` din ${n('target').toLocaleString('ro-RO')}` : ''} m`;
  if (e.kind === 'run' && n('m')) return `${(n('m') / 1000).toFixed(1).replace('.', ',')} km`;
  if (e.kind === 'amrap' && n('rounds')) return `${n('rounds')} runde`;
  if (e.kind === 'workout' && Array.isArray(d['ex'])) return `${(d['ex'] as unknown[]).length} exerciții`;
  return undefined;
}

export function readTraining(store: Store): Training {
  let week: Session[][] | null = null;
  try {
    const raw = store.getItem('beast:plan:v1');
    const parsed = raw ? JSON.parse(raw) as { week?: Session[][] } : null;
    if (Array.isArray(parsed?.week) && parsed.week.length === 7) week = parsed.week;
  } catch { week = null; }
  const log: Training['log'] = {};
  let sleep: Training['sleep'] = {};
  try {
    const raw = store.getItem('beast:v1');
    const state = raw ? JSON.parse(raw) as { sleep?: Training['sleep']; log?: LogRow[] } : null;
    sleep = state?.sleep ?? {};
    for (const e of state?.log ?? []) {
      const rpe = Number(e.data?.['rpe']);
      (log[e.date] ??= []).push({ block: e.block, name: e.name, kind: e.kind, min: Math.round((Number(e.dur) || 0) / 60), rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : undefined, detail: volume(e) });
    }
  } catch { /* unreadable log: plan only */ }
  return { linked: !!week, week: week ?? FALLBACK_WEEK, log, sleep };
}

export type Status = 'planned' | 'done' | 'partial' | 'changed' | 'skipped' | 'cancelled';
export const STATUS_LABEL: Record<Status, string> = { planned: '', done: 'Făcut', partial: 'Parțial', changed: 'Schimbat', skipped: 'Sărit', cancelled: 'Anulat' };

export function sessionStatus(s: Session, done: Logged[], date: string, today: string, cancelled: string[] = []): Status {
  if (cancelled.includes(s.id)) return 'cancelled';
  const log = done.find((d) => d.block === s.id);
  if (log) {
    if (log.kind !== s.kind) return 'changed';
    return log.min > 0 && log.min < s.min * 0.7 ? 'partial' : 'done';
  }
  return date < today ? 'skipped' : 'planned';
}

export interface DayPlan { planned: Session[]; done: Logged[]; rating: Rating; basis: 'planned' | 'actual' | 'manual'; plannedRating: Rating }

/** Past days are rated on what was done, today and later on the plan. A manual choice always wins. Cancelled sessions never count. */
export function dayPlan(t: Training, date: string, today: string, weekdayIdx: number, override?: Demand, rules?: Partial<Rules>, cancelled: string[] = []): DayPlan {
  const planned = t.week[weekdayIdx] ?? [];
  const live = planned.filter((p) => !cancelled.includes(p.id));
  const done = t.log[date] ?? [];
  const plannedRating = classify(live, rules);
  if (override) return { planned, done, plannedRating, basis: 'manual', rating: { ...plannedRating, demand: override, reason: 'Clasificare aleasă de tine.' } };
  // A block ticked by hand has no duration: the plan's minutes stand in for it.
  const actual = done.map((d) => { const p = planned.find((x) => x.id === d.block); return { ...d, id: d.block ?? d.name, focus: p?.focus, min: d.min || p?.min || 0 }; });
  if (date < today) return { planned, done, plannedRating, basis: 'actual', rating: done.length ? classify(actual, rules) : { demand: 'rest', load: 0, reason: live.length ? 'Antrenamentul planificat nu a fost făcut.' : 'Zi de odihnă.', parts: [] } };
  if (date === today && done.length) {
    const left = live.filter((p) => !done.some((d) => d.block === p.id));
    return { planned, done, plannedRating, basis: 'planned', rating: classify([...actual, ...left], rules) };
  }
  return { planned, done, plannedRating, basis: 'planned', rating: plannedRating };
}

/** Which option of a two-way slot is in the plan, in words. */
export function picks(list: Session[]): string[] {
  return list.filter((x) => x.alt).map((x) => `${x.name}${x.alt!.detail ? ` (${x.alt!.detail})` : ''}, nu ${x.alt!.other}`);
}

/** The first planned session of the day not yet in the log. */
export function nextSession(p: Pick<DayPlan, 'planned' | 'done'>, cancelled: string[] = []): Session | null {
  return p.planned.find((s) => s.min > 0 && !cancelled.includes(s.id) && !p.done.some((d) => d.block === s.id)) ?? null;
}
