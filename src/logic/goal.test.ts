import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chance, goalView, lossRate, phi, segments } from './goal.ts';
import { homa, labStatus } from './labs.ts';

const line = (from: number, perWeek: number, days: number, end = '2026-11-14') => {
  const out = [];
  const t0 = Date.parse(`${end}T12:00:00Z`) - days * 864e5;
  for (let i = 0; i <= days; i++) out.push({ date: new Date(t0 + i * 864e5).toISOString().slice(0, 10), kg: 0, trend: from - (perWeek / 7) * i });
  return out;
};

test('loss rate from the trend', () => {
  assert.equal(Math.round(lossRate(line(134, 1, 35))! * 100) / 100, 1);
  assert.equal(lossRate(line(134, 1, 5)), null);
});

test('far from the goal gives a date', () => {
  const v = goalView({ kg: 105, by: '', from: 134 }, line(134, 1, 35), 'cut', '2026-11-14');
  assert.equal(v.state, 'far');
  assert.ok(v.eta && v.eta > '2027-01-01');
});

test('reached the goal points to reverse', () => {
  const v = goalView({ kg: 130, by: '', from: 134 }, line(134, 1, 35), 'cut', '2026-11-14');
  assert.equal(v.state, 'reached');
  assert.equal(v.to, 'reverse');
});

test('three weeks before the selection the deficit stops', () => {
  assert.equal(goalView({ kg: 105, by: '2026-12-01', from: 134 }, line(134, 1, 35), 'cut', '2026-11-14').state, 'stop');
});

test('a selection before the goal is reached is flagged', () => {
  assert.equal(goalView({ kg: 105, by: '2027-03-01', from: 134 }, line(134, 1, 35), 'cut', '2026-11-14').state, 'late');
});

test('after the diet the band holds', () => {
  assert.equal(goalView({ kg: 105, by: '', from: 134, hold: 105 }, line(105, 0, 30), 'maintain', '2026-11-14').state, 'band');
  assert.equal(goalView({ kg: 105, by: '', from: 134, hold: 105 }, line(107, 0, 30), 'maintain', '2026-11-14').state, 'above');
});

test('lab ranges, the laboratory first', () => {
  assert.equal(labStatus({ id: '1', marker: 'ferritin', date: '2026-11-01', value: 20 }), 'low');
  assert.equal(labStatus({ id: '1', marker: 'ferritin', date: '2026-11-01', value: 20, lo: 15 }), 'ok');
  assert.equal(labStatus({ id: '1', marker: 'hba1c', date: '2026-11-01', value: 6 }), 'high');
  assert.equal(homa([{ id: 'a', marker: 'glucose', date: '2026-11-01', value: 90 }, { id: 'b', marker: 'insulin', date: '2026-11-01', value: 15 }])!.value, 3.3);
});


test('segments of about 5 kg, the current one part done', () => {
  const s = segments({ kg: 105, by: '', from: 134.9 }, 129.2);
  assert.equal(s.length, 6);
  assert.equal(s[0]!.done, 1);
  assert.ok(s[1]!.done > 0 && s[1]!.done < 1);
  assert.equal(s[5]!.done, 0);
});

test('the normal curve', () => {
  assert.equal(Math.round(phi(0) * 100), 50);
  assert.equal(Math.round(phi(1.96) * 1000), 975);
});

test('the chance: on pace is likely, too far is unlikely, no date is no number', () => {
  const pts = line(134, 1, 42);
  assert.ok(chance({ kg: 120, by: '2027-06-01', from: 134 }, pts, 0.7, '2026-11-14').pct! > 80);
  assert.ok(chance({ kg: 90, by: '2027-01-15', from: 134 }, pts, 0.7, '2026-11-14').pct! < 10);
  assert.equal(chance({ kg: 105, by: '', from: 134 }, pts, 0.7, '2026-11-14').pct, null);
});

// 2026-11-28: the pace the date asks for, and the road of weights to it
import { goalPace, milestones, MIN_RATE } from './goal.ts';

test('goalPace: the date sets the rate, capped by body fat', () => {
  // 134 → 110 kg, selection 2027-11-28, deficit stops 3 weeks before
  const p = goalPace({ kg: 110, by: '2027-11-28', from: 134 }, 134, '2026-11-28', 1.2)!;
  assert.equal(p.deadline, '2027-11-07');
  assert.ok(p.needPct > 0.35 && p.needPct < 0.45, String(p.needPct));
  assert.equal(p.capped, false);
  assert.ok(Math.abs(134 * (1 - p.needPct / 100) ** p.weeks - 110) < 0.01);
  // too close a date: capped at the limit, landing above the goal
  const q = goalPace({ kg: 110, by: '2027-03-01', from: 134 }, 134, '2026-11-28', 1.2)!;
  assert.equal(q.capped, true);
  assert.equal(q.pct, 1.2);
  assert.ok(q.at > 110);
  // a far date never aims under the minimum
  assert.equal(goalPace({ kg: 130, by: '2029-01-01', from: 134 }, 134, '2026-11-28', 1.2)!.pct, MIN_RATE);
  assert.equal(goalPace({ kg: 110, by: '', from: 134 }, 134, '2026-11-28', 1.2), null);
});

test('milestones: one weight per step, the current one marked, the passed ones with the trend', () => {
  const g = { kg: 120, by: '2027-03-21', from: 134, line: { date: '2026-11-01', kg: 134 } };
  const points = [{ date: '2026-11-01', kg: 134, trend: 134 }, { date: '2026-11-20', kg: 132, trend: 132.4 }];
  const m = milestones(g, points, '2026-11-28');
  assert.equal(m.at(-1)!.kind, 'by');
  assert.equal(m.at(-2)!.date, '2027-02-28');
  assert.ok(Math.abs(m.at(-2)!.kg - 120) < 0.01);
  const now = m.find((x) => x.kind === 'now')!;
  assert.ok(now.date >= '2026-11-28');
  const past = m.filter((x) => x.kind === 'past');
  assert.ok(past.length >= 1 && past.every((x) => x.got != null));
  for (let i = 1; i < m.length - 1; i++) assert.ok(m[i]!.kg < m[i - 1]!.kg);
});
