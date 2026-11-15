import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepFor } from './prep.ts';

/** Every food the plan's templates can put on a plate (read from mealplan.ts, where they are not exported). */
function templateFoods(): string[] {
  const src = readFileSync(new URL('./mealplan.ts', import.meta.url), 'utf8');
  const out = new Set<string>();
  for (const m of src.matchAll(/(?:protein|carb|fat|veg): \[([^\]]*)\]/g)) for (const n of m[1]!.matchAll(/'([^']+)'/g)) out.add(n[1]!);
  return [...out];
}

test('every food of the plan has a way to cook it', () => {
  const foods = templateFoods();
  assert.ok(foods.length > 40);
  const missing = foods.filter((f) => prepFor('x', [{ name: f, g: 100 }]).steps.length === 0);
  assert.deepEqual(missing, []);
});

test('the steps start with what takes longest and end at the plate', () => {
  const p = prepFor('Pui cu orez și legume', [{ name: 'Piept de pui, crud', g: 180 }, { name: 'Orez alb crud', g: 80 }, { name: 'Broccoli crud', g: 150 }, { name: 'Ulei de măsline', g: 9 }]);
  assert.match(p.steps[0]!, /orez/i);
  assert.match(p.steps[0]!, /130 ml/);
  assert.match(p.steps[1]!, /Pieptul de pui \(180 g\)/);
  assert.match(p.steps.at(-1)!, /Asamblează/);
  assert.match(p.steps.join(' '), /două lingurițe|2 lingurițe/);
  assert.ok(p.min >= 20);
});

test('boiled potatoes and eggs when the dish says so', () => {
  const p = prepFor('Ouă cu cartofi și salată', [{ name: 'Cartofi cruzi', g: 250 }, { name: 'Ou întreg, crud', g: 110 }]);
  assert.match(p.steps.join(' '), /apă rece cu sare/);
  assert.match(p.steps.join(' '), /9 minute/);
});

test('peanut butter is not taken for nuts', () => {
  assert.match(prepFor('Pâine cu unt de arahide', [{ name: 'Unt de arahide', g: 26 }]).steps.join(' '), /Untul de arahide \(26 g\)/);
});
