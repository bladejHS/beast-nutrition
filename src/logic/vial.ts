/* Reconstituting a vial and reading the dose on an insulin syringe (2026-11-22, the user: "câte UI trebuie să injectez
   pe seringa de insulină" and "construire flacon ... câți ml trebuie să pun pentru o anumită doză în UI").
   A U-100 insulin syringe: 100 units = 1 ml, so one unit = 0,01 ml. The arithmetic only converts between mcg, ml and
   units; it proposes no dose. The dose comes from the schema the user set in logic/rx.ts. */

/** A vial, as the user mixed it: the peptide in the vial and the bacteriostatic water added. */
export interface Vial { mg: number; ml: number }

export const VIAL_MG = [2, 5, 10, 15];
export const WATER_ML = [1, 1.5, 2, 2.5, 3, 5];
/** A U-100 syringe: units per ml. */
export const U_PER_ML = 100;

/** Micrograms in one unit of a U-100 syringe. */
export const mcgPerUnit = (v: Vial) => (v.mg * 1000) / (v.ml * U_PER_ML);

/** Units to draw for a dose in mcg, to one decimal. */
export const unitsFor = (v: Vial, mcg: number) => Math.round((mcg / mcgPerUnit(v)) * 10) / 10;

/** Millilitres for a dose in mcg, to three decimals. */
export const mlFor = (v: Vial, mcg: number) => Math.round((mcg / (v.mg * 1000)) * v.ml * 1000) / 1000;

/** Micrograms in a number of units. */
export const mcgForUnits = (v: Vial, units: number) => Math.round(units * mcgPerUnit(v) * 10) / 10;

/** Doses of `mcg` left in the vial, whole doses only. */
export const dosesIn = (v: Vial, mcg: number) => (mcg > 0 ? Math.floor((v.mg * 1000) / mcg) : 0);

/** How many days a vial lasts at `mcg` a night, 5 nights a week. */
export const daysOfVial = (v: Vial, mcg: number) => Math.round((dosesIn(v, mcg) * 7) / 5);

/** How round a mark is to read: whole unit > half unit > anything else. */
function readability(u: number): number {
  if (u < 2 || u > 60) return -1;
  const tenths = Math.round(u * 10) % 10;
  return tenths === 0 ? 2 : tenths === 5 ? 1 : 0;
}

/** The water that makes `mcg` land on the easiest mark, preferring 10 units and the least water. */
export function bestWater(mg: number, mcg: number, waters = WATER_ML): { ml: number; units: number; why: string } | null {
  const scored = waters
    .map((ml) => ({ ml, units: unitsFor({ mg, ml }, mcg), score: readability(unitsFor({ mg, ml }, mcg)) }))
    .filter((x) => x.score >= 0);
  if (!scored.length) return null;
  const best = scored.sort((a, b) => b.score - a.score || Math.abs(a.units - 10) - Math.abs(b.units - 10) || a.ml - b.ml)[0]!;
  return { ml: best.ml, units: best.units, why: `${best.units} unități pe seringă pentru ${mcg} mcg` };
}

/** What to tell the user when the mark is hard to read or the dose is tiny. */
export function vialWarning(v: Vial, mcg: number): string | null {
  const u = unitsFor(v, mcg);
  if (u < 2) return `Doar ${unit(u)}: prea puțin de măsurat exact. Pune mai multă apă.`;
  if (u > 60) return `${unit(u)} înseamnă aproape toată seringa. Pune mai puțină apă.`;
  if (Math.round(u * 10) % 5 !== 0) return `${unit(u)} cade între gradații. Cu altă cantitate de apă citești mai ușor.`;
  return null;
}

const num = (v: number) => String(v).replace('.', ',');
/** "1 unitate", "2 unități", "1,5 unități". */
export const unit = (u: number) => `${num(u)} ${u === 1 ? 'unitate' : 'unități'}`;
