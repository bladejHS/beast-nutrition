/* Reads the real training plan and log of HYBRID FORGE (ex Inner Beast) (same origin, so same localStorage) and rates each day.
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

export type WeightKey = 'boxHard' | 'boxTech' | 'boxEasy' | 'footwork' | 'legs' | 'amrap' | 'workout' | 'row' | 'run' | 'thr' | 'long' | 'race' | 'coach' | 'routine' | 'walk';
export type Weights = Record<WeightKey, number>;
/** Effort per minute by session type. An estimate of this app, not a validated measure of carbohydrate needs. */
export const DEFAULT_WEIGHTS: Weights = { boxHard: 1, boxTech: 0.8, boxEasy: 0.3, footwork: 0.8, legs: 0.8, amrap: 1, workout: 0.7, row: 0.9, run: 0.6, thr: 1, long: 0.8, race: 1, coach: 0.6, routine: 0.2, walk: 0.2 };
export const WEIGHT_LABEL: Record<WeightKey, string> = { boxHard: 'Sac, pads: putere, mișcare', boxTech: 'Kickbox tehnic, combinații', boxEasy: 'Kickbox lent, distanță', footwork: 'Coardă, scară', legs: 'Intervale picioare', amrap: 'AMRAP', workout: 'Forță, calistenie', row: 'Ski / Row, Engine Builder', run: 'Alergare ușoară (Zona 2)', thr: 'Threshold, intervale', long: 'Alergare lungă',  race: 'Simulare de concurs', coach: 'Antrenor cu cameră', routine: 'Mobilitate, stretching', walk: 'Mers' };

export interface Rules { limits: Limits; weights: Weights; boxStrength: boolean }
export const DEFAULT_RULES: Rules = { limits: DEFAULT_LIMITS, weights: DEFAULT_WEIGHTS, boxStrength: true };

/** What each kickboxing block trains, in the words of the plan (Inner Beast's FOCUS_LINE). */
export const FOCUS_LABEL: Record<string, string> = { jab: 'Jab, Teep & Footwork', move: 'Strikes & Movement', combo: 'Combinations', power: 'Dutch Combinations & Power', slow: 'Slow, Clean Technique', distance: 'Distance Work', pads: 'Thai Pads' };

/** The same weekly plan as HYBRID FORGE (ex Inner Beast), as its bridge publishes it with the default choices:
 *  Hybrid365 since 2026-11-20 (run + strength split). Used when HYBRID FORGE has not been opened in this browser,
 *  which is always the case for two separate home-screen apps on an iPhone. */
export const FALLBACK_WEEK: Session[][] = [
  [{ id: 'mon-run', name: 'Easy Run (Zone 2)', kind: 'run', min: 30, alt: { other: 'Easy Row (Zone 2)' } }, { id: 'mon-upper', name: 'Upper Body (Strength)', kind: 'workout', min: 55 }, { id: 'mon-core', name: 'Core (Circuits)', kind: 'workout', min: 9 }],
  [{ id: 'tue-wu', name: 'Warm Up: Easy Run + Drills', kind: 'run', min: 12 }, { id: 'tue-thr', name: 'Threshold Run', kind: 'run', min: 29 }, { id: 'tue-cd', name: 'Cool Down: Easy Run', kind: 'run', min: 10 }],
  [{ id: 'wed-upper', name: 'Upper Body (Strength)', kind: 'workout', min: 60 }, { id: 'wed-cond', name: 'Engine Builder (Ski/Row)', kind: 'row', min: 14, alt: { other: 'Hybrid Circuit (10 Min AMRAP)', detail: '8 × 250 m' } }],
  [{ id: 'thu-run', name: 'Easy Run (Zone 2)', kind: 'run', min: 30, alt: { other: 'Easy Row (Zone 2)' } }, { id: 'thu-lower', name: 'Lower Body (Strength)', kind: 'workout', min: 55 }],
  [{ id: 'fri-upper', name: 'Upper Body (Strength + Power)', kind: 'workout', min: 65 }, { id: 'fri-emom', name: 'Power Finisher', kind: 'routine', min: 10 }, { id: 'fri-core', name: 'Core (Circuits)', kind: 'workout', min: 9 }],
  [{ id: 'sat-long', name: 'Long Run (Endurance)', kind: 'run', min: 60, alt: { other: 'Long Row (Endurance)' } }],
  [{ id: 'sun-walk', name: 'Light Walk / Easy Bike', kind: 'run', min: 8 }, { id: 'sun-flow', name: 'Mobility Flow (Full Body)', kind: 'routine', min: 12 }, { id: 'sun-stretch', name: 'Stretching', kind: 'routine', min: 12 }, { id: 'sun-foam', name: 'Foam Roll / Trigger Point', kind: 'routine', min: 6 }, { id: 'sun-breath', name: 'Deep Breathing / Mindset Reset', kind: 'breath', min: 5 }],
];

/** Knee Armor and Kick Armor: a few minutes of isometrics and balance, prehab rather than a strength session. */
const prehab = (s: { kind: string; id?: string; name?: string }) => s.kind === 'workout' && (/^(knee|kick)-/.test(s.id ?? '') || /\bArmor\b/.test(s.name ?? ''));

/** The keys that the Hybrid365 week uses, in the order the settings show them. */
export const HYBRID_KEYS: WeightKey[] = ['workout', 'amrap', 'thr', 'long', 'run', 'row', 'walk', 'routine'];

export function weightKey(s: Pick<Session, 'kind' | 'focus'> & { id?: string; name?: string }): WeightKey | null {
  if (prehab(s)) return 'routine';
  const label = `${s.id ?? ''} ${s.name ?? ''}`;
  // Hybrid365 (2026-11-20): runs differ a lot in effort, and the Power Finisher is an EMOM, not mobility
  if (s.kind === 'run') {
    if (/threshold|-thr\b|interval|tempo/i.test(label)) return 'thr';
    if (/long run|long row|-long\b/i.test(label)) return 'long';
    if (/walk|bike/i.test(label)) return 'walk';
  }
  if (s.kind === 'routine' && /emom|power finisher/i.test(label)) return 'amrap';
  if (s.kind === 'rounds') {
    if (s.focus === 'slow' || s.focus === 'distance') return 'boxEasy';
    if (s.focus === 'power' || s.focus === 'move' || s.focus === 'pads') return 'boxHard';
    if (s.focus === 'rope' || s.focus === 'ladder') return 'footwork';
    return s.focus === 'legs' ? 'legs' : 'boxTech';
  }
  return (['amrap', 'workout', 'row', 'run', 'routine', 'walk', 'race', 'coach'] as const).find((k) => k === s.kind) ?? null;
}

export const weight = (s: Pick<Session, 'kind' | 'focus'> & { id?: string; name?: string }, w: Weights = DEFAULT_WEIGHTS): number => { const k = weightKey(s); return k ? w[k] ?? DEFAULT_WEIGHTS[k] : 0; };

/** Hard boxing rounds. Rope, ladder and leg intervals use the same timer but are not boxing. */
const combat = (s: Pick<Session, 'kind' | 'focus'>) => { const k = weightKey(s); return k === 'boxHard' || k === 'boxTech'; };
const strength = (s: Pick<Session, 'kind'> & { id?: string; name?: string }) => (s.kind === 'workout' || s.kind === 'amrap') && !prehab(s);
const legDay = (s: { id?: string; name?: string }) => /\bleg|lower|picioare|lunge/i.test(`${s.id ?? ''} ${s.name ?? ''}`);
/** Under this load, with nothing at moderate intensity for 10 minutes, the day is recovery (2026-11-15 review). */
export const RECOVERY_LOAD = 20;

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
  // 2026-11-15 review: legs are the most muscle and the most glycogen; a long leg session is a HIGH day by itself
  if (real.some((s) => strength(s) && s.min >= 40 && legDay(s))) return { demand: 'high', load, reason: `${text}: zi de picioare, cea mai mare masă musculară.`, parts };
  if (load >= r.limits.high) return { demand: 'high', load, reason: `${text}: încărcare estimată ${load}.`, parts };
  if (load >= r.limits.moderate) return { demand: 'moderate', load, reason: `${text}: încărcare estimată ${load}.`, parts };
  // only light movement (a walk, mobility, breathing): a recovery day, the lowest carbs of the week
  if (load < RECOVERY_LOAD && !parts.some((p) => p.intensity >= 0.5 && p.min >= 10)) return { demand: 'rest', load, reason: `${text}: doar mișcare ușoară, zi de recuperare.`, parts };
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
