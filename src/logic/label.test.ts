import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabelAnswer, parseLabel } from './label.ts';

test('a Romanian label, two columns, read from OCR text', () => {
  const v = parseLabel(`Declarație nutrițională  100 g   Porție 40 g
Valoare energetică  1569 kJ / 375 kcal   628 kJ / 150 kcal
Grăsimi  9,5 g  3,8 g
din care acizi grași saturați  1,2 g  0,5 g
Glucide  60 g  24 g
din care zaharuri  20 g  8 g
Fibre  6,1 g  2,4 g
Proteine  10 g  4 g
Sare  0,5 g  0,2 g`)!;
  assert.deepEqual([v.kcal, v.p, v.c, v.f, v.fiber, v.sugar, v.portion], [375, 10, 60, 9.5, 6.1, 20, 40]);
});

test('an English label with kJ only and numbers on the next line', () => {
  const v = parseLabel(`NUTRITION Per 100g
Energy 1046kJ
Fat
3.2g
of which saturates 0.8g
Carbohydrate 4.1g
of which sugars 4.1g
Protein 10.5g
Salt 0.1g`)!;
  assert.equal(v.p, 10.5); assert.equal(v.c, 4.1); assert.equal(v.f, 3.2); assert.equal(v.sugar, 4.1);
  // 1046 kJ = 250 kcal, but the macros say 87: the printed energy is too far, so the macros win
  assert.equal(v.kcal, Math.round(4 * 10.5 + 4 * 4.1 + 9 * 3.2));
});

test('an unreadable photo gives nothing to save', () => {
  assert.equal(parseLabel('Ingrediente: lapte, sare, cheag'), null);
  assert.equal(cleanLabelAnswer({ found: false }), null);
});

test("Claude's answer is cleaned: missing values stay empty, kcal follows the macros", () => {
  const v = cleanLabelAnswer({ found: true, name: 'Skyr natur · Olympus', kcal_100g: 63, protein_100g: 11, carbs_100g: 4, fat_100g: 0.2, fiber_100g: -1, sugar_100g: 4, portion_g: 150 })!;
  assert.deepEqual([v.name, v.kcal, v.p, v.fiber, v.sugar, v.portion], ['Skyr natur · Olympus', 63, 11, null, 4, 150]);
});

test('the real OCR of a phone-made label: the unit g read as a 9 (2026-11-28)', () => {
  const v = parseLabel(`Declaraţie nutritionala 100 g Portie 40 g
Valoare energetica 1569 kJ / 375 kcal 50 kcal
Grasimi 959 3,89

din care acizi grași saturati 1,2g 0,59
Glucide 60g 249

din care Zaharuri 20g 8g

Fibre 6,19 249
Proteine 109 49

Sare 0,59 029`)!;
  assert.deepEqual([v.kcal, v.p, v.c, v.f, v.fiber, v.sugar, v.portion], [375, 10, 60, 9.5, 6.1, 20, 40]);
});
