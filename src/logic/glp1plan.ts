/* The whole semaglutide protocol as five phases, added 2026-11-21 at the user's request after the research on
 * semaglutide ("adaugă protocolul de semaglutidă în tabul semaglutidă").
 *
 * The rule of logic/glp1.ts still holds: the app prescribes nothing. The only dose numbers here are the label's own
 * escalation (already in LADDER) and the pace the scale should show; everything else is what the user controls —
 * protein, lifting, measurements, and the way out.
 *
 * Sources: Wegovy SmPC/label (0.25 → 0.5 → 1 → 1.7 → 2.4 mg weekly, ≥4 weeks per step; 7.2 mg approved 2026-03 only
 * after ≥4 weeks tolerated at 2.4); STEP 1 (Wilding 2021: −14.9 % at 68 weeks; DEXA substudy, lean mass about a third
 * to 45 % of the loss without training); STEP 1 extension (Wilding 2022: two thirds of the loss regained a year after
 * stopping); SELECT (Lincoff 2023, cardiovascular outcomes); Norton on lean mass vs muscle mass (25–40 % of the loss
 * is lean mass on diet alone without resistance training, so the GLP-1 figure is not drug-specific); Garvey 2022
 * (maintenance); ISSN 2017 and Helms 2014 for the protein floor in a deficit. */
import type { Sex } from './calc.ts';
import { LADDER, weeksAtDose, type Glp1 } from './glp1.ts';

/** Devine ideal body weight, kg, from height: the reference obesity dosing is built on. */
export function idealKg(heightCm: number, sex: Sex): number {
  const inchesOver5ft = Math.max(0, heightCm - 152.4) / 2.54;
  return (sex === 'm' ? 50 : 45.5) + 2.3 * inchesOver5ft;
}

/** Adjusted body weight: ideal plus 40 % of the excess. Protein on total weight overshoots badly above 30 % fat. */
export function adjustedKg(heightCm: number, kg: number, sex: Sex): number {
  const ibw = idealKg(heightCm, sex);
  return kg > ibw ? ibw + 0.4 * (kg - ibw) : kg;
}

/** Protein floor for a deficit held with a GLP-1, g per day: 1.8 g per kg of adjusted weight. */
export const proteinFloor = (adjKg: number) => Math.round(adjKg * 1.8);

/** The weekly loss that protects lean mass, as kg for this body weight: 0.5–0.75 % per week. */
export const rateBandKg = (kg: number): [number, number] => [(kg * 0.5) / 100, (kg * 0.75) / 100];

/** The panel worth having before the first injection and again at three months. */
export const BASELINE_LABS = ['hba1c', 'glucose', 'insulin', 'ldl', 'hdl', 'tg', 'alt', 'creatinine', 'lipase', 'tsh', 'vitd', 'b12'] as const;

/** How many of the baseline markers already have a result. */
export const labsCovered = (results: { marker: string }[]): number =>
  BASELINE_LABS.filter((id) => results.some((r) => r.marker === id)).length;

export type PhaseId = 'before' | 'titrate' | 'cut' | 'hold' | 'exit';
export type PhaseState = 'done' | 'now' | 'next';

export const PHASE_TITLE: Record<PhaseId, string> = {
  before: 'Înainte de prima injecție',
  titrate: 'Titrarea',
  cut: 'Slăbitul',
  hold: 'Menținerea',
  exit: 'Ieșirea',
};

export const PHASE_WHEN: Record<PhaseId, string> = {
  before: '2–4 săptămâni',
  titrate: 'săptămânile 1–16',
  cut: 'până la ținta finală',
  hold: '6–12 luni la ținta atinsă',
  exit: 'în trepte, de-a lungul lunilor',
};

/** Which phase the treatment is in now. `atGoal`: the final weight from Corp has been reached. */
export function phaseOf(g: Glp1, atGoal: boolean): PhaseId {
  if (!g.on) return g.shots.length ? 'exit' : 'before';
  if (atGoal) return 'hold';
  // still climbing the label's ladder, or not yet four tolerated weeks on the top maintenance dose
  const top = g.mg >= LADDER[LADDER.length - 1]!;
  return top && weeksAtDose(g) >= 4 ? 'cut' : 'titrate';
}

const ORDER: PhaseId[] = ['before', 'titrate', 'cut', 'hold', 'exit'];

/** done for the phases already passed, now for the current one, next for what comes after. */
export function phaseStates(current: PhaseId): Record<PhaseId, PhaseState> {
  const i = ORDER.indexOf(current);
  return Object.fromEntries(ORDER.map((p, k) => [p, k < i ? 'done' : k === i ? 'now' : 'next'])) as Record<PhaseId, PhaseState>;
}
