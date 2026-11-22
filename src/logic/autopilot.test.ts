import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Plan, Profile } from './calc.ts';
import { DAMPING, MAX_STEP, pilot, wantedDeficit, weeklyRate, willApply, type PilotIn } from './autopilot.ts';
import { addDaysUtc } from './tdee.ts';

const TODAY = '2026-11-22';
const back = (n: number) => addDaysUtc(TODAY, -n);

const profile: Profile = { sex: 'm', age: 23, heightCm: 200, weightKg: 134, bf: 32, activity: 1.5, lifts: true } as Profile;

const plan = (kcal: number): Plan => ({
  phase: 'cut', pace: 'm', ratePct: 0.7, maintenance: 3200, startKg: 134,
  macros: { kcal, p: 210, c: 250, f: 70 }, adjustments: [], start: back(60),
} as unknown as Plan);

/** `perDay` is the kilograms a day the scale really moves. */
function data(kcal: number, perDay: number, days = 21) {
  const intake: Array<{ date: string; kcal: number }> = [];
  const weights: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = back(i);
    intake.push({ date: d, kcal });
    weights[d] = 134 + (days - 1 - i) * perDay + (i % 2 ? 0.2 : -0.2);
  }
  return { intake, weights };
}

function weeks(a: number, b: number) {
  return [
    { start: back(14), avg: a, n: 5 },
    { start: back(7), avg: b, n: 5 },
  ];
}

const input = (over: Partial<PilotIn> = {}): PilotIn => ({
  plan: plan(2600), profile, goalKg: 105, today: TODAY,
  ...data(2600, -0.09), weeks: weeks(134.6, 133.7), proteinG: 215,
  ...over,
});

test('the deficit it aims for is the one that gives the target rate', () => {
  // 0.9 %/week of 134 kg = 1.206 kg = 8804 kcal a week = ~1258 a day
  const d = wantedDeficit(134, 32);
  assert.ok(d > 1150 && d < 1350, `deficit ${d}`);
});

test('with thin data the pilot waits instead of guessing', () => {
  const thin = input({ ...data(2600, -0.09, 6), weights: data(2600, -0.09, 6).weights });
  const o = pilot(thin);
  assert.equal(o.kind, 'wait');
  assert.equal(willApply(o, true), false);
});

test('it changes the target by half of what the arithmetic implies', () => {
  const o = pilot(input());
  assert.ok(o.kind === 'cut' || o.kind === 'raise' || o.kind === 'hold');
  if (o.kcal != null) {
    const implied = o.tdee.kcal - wantedDeficit(134, 32) - 2600;
    const applied = o.kcal - 2600;
    assert.ok(Math.abs(applied) <= Math.abs(implied) * DAMPING + 15, `applied ${applied} of implied ${implied}`);
    assert.ok(Math.abs(applied) <= 2600 * MAX_STEP + 10, 'never more than one tenth at a time');
  }
});

test('a week that moved nothing brings the target down', () => {
  // eating 2600 and holding weight means maintenance is 2600; the target must drop
  const o = pilot(input({ ...data(2600, 0) }));
  assert.equal(o.kind, 'cut');
  assert.ok(o.delta! < 0);
  assert.ok(o.kcal! < 2600);
  assert.match(o.body, /Întreținerea măsurată/);
});

test('losing too fast adds food and never cuts', () => {
  const o = pilot(input({ weeks: weeks(134.6, 132.5) }));
  assert.equal(o.kind, 'raise');
  assert.ok(o.delta! > 0);
  assert.match(o.title, /Prea repede/);
});

test('protein under the red line stops everything else', () => {
  const o = pilot(input({ proteinG: 130, ...data(2600, 0) }));
  assert.equal(o.kind, 'stop');
  assert.match(o.title, /Proteina/);
  assert.equal(willApply(o, true), false);
});

test('it does not change the target twice in a week', () => {
  const o = pilot(input({ ...data(2600, 0), lastChange: back(3) }));
  assert.equal(o.kind, 'hold');
  assert.match(o.body, /mai sunt/);
});

test('it never goes under the calorie floor', () => {
  const o = pilot(input({ plan: plan(1520), ...data(1520, 0) }));
  assert.equal(o.kind, 'stop');
  assert.match(o.body, /pauză de dietă/);
});

test('a target that already gives the right rate is left alone', () => {
  // maintenance ~3850 against a 2600 target is about the deficit the rate wants
  const o = pilot(input({ ...data(2600, -0.172) }));
  assert.equal(o.kind, 'hold');
  assert.match(o.title, /bună/);
});

test('it only writes when it is switched on and has a target', () => {
  const o = pilot(input({ ...data(2600, 0) }));
  assert.equal(willApply(o, false), false);
  assert.equal(willApply(o, true), true);
});

test('the weekly rate is a percentage of body mass, negative when losing', () => {
  const r = weeklyRate(weeks(134.6, 133.7))!;
  assert.ok(r < 0 && r > -1, `rate ${r}`);
  assert.equal(weeklyRate([{ start: back(21), avg: 134, n: 4 }, { start: back(7), avg: 133, n: 4 }]), null);
});

import { keepFatFloor, shiftPct } from '../screens/pilot.ts';
test('a cut moves carbs and fat but never takes fat under the floor', () => {
  const m = { kcal: 2928, p: 210, c: 365, f: 70 };
  const pct = shiftPct(m.kcal, m.p, -288);
  assert.ok(pct < -13 && pct > -15, `pct ${pct}`);
  const cut = keepFatFloor({ kcal: 2640, p: 210, c: 315, f: 60 }, 134);
  assert.equal(cut.f, 67);
  assert.ok(cut.c < 315, 'the carbs pay for the fat floor');
  assert.ok(Math.abs(cut.kcal - 2640) <= 20, `kcal ${cut.kcal}`);
  // a day already above the floor is left alone
  assert.deepEqual(keepFatFloor(m, 134), m);
});
