/* Other prescribed treatments under Peptide (2026-11-21). The user asked for a kisspeptin protocol; the app does not
   make one and proposes no dose. It keeps what the doctor wrote: the name, the dose and how often, in the user's own
   words, and logs each administration with the site, so the doctor can read the history next to the lab results. */

import type { Vial } from './vial.ts';

export const RX_SITES = ['Abdomen stânga', 'Abdomen dreapta', 'Coapsă stângă', 'Coapsă dreaptă', 'Braț stâng', 'Braț drept'] as const;

export interface RxDose { id: string; date: string; time: string; amount: number; site: number; note?: string; /** Hours since the last meal, when typed. */ fasted?: number }
/** The morning after: how the night went and what the user noticed (CJC tracking, 2026-11-21). */
export interface RxCheck { sleep?: number; fx: number[] }
export interface Rx {
  id: string;
  name: string;
  /** The prescribed dose, as the doctor wrote it. */
  amount: number;
  unit: 'µg' | 'mg' | 'UI' | 'ml';
  /** How often, in the doctor's words ("de 2 ori pe săptămână", "dimineața"). */
  how: string;
  doctor: string;
  start: string;
  on: boolean;
  log: RxDose[];
  /** Morning check-ins by date. */
  checks?: Record<string, RxCheck>;
  /** CJC: the highest dose the automatic step-up may reach again, lowered when an increase was not tolerated. */
  cap?: number;
  /** CJC: the two vials as the user mixed them (logic/vial.ts). */
  vials?: { cjc?: Vial; ipa?: Vial };
}

/** The site after the last one, so the injections rotate. */
export const rxNextSite = (r: Rx) => ((r.log.at(-1)?.site ?? -1) + 1) % RX_SITES.length;

/** Valid only with a name, a positive dose and a frequency: all three come from the prescription. */
export function rxValid(x: Pick<Rx, 'name' | 'amount' | 'how'>): string | null {
  if (!x.name.trim()) return 'Scrie numele tratamentului.';
  if (!(x.amount > 0)) return 'Scrie doza din prescripție.';
  if (!x.how.trim()) return 'Scrie cât de des, cum a scris medicul.';
  return null;
}

/** Days since the last administration, null when none. */
export function rxSince(r: Rx, today: string): number | null {
  const last = r.log.at(-1);
  return last ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${last.date}T12:00:00Z`)) / 864e5) : null;
}

/* 2026-11-21: the user's own schema for CJC-1295 no DAC + Ipamorelin, written into the app at their request, exactly
   as they set it. It is their choice, not a prescription: the screen says so, and points to IGF-1 and glucose. */
export const CJC_NAME = 'CJC-1295 no DAC + Ipamorelin';
export const CJC_SCHEMA: [string, string][] = [
  ['Doza', '100 mcg CJC-1295 no DAC + 100 mcg Ipamorelin, în aceeași seringă'],
  ['Când', 'O dată pe zi, înainte de culcare'],
  ['Stomacul', 'Gol: minimum 2–3 ore fără mâncare înainte și nimic 30 de minute după'],
  ['Frecvență', '5 zile da, 2 zile pauză (sau 5–7 nopți pe săptămână)'],
  ['Ciclu', '8–12 săptămâni, apoi 4 săptămâni pauză'],
  ['Creștere', 'Doar dacă e tolerat după 2 săptămâni, cu câte 50 mcg, până la maximum 200–300 mcg'],
  ['Administrare', 'Subcutanat, în grăsimea abdominală, schimbând locul injecției'],
];

export const isCjc = (r: Rx) => r.name === CJC_NAME;

/** Where the cycle is: week 1.. from the start; 'pause' in weeks 13–16 (or after the user stopped), then a new cycle. */
export function cjcCycle(start: string, today: string): { week: number; phase: 'on' | 'can-stop' | 'pause'; pauseLeft: number } {
  const days = Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 864e5));
  const d = days % 112;
  const week = Math.floor(d / 7) + 1;
  if (week > 12) return { week, phase: 'pause', pauseLeft: 112 - d };
  return { week, phase: week > 8 ? 'can-stop' : 'on', pauseLeft: 0 };
}

/** Doses in the last 7 days (today included), for the 5-on / 2-off check. */
export function dosesLast7(r: Rx, today: string): number {
  const t = Date.parse(`${today}T12:00:00Z`);
  return r.log.filter((x) => { const d = (t - Date.parse(`${x.date}T12:00:00Z`)) / 864e5; return d >= 0 && d < 7; }).length;
}

/** The next site for the CJC schema: alternate left/right abdomen. */
export const cjcNextSite = (r: Rx) => (r.log.at(-1)?.site === 0 ? 1 : 0);

/* Tracking for the CJC schema (2026-11-21, the user: "o metodă de tracking"). */
const day = (d: string) => Date.parse(`${d}T12:00:00Z`);
export const addDays = (d: string, n: number) => new Date(day(d) + n * 864e5).toISOString().slice(0, 10);

export const CJC_FX = ['Retenție de apă', 'Amorțeli sau furnicături în mâini', 'Înroșire sau căldură după injecție', 'Foame mult crescută', 'Dureri de cap', 'Reacție la locul injecției', 'Somnolență dimineața'];

/** The first day of the cycle today belongs to. */
export function cycleStart(start: string, today: string): string {
  const days = Math.max(0, Math.round((day(today) - day(start)) / 864e5));
  return addDays(start, days - (days % 112));
}

/** The current cycle as weeks of 7 days: 'done' | 'miss' (past, no dose) | 'today' | 'pause' | 'future'. */
export function cycleGrid(r: Rx, today: string): Array<Array<{ date: string; state: 'done' | 'miss' | 'today' | 'future' | 'pause' | 'rest'; amount?: number }>> {
  const c0 = cycleStart(r.start, today);
  const by = new Map(r.log.map((x) => [x.date, x.amount]));
  const weeks = Math.min(16, Math.max(8, Math.floor((day(today) - day(c0)) / 864e5 / 7) + 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(c0, w * 7 + i);
    const amount = by.get(date);
    if (amount != null) return { date, state: 'done' as const, amount };
    if (w >= 12) return { date, state: 'pause' as const };
    if (date <= today && cjcDay(r, date) === 'rest') return { date, state: 'rest' as const };
    if (date === today) return { date, state: 'today' as const };
    return { date, state: date < today ? 'miss' as const : 'future' as const };
  }));
}

/** Nights done in this cycle against the 5-a-week target (pro rata, today counts only once done). */
export function cjcAdherence(r: Rx, today: string): { done: number; target: number; pct: number } {
  const c0 = cycleStart(r.start, today);
  const doneToday = r.log.some((x) => x.date === today);
  const end = Math.min(84, Math.round((day(today) - day(c0)) / 864e5) + (doneToday ? 1 : 0));
  const done = r.log.filter((x) => x.date >= c0 && x.date < addDays(c0, Math.min(84, end))).length;
  const target = Math.round((end * 5) / 7);
  return { done, target, pct: target ? Math.min(100, Math.round((done / target) * 100)) : 100 };
}

/** Side effects noticed in the last 7 mornings, by index, with counts. */
export function recentFx(r: Rx, today: string, n = 7): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < n; i++) for (const f of r.checks?.[addDays(today, -i)]?.fx ?? []) out.set(f, (out.get(f) ?? 0) + 1);
  return out;
}

/** Average sleep (1–5) over the last n mornings, null when none rated. */
export function avgSleep(r: Rx, today: string, n = 7): number | null {
  const v = Array.from({ length: n }, (_, i) => r.checks?.[addDays(today, -i)]?.sleep).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** The user's step-up rule: after 2 weeks at the dose, no side effects in 7 days, +50 mcg, never above 300. */
export function cjcRaise(r: Rx, today: string): { ok: boolean; next: number; why: string } {
  const next = Math.min(300, r.amount + 50);
  if (r.amount >= 300) return { ok: false, next: r.amount, why: 'Ești la maximum (300 mcg). Nu mai crești.' };
  let i = r.log.length;
  while (i > 0 && r.log[i - 1]!.amount === r.amount) i--;
  const runStart = r.log[i]?.date;
  const days = runStart ? Math.round((day(today) - day(runStart)) / 864e5) : 0;
  if (days < 14) return { ok: false, next, why: `Rămâi la ${r.amount} mcg încă ${14 - days} ${14 - days === 1 ? 'zi' : 'zile'}.` };
  if (recentFx(r, today).size) return { ok: false, next, why: 'Ai notat efecte în ultimele 7 zile. Rămâi la doza actuală.' };
  return { ok: true, next, why: `${days} zile la ${r.amount} mcg, fără efecte notate.` };
}

/** Hours between the last meal ("HH:MM") and the dose time, across midnight. */
export function fastHours(meal: string, dose: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let d = m(dose) - m(meal);
  if (d < 0) d += 1440;
  return Math.round((d / 60) * 10) / 10;
}

/* The rules, applied by the app (2026-11-21, the user: "regulile vreau să fie aplicate automat"). */
const dosed = (r: Rx, d: string) => r.log.some((x) => x.date === d);
function streak(r: Rx, end: string): number { let k = 0; while (k < 7 && dosed(r, addDays(end, -k))) k++; return k; }

/** What a day is by the schema: 'pause' (weeks 13–16), 'rest' (the 2 nights after 5 in a row) or 'on'. */
export function cjcDay(r: Rx, date: string): 'on' | 'rest' | 'pause' {
  if (cjcCycle(r.start, date).phase === 'pause') return 'pause';
  if (dosed(r, date)) return 'on';
  if (streak(r, addDays(date, -1)) >= 5) return 'rest';
  if (!dosed(r, addDays(date, -1)) && streak(r, addDays(date, -2)) >= 5) return 'rest';
  return 'on';
}

/** Days on the current dose, from its first injection. */
function daysAtDose(r: Rx, today: string): number {
  let i = r.log.length;
  while (i > 0 && r.log[i - 1]!.amount === r.amount) i--;
  const d = r.log[i]?.date;
  return d ? Math.round((day(today) - day(d)) / 864e5) : 0;
}

/** The automatic step-up stops at 200 mcg; 250–300 only by hand. */
export const CJC_AUTO_MAX = 200;

/** Tonight, with the rules applied: whether to inject, how much, and why. `cap` is set when an increase is undone. */
export function cjcTonight(r: Rx, today: string): { state: 'on' | 'rest' | 'pause' | 'done'; amount: number; why: string; cap?: number } {
  const st = cjcDay(r, today);
  if (dosed(r, today)) return { state: 'done', amount: r.log.find((x) => x.date === today)!.amount, why: '' };
  if (st !== 'on') return { state: st, amount: r.amount, why: st === 'rest' ? '5 nopți la rând: azi e pauză.' : 'Ciclul s-a încheiat: 4 săptămâni pauză.' };
  if (r.amount > 100 && recentFx(r, today, 3).size && daysAtDose(r, today) < 14) {
    const back = r.amount - 50;
    return { state: 'on', amount: back, cap: back, why: `Efecte notate după creștere: înapoi la ${back} mcg, fără alte creșteri automate.` };
  }
  const up = cjcRaise(r, today);
  if (up.ok && up.next <= Math.min(r.cap ?? CJC_AUTO_MAX, CJC_AUTO_MAX)) return { state: 'on', amount: up.next, why: `Crescută automat la ${up.next} mcg: ${up.why}` };
  return { state: 'on', amount: r.amount, why: '' };
}

/** Days until the next injection night (0 = tonight), null when not started. */
export function cjcNextIn(r: Rx, today: string): number {
  for (let i = 0; i < 40; i++) {
    const d = addDays(today, i);
    if (i === 0 && dosed(r, d)) continue;
    if (cjcDay(r, d) === 'on') return i;
  }
  return 0;
}
