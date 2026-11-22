import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestWater, daysOfVial, dosesIn, mcgForUnits, mcgPerUnit, mlFor, unitsFor, vialWarning } from './vial.ts';

test('a U-100 syringe reads the vial as units', () => {
  // 5 mg in 2 ml = 2500 mcg/ml = 25 mcg in one unit
  const v = { mg: 5, ml: 2 };
  assert.equal(mcgPerUnit(v), 25);
  assert.equal(unitsFor(v, 100), 4);
  assert.equal(unitsFor(v, 150), 6);
  assert.equal(mlFor(v, 100), 0.04);
  assert.equal(mcgForUnits(v, 4), 100);
  // 2 mg in 2 ml = 10 mcg per unit: 100 mcg is 10 units
  assert.equal(unitsFor({ mg: 2, ml: 2 }, 100), 10);
  // 10 mg in 5 ml = 20 mcg per unit
  assert.equal(unitsFor({ mg: 10, ml: 5 }, 100), 5);
});

test('how long a vial lasts', () => {
  assert.equal(dosesIn({ mg: 5, ml: 2 }, 100), 50);
  assert.equal(dosesIn({ mg: 5, ml: 2 }, 150), 33);
  assert.equal(daysOfVial({ mg: 5, ml: 2 }, 100), 70);
  assert.equal(dosesIn({ mg: 5, ml: 2 }, 0), 0);
});

test('the water that makes the dose easy to read', () => {
  // 2 mg, 100 mcg: 2 ml gives exactly 10 units
  assert.deepEqual(bestWater(2, 100), { ml: 2, units: 10, why: '10 unități pe seringă pentru 100 mcg' });
  // 5 mg, 100 mcg: 5 ml gives 10 units
  assert.equal(bestWater(5, 100)!.ml, 5);
  assert.equal(bestWater(5, 100)!.units, 10);
  // 10 mg, 100 mcg: 5 ml gives 5 units, the roundest available
  assert.equal(bestWater(10, 100)!.units, 5);
});

test('the warnings about the mark on the syringe', () => {
  assert.equal(vialWarning({ mg: 2, ml: 2 }, 100), null);
  assert.match(vialWarning({ mg: 10, ml: 1 }, 100)!, /^Doar 1 unitate/);
  assert.match(vialWarning({ mg: 2, ml: 5 }, 300)!, /aproape toată seringa/);
  assert.match(vialWarning({ mg: 3, ml: 2 }, 100)!, /între gradații/);
});

test('one vial holding both peptides: 5 mg + 5 mg, 10 mg in total', () => {
  // The mg is what the vial holds of each peptide, so a unit carries that much of each.
  const v = { mg: 5, ml: 2 };
  assert.equal(mcgPerUnit(v), 25);
  assert.equal(unitsFor(v, 100), 4);
  // 5 ml makes 100 mcg land on 10 units, the easiest mark to read
  assert.equal(bestWater(5, 100)!.ml, 5);
  assert.equal(unitsFor({ mg: 5, ml: 5 }, 100), 10);
  // one draw, so the vial lasts as many doses as either peptide allows
  assert.equal(dosesIn(v, 100), 50);
});
