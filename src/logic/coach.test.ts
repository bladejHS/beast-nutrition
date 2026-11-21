/* 2026-11-21, the coach's rules on the real food database (coach.ts, mealplan.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDb } from './foods.ts';
import { generateDay, macros, type Meal } from './mealplan.ts';
import { mealCarbShares, mealFatShares } from './carbs.ts';
import { FIBRE_PER_1000, leucine, LEUCINE_MIN, OILY_FISH, POST_TAG, PRE_TAG, RED_MEAT, SLOW_PROTEIN, weekFocus, why } from './coach.ts';

const foods = parseDb(JSON.parse(readFileSync('public/foods.json', 'utf8')));
const db = new Map(foods.map((f) => [f.id, f]));
const prefs = { meals: 4 as const, exclude: '', allergies: '', maxCook: 60, budget: 0 };
const times = ['08:00', '11:35', '15:10', '18:50'];
// the user's numbers (134 kg, body fat over 30 %): a HIGH training day and an easy one
const HIGH = { p: 210, c: 356, f: 70 }, LOW = { p: 210, c: 250, f: 70 };
const LBM = 134 * (1 - 0.32);
const train = (day: typeof HIGH, seed: number, focus: ReturnType<typeof weekFocus> = null) =>
  generateDay(day, mealCarbShares(4, 2, 'high'), times, ['', '', PRE_TAG, POST_TAG], foods, prefs, seed, { fatShares: mealFatShares(4, 2, 'high'), focus });
const rest = (seed: number, focus: ReturnType<typeof weekFocus> = null) => generateDay(LOW, [0.25, 0.25, 0.25, 0.25], times, ['', '', '', ''], foods, prefs, seed, { focus });
const names = (m: Meal) => m.items.map((it) => db.get(it.foodId)?.name ?? '');
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

test('1. every meal carries enough protein and leucine to start muscle protein synthesis', () => {
  for (const s of SEEDS) for (const day of [train(HIGH, s), rest(s)]) for (const m of day) {
    const t = macros(m.items, db);
    assert.ok(t.p >= 0.33 * LBM, `${m.name}: ${t.p.toFixed(1)} g protein`);
    assert.ok(leucine(m.items, db) >= LEUCINE_MIN, `${m.name}: ${leucine(m.items, db).toFixed(2)} g leucine`);
  }
});

test('2. before training: light, more carbs, little fat and fibre; after: protein and carbs', () => {
  for (const s of SEEDS) {
    const day = train(HIGH, s);
    const [a, b, pre, post] = day.map((m) => macros(m.items, db));
    assert.equal(day[2]!.tag, PRE_TAG);
    assert.ok(pre!.f <= 12 && pre!.fiber <= 9, `pre ${day[2]!.name}: fat ${pre!.f.toFixed(1)}, fibre ${pre!.fiber.toFixed(1)}`);
    assert.ok(pre!.c > (a!.c + b!.c) / 2 && post!.c > (a!.c + b!.c) / 2, `carbs ${[a, b, pre, post].map((x) => x!.c.toFixed(0))}`);
    assert.ok(pre!.f < (a!.f + b!.f) / 2, 'fat moves away from training');
    assert.ok(post!.p >= 0.33 * LBM);
  }
});

test('3. the last meal before sleep is ~30–40 g of slowly digested dairy protein', () => {
  for (const s of SEEDS) {
    const last = rest(s).at(-1)!;
    const t = macros(last.items, db);
    assert.ok(names(last).some((n) => SLOW_PROTEIN.includes(n)), `${last.name}: ${names(last)}`);
    assert.ok(t.p >= 30 && t.p <= 42, `${last.name}: ${t.p.toFixed(1)} g`);
  }
});

test('4. the day still lands on its macros within 2 g', () => {
  for (const s of SEEDS) for (const [day, goal] of [[train(HIGH, s), HIGH], [rest(s), LOW]] as const) {
    const t = macros(day.flatMap((m) => m.items), db);
    assert.ok(Math.abs(t.p - goal.p) <= 2 && Math.abs(t.c - goal.c) <= 2 && Math.abs(t.f - goal.f) <= 2, `${t.p.toFixed(1)}/${t.c.toFixed(1)}/${t.f.toFixed(1)}`);
  }
});

test('5. fibre near 14 g per 1000 kcal, vegetables at every savoury meal', () => {
  for (const s of SEEDS) for (const day of [train(HIGH, s), rest(s)]) {
    const t = macros(day.flatMap((m) => m.items), db);
    assert.ok(t.fiber >= (t.kcal / 1000) * FIBRE_PER_1000 * 0.7, `fibre ${t.fiber.toFixed(1)} for ${t.kcal.toFixed(0)} kcal`);
    for (const m of day) assert.ok(m.items.some((i) => i.role === 'veg'), m.name);
  }
});

test('6. the week: oily fish twice, red meat twice, dairy every day', () => {
  const week = Array.from({ length: 7 }, (_, i) => `2026-11-${String(23 + i).padStart(2, '0')}`);
  const days = week.map((d, i) => (i % 2 ? rest(i + 1, weekFocus(d)) : train(HIGH, i + 1, weekFocus(d))));
  const count = (list: string[]) => days.filter((day) => day.some((m) => names(m).some((n) => list.includes(n)))).length;
  assert.ok(count(OILY_FISH) >= 2, `fish on ${count(OILY_FISH)} days`);
  assert.ok(count(RED_MEAT) >= 2, `red meat on ${count(RED_MEAT)} days`);
  const dairy = /lapte|iaurt|skyr|brânz|cottage|parmezan|telemea/i;
  assert.ok(days.every((day) => day.some((m) => names(m).some((n) => dairy.test(n)))), 'dairy every day');
});

test('7. every meal says why it is built that way', () => {
  const day = train(HIGH, 3), night = rest(3);
  assert.match(why(day[2]!, 2, day, db), /Înainte de antrenament/);
  assert.match(why(day[3]!, 3, day, db), /După antrenament/);
  assert.match(why(night[3]!, 3, night, db), /somn/);
  assert.match(why(day[0]!, 0, day, db), /Proteină/);
});
