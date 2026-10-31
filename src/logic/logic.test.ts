import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bfClass, bmrMuller, buildPlan, cutSetup, deficitFactor, dietBlocked, macrosFor, proteinG, shiftCarbsFat, targetFor, isBreakWeek, type Plan, type Profile } from './calc.ts';
import { addDays, finishedWeeks, maintenanceFromData, mondayOf, review, type Week } from './review.ts';
import { fold, parseDb, search } from './foods.ts';
import { entryFrom, parseBackup, totals } from './store.ts';

const man: Profile = { sex: 'm', age: 30, heightCm: 180, weightKg: 100, bf: 20, activity: 1.55, lifts: true };
const woman: Profile = { sex: 'f', age: 45, heightCm: 165, weightKg: 90, bf: 36, activity: 1.375, lifts: true };

test('book example: Müller equation for the 85 kg man', () => {
  const p: Profile = { ...man, weightKg: 100, bf: 15, age: 25 };
  assert.equal(bmrMuller(p), 2087);
});

test('book example: 100 kg man at 0.6% a week needs 558 kcal of deficit', () => {
  assert.equal(deficitFactor(man), 930);
  const s = cutSetup(man, 2800, 0.6);
  assert.equal(s.deficit, 558);
  assert.equal(s.kcal, 2242);
});

test('book example: 90 kg woman at 1% a week needs 922 kcal of deficit', () => {
  assert.equal(bfClass('f', 36), 'over');
  assert.equal(cutSetup(woman, 2350, 1).deficit, 922);
});

test('book example: 2242 kcal with 190 g protein at 60/40 gives 220 c and 65 f', () => {
  const m = macrosFor(2242, 190, 0.6);
  assert.deepEqual([m.c, m.f], [220, 65]);
});

test('protein follows lean mass, age and the deficit', () => {
  assert.equal(proteinG(man, true), 185);
  assert.ok(proteinG(man, false) < proteinG(man, true));
  assert.equal(proteinG(woman, true), 170);
});

test('the safety floor stops an extreme target', () => {
  const s = cutSetup({ ...woman, weightKg: 60 }, 1300, 1);
  assert.equal(s.kcal, 1200);
  assert.ok(s.floored);
});

test('no diet under 75% of predicted maintenance or 25 kcal/kg lean mass', () => {
  assert.ok(dietBlocked(man, 1500));
  assert.equal(dietBlocked(man, 2800), null);
});

const plan = (o: Partial<Parameters<typeof buildPlan>[1]> = {}): Plan => buildPlan(man, {
  phase: 'cut', startDate: '2026-11-02', ratePct: 0.6, carbShare: 0.6, maintenance: 2800,
  highDays: [], breaks: null, pace: 'c', ...o,
});

test('high days keep the weekly calories: book example 2800 and 2019', () => {
  const p = plan({ highDays: [5, 6] });
  const high = targetFor(p, '2026-11-07'), low = targetFor(p, '2026-11-02');
  assert.equal(high.kcal, 2800);
  assert.equal(low.kcal, 2019);
  assert.equal(high.kind, 'high');
});

test('break weeks run at maintenance on schedule', () => {
  const p = plan({ breaks: { on: 2, off: 1 } });
  assert.ok(!isBreakWeek(p, '2026-11-09'));
  assert.ok(isBreakWeek(p, '2026-11-16'));
  assert.equal(targetFor(p, '2026-11-16').kcal, 2800);
  assert.ok(!isBreakWeek(p, '2026-11-23'));
});

test('fiber is 10 to 15 g per 1000 kcal', () => {
  const t = targetFor(plan(), '2026-11-02');
  assert.equal(t.fiberMin, 22);
  assert.equal(t.fiberMax, 34);
});

test('adjustments touch carbs and fat only', () => {
  const m = shiftCarbsFat({ kcal: 1420, p: 175, c: 100, f: 35 }, -5);
  assert.equal(m.p, 175);
  assert.equal(m.c, 95);
  assert.equal(m.f, 33);
});

const weeks = (...avgs: number[]): Week[] => avgs.map((avg, i) => ({ start: addDays('2026-11-02', i * 7), avg, n: 7 }));

test('weekly averages need finished weeks with 3 weigh-ins', () => {
  const w = finishedWeeks({ '2026-11-02': 100, '2026-11-03': 101, '2026-11-04': 102, '2026-11-09': 99, '2026-11-16': 90 }, '2026-11-17');
  assert.equal(w.length, 1);
  assert.equal(w[0]!.avg, 101);
  assert.equal(mondayOf('2026-11-08'), '2026-11-02');
});

test('one slow week is not a plateau, two are, and protein is untouched', () => {
  assert.equal(review(plan(), weeks(100, 99.9), {}).level, 'watch');
  const r = review(plan(), weeks(100, 99.9, 99.8), {});
  assert.equal(r.title, 'Platou real');
  assert.equal(r.pct, -5);
});

test('low adherence comes before cutting calories', () => {
  const w = weeks(100, 99.9, 99.8);
  const r = review(plan(), w, { [w[1]!.start]: { adherence: 5 }, [w[2]!.start]: { adherence: 6 } });
  assert.equal(r.title, 'Întâi aderența');
  assert.equal(r.pct, undefined);
});

test('a failed 15% step points to a reverse diet', () => {
  const p = plan();
  p.adjustments = [{ date: '2026-11-02', pct: -15, note: '', from: 0, to: 0 }];
  assert.ok(review(p, weeks(100, 99.9, 99.8), {}).suggestReverse);
});

test('on pace there is nothing to change; over 1% slows down', () => {
  assert.equal(review(plan(), weeks(100, 99.5), {}).level, 'good');
  assert.equal(review(plan(), weeks(100, 98.5), {}).pct, 5);
});

test('reverse adds calories inside the range and holds above it', () => {
  const p = plan({ phase: 'reverse' });
  assert.equal(review(p, weeks(80, 80.05), {}).pct, 3.5);
  assert.equal(review(p, weeks(80, 80.4), {}).pct, undefined);
});

test('maintenance from data', () => {
  assert.equal(maintenanceFromData(1770, 0.54, 930), 2272);
});

const db = parseDb({
  cats: ['Băuturi', 'Lactate'], ro: [[1, 'Lapte 2%']],
  foods: [[1, 'Milk, reduced fat', 1, 50, 3, 5, 2, 0, 5, 1, 40, []], [2, 'Milk, chocolate', 1, 80, 3, 10, 2, 1, 9, 1, 60, []], [3, 'Coffee, brewed', 0, 1, 0, 0, 0, 0, 0, 0, 2, []]],
});

test('Romanian search reaches USDA names and ranks Romanian names first', () => {
  assert.equal(fold('Brânză'), 'branza');
  assert.deepEqual(search(db, 'lapte').map((f) => f.id), ['u1', 'u2']);
  assert.deepEqual(search(db, 'cafea').map((f) => f.id), ['u3']);
  assert.equal(search(db, 'nimic').length, 0);
});

test('entries are scaled from 100 g and summed', () => {
  const e = entryFrom({ name: 'x', kcal: 155, p: 13, c: 1, f: 11, fiber: 0 }, 200);
  assert.equal(e.kcal, 310);
  assert.equal(totals([[e, e]]).p, 52);
});

test('a backup from another app is refused', () => {
  assert.throws(() => parseBackup('{"a":1}'));
});
