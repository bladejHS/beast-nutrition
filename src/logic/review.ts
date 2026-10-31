/* Weekly check-in decisions, from chapters 10 and 11 of "Fat Loss Forever". */
import { isBreakWeek, type Pace, type Plan } from './calc.ts';

export interface Week { start: string; avg: number; n: number }

export interface CheckIn {
  waist?: number; hips?: number; bf?: number;
  adherence?: number; energy?: number; strength?: number; hunger?: number; mood?: number; stress?: number; sleep?: number;
}

export interface Review {
  level: 'wait' | 'good' | 'watch' | 'act';
  title: string;
  body: string;
  /** Proposed change to carbs and fat, percent. */
  pct?: number;
  note?: string;
  suggestReverse?: boolean;
}

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));

/** Finished weeks with at least 3 weigh-ins (the book's minimum), oldest first. */
export function finishedWeeks(weights: Record<string, number>, today: string): Week[] {
  const map = new Map<string, number[]>();
  for (const [d, kg] of Object.entries(weights)) {
    const w = mondayOf(d);
    map.set(w, [...(map.get(w) ?? []), kg]);
  }
  const current = mondayOf(today);
  return [...map.entries()]
    .filter(([w, list]) => w < current && list.length >= 3)
    .map(([start, list]) => ({ start, n: list.length, avg: list.reduce((a, b) => a + b, 0) / list.length }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

const consecutive = (a: Week, b: Week) => addDays(a.start, 7) === b.start;

/** Next step of the ladder: 5, 10, 15; a step that worked is retried 2.5 lower. */
export function nextCut(plan: Plan, weeks: Week[]): { pct: number; exhausted: boolean } {
  const last = plan.adjustments.filter((a) => a.pct < 0).at(-1);
  if (!last) return { pct: 5, exhausted: false };
  const size = Math.abs(last.pct);
  const after = weeks.filter((w) => w.start >= mondayOf(last.date));
  const target = (w: Week) => (w.avg * plan.ratePct) / 100;
  const worked = after.slice(1).some((w, i) => after[i]!.avg - w.avg >= target(w) * 0.5);
  if (worked) return { pct: Math.max(5, size - 2.5), exhausted: false };
  return size >= 15 ? { pct: 15, exhausted: true } : { pct: Math.min(15, size + 5), exhausted: false };
}

const REVERSE_LIMIT: Record<Pace, number> = { c: 0.2, m: 0.35, a: 0.5 };
export const REVERSE_STEP: Record<Pace, number> = { c: 3.5, m: 6.5, a: 10 };

export function review(plan: Plan, weeks: Week[], checkins: Record<string, CheckIn>): Review {
  const wait: Review = {
    level: 'wait', title: 'Strângem date',
    body: 'Decizia vine din media săptămânii. Sunt necesare două săptămâni încheiate la rând, fiecare cu cel puțin 3 cântăriri.',
  };
  const a = weeks.at(-2), b = weeks.at(-1);
  if (!a || !b || !consecutive(a, b)) return wait;
  const lost = a.avg - b.avg;
  const changePct = (lost / a.avg) * 100;
  const diff = `Media a trecut de la ${a.avg.toFixed(1)} la ${b.avg.toFixed(1)} kg.`;

  if (plan.phase === 'reverse') {
    const gain = -changePct;
    const three = weeks.slice(-4);
    const rising = three.length === 4 && three.every((w, i) => i === 0 || (consecutive(three[i - 1]!, w) && w.avg > three[i - 1]!.avg));
    if (gain > REVERSE_LIMIT[plan.pace]) return { level: 'watch', title: 'Ținem caloriile o săptămână', body: `${diff} Creșterea de ${gain.toFixed(2)}% e peste limita aleasă. Poate fi doar o fluctuație, așa că mai așteptăm o săptămână.` };
    if (rising) return { level: 'watch', title: 'Încetinim', body: `${diff} Greutatea crește de 3 săptămâni la rând, chiar dacă fiecare creștere e mică. Pauză de o săptămână.` };
    return { level: 'act', title: 'Adăugăm calorii', body: `${diff} Greutatea e în limita acceptată.`, pct: REVERSE_STEP[plan.pace], note: 'Reverse: creștere săptămânală' };
  }

  if (plan.phase === 'maintain') {
    if (Math.abs(changePct) <= 0.5) return { level: 'good', title: 'Menținere stabilă', body: `${diff} Rămâi la aceleași cifre.` };
    return changePct > 0
      ? { level: 'act', title: 'Slăbești fără să vrei', body: `${diff} Crește puțin carbohidrații și grăsimile.`, pct: 5, note: 'Menținere: scădere nedorită' }
      : { level: 'act', title: 'Greutatea urcă', body: `${diff} Dacă nu e o fluctuație, o ajustare mică o oprește.`, pct: -5, note: 'Menținere: creștere nedorită' };
  }

  if (isBreakWeek(plan, b.start) || isBreakWeek(plan, a.start)) {
    return { level: 'wait', title: 'Pauză de dietă', body: `${diff} La mențineri nu se ajustează nimic. Reevaluăm după două săptămâni normale de deficit.` };
  }
  const target = (a.avg * plan.ratePct) / 100;
  if (changePct > 1) return { level: 'act', title: 'Mergi prea repede', body: `${diff} Ai slăbit ${changePct.toFixed(2)}% într-o săptămână, peste limita de 1%.`, pct: 5, note: 'Ritm peste 1% pe săptămână' };
  if (lost >= target * 0.5) return { level: 'good', title: 'Pe drumul bun', body: `${diff} Ai pierdut ${lost.toFixed(2)} kg din ${target.toFixed(2)} kg propuse. Nu schimbi nimic.` };

  const c = weeks.at(-3);
  const twoInARow = !!c && consecutive(c, a) && c.avg - a.avg < target * 0.5;
  if (!twoInARow) return { level: 'watch', title: 'O săptămână mai lentă', body: `${diff} O singură săptămână sub 50% din țintă nu e platou. Rămâi la plan.` };

  const scores = [checkins[a.start]?.adherence, checkins[b.start]?.adherence].filter((x): x is number => x != null);
  const adherence = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null;
  if (adherence != null && adherence < 8) {
    return { level: 'watch', title: 'Întâi aderența', body: `${diff} Ai notat aderența cu ${adherence.toFixed(1)} din 10. Înainte să tai calorii, cântărește tot ce mănânci timp de două săptămâni.` };
  }
  const waistA = checkins[a.start]?.waist, waistB = checkins[b.start]?.waist;
  if (waistA != null && waistB != null && waistB < waistA) {
    return { level: 'watch', title: 'Talia scade', body: `${diff} Cântarul stă, dar talia a scăzut cu ${(waistA - waistB).toFixed(1)} cm. Mai așteptăm o săptămână.` };
  }
  const step = nextCut(plan, weeks);
  if (step.exhausted) {
    return { level: 'act', suggestReverse: true, title: 'Mergi spre reverse diet', body: `${diff} Nici −15% la carbohidrați și grăsimi nu a mișcat cântarul. Metabolismul are nevoie de timp, nu de și mai puțină mâncare.` };
  }
  return {
    level: 'act', title: 'Platou real',
    body: `${diff} Două verificări la rând sub 50% din țintă. Platoul e normal: reduci carbohidrații și grăsimile cu ${step.pct}%, proteina rămâne${step.pct === 5 ? ', și adaugi 5% timp de mișcare pe săptămână' : ''}.`,
    pct: -step.pct, note: 'Platou',
  };
}

/** Ch. 11: maintenance estimated from what actually happened. */
export const maintenanceFromData = (avgIntake: number, weeklyLossKg: number, factor: number) => Math.round(avgIntake + weeklyLossKg * factor);
