import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, macrosFor, type Profile } from './calc.ts';
import { fatFloorShare, minusMinutes, nextBreak, proteinPerMeal, sleepAverage } from './perf.ts';

const man: Profile = { sex: 'm', age: 23, heightCm: 200, weightKg: 134, bf: 32, activity: 1.55, lifts: true };

test('the fat floor moves only the split: 134 kg at 2,692 kcal and 210 g protein goes from 60 g to 70 g', () => {
  const m = macrosFor(2692, 210, 0.7);
  assert.equal(m.f, 60);
  const share = fatFloorShare(m, 0.7, 134)!;
  assert.equal(share, 0.67);
  const after = macrosFor(2692, 210, share);
  assert.deepEqual([after.kcal, after.p, after.f], [2692, 210, 70]);
  assert.ok(after.f / 134 >= 0.5);
  assert.equal(fatFloorShare(after, share, 134), null, 'already at the floor: nothing to do');
});

test('the rebuilt plan keeps calories and protein and lands at 0.5 g/kg of fat or more', () => {
  const base = { phase: 'cut' as const, startDate: '2026-11-09', ratePct: 0.5, maintenance: 3410, highDays: [], breaks: null, pace: 'm' as const };
  const before = buildPlan(man, { ...base, carbShare: 0.7 });
  const after = buildPlan(man, { ...base, carbShare: fatFloorShare(before.macros, 0.7, 134)! });
  assert.equal(after.macros.kcal, before.macros.kcal);
  assert.equal(after.macros.p, before.macros.p);
  assert.ok(after.macros.f >= 67 && after.macros.c < before.macros.c);
});

test('protein per meal, the next diet break, the pre-workout meal and the sleep average', () => {
  assert.equal(proteinPerMeal(210, 4), 53);
  const plan = { phase: 'cut' as const, startDate: '2026-11-09', breaks: { on: 4, off: 1 } };
  assert.equal(nextBreak(plan, '2026-11-10'), '2026-12-07');
  assert.equal(nextBreak({ ...plan, breaks: null }, '2026-11-10'), null);
  assert.equal(minusMinutes('17:00', 150), '14:30');
  assert.equal(minusMinutes('01:00', 150), '22:30');
  assert.equal(sleepAverage({ '2026-11-08': 7, '2026-11-07': 8, '2026-10-01': 4 }, '2026-11-08'), 7.5);
  assert.equal(sleepAverage({}, '2026-11-08'), null);
});
