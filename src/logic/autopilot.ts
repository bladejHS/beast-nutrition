/* The pilot (2026-11-22, the user: "termină totul până la capăt. Să le aplice singur").

   Until now one decision a week was proposed on Corp and the user pressed a button. This file decides and applies by
   itself. It is deliberately boring: the research says the gains come from acting on *measured* expenditure, changing
   little, changing rarely, and explaining it — not from clever maths.

   The rules, and where they come from (research_notes/Carb cycling si coaching automat/):

   - The trigger is the measured maintenance (tdee.ts), not the gap between the scale and the goal rate. Adherence
     noise then cannot drive a cut: a week of under-eating moves the measured maintenance down too, and the two
     cancel. This is MacroFactor's documented behaviour and the one piece of published auto-regulation logic.
   - Only about half of the implied change is passed through (DAMPING). Same source. A full correction chases noise.
   - One change a week at most (MIN_DAYS), and never more than 10% of the current target in one step (MAX_STEP).
   - Nothing happens on thin data: at least 10 days with food logged and a weight line that spans 10 days, and two
     finished weeks of history, or the pilot waits.
   - Safety wins over arithmetic (safety.ts). Protein under the clinical red line, or weight falling faster than the
     cap for this body fat, means food is added or nothing is cut — on semaglutide the real danger is a deficit that
     grows by itself.
   - During a diet break, and in the first week after a change, the pilot keeps its hands off.

   Everything it does lands in plan.adjustments with a note, so the history on Corp reads as a log of what the app
   did and why, and the user can undo it. */
import type { Plan, Profile } from './calc.ts';
import { kcalFloor } from './calc.ts';
import { isBreakWeek } from './calc.ts';
import { addDays, mondayOf, type Week } from './review.ts';
import { checkSafety, rateCap, rateTarget, type Flag } from './safety.ts';
import { estimateTdee, expectedRate, KCAL_PER_KG, type IntakeDay, type Tdee } from './tdee.ts';

/** How much of the implied change is passed through. */
export const DAMPING = 0.5;
/** Days between two changes made by the pilot. */
export const MIN_DAYS = 7;
/** The largest single step, as a share of the current target. */
export const MAX_STEP = 0.1;
/** Under this many kcal the change is not worth making. */
export const MIN_STEP_KCAL = 60;

export type PilotKind = 'wait' | 'hold' | 'cut' | 'raise' | 'stop';

export interface PilotIn {
  plan: Plan;
  profile: Profile;
  goalKg?: number;
  today: string;
  intake: IntakeDay[];
  weights: Record<string, number>;
  weeks: Week[];
  /** Mean protein eaten over the window, grams a day, or null when too little was logged. */
  proteinG: number | null;
  /** The last day the pilot (or the user) changed the plan. */
  lastChange?: string;
}

export interface PilotOut {
  kind: PilotKind;
  /** The new calorie target, when there is one to apply. */
  kcal?: number;
  /** Change against the current target, kcal. */
  delta?: number;
  title: string;
  body: string;
  /** What goes in plan.adjustments. */
  note?: string;
  /** Percentage change of carbohydrate and fat, the way the rest of the app applies a change. */
  pct?: number;
  tdee: Tdee;
  flags: Flag[];
  /** The weekly rate the new target should produce, % of body mass. */
  rate?: number;
}

const round10 = (v: number) => Math.round(v / 10) * 10;
const pct1 = (v: number) => Math.round(v * 10) / 10;
/** Romanian decimals, and a thin space in the thousands, so the copy reads like the rest of the app. */
const ro = (v: number) => String(v).replace('.', ',');
const kcalRo = (v: number) => Math.round(v).toLocaleString('ro-RO');

/** The deficit that produces the target rate for this body: kcal a day. */
export function wantedDeficit(bodyKg: number, bf: number): number {
  const kgPerWeek = (rateTarget(bf) / 100) * bodyKg;
  return Math.round((kgPerWeek * KCAL_PER_KG) / 7);
}

/**
 * One decision. Pure: it reads data and returns what should happen, so every rule can be tested without a browser.
 */
export function pilot(x: PilotIn): PilotOut {
  const t = estimateTdee(x.intake, x.weights, x.today);
  const bodyKg = x.weights[Object.keys(x.weights).sort().at(-1) ?? ''] ?? x.profile.weightKg;
  const current = x.plan.macros.kcal;
  const ratePct = x.weeks.length >= 2 ? weeklyRate(x.weeks) : null;
  const flags = checkSafety({
    profile: { ...x.profile, weightKg: bodyKg },
    goalKg: x.goalKg,
    proteinG: x.proteinG,
    ratePct,
    kcal: current,
    kcalFloor: kcalFloor(x.profile.sex),
  });
  const base = { tdee: t, flags };

  // 1. the pilot never touches a diet break
  if (isBreakWeek(x.plan, mondayOf(x.today))) {
    return { ...base, kind: 'hold', title: 'Pauză de dietă', body: 'Săptămâna asta e la întreținere. Pilotul nu schimbă nimic până nu trec două săptămâni normale de deficit.' };
  }

  // 2. nor twice in a week
  if (x.lastChange && x.today < addDays(x.lastChange, MIN_DAYS)) {
    const left = Math.max(1, Math.round((Date.parse(`${addDays(x.lastChange, MIN_DAYS)}T12:00:00Z`) - Date.parse(`${x.today}T12:00:00Z`)) / 864e5));
    return { ...base, kind: 'hold', title: 'Ținta e nouă', body: `Ultima schimbare a fost pe ${x.lastChange}. O țintă are nevoie de o săptămână întreagă ca să se vadă pe cântar; mai sunt ${left} ${left === 1 ? 'zi' : 'zile'}.` };
  }

  // 3. safety before arithmetic
  const red = flags.find((f) => f.id === 'protein-red');
  if (red) {
    return { ...base, kind: 'stop', title: 'Proteina, înainte de orice', body: `Media e ${red.got} g pe zi, sub minimul de ${red.need} g. Pilotul nu taie nimic cât timp proteina e acolo: întâi ridici proteina, apoi vorbim de calorii.` };
  }
  const fast = flags.find((f) => f.id === 'too-fast');
  if (fast) {
    const add = Math.min(round10(current * MAX_STEP), round10(wantedDeficit(bodyKg, x.profile.bf) * 0.5));
    const kcal = current + add;
    return {
      ...base, kind: 'raise', kcal, delta: add, pct: pct1((add / current) * 100), rate: ratePct ?? undefined,
      title: 'Prea repede: adaug mâncare',
      body: `Ai pierdut ${ro(fast.rate)}% din greutate într-o săptămână, peste limita de ${ro(fast.cap)}% pentru grăsimea ta. Urc ținta cu ${add} kcal, la ${kcalRo(kcal)}.`,
      note: `Pilot: ritm ${fast.rate}%/săpt, peste limită`,
    };
  }

  // 4. without data the pilot waits, it does not guess
  if (!t.usable) {
    return { ...base, kind: 'wait', title: 'Strâng date', body: `Am ${t.logged} zile cu mâncare notată din 21 și ${t.span} zile de cântăriri. Pilotul pornește de la 10 și 10, ca să nu mute ținta după zgomot.` };
  }
  if (x.weeks.length < 2) {
    return { ...base, kind: 'wait', title: 'Strâng date', body: 'Îmi trebuie două săptămâni încheiate, fiecare cu cel puțin 3 cântăriri.' };
  }

  // 5. the arithmetic: where the target should sit at the measured maintenance
  const want = t.kcal - wantedDeficit(bodyKg, x.profile.bf);
  const implied = want - current;
  const damped = implied * DAMPING;
  const capped = Math.max(-current * MAX_STEP, Math.min(current * MAX_STEP, damped));
  const floor = kcalFloor(x.profile.sex);
  const wanted = round10(current + capped);
  const next = Math.max(floor, wanted);
  const delta = next - current;
  const rate = expectedRate(t, next, bodyKg) ?? undefined;

  // the floor is checked before the step size: a cut that only stops because of the floor is news, not a quiet hold
  if (wanted < floor && capped < 0) {
    return {
      ...base, kind: 'stop', title: 'Nu mai tai calorii',
      body: `Aritmetica ar cere ${kcalRo(wanted)} kcal, sub limita de ${kcalRo(floor)} kcal a aplicației. De aici se merge pe pauză de dietă, mai multă mișcare sau răbdare, nu pe mai puțină mâncare.`,
    };
  }

  if (Math.abs(delta) < MIN_STEP_KCAL) {
    return {
      ...base, kind: 'hold', rate,
      title: 'Ținta e bună',
      body: `Întreținerea măsurată e ${kcalRo(t.kcal)} kcal, iar ținta de ${kcalRo(current)} kcal duce la ${rate != null ? `${ro(Math.abs(rate))}% pe săptămână` : 'ritmul propus'}. Nu merită mutată.`,
    };
  }
  const up = delta > 0;
  // the rate the body fat allows is not always reachable from the measured maintenance without going under the floor
  const dream = round10(want);
  const reachable = dream >= floor;
  return {
    ...base,
    kind: up ? 'raise' : 'cut',
    kcal: next, delta, pct: pct1((delta / current) * 100), rate,
    title: up ? 'Urc ținta' : 'Cobor ținta',
    body: `Întreținerea măsurată e ${kcalRo(t.kcal)} kcal${t.confidence < 0.7 ? ', estimare încă subțire' : ''}. ${reachable
      ? `Pentru ${ro(rateTarget(x.profile.bf))}% pe săptămână ținta ar fi ${kcalRo(dream)} kcal; mut jumătate din drum, la ${kcalRo(next)} kcal (${up ? '+' : ''}${delta}).`
      : `Ritmul de ${ro(rateTarget(x.profile.bf))}% pe săptămână ar cere mai puțin decât limita de ${kcalRo(floor)} kcal, deci nu îl urmărim orbește: cobor un pas, la ${kcalRo(next)} kcal (${delta}), și mergem cât se poate${rate != null ? `, adică vreo ${ro(Math.abs(rate))}% pe săptămână` : ''}.`}`,
    note: `Pilot: întreținere ${t.kcal} kcal, ${up ? '+' : ''}${delta} kcal`,
  };
}

/** The weekly change of the two last finished weeks, in % of body mass; negative when losing. */
export function weeklyRate(weeks: Week[]): number | null {
  const a = weeks.at(-2), b = weeks.at(-1);
  if (!a || !b || addDays(a.start, 7) !== b.start) return null;
  return Math.round(((b.avg - a.avg) / a.avg) * 10000) / 100;
}

/** True when the pilot is allowed to write: it has a target to set and the user turned it on. */
export const willApply = (o: PilotOut, on: boolean): o is PilotOut & { kcal: number; delta: number } =>
  on && (o.kind === 'cut' || o.kind === 'raise') && typeof o.kcal === 'number';

export { rateCap };
