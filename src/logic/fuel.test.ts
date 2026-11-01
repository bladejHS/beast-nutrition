import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, type Plan, type Profile } from './calc.ts';
import { classify, dayPlan, FALLBACK_WEEK, readTraining, type Training } from './training.ts';
import { DEFAULT_FACTORS, mealCarbShares, reconcile, weekFuel } from './carbs.ts';
import { activate, adherence, advice, assessmentDue, currentRatio, dayInPhase, daysLeft, decide, freshFasting, pause, PHASES, programPct, resume, status, windowFor, type Progressive } from './fasting.ts';
import { analyseStack, fatMass, microTotals, monthly, movingAverage, sweatLoss, sweatRate, waterTarget, MICROS } from './wellness.ts';
import { alternatives, generateDay, macros, shoppingList, substitute, type Prefs } from './mealplan.ts';
import { buildReport } from './report.ts';

const man: Profile = { sex: 'm', age: 30, heightCm: 180, weightKg: 100, bf: 20, activity: 1.55, lifts: true };
const woman: Profile = { sex: 'f', age: 45, heightCm: 165, weightKg: 90, bf: 36, activity: 1.375, lifts: true };
const plan = (o: Partial<Parameters<typeof buildPlan>[1]> = {}): Plan => buildPlan(man, {
  phase: 'cut', startDate: '2026-11-02', ratePct: 0.6, carbShare: 0.6, maintenance: 2800, highDays: [], breaks: null, pace: 'c', ...o,
});
const week: Training = { linked: true, week: FALLBACK_WEEK, log: {}, sleep: {} };

test('demand comes from the sessions, not the weekday name', () => {
  assert.equal(classify(FALLBACK_WEEK[0]!).demand, 'high');
  assert.equal(classify(FALLBACK_WEEK[1]!).demand, 'moderate');
  assert.equal(classify(FALLBACK_WEEK[2]!).demand, 'low');
  assert.equal(classify(FALLBACK_WEEK[3]!).demand, 'high');
  assert.equal(classify(FALLBACK_WEEK[5]!).demand, 'low');
  assert.equal(classify([]).demand, 'rest');
  assert.equal(classify([{ name: 'Easy', kind: 'rounds', focus: 'slow', min: 10 }]).demand, 'low');
});

test('box plus strength is high even at moderate minutes', () => {
  assert.equal(classify([{ name: 'Bag', kind: 'rounds', focus: 'move', min: 10 }, { name: 'Lift', kind: 'workout', min: 10 }]).demand, 'high');
});

test('a skipped past workout counts as rest; completed work is kept apart from the plan', () => {
  const t: Training = { ...week, log: { '2026-11-03': [{ block: 'tue-cal', name: 'Calisthenics', kind: 'workout', min: 20 }] } };
  const skipped = dayPlan(t, '2026-11-02', '2026-11-10', 0);
  assert.equal(skipped.rating.demand, 'rest');
  assert.equal(skipped.plannedRating.demand, 'high');
  const done = dayPlan(t, '2026-11-03', '2026-11-10', 1);
  assert.equal(done.basis, 'actual');
  assert.equal(done.rating.demand, 'low');
  assert.equal(dayPlan(t, '2026-11-20', '2026-11-10', 0).rating.demand, 'high');
  assert.equal(dayPlan(t, '2026-11-20', '2026-11-10', 0, 'rest').rating.demand, 'rest');
});

test('Inner Beast data is read from shared storage, with a marked fallback', () => {
  assert.equal(readTraining({ getItem: () => null }).linked, false);
  const data: Record<string, string> = {
    'beast:plan:v1': JSON.stringify({ week: FALLBACK_WEEK }),
    'beast:v1': JSON.stringify({ log: [{ date: '2026-11-02', block: 'mon-bag', name: 'Bag', kind: 'rounds', dur: 1200, data: { rpe: 9 } }] }),
  };
  const t = readTraining({ getItem: (k) => data[k] ?? null });
  assert.ok(t.linked);
  assert.equal(t.log['2026-11-02']![0]!.min, 20);
  assert.equal(t.log['2026-11-02']![0]!.rpe, 9);
});

const demandOf = (d: string) => (['high', 'moderate', 'low', 'high', 'moderate', 'low', 'rest'] as const)[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7]!;

test('carb cycling keeps weekly calories, carbs, protein and fat equal to the plan', () => {
  const p = plan();
  const days = weekFuel(p, '2026-11-02', demandOf, DEFAULT_FACTORS, 'm');
  const r = reconcile(p, days);
  assert.equal(r.kcalFuel, r.kcalPlan);
  assert.equal(r.carbsFuel, r.carbsPlan);
  assert.ok(r.proteinSame && r.fatSame);
  assert.ok(days[0]!.c > days[6]!.c);
});

test('it also reconciles with high days and break weeks', () => {
  for (const o of [{ highDays: [5, 6] }, { breaks: { on: 1, off: 1 } }]) {
    const p = plan(o);
    const r = reconcile(p, weekFuel(p, '2026-11-02', demandOf, DEFAULT_FACTORS, 'm'));
    assert.equal(r.carbsFuel, r.carbsPlan);
  }
});

test('past days stay locked when the rest of the week is recalculated', () => {
  const p = plan();
  const before = weekFuel(p, '2026-11-02', demandOf, DEFAULT_FACTORS, 'm');
  const locked = { '2026-11-02': { c: before[0]!.c, base: before[0]!.planC }, '2026-11-03': { c: before[1]!.c, base: before[1]!.planC } };
  const after = weekFuel(p, '2026-11-02', () => 'rest', DEFAULT_FACTORS, 'm', locked);
  assert.equal(after[0]!.c, before[0]!.c);
  assert.equal(after[1]!.c, before[1]!.c);
  assert.equal(reconcile(p, after).carbsFuel, reconcile(p, after).carbsPlan);
});

test('no day goes under the calorie floor or to implausible carbs', () => {
  const small = buildPlan({ ...woman, weightKg: 62, bf: 25 }, { phase: 'cut', startDate: '2026-11-02', ratePct: 1, carbShare: 0.5, maintenance: 1800, highDays: [], breaks: null, pace: 'c' });
  const days = weekFuel(small, '2026-11-02', demandOf, { high: 3, moderate: 1, low: 0.1, rest: 0.1 }, 'f');
  assert.ok(days.every((d) => d.c >= 50 && d.kcal >= 1190), JSON.stringify(days.map((d) => [d.c, d.kcal])));
  assert.equal(reconcile(small, days).carbsFuel, reconcile(small, days).carbsPlan);
});

test('training-day meals get more carbs around the session', () => {
  const s = mealCarbShares(4, 1, 'high');
  assert.ok(s[1]! > s[0]!);
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.deepEqual(mealCarbShares(4, 1, 'rest'), [0.25, 0.25, 0.25, 0.25]);
});

const prog = (o: Partial<Progressive> = {}): Progressive => ({ phase: 0, phaseStart: '2026-11-02', extra: 0, stay: false, pausedSince: null, pausedDays: 0, startedAt: '2026-11-02', doneBefore: 0, assessments: [], ...o });

test('the three phases have the planned durations and ratios', () => {
  assert.deepEqual(PHASES.map((p) => [p.ratio, p.days]), [['12:12', 7], ['14:10', 7], ['16:8', 42]]);
  assert.equal(dayInPhase(prog(), '2026-11-02'), 1);
  assert.equal(daysLeft(prog(), '2026-11-02'), 7);
  assert.equal(daysLeft(prog(), '2026-11-08'), 1);
  assert.equal(programPct(prog({ phase: 2, doneBefore: 14 }), '2026-12-14'), 100);
});

test('fasting windows are calculated correctly', () => {
  const f = { ...freshFasting(), active: { type: 'fixed', protocol: '16:8', since: '2026-11-02' } as const, eatStart: '12:00', dayStart: { 2: '09:30' } };
  assert.deepEqual(windowFor(f, 0), { ratio: '16:8', start: '12:00', end: '20:00', eatMin: 480 });
  assert.equal(windowFor(f, 2)!.end, '17:30');
  const w = windowFor(f, 0)!;
  assert.deepEqual(status(w, 13 * 60), { eating: true, minutesLeft: 420 });
  assert.deepEqual(status(w, 21 * 60), { eating: false, minutesLeft: 900 });
  assert.deepEqual(status(w, 9 * 60), { eating: false, minutesLeft: 180 });
  const late = windowFor({ ...f, eatStart: '20:00' }, 0)!;
  assert.equal(late.end, '04:00');
  assert.equal(status(late, 60).eating, true);
});

test('time passing never advances a phase; only the decision does', () => {
  const p = prog();
  assert.ok(assessmentDue(p, '2027-06-01'));
  assert.equal(currentRatio({ ...freshFasting(), active: { type: 'prog' }, prog: p }), '12:12');
  const next = decide(p, 'advance', '2026-11-09');
  assert.equal(next.phase, 1);
  assert.equal(next.doneBefore, 7);
});

test('extend, repeat, back and stay all follow the user', () => {
  assert.equal(daysLeft(decide(prog(), 'extend', '2026-11-09'), '2026-11-09'), 7);
  const two = prog({ phase: 1, phaseStart: '2026-11-09', doneBefore: 7 });
  assert.equal(decide(two, 'repeat', '2026-11-16').phaseStart, '2026-11-16');
  assert.equal(decide(two, 'repeat', '2026-11-16').phase, 1);
  assert.equal(decide(two, 'back', '2026-11-16').phase, 0);
  assert.equal(assessmentDue(decide(two, 'stay', '2026-11-16'), '2030-01-01'), false);
  assert.equal(decide(prog({ phase: 2 }), 'advance', '2026-12-30').phase, 2);
});

test('a pause freezes the phase clock', () => {
  const p = pause(prog(), '2026-11-04');
  assert.equal(assessmentDue(p, '2026-12-01'), false);
  assert.equal(dayInPhase(p, '2026-11-20'), 3);
  assert.equal(dayInPhase(resume(p, '2026-11-20'), '2026-11-20'), 3);
  assert.equal(currentRatio({ ...freshFasting(), active: { type: 'prog' }, prog: p }), null);
});

test('warning signs recommend less fasting, never pushing on', () => {
  const good = { energy: 8, hunger: 7, sleep: 8, training: 8, wellbeing: 8, nutrition: 8 };
  assert.equal(advice(good, false).level, 'ok');
  assert.equal(advice(good, true).level, 'reduce');
  assert.equal(advice({ ...good, training: 2 }, false).level, 'reduce');
  assert.equal(advice({ ...good, nutrition: 3 }, false).level, 'reduce');
  assert.equal(advice({ ...good, energy: 5, sleep: 5 }, false).level, 'hold');
});

test('only one schedule is active and history survives switching and a restart', () => {
  let f = activate(freshFasting(), { type: 'fixed', protocol: '14:10', since: '2026-11-01' }, '2026-11-01');
  f = { ...f, log: { '2026-11-01': true } };
  f = activate(f, { type: 'prog' }, '2026-11-05');
  assert.equal(f.active?.type, 'prog');
  assert.equal(f.history[0]!.label, '14:10');
  const reloaded = JSON.parse(JSON.stringify(f)) as typeof f;
  assert.equal(reloaded.log['2026-11-01'], true);
  assert.equal(reloaded.prog!.phaseStart, '2026-11-05');
});

test('fasting adherence counts only the days answered', () => {
  assert.deepEqual(adherence({ ...freshFasting(), log: { '2026-11-09': true, '2026-11-08': false } }, '2026-11-10'), { kept: 1, known: 2 });
});

test('sweat rate follows the formula and refuses nonsense', () => {
  const t = { pre: 80, post: 79.2, fluidL: 0.5, urineL: 0.1 };
  assert.ok(Math.abs(sweatLoss(t) - 1.2) < 1e-9);
  assert.ok(Math.abs(sweatRate({ ...t, hours: 1.5 })! - 0.8) < 1e-9);
  assert.equal(sweatRate({ ...t, hours: 0 }), null);
  assert.equal(waterTarget(80), 2800);
});

test('stack analysis finds duplicates and excess caffeine', () => {
  const base = { id: '', brand: '', serving: '', time: '', freq: '', start: '', notes: '' };
  const r = analyseStack([{ ...base, product: 'Pre', ingredient: 'Cafeină', mgPerDay: 250 }, { ...base, product: 'Cafea', ingredient: 'cafeina', mgPerDay: 200 }]);
  assert.equal(r.length, 2);
  assert.equal(r[1]!.level, 'warn');
  assert.equal(analyseStack([{ ...base, product: 'C', ingredient: 'Creatină', mgPerDay: 5000 }]).length, 0);
});

test('missing micronutrient data is not zero', () => {
  const t = microTotals([{ kcal: 300, m: { vitC: 30 } }, { kcal: 700 }]);
  assert.equal(t.total.vitC, 30);
  assert.equal(t.total.b12, undefined);
  assert.equal(t.coverage('vitC'), 0.3);
  assert.equal(t.coverage('b12'), 0);
});

test('reference intakes follow sex and age', () => {
  const fe = MICROS.find((m) => m.key === 'fe')!;
  assert.deepEqual([fe.ref('f', 30), fe.ref('f', 55), fe.ref('m', 30)], [18, 8, 8]);
});

test('moving average, months and fat mass', () => {
  const a = movingAverage({ '2026-11-01': 100, '2026-11-02': 98, '2026-11-20': 90 });
  assert.equal(a[1]![1], 99);
  assert.equal(a[2]![1], 90);
  assert.deepEqual(monthly({ '2026-11-01': 100, '2026-11-02': 98 }), [{ month: '2026-11', avg: 99 }]);
  assert.deepEqual(fatMass(100, 20), { fat: 20, lean: 80 });
});

const mk = (id: string, name: string, kcal: number, p: number, c: number, f: number, fiber = 0) => ({ id, name, en: `en ${name}`, cat: '', kcal, p, c, f, fiber, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda' as const });
const pantry = [
  mk('a', 'Whey (proteină din zer)', 352, 78, 6, 1.6), mk('b', 'Ovăz fulgi, crud', 379, 13, 68, 6.5, 10), mk('c', 'Nuci', 654, 15, 14, 65, 7), mk('d', 'Afine', 57, 0.7, 14.5, 0.3, 2.4),
  mk('e', 'Piept de pui, gătit', 165, 31, 0, 3.6), mk('f', 'Orez alb fiert', 130, 2.7, 28, 0.3), mk('g', 'Ulei de măsline', 884, 0, 0, 100), mk('h', 'Broccoli fiert', 35, 2.4, 7, 0.4, 3.3),
  mk('i', 'Piept de curcan, gătit', 147, 30, 0, 2), mk('j', 'Cartofi la cuptor', 93, 2.5, 21, 0.1, 2.2), mk('k', 'Salată verde', 15, 1.4, 2.9, 0.2, 1.3), mk('l', 'Somon gătit', 206, 22, 0, 12.4), mk('m', 'Cartofi fierți', 86, 1.7, 20, 0.1, 1.8),
];
const prefs: Prefs = { meals: 4, exclude: '', allergies: '', maxCook: 60, budget: 0 };
const dayT = { p: 180, c: 220, f: 60 };
const dbm = new Map(pantry.map((f) => [f.id, f]));
const even = [0.25, 0.25, 0.25, 0.25];

test('generated days reconcile with the targets using real food values', () => {
  const meals = generateDay(dayT, even, ['08:00', '12:00', '16:00', '20:00'], [], pantry, prefs, 1);
  assert.equal(meals.length, 4);
  const t = macros(meals.flatMap((m) => m.items), dbm);
  assert.ok(Math.abs(t.p - dayT.p) <= dayT.p * 0.08, `p ${t.p}`);
  assert.ok(Math.abs(t.c - dayT.c) <= dayT.c * 0.08, `c ${t.c}`);
  assert.ok(Math.abs(t.f - dayT.f) <= dayT.f * 0.15, `f ${t.f}`);
  assert.ok(meals.flatMap((m) => m.items).every((i) => dbm.has(i.foodId)));
});

test('oats only come with whey, and exclusions and allergies are respected', () => {
  for (let seed = 0; seed < 12; seed++) {
    for (const m of generateDay(dayT, even, [], [], pantry, prefs, seed)) {
      const ids = m.items.map((i) => i.foodId);
      if (ids.includes('b')) assert.ok(ids.includes('a'));
    }
    const ids = generateDay(dayT, even, [], [], pantry, { ...prefs, exclude: 'somon', allergies: 'nuci' }, seed).flatMap((m) => m.items.map((i) => i.foodId));
    assert.ok(!ids.includes('l') && !ids.includes('c'));
  }
});

test('a substitution recalculates the meal and keeps the macros close', () => {
  const meal = generateDay(dayT, even, [], [], pantry, prefs, 1)[1]!;
  const before = macros(meal.items, dbm);
  const i = meal.items.findIndex((x) => x.role === 'protein');
  const swap = pantry.find((f) => (f.id === 'i' || f.id === 'e') && f.id !== meal.items[i]!.foodId)!;
  const after = substitute(meal, i, swap, dbm);
  assert.ok(after.items.some((x) => x.foodId === swap.id));
  assert.ok(Math.abs(macros(after.items, dbm).p - before.p) < 8);
  assert.ok(alternatives('protein', 'e', pantry, { ...prefs, exclude: 'curcan' }).every((f) => f.id !== 'i'));
});

test('the shopping list adds up all days', () => {
  const m = { id: '', name: '', steps: '', time: '', done: false, tag: '', items: [{ foodId: 'e', role: 'protein' as const, g: 100 }] };
  assert.deepEqual(shoppingList([[m], [m]], dbm), [{ id: 'e', name: 'Piept de pui, gătit', g: 200 }]);
});

test('the weekly report averages logged days and gives real recommendations', () => {
  const d = (date: string, kcal: number) => ({ date, kcal, p: 120, c: 200, f: 60, fiber: 10, tKcal: 2200, tP: 185, tC: 200, demand: 'high', plannedSessions: 3, doneSessions: 1, water: 2000, suppsTaken: 1, fastKept: true });
  const r = buildReport('2026-11-02', [d('2026-11-02', 2200), d('2026-11-03', 2200), d('2026-11-04', 0)], 80, 80.5, 90);
  assert.equal(r.logged, 2);
  assert.equal(r.avg.kcal, 2200);
  assert.equal(r.weightChange, -0.5);
  assert.ok(r.recs.length >= 2 && r.recs.length <= 3);
  assert.equal(r.carbFit, 100);
});

import { readFileSync } from 'node:fs';
import { parseMenu, search, type MenuRow } from './foods.ts';

test('the Splendid Chicken menu keeps the declared values and is searchable', () => {
  const menu = parseMenu(JSON.parse(readFileSync('public/splendid.json', 'utf8')) as MenuRow[]);
  assert.equal(menu.length, 72);
  const wings = menu.find((f) => f.name === 'Buffalo Wings')!;
  assert.deepEqual([wings.kcal, wings.p, wings.c, wings.f, wings.sat, wings.sugar], [298, 20, 11, 19, 5.7, 1.7]);
  assert.deepEqual(wings.portions[0], ['5 buc. (145 g)', 145]);
  assert.equal(wings.portions[1]![1], 29);
  assert.match(wings.allergens!, /Arahide/);
  assert.equal(search(menu, 'buffalo wings')[0]!.name, 'Buffalo Wings');
  for (const f of menu) assert.ok(Math.abs(f.p * 4 + f.c * 4 + f.f * 9 - f.kcal) <= Math.max(14, f.kcal * 0.12), f.name);
});
