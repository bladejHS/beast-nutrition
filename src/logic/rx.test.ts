import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rxNextSite, rxSince, rxValid, type Rx } from './rx.ts';
import { labDef } from './labs.ts';

const r: Rx = { id: 'a', name: 'X', amount: 1, unit: 'mg', how: 'cum e pe rețetă', doctor: '', start: '2026-11-01', on: true, log: [] };

test('a prescribed treatment needs its name, dose and frequency from the prescription', () => {
  assert.equal(rxValid({ name: '', amount: 1, how: 'x' }), 'Scrie numele tratamentului.');
  assert.equal(rxValid({ name: 'X', amount: 0, how: 'x' }), 'Scrie doza din prescripție.');
  assert.equal(rxValid({ name: 'X', amount: 1, how: ' ' }), 'Scrie cât de des, cum a scris medicul.');
  assert.equal(rxValid(r), null);
});

test('sites rotate and the days since the last one count', () => {
  assert.equal(rxNextSite(r), 0);
  const x = { ...r, log: [{ id: '1', date: '2026-11-18', time: '08:00', amount: 1, site: 5 }] };
  assert.equal(rxNextSite(x), 0);
  assert.equal(rxSince(x, '2026-11-21'), 3);
  assert.equal(rxSince(r, '2026-11-21'), null);
});

test('the hormone panel is in Analize', () => {
  for (const id of ['testofree', 'lh', 'fsh', 'e2', 'shbg', 'prl', 'hct']) assert.ok(labDef(id), id);
});

import { cjcCycle, dosesLast7, cjcNextSite } from './rx.ts';
test('CJC cycle weeks and pause', () => {
  assert.deepEqual(cjcCycle('2026-11-01', '2026-11-01'), { week: 1, phase: 'on', pauseLeft: 0 });
  assert.equal(cjcCycle('2026-11-01', '2026-12-30').phase, 'can-stop'); // day 59 → week 9
  const p = cjcCycle('2026-11-01', '2027-01-24'); // day 84 → week 13
  assert.equal(p.phase, 'pause'); assert.equal(p.pauseLeft, 28);
  assert.equal(cjcCycle('2026-11-01', '2027-02-21').week, 1); // day 112 → new cycle
});
test('CJC doses in 7 days and abdomen rotation', () => {
  const r = { id: 'a', name: 'x', amount: 100, unit: 'µg', how: 'x', doctor: '', start: '2026-11-01', on: true,
    log: [{ id: '1', date: '2026-11-10', time: '23:00', amount: 100, site: 0 }, { id: '2', date: '2026-11-14', time: '23:00', amount: 100, site: 1 }] } as const;
  assert.equal(dosesLast7(r as never, '2026-11-16'), 2);
  assert.equal(dosesLast7(r as never, '2026-11-17'), 1);
  assert.equal(cjcNextSite(r as never), 0);
});

import { cycleGrid, cjcAdherence, recentFx, avgSleep, cjcRaise, fastHours, cycleStart } from './rx.ts';
const mk = (dates: Array<[string, number]>, checks = {}) => ({ id: 'c', name: 'x', amount: dates.at(-1)?.[1] ?? 100, unit: 'µg', how: 'x', doctor: '', start: '2026-11-01', on: true,
  log: dates.map(([date, amount], i) => ({ id: String(i), date, time: '23:00', amount, site: i % 2 })), checks }) as never as Rx;
test('CJC tracking: grid, adherence, check-ins, step-up, fasting', () => {
  const r = mk([['2026-11-01', 100], ['2026-11-02', 100], ['2026-11-04', 100]]);
  const g = cycleGrid(r, '2026-11-05');
  assert.equal(g.length, 8);
  assert.deepEqual(g[0]!.slice(0, 5).map((c) => c.state), ['done', 'done', 'miss', 'done', 'today']);
  assert.equal(g[0]![5]!.state, 'future');
  assert.deepEqual(cjcAdherence(r, '2026-11-05'), { done: 3, target: 3, pct: 100 });
  assert.equal(cycleStart('2026-11-01', '2027-02-25'), '2027-02-21');
  const c = mk([['2026-11-01', 100]], { '2026-11-02': { sleep: 4, fx: [0] }, '2026-11-03': { sleep: 2, fx: [0, 3] } });
  assert.equal(recentFx(c, '2026-11-03').get(0), 2);
  assert.equal(avgSleep(c, '2026-11-03'), 3);
  assert.equal(cjcRaise(mk([['2026-11-01', 100]]), '2026-11-10').ok, false);
  const ok = cjcRaise(mk([['2026-11-01', 100], ['2026-11-15', 100]]), '2026-11-15');
  assert.equal(ok.ok, true); assert.equal(ok.next, 150);
  assert.equal(cjcRaise(c, '2026-11-15').ok, true); // the effects are older than 7 days by then
  assert.equal(cjcRaise(c, '2026-11-05').ok, false);
  assert.equal(cjcRaise(mk([['2026-11-01', 300]]), '2026-12-01').ok, false);
  assert.equal(fastHours('20:30', '23:00'), 2.5);
  assert.equal(fastHours('23:30', '00:30'), 1);
});

import { cjcDay, cjcTonight, cjcNextIn } from './rx.ts';
test('CJC rules applied automatically: 5/2, cycle pause, step-up, step-back', () => {
  const five = mk([['2026-11-01', 100], ['2026-11-02', 100], ['2026-11-03', 100], ['2026-11-04', 100], ['2026-11-05', 100]]);
  assert.equal(cjcDay(five, '2026-11-06'), 'rest');
  assert.equal(cjcDay(five, '2026-11-07'), 'rest');
  assert.equal(cjcDay(five, '2026-11-08'), 'on');
  assert.equal(cjcTonight(five, '2026-11-06').state, 'rest');
  assert.equal(cjcNextIn(five, '2026-11-06'), 2);
  assert.equal(cjcNextIn(five, '2026-11-05'), 3);
  assert.equal(cjcDay(five, '2027-01-25'), 'pause');
  assert.equal(cjcTonight(five, '2026-11-05').state, 'done');
  // 14 days at 100, no effects → tonight 150
  const two = mk([['2026-11-01', 100], ['2026-11-10', 100]]);
  assert.equal(cjcTonight(two, '2026-11-15').amount, 150);
  // at 200 the automatic step-up stops
  assert.equal(cjcTonight(mk([['2026-11-01', 200]]), '2026-11-20').amount, 200);
  // effects after an increase → back 50, capped
  const fx = mk([['2026-11-01', 100], ['2026-11-15', 150]], { '2026-11-17': { fx: [1] } });
  const t = cjcTonight(fx, '2026-11-17');
  assert.equal(t.amount, 100); assert.equal(t.cap, 100);
  assert.equal(cjcTonight({ ...fx, amount: 100, cap: 100, checks: {} } as Rx, '2026-12-10').amount, 100);
});
