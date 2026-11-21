import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshGlp1, LADDER, type Glp1 } from './glp1.ts';
import { adjustedKg, BASELINE_LABS, idealKg, labsCovered, phaseOf, phaseStates, proteinFloor, rateBandKg } from './glp1plan.ts';

const shots = (mg: number, n: number): Glp1['shots'] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, mg, site: i % 6, nausea: 0 }));
const top = LADDER[LADDER.length - 1]!;

test('the reference weight for protein sits between ideal and actual', () => {
  assert.equal(Math.round(idealKg(200, 'm')), 93); // 50 + 2.3 * (47.6 / 2.54)
  const adj = adjustedKg(200, 134, 'm');
  assert.ok(adj > idealKg(200, 'm') && adj < 134);
  assert.equal(Math.round(adj), 109);
  // someone at or under their ideal weight keeps their own
  assert.equal(adjustedKg(200, 80, 'm'), 80);
});

test('the protein floor for the user lands in the researched band', () => {
  const p = proteinFloor(adjustedKg(200, 134, 'm'));
  assert.ok(p >= 180 && p <= 220, `${p} g outside 180-220`);
});

test('the pace band is 0.5 to 0.75 % of body weight, in kg', () => {
  const [lo, hi] = rateBandKg(134);
  assert.ok(Math.abs(lo - 0.67) < 0.01);
  assert.ok(Math.abs(hi - 1.005) < 0.01);
});

test('the baseline panel counts only its own markers', () => {
  assert.equal(labsCovered([]), 0);
  assert.equal(labsCovered([{ marker: 'hba1c' }, { marker: 'lipase' }, { marker: 'testo' }]), 2);
  assert.equal(labsCovered(BASELINE_LABS.map((marker) => ({ marker }))), BASELINE_LABS.length);
});

test('the phase follows the treatment, not the calendar', () => {
  assert.equal(phaseOf(freshGlp1(), false), 'before');
  // still climbing the label's ladder
  assert.equal(phaseOf({ ...freshGlp1(), on: true, mg: 1, shots: shots(1, 6) }, false), 'titrate');
  // on the top dose, but not yet four tolerated weeks
  assert.equal(phaseOf({ ...freshGlp1(), on: true, mg: top, shots: shots(top, 3) }, false), 'titrate');
  assert.equal(phaseOf({ ...freshGlp1(), on: true, mg: top, shots: shots(top, 4) }, false), 'cut');
  // the goal weight wins over the dose
  assert.equal(phaseOf({ ...freshGlp1(), on: true, mg: 1, shots: shots(1, 8) }, true), 'hold');
  // switched off after real doses: the way out, not the start
  assert.equal(phaseOf({ ...freshGlp1(), on: false, mg: top, shots: shots(top, 20) }, false), 'exit');
});

test('phases mark what is passed, current and ahead', () => {
  const st = phaseStates('cut');
  assert.deepEqual(st, { before: 'done', titrate: 'done', cut: 'now', hold: 'next', exit: 'next' });
  assert.equal(phaseStates('before').before, 'now');
  assert.equal(Object.values(phaseStates('before')).filter((x) => x === 'done').length, 0);
});
