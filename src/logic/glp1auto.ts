/* Semaglutide, applied by the app (2026-11-22, the user: "vreau sa se faca actualizari automate pe baza
 * protocolului ... vreau strict pe semaglutida").
 *
 * Same shape as the CJC rules in logic/rx.ts: pure functions decide, the screen applies, every change says why.
 *
 * TWO HARD LIMITS, from the user's own words and from the app's standing rule:
 *   1. Nothing here may touch the macronutrients or the training. The only field any rule writes is `State.glp1`.
 *      The training week is read to pick a quiet injection day; it is never written.
 *   2. No rule changes the dose in milligrams. That is the doctor's. Rules may HOLD a step up, never make one.
 *
 * Every change is logged with its reason and can be undone from the screen. */
import type { Demand } from './training.ts';
import { LADDER, weeklyRate, weeksAtDose, type Glp1 } from './glp1.ts';

/** 90 days: the label's own three-month check, and the protocol's lab repeat. */
export const RECHECK_DAYS = 90;
/** Losing faster than this for two weeks running holds the titration (lean mass, gallstones). */
export const FAST_PCT = 1.2;

export type AutoKind = 'day' | 'hold' | 'release' | 'labs' | 'phase';

export interface AutoEntry {
  id: string;
  /** Which rule fired. */
  kind: AutoKind;
  date: string;
  /** What the user sees. */
  text: string;
  /** What to put back on undo, when the rule changed a field. */
  undo?: { day?: number; hold?: boolean };
}

export interface Auto {
  /** The master switch. On by default: the user asked for this to be automatic. */
  on: boolean;
  log: AutoEntry[];
  /** The phase the last run saw, so a change can be announced once. */
  phase?: string;
  /** Date of the last three-month reminder, so it is not repeated every day. */
  recheck?: string;
}

export const freshAuto = (): Auto => ({ on: true, log: [] });

const gap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];

/** The quietest weekday for the injection: a rest day, else the lightest, so the first day's nausea lands on it.
 *  `week[i]` is the planned demand of weekday i, Monday first. Returns null when nothing is clearly quieter. */
export function quietDay(week: (Demand | null)[]): number | null {
  const rank: Record<Demand, number> = { rest: 0, low: 1, moderate: 2, high: 3 };
  let best: number | null = null;
  let bestRank = 2; // never move the shot onto a moderate or high day
  week.forEach((d, i) => {
    if (!d) return;
    const r = rank[d];
    if (r < bestRank) { bestRank = r; best = i; }
  });
  return best;
}

export interface Ctx {
  today: string;
  /** Planned demand per weekday, Monday first; nulls where it cannot be read. */
  week: (Demand | null)[];
  weights: Record<string, number>;
  /** Newest date among the baseline blood markers, or ''. */
  lastLabs: string;
  /** The phase the protocol is in now (logic/glp1plan.ts). */
  phase: string;
}

export interface Decision {
  /** Fields to write on State.glp1. Only ever these. */
  set: { day?: number; hold?: boolean };
  entries: Omit<AutoEntry, 'id'>[];
}

/** What the app should do by itself right now. Pure: it writes nothing. */
export function decide(g: Glp1, a: Auto, c: Ctx): Decision {
  const set: Decision['set'] = {};
  const entries: Decision['entries'] = [];
  if (!a.on || !g.on) return { set, entries };

  // R1 — move the injection to the week's quiet day, so the day after a dose is not a hard session.
  const quiet = quietDay(c.week);
  if (quiet != null && quiet !== g.day) {
    const last = g.shots.at(-1)?.date;
    // the label asks for at least 3 days between two doses: only move when the new slot keeps that
    const slack = !last || gap(last, c.today) >= 3;
    if (slack) {
      set.day = quiet;
      entries.push({ kind: 'day', date: c.today, undo: { day: g.day },
        text: `Ziua injecției mutată de ${DAYS[g.day]} pe ${DAYS[quiet]}: e ziua cea mai ușoară din săptămâna ta, așa că greața din prima zi nu cade pe un antrenament greu.` });
    }
  }

  // R2 — hold the titration when the scale says it is already too fast, or the meter saw a low.
  const r = weeklyRate(c.weights);
  const loss = r == null ? null : -r;
  const low = (g.glucose ?? []).some((x) => x.mg < 70 && gap(x.date, c.today) < 14);
  const tooFast = loss != null && loss > FAST_PCT;
  const shouldHold = tooFast || low;
  if (shouldHold && !g.hold) {
    set.hold = true;
    entries.push({ kind: 'hold', date: c.today, undo: { hold: false },
      text: tooFast
        ? `Treapta următoare e blocată: slăbești ${loss!.toFixed(1).replace('.', ',')}% pe săptămână, peste pragul de ${String(FAST_PCT).replace('.', ',')}%. Prea repede costă masă slabă și crește riscul de calculi biliari.`
        : 'Treapta următoare e blocată: ai avut o glicemie sub 70 mg/dL în ultimele 2 săptămâni. Se discută cu medicul înainte de orice creștere.' });
  } else if (!shouldHold && g.hold) {
    set.hold = false;
    entries.push({ kind: 'release', date: c.today, undo: { hold: true },
      text: 'Blocajul treptei a fost ridicat: ritmul a revenit în bandă și nu mai sunt glicemii scăzute. Creșterea rămâne decizia medicului.' });
  }

  // R3 — the three-month check, counted from the start or from the newest blood test.
  const from = c.lastLabs || g.start;
  if (from && gap(from, c.today) >= RECHECK_DAYS && (!a.recheck || gap(a.recheck, c.today) >= RECHECK_DAYS)) {
    entries.push({ kind: 'labs', date: c.today,
      text: `Au trecut ${gap(from, c.today)} de zile de la ${c.lastLabs ? 'ultimele analize' : 'prima injecție'}. Protocolul cere repetarea panelului la 3 luni: glicemie, HbA1c, lipide, ficat, rinichi, lipază, TSH, vitamina D și B12.` });
  }

  // R4 — say it once when the protocol moves into another phase.
  if (a.phase && a.phase !== c.phase) {
    entries.push({ kind: 'phase', date: c.today, text: `Ai intrat în faza „${c.phase}". Pașii din protocol s-au schimbat odată cu ea.` });
  }

  return { set, entries };
}

/** True when the dose must not go up, whatever the scale says. Read by the Doza card. */
export const holding = (g: Glp1) => !!g.hold;

/** The step the app would discuss with the doctor, or null while held or already at the top. */
export function nextStep(g: Glp1): number | null {
  if (g.hold || weeksAtDose(g) < 4) return null;
  const i = LADDER.findIndex((x) => x === g.mg);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1]! : null;
}
