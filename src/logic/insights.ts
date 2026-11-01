/* What the user's own ratings and logs show about the distribution. Patterns only, never causes: nothing here changes
   a target by itself, and a suggestion needs enough ratings and the user's acceptance. */
import type { Demand } from './training.ts';

/** All ratings 1–5, where 5 is good: fatigue 5 = none, hunger 5 = none. */
export interface Feedback { energy?: number; performance?: number; fatigue?: number; recovery?: number; hunger?: number; digestion?: number; rpe?: number }
export type FeedbackKey = Exclude<keyof Feedback, 'rpe'>;
export const FEEDBACK: [FeedbackKey, string][] = [['energy', 'Energie'], ['performance', 'Performanță'], ['fatigue', 'Oboseală (5 = deloc)'], ['recovery', 'Recuperare'], ['hunger', 'Foame (5 = deloc)'], ['digestion', 'Confort digestiv']];

export const MIN_RATINGS = 4;

export type Action = { kind: 'factor'; demand: Demand; delta: number } | { kind: 'tolerance' };
export interface Insight { id: string; level: 'good' | 'watch'; title: string; body: string; action?: Action; actionLabel?: string }
export interface Rated { date: string; demand: Demand; fb: Feedback }

const CAVEAT = 'Poate ține și de somn, stres sau de deficit, nu doar de carbohidrați.';

export function insights(rows: Rated[], factors: Record<Demand, number>): Insight[] {
  const out: Insight[] = [];
  const of = (d: Demand[]) => rows.filter((r) => d.includes(r.demand));
  const share = (list: Rated[], test: (f: Feedback) => boolean) => { const known = list.filter((r) => Object.keys(r.fb).length); return { n: known.length, hits: known.filter((r) => test(r.fb)).length }; };
  const high = of(['high']);
  const tired = share(high.filter((r) => r.fb.energy != null), (f) => f.energy! <= 2);
  if (tired.n >= MIN_RATINGS && tired.hits / tired.n >= 0.6) {
    out.push({ id: 'high-energy', level: 'watch', title: 'Energie slabă în zilele HIGH', body: `Ai notat energie slabă în ${tired.hits} din ${tired.n} zile HIGH. ${CAVEAT}`, ...(factors.high < 2 ? { action: { kind: 'factor', demand: 'high', delta: 0.05 } as Action, actionLabel: 'Mărește factorul HIGH cu 0,05' } : {}) });
  }
  const strong = share(high.filter((r) => r.fb.energy != null && r.fb.performance != null), (f) => f.energy! >= 4 && f.performance! >= 4);
  if (strong.n >= MIN_RATINGS && strong.hits / strong.n >= 0.7) out.push({ id: 'high-good', level: 'good', title: 'Zilele HIGH merg bine', body: `Energie și performanță bune în ${strong.hits} din ${strong.n} zile HIGH notate. Distribuția actuală nu cere nicio schimbare.` });
  const hungry = share(of(['low', 'rest']).filter((r) => r.fb.hunger != null), (f) => f.hunger! <= 2);
  if (hungry.n >= MIN_RATINGS && hungry.hits / hungry.n >= 0.6) {
    out.push({ id: 'rest-hunger', level: 'watch', title: 'Foame mare în zilele ușoare', body: `Foame mare în ${hungry.hits} din ${hungry.n} zile LOW sau RECOVERY. ${CAVEAT}`, ...(factors.rest < 2 ? { action: { kind: 'factor', demand: 'rest', delta: 0.05 } as Action, actionLabel: 'Mărește factorul RECOVERY cu 0,05' } : {}) });
  }
  const gut = share(rows.filter((r) => r.fb.digestion != null), (f) => f.digestion! <= 2);
  if (gut.n >= MIN_RATINGS && gut.hits / gut.n >= 0.5) out.push({ id: 'gut', level: 'watch', title: 'Disconfort digestiv la antrenament', body: `Disconfort în ${gut.hits} din ${gut.n} zile notate. O pauză mai mare după masă ar putea ajuta.`, action: { kind: 'tolerance' }, actionLabel: 'Treci toleranța pe Sensibil' });
  return out;
}

export interface DayRow { date: string; demand: Demand; planned: Demand; targetC: number; eatenC: number; targetKcal: number; eatenKcal: number; sessionsDone: number; sessionsPlanned: number }

/** Averages by class, from the days that have food logged. */
export function byClass(rows: DayRow[]) {
  const levels: Demand[] = ['high', 'moderate', 'low', 'rest'];
  return levels.map((demand) => {
    const days = rows.filter((r) => r.demand === demand && r.eatenKcal > 0);
    const avg = (f: (r: DayRow) => number) => (days.length ? Math.round(days.reduce((a, r) => a + f(r), 0) / days.length) : 0);
    return { demand, days: days.length, targetC: avg((r) => r.targetC), eatenC: avg((r) => r.eatenC), fit: days.length ? Math.round((days.filter((r) => r.targetC > 0 && Math.abs(r.eatenC - r.targetC) / r.targetC <= 0.15).length / days.length) * 100) : 0 };
  });
}

/** How often training came out different from the plan. */
export function plannedVsActual(rows: DayRow[]) {
  const trained = rows.filter((r) => r.sessionsPlanned > 0);
  return { days: trained.length, sameClass: trained.filter((r) => r.demand === r.planned).length, sessionsDone: rows.reduce((a, r) => a + r.sessionsDone, 0), sessionsPlanned: rows.reduce((a, r) => a + r.sessionsPlanned, 0) };
}
