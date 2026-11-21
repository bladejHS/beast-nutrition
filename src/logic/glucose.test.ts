import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshGlp1, glucoseFeedback, glucoseLevel, titration, type Glucose, type Glp1 } from './glp1.ts';
import { addDays } from './review.ts';

const T = '2026-11-21';
const g = (back: number, mg: number, when: Glucose['when'] = 'fasting'): Glucose => ({ id: `${back}${mg}${when}`, date: addDays(T, -back), time: '07:30', mg, when });

test('levels follow the ADA cut-offs, fasting and after a meal apart', () => {
  assert.deepEqual([65, 92, 110, 130].map((mg) => glucoseLevel({ mg, when: 'fasting' })), ['low', 'ok', 'raised', 'high']);
  assert.deepEqual([120, 160, 210].map((mg) => glucoseLevel({ mg, when: 'post' })), ['ok', 'raised', 'high']);
});

test('feedback: the week against the one before and against the start of the treatment', () => {
  const list = [g(16, 112), g(15, 110), g(10, 104), g(8, 102), g(3, 96), g(1, 94), g(2, 128, 'post')];
  const f = glucoseFeedback(list, T, addDays(T, -16));
  assert.deepEqual([f.fasting, f.before, f.start, f.post, f.level], [95, 103, 109, 128, 'good']);
  assert.match(f.text, /Scade față de săptămâna trecută/);
  assert.match(f.text, /a scăzut cu 14 mg\/dL/);
});

test('a low reading warns, under 54 is urgent, repeated highs send to the doctor', () => {
  assert.equal(glucoseFeedback([g(2, 66), g(1, 90)], T).level, 'doctor');
  assert.equal(glucoseFeedback([g(1, 50)], T).level, 'urgent');
  assert.equal(glucoseFeedback([g(2, 131), g(1, 215, 'post')], T).level, 'doctor');
  assert.equal(glucoseFeedback([], T).level, 'none');
});

test('a low reading holds the next step up of the dose', () => {
  const base: Glp1 = { ...freshGlp1(), on: true, mg: 0.5, start: '2026-10-01', shots: Array.from({ length: 6 }, (_, i) => ({ date: addDays('2026-10-15', i * 7), mg: 0.5, site: 0 })) };
  const weights = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [addDays(T, i - 20), 120]));
  assert.equal(titration(base, weights).kind, 'up');
  assert.equal(titration({ ...base, glucose: [g(3, 64)] }, weights).kind, 'lowsugar');
});
