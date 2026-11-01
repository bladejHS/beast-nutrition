import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNum } from '../app.ts';
import { buildPlan, shiftCarbsFat, type Profile } from './calc.ts';
import { alternatives, type Prefs } from './mealplan.ts';
import type { Food } from './foods.ts';
import { aroundSession } from './timing.ts';
import { bandCount, dayRows, inBand, nextMeal } from './today.ts';
import { chartRange, trendAlpha, trendChange, weightTrend } from './trend.ts';

test('the day reads in time order, with training between meals and one marker for now', () => {
  const rows = dayRows(['08:00', '11:35', '15:10', '18:50'], { start: '17:00', end: '18:15' }, '13:20');
  assert.deepEqual(rows.map((r) => r.kind), ['meal', 'meal', 'now', 'meal', 'train', 'meal']);
  assert.equal(rows[2]!.time, '13:20');
  assert.deepEqual(dayRows(['08:00'], null, '23:00').map((r) => r.kind), ['meal', 'now']);
  assert.deepEqual(dayRows(['08:00'], null, null).map((r) => r.kind), ['meal']);
});

test('the next meal follows the last one logged and never asks for one long past', () => {
  const times = ['08:00', '11:35', '15:10', '18:50'];
  assert.equal(nextMeal([false, false, false, false], times, 7 * 60), 0);
  assert.equal(nextMeal([true, false, false, false], times, 9 * 60), 1);
  assert.equal(nextMeal([false, false, false, false], times, 13 * 60 + 20), 2, 'breakfast is not asked for after lunch');
  assert.equal(nextMeal([true, true, true, true], times, 20 * 60), null);
  assert.equal(nextMeal([true, false, true, false], times, 16 * 60), 3, 'a skipped meal stays behind');
  assert.equal(nextMeal([false, false, false, false], times, 23 * 60), 3, 'late at night the last meal is still open');
});

test('a meal that falls during training moves after it and the rest keep their order', () => {
  // 16:8 from 10:00 with training at 17:00: the old result tagged 17:10 as the meal after training.
  const out = aroundSession(['10:00', '12:25', '14:50', '17:10'], '17:00', 75);
  assert.deepEqual(out.times, ['10:00', '12:25', '14:50', '18:35']);
  assert.equal(out.moved, 3);
  const none = aroundSession(['08:00', '11:35', '15:10', '18:50'], '17:00', 75);
  assert.equal(none.moved, null);
  assert.deepEqual(none.times, ['08:00', '11:35', '15:10', '18:50']);
  const later = aroundSession(['10:00', '11:00', '12:00', '13:00'], '10:30', 60);
  assert.deepEqual(later.times, ['10:00', '11:50', '13:20', '14:50'], 'nothing is left closer than 90 minutes');
});

test('the carb band judges only days with food logged', () => {
  assert.ok(inBand(115, 100));
  assert.ok(!inBand(116, 100));
  assert.deepEqual(bandCount([{ eaten: 100, target: 100 }, { eaten: 50, target: 100 }, { eaten: 0, target: 100 }]), { logged: 2, inside: 1 });
});

test('the trend skips missed days without inventing weigh-ins', () => {
  const steady = weightTrend({ '2026-01-01': 100, '2026-01-02': 100, '2026-01-03': 100 }, 0.25);
  assert.deepEqual(steady.map((p) => p.trend), [100, 100, 100]);
  const gap = weightTrend({ '2026-01-01': 100, '2026-01-08': 96 }, 0.25);
  assert.ok(gap[1]!.trend < 98, 'a week away counts for more than one day');
  const next = weightTrend({ '2026-01-01': 100, '2026-01-02': 96 }, 0.25);
  assert.equal(next[1]!.trend, 99);
  assert.equal(trendAlpha('cut'), 0.25);
  assert.equal(trendAlpha('maintain'), 0.1);
});

test('a small change never fills the chart, and the change is read over a real week', () => {
  assert.deepEqual(chartRange([99.8, 100.1]).map((v) => Math.round(v * 100) / 100), [98.45, 101.45]);
  assert.deepEqual(chartRange([95, 100]), [95, 100]);
  const points = weightTrend({ '2026-01-01': 100, '2026-01-04': 100, '2026-01-08': 100 }, 0.25);
  assert.equal(trendChange(points), 0);
  assert.equal(trendChange(points.slice(0, 2)), null);
});

test('numbers typed with a Romanian comma are read', () => {
  assert.equal(parseNum('82,5'), 82.5);
  assert.equal(parseNum(' 82.5 '), 82.5);
  assert.ok(Number.isNaN(parseNum('')));
  assert.ok(Number.isNaN(parseNum('abc')));
});

const food = (name: string, id = name): Food => ({ id, name, en: 'x', cat: '', kcal: 100, p: 10, c: 10, f: 1, fiber: 0, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda' });
const kitchen = ['Ovăz fulgi, crud', 'Banană', 'Orez alb fiert', 'Cartofi fierți', 'Whey (proteină din zer)', 'Piept de pui, gătit', 'Iaurt grecesc degresat', 'Tofu', 'Nuci', 'Ulei de măsline'].map((n) => food(n));
const prefs: Prefs = { meals: 4, exclude: '', allergies: '', maxCook: 30, budget: 0 };

test('a swap keeps the food rules: oats only with whey, sweet and savory apart', () => {
  const names = (l: Food[]) => l.map((f) => f.name);
  const savory = names(alternatives('carb', 'Orez alb fiert', kitchen, prefs, ['Piept de pui, gătit', 'Ulei de măsline']));
  assert.ok(savory.includes('Cartofi fierți'));
  assert.ok(!savory.includes('Ovăz fulgi, crud'), 'no oats next to chicken');
  assert.ok(!savory.includes('Banană'), 'no banana next to chicken');
  const bowl = names(alternatives('protein', 'Whey (proteină din zer)', kitchen, prefs, ['Ovăz fulgi, crud', 'Banană']));
  assert.deepEqual(bowl, [], 'whey stays with the oats');
  const sweet = names(alternatives('carb', 'Ovăz fulgi, crud', kitchen, prefs, ['Whey (proteină din zer)', 'Nuci']));
  assert.ok(sweet.includes('Banană'));
  assert.ok(!sweet.includes('Orez alb fiert'));
  assert.ok(names(alternatives('carb', 'Banană', kitchen, prefs, ['Whey (proteină din zer)'])).includes('Ovăz fulgi, crud'), 'oats are fine when whey is there');
});

test('steps of the plan can be replayed on a recalculated plan', () => {
  const p: Profile = { sex: 'm', age: 30, heightCm: 180, weightKg: 100, bf: 20, activity: 1.55, lifts: true };
  const plan = buildPlan(p, { phase: 'cut', startDate: '2026-01-05', ratePct: 0.6, carbShare: 0.7, maintenance: 2800, highDays: [], breaks: null, pace: 'c' });
  const replayed = [-5, -10].reduce((m, pct) => shiftCarbsFat(m, pct), plan.macros);
  assert.ok(replayed.kcal < plan.macros.kcal * 0.92);
  assert.equal(replayed.p, plan.macros.p);
});
