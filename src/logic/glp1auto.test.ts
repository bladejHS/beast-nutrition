import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshGlp1, titration, type Glp1 } from './glp1.ts';
import { decide, freshAuto, nextStep, quietDay, RECHECK_DAYS, type Ctx } from './glp1auto.ts';

const day = (n: number) => new Date(Date.parse('2026-11-22T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const TODAY = day(0);

const g = (over: Partial<Glp1> = {}): Glp1 => ({ ...freshGlp1(), on: true, start: day(-120), ...over });
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  today: TODAY, week: [null, null, null, null, null, null, null], weights: {}, lastLabs: day(-10), phase: 'Slăbitul', ...over,
});
/** Weights falling at a steady percent per week, enough days for the trend to read. */
const falling = (pctPerWeek: number) => {
  const w: Record<string, number> = {};
  for (let i = 40; i >= 0; i--) w[day(-i)] = Math.round(130 * (1 - (pctPerWeek / 100) * ((40 - i) / 7)) * 10) / 10;
  return w;
};

test('the quiet day is a rest day, else the lightest, and never a moderate or hard one', () => {
  assert.equal(quietDay(['high', 'moderate', 'low', 'high', 'moderate', 'high', 'rest']), 6);
  assert.equal(quietDay(['high', 'moderate', 'low', 'high', 'moderate', 'high', 'moderate']), 2);
  // nothing quieter than moderate anywhere: the shot is not moved
  assert.equal(quietDay(['high', 'moderate', 'high', 'high', 'moderate', 'high', 'moderate']), null);
  assert.equal(quietDay([null, null, null, null, null, null, null]), null);
});

test('the injection moves to the quiet day, and says why', () => {
  const d = decide(g({ day: 0 }), freshAuto(), ctx({ week: ['high', 'moderate', 'low', 'high', 'moderate', 'high', 'rest'] }));
  assert.equal(d.set.day, 6);
  assert.equal(d.entries[0]?.kind, 'day');
  assert.equal(d.entries[0]?.undo?.day, 0);
  assert.match(d.entries[0].text, /duminică/);
});

test('it does not move the day when the last dose was under three days ago', () => {
  const shots = [{ date: day(-1), mg: 1, site: 0 }];
  const d = decide(g({ day: 0, shots }), freshAuto(), ctx({ week: ['high', 'low', 'low', 'high', 'low', 'high', 'rest'] }));
  assert.equal(d.set.day, undefined);
});

test('it holds the ladder when the loss is too fast, and lets go when it is back in band', () => {
  const fast = decide(g(), freshAuto(), ctx({ weights: falling(2) }));
  assert.equal(fast.set.hold, true);
  assert.equal(fast.entries[0]?.kind, 'hold');

  const ok = decide(g({ hold: true }), freshAuto(), ctx({ weights: falling(0.6) }));
  assert.equal(ok.set.hold, false);
  assert.equal(ok.entries[0]?.kind, 'release');

  // already held and still too fast: nothing new is written or logged
  const again = decide(g({ hold: true }), freshAuto(), ctx({ weights: falling(2) }));
  assert.equal(again.set.hold, undefined);
  assert.equal(again.entries.length, 0);
});

test('a low blood sugar in the last two weeks holds the ladder on its own', () => {
  const glucose = [{ id: 'x', date: day(-3), time: '07:00', mg: 64, when: 'fasting' as const }];
  const d = decide(g({ glucose }), freshAuto(), ctx({ weights: falling(0.6) }));
  assert.equal(d.set.hold, true);
  assert.match(d.entries[0].text, /70 mg\/dL/);
});

test('a hold stops titration proposing a step, and nextStep goes quiet', () => {
  const held = g({ hold: true, mg: 1, shots: Array.from({ length: 6 }, (_, i) => ({ date: day(-i * 7), mg: 1, site: 0, nausea: 0 })) });
  assert.equal(titration(held, falling(0.2)).kind, 'held');
  assert.equal(nextStep(held), null);
  held.hold = false;
  assert.equal(nextStep(held), 1.7);
});

test('the three-month recheck fires once, not every day', () => {
  const c = ctx({ lastLabs: day(-RECHECK_DAYS - 1) });
  const first = decide(g(), freshAuto(), c);
  assert.ok(first.entries.some((e) => e.kind === 'labs'));
  // already reminded today
  const after = decide(g(), { ...freshAuto(), recheck: TODAY }, c);
  assert.ok(!after.entries.some((e) => e.kind === 'labs'));
  // recent labs: nothing to say
  const fresh = decide(g(), freshAuto(), ctx({ lastLabs: day(-10) }));
  assert.ok(!fresh.entries.some((e) => e.kind === 'labs'));
});

test('a phase change is announced once', () => {
  const d = decide(g(), { ...freshAuto(), phase: 'Titrarea' }, ctx({ phase: 'Slăbitul' }));
  assert.ok(d.entries.some((e) => e.kind === 'phase' && /Slăbitul/.test(e.text)));
  const same = decide(g(), { ...freshAuto(), phase: 'Slăbitul' }, ctx({ phase: 'Slăbitul' }));
  assert.ok(!same.entries.some((e) => e.kind === 'phase'));
});

test('nothing happens at all when the switch is off or the treatment is not running', () => {
  const hard = ctx({ week: ['high', 'low', 'low', 'high', 'low', 'high', 'rest'], weights: falling(2), lastLabs: day(-200) });
  const off = decide(g({ day: 0 }), { ...freshAuto(), on: false }, hard);
  assert.deepEqual(off, { set: {}, entries: [] });
  const stopped = decide(g({ day: 0, on: false }), freshAuto(), hard);
  assert.deepEqual(stopped, { set: {}, entries: [] });
});

test('no rule ever writes anything but the injection day and the hold', () => {
  const hard = ctx({ week: ['high', 'low', 'low', 'high', 'low', 'high', 'rest'], weights: falling(2), lastLabs: day(-200) });
  const d = decide(g({ day: 0 }), { ...freshAuto(), phase: 'Titrarea' }, hard);
  assert.deepEqual(Object.keys(d.set).sort(), ['day', 'hold']);
});
