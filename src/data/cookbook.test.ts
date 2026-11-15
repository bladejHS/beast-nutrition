import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from './cookbook.ts';
import { portionOf, suggest } from '../logic/cook.ts';

test('every recipe is there once', () => {
  const ids = new Set(RECIPES.map((r) => r.id));
  assert.equal(ids.size, RECIPES.length);
  const names = new Set(RECIPES.map((r) => r.name.toLowerCase()));
  assert.equal(names.size, RECIPES.length);
  assert.ok(RECIPES.length >= 120);
});

test('the printed macros add up to the printed calories (4/4/9, within 12%)', () => {
  for (const r of RECIPES) {
    const k = 4 * r.p + 4 * r.c + 9 * r.f;
    assert.ok(Math.abs(k - r.kcal) / r.kcal < 0.12, `${r.name}: ${r.kcal} kcal vs ${k} from macros`);
    assert.ok(r.ing.length > 0 && r.steps.length > 0, r.name);
  }
});

test('a share of a recipe is that share of its macros', () => {
  const r = RECIPES.find((x) => x.id === 'ardei-umpluti')!;
  const e = portionOf(r, 0.25);
  assert.equal(e.kcal, Math.round(r.kcal / 4));
  assert.equal(e.p, Math.round(r.p / 4 * 10) / 10);
  assert.equal(e.g, 0);
});

test('the suggestion fits the calories left and suits the hour', () => {
  const picks = suggest(RECIPES, 600, 45, 8, 1);
  assert.equal(picks.length, 3);
  for (const x of picks) assert.ok(x.kcal <= 600 * 1.08, `${x.r.name} ${x.kcal}`);
  assert.equal(picks[0]!.r.cat, 'dejun');
  assert.deepEqual(suggest(RECIPES, 80, 10, 12, 1), []);
});
