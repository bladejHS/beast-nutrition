import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Profile } from './calc.ts';
import { checkSafety, flagText, proteinFloor, proteinRedLine, rateCap, rateTarget } from './safety.ts';

const me: Profile = { sex: 'm', age: 23, heightCm: 200, weightKg: 134, bf: 32, activity: 1.5, lifts: true } as Profile;

test('the protein floor is the number every denominator agrees on', () => {
  // 2.3 × 91.1 kg lean ≈ 210, 1.6 × 134 ≈ 214, 2.0 × 105 goal = 210
  const floor = proteinFloor(me, 105);
  assert.ok(floor >= 200 && floor <= 215, `floor ${floor}`);
  assert.equal(proteinRedLine(me), 160);
  // without a goal weight the floor still comes from the other two
  assert.ok(proteinFloor(me) >= 200);
});

test('the rate cap follows the fat there is to lose', () => {
  assert.equal(rateCap(32), 1.2);
  assert.equal(rateCap(27), 1);
  assert.equal(rateCap(18), 0.7);
  assert.equal(rateCap(10), 0.5);
  assert.equal(rateTarget(32), 0.9);
});

test('nothing is flagged when the week is in order', () => {
  const flags = checkSafety({ profile: me, goalKg: 105, proteinG: 215, ratePct: -0.9, kcal: 2600, kcalFloor: 1500 });
  assert.deepEqual(flags, []);
});

test('protein under the red line comes before anything else', () => {
  const flags = checkSafety({ profile: me, goalKg: 105, proteinG: 120, ratePct: -1.6, kcal: 2600, kcalFloor: 1500 });
  assert.equal(flags[0]!.id, 'protein-red');
  assert.equal(flags[0]!.level, 'stop');
  assert.ok(flags.some((f) => f.id === 'too-fast'));
  assert.match(flagText(flags[0]!).body, /masă musculară/);
});

test('losing faster than the cap asks for more food, not less', () => {
  const [f] = checkSafety({ profile: me, goalKg: 105, proteinG: 215, ratePct: -1.5, kcal: 2600, kcalFloor: 1500 });
  assert.equal(f!.id, 'too-fast');
  assert.match(flagText(f!).body, /Se adaugă mâncare/);
});

test('a stalled week is information, and the calorie floor is a stop', () => {
  const flags = checkSafety({ profile: me, goalKg: 105, proteinG: 215, ratePct: -0.1, kcal: 1400, kcalFloor: 1500 });
  assert.equal(flags[0]!.id, 'kcal-floor');
  assert.ok(flags.some((f) => f.id === 'too-slow' && f.level === 'info'));
});

test('a week with no food logged says nothing about protein', () => {
  const flags = checkSafety({ profile: me, goalKg: 105, proteinG: null, ratePct: -0.9, kcal: 2600, kcalFloor: 1500 });
  assert.equal(flags.length, 0);
});
