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
