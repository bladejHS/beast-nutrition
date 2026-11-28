import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retitle, shortName } from './mealplan.ts';

test('shortName keeps the food a title names', () => {
  assert.equal(shortName('Piept de pui, crud'), 'pui');
  assert.equal(shortName('Carne tocată de vită 90%, crudă'), 'vită');
  assert.equal(shortName('Ton la conservă în apă'), 'ton');
  assert.equal(shortName('Ovăz fulgi, crud'), 'ovăz');
  assert.equal(shortName('Iaurt grecesc 2%'), 'iaurt grecesc');
  assert.equal(shortName('Whey (proteină din zer)'), 'whey');
  assert.equal(shortName('Orez brun crud'), 'orez brun');
});

test('the title follows a swapped food (2026-11-28)', () => {
  assert.equal(retitle('Pui cu orez și legume', 'Piept de pui, crud', 'Piept de curcan, crud'), 'Curcan cu orez și legume');
  assert.equal(retitle('Pui cu orez și legume', 'Orez alb crud', 'Quinoa crudă'), 'Pui cu quinoa și legume');
  assert.equal(retitle('Curcan cu cartofi și salată', 'Cartofi cruzi', 'Cartofi dulci cruzi'), 'Curcan cu cartofi dulci și salată');
  assert.equal(retitle('Wrap cu pui și legume', 'Piept de pui, crud', 'Piept de curcan, crud'), 'Wrap cu curcan și legume');
  assert.equal(retitle('Iaurt grecesc cu fructe', 'Iaurt grecesc degresat', 'Skyr natur'), 'Skyr cu fructe');
  assert.equal(retitle('Vită cu paste și legume', 'Carne tocată de vită 90%, crudă', 'Mușchi de porc, crud'), 'Porc cu paste și legume');
  // same animal, other cut: nothing to rename
  assert.equal(retitle('Pui cu leguminoase', 'Piept de pui, crud', 'Pulpă de pui, crudă, fără piele'), 'Pui cu leguminoase');
  // a title that never named the food stays
  assert.equal(retitle('Somon cu garnitură și legume', 'Cartofi cruzi', 'Cuscus crud'), 'Somon cu garnitură și legume');
});
