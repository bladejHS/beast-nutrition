import assert from 'node:assert/strict';
import { test } from 'node:test';
import { due, freshGlp1, nextSite, titration, units, vialLeft, weeksAtDose, type Glp1 } from './glp1.ts';

// 2026-11-11 is a Wednesday (day 2)
const g = (over: Partial<Glp1> = {}): Glp1 => ({ ...freshGlp1(), on: true, start: '2026-11-11', ...over });

test('the first dose falls on the chosen weekday, then every 7 days', () => {
  assert.deepEqual(due(g(), '2026-11-09'), { kind: 'upcoming', date: '2026-11-11', days: 2 });
  assert.deepEqual(due(g(), '2026-11-11'), { kind: 'today', date: '2026-11-11' });
  const one = g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 0 }] });
  assert.deepEqual(due(one, '2026-11-12'), { kind: 'upcoming', date: '2026-11-18', days: 6 });
  assert.equal(due(one, '2026-11-18').kind, 'today');
});

test('a missed dose: taken when the next is more than 2 days away, skipped otherwise', () => {
  const one = g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 0 }] });
  assert.deepEqual(due(one, '2026-11-20'), { kind: 'late', missed: '2026-11-18', next: '2026-11-25' });
  assert.deepEqual(due(one, '2026-11-23'), { kind: 'skip', missed: '2026-11-18', next: '2026-11-25' });
  assert.equal(due(one, '2026-11-25').kind, 'today');
  // a late dose keeps the weekday, with at least 3 days before the next
  const late = g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 0 }, { date: '2026-11-21', mg: 0.25, site: 1 }] });
  assert.deepEqual(due(late, '2026-11-22'), { kind: 'upcoming', date: '2026-11-25', days: 3 });
  assert.equal(due(g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 0 }] }), '2026-12-05').kind, 'restart');
  assert.equal(due(g({ on: false }), '2026-11-11').kind, 'off');
});

test('sites rotate', () => {
  assert.equal(nextSite(g()), 0);
  assert.equal(nextSite(g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 5 }] })), 0);
  assert.equal(nextSite(g({ shots: [{ date: '2026-11-11', mg: 0.25, site: 2 }] })), 3);
});

const weekly = (from: number, perWeek: number, weeks = 4) => {
  const w: Record<string, number> = {};
  for (let d = 0; d <= weeks * 7; d++) w[new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10)] = from - (perWeek / 7) * d;
  return w;
};
const four = (mg: number, nausea = 0) => Array.from({ length: 4 }, (_, i) => ({ date: `2026-10-${String(7 + i * 7).padStart(2, '0')}`, mg, site: i, nausea }));

test('the dose steps up only after 4 weeks, without strong nausea, when the loss is slow', () => {
  assert.deepEqual(titration(g({ mg: 0.25, shots: four(0.25).slice(0, 2) }), weekly(134, 0.3)), { kind: 'wait', weeks: 2 });
  assert.equal(titration(g({ mg: 0.25, shots: four(0.25, 2) }), weekly(134, 0.3)).kind, 'nausea');
  assert.equal(titration(g({ mg: 0.25, shots: four(0.25) }), {}).kind, 'data');
  const slow = titration(g({ mg: 0.5, shots: four(0.5) }), weekly(134, 0.3));
  assert.equal(slow.kind, 'up');
  assert.equal(slow.kind === 'up' && slow.to, 1);
  assert.equal(titration(g({ mg: 0.5, shots: four(0.5) }), weekly(134, 1)).kind, 'hold');
  assert.equal(titration(g({ mg: 1, shots: four(1) }), weekly(134, 2.5)).kind, 'fast');
  assert.equal(titration(g({ mg: 2.4, shots: four(2.4) }), weekly(134, 0.2)).kind, 'top');
  // a dose change resets the count
  assert.equal(weeksAtDose(g({ mg: 0.5, shots: four(0.25) })), 0);
});

test('units on a U-100 syringe for a 10 mg vial', () => {
  // 2 ml → 5 mg/ml: 0.25 mg = 0.05 ml = 5 units
  assert.equal(units(0.25, { mg: 10, ml: 2 }), 5);
  assert.equal(units(2.4, { mg: 10, ml: 2 }), 48);
  assert.equal(units(0.25, { mg: 10, ml: 3 }), 7.5);
  assert.equal(units(1.7, { mg: 10, ml: 3 }), 51);
  assert.equal(units(0.25, { mg: 10, ml: 1 }), 2.5);
  assert.equal(units(1, { mg: 0, ml: 2 }), 0);
  const v = g({ vial: { mg: 10, ml: 2, mixed: '2026-11-11' }, shots: [{ date: '2026-11-04', mg: 0.25, site: 0 }, { date: '2026-11-11', mg: 0.5, site: 1 }, { date: '2026-11-18', mg: 0.5, site: 2 }] });
  assert.equal(vialLeft(v), 9);
});
