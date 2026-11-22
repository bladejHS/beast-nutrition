import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDaysUtc, estimateTdee, expectedRate, KCAL_PER_KG, tdeeDrift } from './tdee.ts';

const TODAY = '2026-11-22';
const back = (n: number) => addDaysUtc(TODAY, -n);

/** `kg` is the straight line the weights follow; a little noise is added so the trend has to do its job. */
function seed(days: number, kcal: number, startKg: number, perDay: number) {
  const intake: Array<{ date: string; kcal: number }> = [];
  const weights: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = back(i);
    intake.push({ date: d, kcal });
    weights[d] = startKg + (days - 1 - i) * perDay + (i % 2 ? 0.25 : -0.25);
  }
  return { intake, weights };
}

test('maintenance comes out of intake plus what the trend did', () => {
  // 2500 kcal a day and 0.1 kg a day lost: 2500 + 730 = 3230
  const { intake, weights } = seed(21, 2500, 134, -0.1);
  const t = estimateTdee(intake, weights, TODAY);
  assert.equal(t.usable, true);
  assert.ok(Math.abs(t.kcal - 3230) < 120, `got ${t.kcal}`);
  assert.equal(t.intake, 2500);
  assert.ok(t.trendKg < 0);
});

test('weight holding means intake is maintenance', () => {
  const { intake, weights } = seed(21, 2800, 120, 0);
  const t = estimateTdee(intake, weights, TODAY);
  assert.ok(Math.abs(t.kcal - 2800) < 60, `got ${t.kcal}`);
});

test('a short or half-logged window is not usable', () => {
  const { intake, weights } = seed(6, 2500, 134, -0.1);
  assert.equal(estimateTdee(intake, weights, TODAY).usable, false);
  const sparse = seed(21, 2500, 134, -0.1);
  const few = { ...sparse, intake: sparse.intake.filter((_, i) => i % 4 === 0) };
  const t = estimateTdee(few.intake, few.weights, TODAY);
  assert.equal(t.usable, false);
  assert.ok(t.confidence < 0.4);
});

test('no food logged gives nothing, not zero', () => {
  const { weights } = seed(21, 2500, 134, -0.1);
  const t = estimateTdee([], weights, TODAY);
  assert.equal(t.kcal, 0);
  assert.equal(t.usable, false);
});

test('drift and the rate the target would produce', () => {
  const { intake, weights } = seed(21, 2500, 134, -0.1);
  const t = estimateTdee(intake, weights, TODAY);
  const drift = tdeeDrift(t, 3000);
  assert.ok(drift != null && drift > 4, `drift ${drift}`);
  // at 2500 kcal against ~3230 measured: about 0.7 kg a week on 134 kg = ~0.52%
  const rate = expectedRate(t, 2500, 134)!;
  assert.ok(rate > 0.4 && rate < 0.65, `rate ${rate}`);
  assert.equal(expectedRate({ ...t, usable: false }, 2500, 134), null);
});

test('the constant is the mixed tissue one, not pure fat', () => {
  assert.equal(KCAL_PER_KG, 7300);
});
