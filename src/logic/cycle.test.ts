import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, targetFor, type Plan, type Profile } from './calc.ts';
import { DEFAULT_FACTORS, mealCarbShares, reconcile } from './carbs.ts';
import { cycleWeek, freeze, targetOn, type CycleIn } from './cycle.ts';
import { generateDay, macros, mealOptions, regenerate, type Meal, type Prefs } from './mealplan.ts';
import { entryFrom, relog, totals, type Entry, type Snap } from './store.ts';
import { classify, CARB_LABEL, DEFAULT_LIMITS, FALLBACK_WEEK, nextSession, picks, type Session, type Training } from './training.ts';

const man: Profile = { sex: 'm', age: 30, heightCm: 180, weightKg: 100, bf: 20, activity: 1.55, lifts: true };
const plan: Plan = buildPlan(man, { phase: 'cut', startDate: '2026-11-02', ratePct: 0.6, carbShare: 0.7, maintenance: 2800, highDays: [], breaks: null, pace: 'c' });
const week: Training = { linked: true, week: FALLBACK_WEEK, log: {}, sleep: {} };
const MONDAY = '2026-11-02';
const input = (o: Partial<CycleIn> = {}): CycleIn => ({ plan, sex: 'm', cycling: true, factors: DEFAULT_FACTORS, limits: DEFAULT_LIMITS, overrides: {}, snap: {}, today: MONDAY, training: week, ...o });

const thursday = (feet: Session, main: Session): Session[] => [feet, FALLBACK_WEEK[3]![1]!, main];
const rope: Session = FALLBACK_WEEK[3]![0]!;
const ladder: Session = { ...rope, name: 'Agility Ladder', focus: 'ladder', alt: { other: 'Jumping Rope' } };
const bag: Session = FALLBACK_WEEK[3]![2]!;
const row = (name: string, min: number): Session => ({ id: 'thu-bag', name: 'Machine Row', kind: 'row', min, alt: { other: 'Heavy Bag Training', detail: name } });

test('Thursday counts only the picked alternatives, with the workload of the rowing challenge', () => {
  assert.equal(classify(thursday(rope, bag)).demand, 'high');
  assert.equal(classify(thursday(ladder, bag)).demand, 'high');
  assert.equal(classify(thursday(rope, row('Challenge A: 1.000 m', 5))).demand, 'moderate');
  assert.equal(classify(thursday(ladder, row('Challenge D: 250 m × 8', 14))).demand, 'moderate');
  assert.equal(classify(thursday(rope, row('Challenge C: 10.000 m', 45))).demand, 'high');
  const all = classify([rope, ladder, FALLBACK_WEEK[3]![1]!, bag, row('Challenge C: 10.000 m', 45)]);
  assert.ok(classify(thursday(rope, bag)).load < all.load, 'all alternatives together would overstate the day');
  assert.deepEqual(picks(thursday(ladder, row('Challenge B: 5.000 m', 22))), ['Agility Ladder, nu Jumping Rope', 'Machine Row (Challenge B: 5.000 m), nu Heavy Bag Training']);
});

test('the boxing days keep their structure: Monday and Thursday are high, the light boxing of Tuesday and Friday is not', () => {
  assert.deepEqual([0, 1, 3, 4].map((i) => classify(FALLBACK_WEEK[i]!).demand), ['high', 'moderate', 'high', 'moderate']);
  assert.match(classify(FALLBACK_WEEK[0]!).reason, /box și forță/);
});

test('leg intervals on the round timer are not boxing, so Sunday is not a box-and-strength day', () => {
  const sunday = classify(FALLBACK_WEEK[6]!);
  assert.equal(sunday.demand, 'moderate');
  assert.doesNotMatch(sunday.reason, /box/);
});

test('demand follows the sessions, not the weekday', () => {
  const swapped: Training = { ...week, week: [FALLBACK_WEEK[2]!, FALLBACK_WEEK[1]!, FALLBACK_WEEK[0]!, ...FALLBACK_WEEK.slice(3)] };
  const { days } = cycleWeek(input({ training: swapped }), MONDAY);
  assert.deepEqual([days[0]!.demand, days[2]!.demand], ['low', 'high']);
  assert.ok(days[2]!.c > days[0]!.c);
});

test('protein, fat and the weekly energy stay those of the plan, and only carbs move', () => {
  const { days } = cycleWeek(input(), MONDAY);
  const r = reconcile(plan, days);
  assert.equal(r.kcalFuel, r.kcalPlan);
  assert.equal(r.carbsFuel, r.carbsPlan);
  assert.ok(r.proteinSame && r.fatSame);
  for (const d of days) assert.equal(d.kcal, d.p * 4 + d.c * 4 + d.f * 9);
  assert.equal(new Set(days.map((d) => d.c)).size > 1, true);
});

test('a rest week is no deficit: all days rated the same give back the plan', () => {
  const none: Training = { ...week, week: FALLBACK_WEEK.map(() => []) };
  const { days } = cycleWeek(input({ training: none }), MONDAY);
  for (const d of days) assert.equal(d.c, targetFor(plan, d.date).c);
});

test('an override changes the day and rebalances only the days ahead', () => {
  const before = cycleWeek(input({ today: '2026-11-04' }), MONDAY).days;
  const x = input({ today: '2026-11-04', overrides: { '2026-11-06': 'rest' } });
  const after = cycleWeek(x, MONDAY).days;
  assert.equal(after[4]!.demand, 'rest');
  assert.ok(after[4]!.c < before[4]!.c);
  assert.equal(after[0]!.c, before[0]!.c);
  assert.equal(after[1]!.c, before[1]!.c);
  assert.equal(reconcile(plan, after).carbsFuel, reconcile(plan, after).carbsPlan);
});

test('a completed day keeps its target whatever changes afterwards', () => {
  const monday = input();
  const snaps = freeze(monday).snaps;
  const frozen = snaps[MONDAY]!;
  const later: CycleIn = { ...monday, today: '2026-11-03', snap: snaps };
  const original = targetOn(later, MONDAY);
  assert.deepEqual([original.c, original.kcal], [frozen.c, frozen.kcal]);
  const lighter: Training = { ...week, week: [[], ...FALLBACK_WEEK.slice(1)] };
  for (const x of [{ ...later, training: lighter }, { ...later, overrides: { [MONDAY]: 'rest' as const } }, { ...later, cycling: false }, { ...later, factors: { high: 2, moderate: 1, low: 0.5, rest: 0.3 } }]) {
    const t = targetOn(x, MONDAY);
    assert.deepEqual([t.c, t.kcal, t.p, t.f], [frozen.c, frozen.kcal, frozen.p, frozen.f]);
  }
  const r = reconcile(plan, cycleWeek({ ...later, training: lighter }, MONDAY).days);
  assert.equal(r.carbsFuel, r.carbsPlan);
});

test('the snapshot records the class really used, and an existing one is not rewritten', () => {
  const x = input({ overrides: { [MONDAY]: 'rest' } });
  assert.equal(freeze(x).snaps[MONDAY]!.demand, 'rest');
  const old: Snap = { c: 111, kcal: 1, p: 1, f: 1, demand: 'low', reason: '' };
  const next = freeze(input({ today: '2026-11-03', snap: { [MONDAY]: old } }));
  assert.equal(next.snaps[MONDAY], undefined);
  assert.ok(next.snaps['2026-11-03']);
});

test('the signature of the days ahead notices a changed Thursday', () => {
  const light: Training = { ...week, week: FALLBACK_WEEK.map((d, i) => (i === 3 ? thursday(rope, row('Challenge A: 1.000 m', 5)) : d)) };
  assert.notEqual(freeze(input()).sig, freeze(input({ training: light })).sig);
});

test('the next session skips what the log shows as done', () => {
  const planned = FALLBACK_WEEK[0]!;
  assert.equal(nextSession({ planned, done: [] })!.id, 'mon-shadow');
  assert.equal(nextSession({ planned, done: [{ block: 'mon-shadow', name: '', kind: '', min: 1 }] })!.id, 'mon-bw');
  assert.equal(CARB_LABEL.low, 'LOWER CARB');
});

const mk = (id: string, name: string, kcal: number, p: number, c: number, f: number, fiber = 0) => ({ id, name, en: `en ${name}`, cat: '', kcal, p, c, f, fiber, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda' as const });
const pantry = [
  mk('a', 'Whey (proteină din zer)', 352, 78, 6, 1.6), mk('b', 'Ovăz fulgi, crud', 379, 13, 68, 6.5, 10), mk('c', 'Nuci', 654, 15, 14, 65, 7), mk('d', 'Afine', 57, 0.7, 14.5, 0.3, 2.4),
  mk('e', 'Piept de pui, gătit', 165, 31, 0, 3.6), mk('f', 'Orez alb fiert', 130, 2.7, 28, 0.3), mk('g', 'Ulei de măsline', 884, 0, 0, 100), mk('h', 'Broccoli fiert', 35, 2.4, 7, 0.4, 3.3),
  mk('i', 'Piept de curcan, gătit', 147, 30, 0, 2), mk('j', 'Cartofi la cuptor', 93, 2.5, 21, 0.1, 2.2), mk('k', 'Salată verde', 15, 1.4, 2.9, 0.2, 1.3), mk('l', 'Somon gătit', 206, 22, 0, 12.4), mk('m', 'Cartofi fierți', 86, 1.7, 20, 0.1, 1.8),
];
const db = new Map(pantry.map((f) => [f.id, f]));
const prefs: Prefs = { meals: 4, exclude: '', allergies: '', maxCook: 60, budget: 0 };
const times = ['08:00', '12:00', '16:00', '20:00'];

test('the planner receives each day\'s own target: a high day gets more carbs than a low one', () => {
  const { days } = cycleWeek(input(), MONDAY);
  const hi = days.find((d) => d.demand === 'high')!;
  const lo = days.find((d) => d.demand === 'low')!;
  const total = (d: typeof hi) => macros(generateDay(d, mealCarbShares(4, 2, d.demand), times, [], pantry, prefs, 1).flatMap((m) => m.items), db);
  const a = total(hi), b = total(lo);
  assert.ok(a.c > b.c + 20, `${a.c} vs ${b.c}`);
  assert.ok(Math.abs(a.c - hi.c) <= hi.c * 0.08, `high ${a.c} of ${hi.c}`);
  assert.ok(Math.abs(b.c - lo.c) <= lo.c * 0.08, `low ${b.c} of ${lo.c}`);
});

const dayGoal = { p: 180, c: 220, f: 60 };
const even = [0.25, 0.25, 0.25, 0.25];

test('regenerating never touches a logged meal and shares out only what is left', () => {
  const first = generateDay(dayGoal, even, times, [], pantry, prefs, 1);
  first[0]!.done = true;
  const before = JSON.stringify(first[0]);
  const fresh = regenerate(first, { ...dayGoal, c: 300 }, even, times, [], pantry, prefs, 5);
  assert.equal(JSON.stringify(fresh.find((m) => m.done)), before);
  assert.equal(fresh.length, 4);
  assert.equal(fresh.filter((m) => m.done).length, 1);
  const sum = macros(fresh.flatMap((m) => m.items), db);
  assert.ok(Math.abs(sum.c - 300) <= 300 * 0.1, `c ${sum.c}`);
  assert.equal(new Set(fresh.map((m) => m.name)).size, 4);
});

test('with every meal logged nothing is regenerated', () => {
  const all: Meal[] = generateDay(dayGoal, even, times, [], pantry, prefs, 1).map((m) => ({ ...m, done: true }));
  assert.equal(JSON.stringify(regenerate(all, { ...dayGoal, c: 400 }, even, times, [], pantry, prefs, 3)), JSON.stringify(all));
});

test('options for a meal are sized to the same macros and keep the exclusions', () => {
  const goal = { p: 45, c: 80, f: 12 };
  const list = mealOptions(goal, pantry, prefs, '16:00', 'Înainte de antrenament', 1, 'Pui cu orez și broccoli');
  assert.ok(list.length >= 2);
  assert.ok(list.every((m) => m.name !== 'Pui cu orez și broccoli' && m.tag === 'Înainte de antrenament' && m.time === '16:00'));
  const best = macros(list[0]!.items, db);
  assert.ok(Math.abs(best.p - goal.p) < 8 && Math.abs(best.c - goal.c) < 12, JSON.stringify(best));
  const safe = mealOptions(goal, pantry, { ...prefs, allergies: 'somon, curcan' }, '16:00', '', 1);
  assert.ok(safe.flatMap((m) => m.items).every((i) => i.foodId !== 'l' && i.foodId !== 'i'));
});

test('changing a logged meal changes the journal and what remains, and leaves the other entries', () => {
  const other: Entry = entryFrom(pantry[3]!, 100);
  const a = entryFrom(pantry[4]!, 200);
  const base: Entry[][] = [[other], [], [], [], []];
  const logged = relog(base, 'meal-1', [a], 1, false)!;
  assert.equal(logged[1]![0]!.from, 'meal-1');
  assert.equal(base[1]!.length, 0, 'the input is not mutated');
  const smaller = relog(logged, 'meal-1', [entryFrom(pantry[4]!, 100)], 0, true)!;
  assert.equal(smaller[1]!.length, 1, 'stays in its slot');
  assert.equal(totals(smaller).kcal, totals(logged).kcal - Math.round(165));
  assert.equal(smaller[0]![0], other);
  const gone = relog(smaller, 'meal-1', [], 0, true)!;
  assert.equal(gone.flat().length, 1);
  assert.equal(relog(base, 'older-meal', [a], 0, true), null, 'a meal logged without a link is not guessed at');
});
