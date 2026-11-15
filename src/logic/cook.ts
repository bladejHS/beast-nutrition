/* The Cookbook's arithmetic (2026-11-15): a share of a recipe as an entry in the day's journal. */
import type { Recipe } from '../data/cookbook.ts';
import type { Entry } from './store.ts';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** How much of the recipe was eaten, in words: "½ rețetă", "2 buc. din 8", "toată rețeta". */
export function shareLabel(r: Recipe, share: number): string {
  if (r.pieces > 1) {
    const n = Math.round(share * r.pieces * 100) / 100;
    if (Math.abs(n - r.pieces) < 0.01) return `toată rețeta, ${r.pieces} buc.`;
    return `${String(n).replace('.', ',')} ${n === 1 ? 'bucată' : 'buc.'} din ${r.pieces}`;
  }
  const names: Record<string, string> = { '0.25': '¼ rețetă', '0.33': '⅓ rețetă', '0.5': '½ rețetă', '0.67': '⅔ rețetă', '0.75': '¾ rețetă', '1': 'toată rețeta' };
  return names[String(Math.round(share * 100) / 100)] ?? `${String(Math.round(share * 100) / 100).replace('.', ',')} × rețeta`;
}

/** The entry for `share` of the recipe (1 = all of it). No grams: the recipe is counted by portion. */
export function portionOf(r: Recipe, share: number): Entry {
  return { id: crypto.randomUUID(), name: `${r.name} (${shareLabel(r, share)})`, g: 0, kcal: Math.round(r.kcal * share), p: r1(r.p * share), c: r1(r.c * share), f: r1(r.f * share), fiber: 0 };
}
