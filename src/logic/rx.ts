/* Other prescribed treatments under Peptide (2026-11-21). The user asked for a kisspeptin protocol; the app does not
   make one and proposes no dose. It keeps what the doctor wrote: the name, the dose and how often, in the user's own
   words, and logs each administration with the site, so the doctor can read the history next to the lab results. */

export const RX_SITES = ['Abdomen stânga', 'Abdomen dreapta', 'Coapsă stângă', 'Coapsă dreaptă', 'Braț stâng', 'Braț drept'] as const;

export interface RxDose { id: string; date: string; time: string; amount: number; site: number; note?: string }
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
