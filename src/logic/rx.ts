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
