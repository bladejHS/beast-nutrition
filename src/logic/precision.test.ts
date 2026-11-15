/* 2026-11-15, the user: "asigură-te de precizia macronutrienților din planul de masă generat". Every generated day,
   from the real food database, for several targets and 3, 4 or 5 meals, must land within a gram or two of each macro. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDb } from './foods.ts';
import { generateDay, macros } from './mealplan.ts';

const foods = parseDb(JSON.parse(readFileSync('public/foods.json', 'utf8')));
const db = new Map(foods.map((f) => [f.id, f]));

test('generated days hit protein, carbs and fat within 2 g, from the real database', () => {
  const days = [{ p: 210, c: 328, f: 60 }, { p: 210, c: 391, f: 60 }, { p: 210, c: 271, f: 70 }, { p: 180, c: 220, f: 60 }, { p: 160, c: 150, f: 55 }];
  for (const day of days) for (const n of [3, 4, 5]) for (let seed = 1; seed < 13; seed++) {
    const times = ['08:00', '11:30', '15:00', '18:30', '21:00'].slice(0, n);
    const meals = generateDay(day, times.map(() => 1 / n), times, [], foods, { meals: 4, exclude: '', allergies: '', maxCook: 60, budget: 0 }, seed);
    const t = macros(meals.flatMap((m) => m.items), db);
    const msg = `${JSON.stringify(day)} ${n} meals, seed ${seed}: ${t.p.toFixed(1)} / ${t.c.toFixed(1)} / ${t.f.toFixed(1)}`;
    assert.ok(Math.abs(t.p - day.p) <= 2 && Math.abs(t.c - day.c) <= 2 && Math.abs(t.f - day.f) <= 2, msg);
    assert.ok(meals.flatMap((m) => m.items).every((i) => i.g >= 0 && Number.isInteger(i.g)), msg);
  }
});
