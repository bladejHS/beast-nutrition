import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayBase, DEFAULT_SHIFTS, firstMealAt, onClock } from './shift.ts';
import { aroundSession, mealTimes, timing } from './timing.ts';

/** What screens/state.ts mealSlots does for a shift day, without the saved state. */
function day(wake: string, train: string, minutes: number) {
  const first = firstMealAt(wake), base = dayBase(first);
  const { times } = aroundSession(mealTimes(first, 720, 4), train, minutes, base);
  const before = times.reduce((best, x, i) => (onClock(x, base) <= onClock(train, base) ? i : best), -1);
  return { times, before, base };
}

test('night shift: meals run past midnight in order, training before the shift gets its pre and post meal', () => {
  const { wake, train } = DEFAULT_SHIFTS.night;
  const d = day(wake, train, 75);
  assert.equal(d.times[0], '13:30');
  assert.ok(d.times.some((t) => t < '06:00'), 'a meal falls after midnight, at work');
  const clock = d.times.map((t) => onClock(t, d.base));
  assert.deepEqual(clock, [...clock].sort((a, b) => a - b), 'the day keeps its order across midnight');
  assert.equal(d.before, 0, 'the meal after waking is the one before training');
  assert.ok(onClock(d.times[1]!, d.base) >= onClock('18:35', d.base), 'the next meal comes after the session');
});

test('morning and afternoon shifts put training where the shift leaves room', () => {
  const m = day(DEFAULT_SHIFTS.morning.wake, DEFAULT_SHIFTS.morning.train, 75);
  assert.equal(m.times[0], '05:30');
  assert.ok(m.before >= 1 && m.before < 3, 'training after the morning shift, with a meal after it');
  const a = day(DEFAULT_SHIFTS.afternoon.wake, DEFAULT_SHIFTS.afternoon.train, 75);
  assert.equal(a.before, 0, 'morning training before the afternoon shift: breakfast is the meal before it');
});

test('the gaps before and after training stay right across midnight', () => {
  const t = timing({ start: '23:30', sessions: [{ id: 'a', name: 'Forță', kind: 'workout', min: 60 }], demand: 'high', day: { p: 200, c: 300, f: 70 },
    times: ['14:00', '21:30', '00:45', '04:00'], shares: [0.25, 0.25, 0.25, 0.25], trainingMeal: 1, tolerance: 'normal', gap: 0, tomorrow: null, sweatRate: null });
  if (t.pre) assert.equal(t.pre.gapMin, 120);
  if (t.post) assert.equal(t.post.afterMin, 15);
});
