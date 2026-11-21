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
