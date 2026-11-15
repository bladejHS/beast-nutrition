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

/** The shares a recipe can be eaten in: by the piece, or a fraction of the whole. */
export const sharesOf = (r: Recipe): number[] => (r.pieces > 1 ? Array.from({ length: r.pieces }, (_, k) => (k + 1) / r.pieces) : [0.25, 1 / 3, 0.5, 0.75, 1]);

/** The kind of recipe that suits the hour: breakfast in the morning, a meal at noon and in the evening, sweets late. */
export const catsFor = (hour: number): Recipe['cat'][] => (hour < 11 ? ['dejun'] : hour < 17 ? ['pranz'] : hour < 21 ? ['pranz', 'gustare'] : ['gustare', 'desert']);

export interface Pick { r: Recipe; share: number; kcal: number; p: number }

/**
 * "Ce gătesc acum?" (2026-11-16): the recipes, each at the share that comes closest to the meal's calories, ranked by
 * how close they come, how much protein they bring for them, and whether they suit the hour. `day` turns the choice
 * between near equals each day, so the card does not show the same recipe every morning.
 */
export function suggest(recipes: Recipe[], kcal: number, p: number, hour: number, day: number, n = 3): Pick[] {
  if (kcal < 120) return [];
  const cats = catsFor(hour);
  const scored = recipes.map((r) => {
    let best: { share: number; score: number } | null = null;
    for (const sh of sharesOf(r)) {
      const k = r.kcal * sh, pr = r.p * sh;
      if (k > kcal * 1.08) continue;
      const score = Math.abs(k - kcal) / kcal + Math.max(0, p - pr) / Math.max(p, 1) * 0.5;
      if (!best || score < best.score) best = { share: sh, score };
    }
    if (!best) return null;
    const dens = (r.p * 4) / r.kcal;
    const jitter = (((r.id.length * 31 + day * 17 + r.name.charCodeAt(0)) % 13) / 13) * 0.08;
    return { r, share: best.share, score: best.score - dens * 0.35 + (cats.includes(r.cat) ? 0 : 0.3) + jitter };
  }).filter((x): x is { r: Recipe; share: number; score: number } => !!x).sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map((x) => ({ r: x.r, share: x.share, kcal: Math.round(x.r.kcal * x.share), p: Math.round(x.r.p * x.share) }));
}
