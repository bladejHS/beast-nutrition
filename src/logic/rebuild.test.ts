import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, type Profile } from './calc.ts';
import { DEFAULT_FACTORS, mealCarbShares, reconcile } from './carbs.ts';
import { cycleWeek, freeze, rateDay, type CycleIn } from './cycle.ts';
import { byClass, insights, MIN_RATINGS, plannedVsActual, type DayRow, type Feedback, type Rated } from './insights.ts';
import { macros, regenerate, snackOptions, generateDay, type Prefs } from './mealplan.ts';
import { parseBackup } from './store.ts';
import { intraAdvice, timing, type TimingIn } from './timing.ts';
import { classify, DEFAULT_RULES, DEFAULT_WEIGHTS, FALLBACK_WEEK, readTraining, sessionStatus, weightKey, type Session, type Training } from './training.ts';

const man: Profile = { sex: 'm', age: 30, heightCm: 180, weightKg: 100, bf: 20, activity: 1.55, lifts: true };
const plan = buildPlan(man, { phase: 'cut', startDate: '2026-11-02', ratePct: 0.6, carbShare: 0.7, maintenance: 2800, highDays: [], breaks: null, pace: 'c' });
const week: Training = { linked: true, week: FALLBACK_WEEK, log: {}, sleep: {} };
const MONDAY = '2026-11-02', THURSDAY = '2026-11-05';
const input = (o: Partial<CycleIn> = {}): CycleIn => ({ plan, sex: 'm', cycling: true, factors: DEFAULT_FACTORS, rules: DEFAULT_RULES, overrides: {}, snap: {}, today: MONDAY, training: week, ...o });

test('every session type of the plan has a transparent weight', () => {
  for (const s of FALLBACK_WEEK.flat()) if (!['wimhof', 'breath', 'shower'].includes(s.kind)) assert.ok(weightKey(s), s.name);
  assert.equal(weightKey({ kind: 'rounds', focus: 'slow' }), 'boxEasy');
  assert.equal(weightKey({ kind: 'rounds', focus: 'distance' }), 'boxEasy');
  assert.equal(weightKey({ kind: 'rounds', focus: 'power' }), 'boxHard');
  assert.equal(weightKey({ kind: 'wimhof' }), null);
});

test('the score explains itself part by part', () => {
  const r = classify(FALLBACK_WEEK[3]!);
  assert.equal(r.parts.length, 3);
  assert.equal(Math.round(r.parts.reduce((a, p) => a + p.load, 0)), r.load);
  assert.deepEqual([r.parts[2]!.min, r.parts[2]!.intensity], [39, 1]);
});

test('weights, thresholds and the box-and-strength rule are the user\'s to change', () => {
  const monday = FALLBACK_WEEK[0]!;
  assert.equal(classify(monday).demand, 'high');
  assert.equal(classify(monday, { boxStrength: false, limits: { high: 80, moderate: 25 } }).demand, 'moderate');
  assert.equal(classify(FALLBACK_WEEK[1]!, { limits: { high: 40, moderate: 25 } }).demand, 'high');
  assert.equal(classify(FALLBACK_WEEK[1]!, { weights: { ...DEFAULT_WEIGHTS, workout: 0.1 } }).demand, 'low');
});

test('a hard rating weighs more, an easy one less, and only on sessions done', () => {
  const base = { name: 'Bag', kind: 'rounds', focus: 'power', min: 30 };
  assert.equal(classify([base]).load, 30);
  assert.equal(classify([{ ...base, rpe: 9 }]).load, 36);
  assert.equal(classify([{ ...base, rpe: 3 }]).load, 26);
});

test('session status keeps planned and actual apart', () => {
  const s = FALLBACK_WEEK[3]![2]!;
  const log = (min: number, kind = 'rounds') => [{ block: s.id, name: s.name, kind, min }];
  assert.equal(sessionStatus(s, [], '2026-11-05', '2026-11-05'), 'planned');
  assert.equal(sessionStatus(s, [], '2026-11-05', '2026-11-06'), 'skipped');
  assert.equal(sessionStatus(s, log(39), '2026-11-05', '2026-11-06'), 'done');
  assert.equal(sessionStatus(s, log(15), '2026-11-05', '2026-11-06'), 'partial');
  assert.equal(sessionStatus(s, log(20, 'row'), '2026-11-05', '2026-11-06'), 'changed');
  assert.equal(sessionStatus(s, [], '2026-11-06', '2026-11-05', [s.id]), 'cancelled');
});

test('a cancelled session stops counting and never reads as done', () => {
  const free = cycleWeek(input(), MONDAY).days[3]!;
  const x = input({ cancelled: { [THURSDAY]: ['thu-bag'] } });
  const p = rateDay(x, THURSDAY, 3);
  assert.equal(p.rating.demand, 'moderate');
  assert.equal(p.done.length, 0);
  assert.ok(p.rating.parts.every((q) => q.id !== 'thu-bag'));
  assert.ok(cycleWeek(x, MONDAY).days[3]!.c < free.c);
  assert.equal(reconcile(plan, cycleWeek(x, MONDAY).days).carbsFuel, reconcile(plan, cycleWeek(x, MONDAY).days).carbsPlan);
});

test('a block ticked by hand counts with the planned minutes, and a skipped day as nothing done', () => {
  const t: Training = { ...week, log: { [MONDAY]: [{ block: 'mon-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 0 }] } };
  const p = rateDay(input({ training: t, today: '2026-11-03' }), MONDAY, 0);
  assert.equal(p.basis, 'actual');
  assert.equal(p.rating.load, 19);
});

test('finishing a workout changes neither calories nor the finished day', () => {
  const planned = input();
  const snaps = freeze(planned).snaps;
  const t: Training = { ...week, log: { [MONDAY]: FALLBACK_WEEK[0]!.map((s) => ({ block: s.id, name: s.name, kind: s.kind, min: s.min * 2 })) } };
  const next = cycleWeek(input({ today: '2026-11-03', snap: snaps, training: t }), MONDAY).days;
  assert.equal(next[0]!.c, snaps[MONDAY]!.c);
  assert.equal(next[0]!.kcal, snaps[MONDAY]!.kcal);
  assert.equal(snaps[MONDAY]!.planned, 'high');
  const r = reconcile(plan, next);
  assert.equal(r.kcalFuel, r.kcalPlan);
});

test('manual mode uses only the classes set by hand', () => {
  const x = input({ manual: true, overrides: { [THURSDAY]: 'rest' } });
  const days = cycleWeek(x, MONDAY).days;
  assert.equal(days[0]!.demand, 'moderate');
  assert.equal(days[3]!.demand, 'rest');
  assert.match(rateDay(x, MONDAY, 0).rating.reason, /Mod manual/);
  assert.equal(reconcile(plan, days).carbsFuel, reconcile(plan, days).carbsPlan);
});

test('the log gives real volume when Inner Beast saved it', () => {
  const data: Record<string, string> = { 'beast:v1': JSON.stringify({ sleep: { '2026-11-02': 7.5 }, log: [
    { date: '2026-11-02', block: 'mon-bag', name: 'Bag', kind: 'rounds', dur: 900, data: { rounds: 3, planned: 5 } },
    { date: '2026-11-05', block: 'thu-bag', name: 'Machine Row', kind: 'row', dur: 1320, data: { meters: 3200, target: 5000 } },
  ] }) };
  const t = readTraining({ getItem: (k) => data[k] ?? null });
  assert.equal(t.log['2026-11-02']![0]!.detail, '3 din 5 runde');
  assert.equal(t.log['2026-11-05']![0]!.detail, '3.200 din 5.000 m');
  assert.equal(t.sleep['2026-11-02'], 7.5);
});

const session = (min: number, focus = 'power'): Session => ({ id: 'a', name: 'Bag', kind: 'rounds', focus, min });

test('carbs during training are only suggested when the session justifies them', () => {
  assert.equal(intraAdvice([session(40)], 'normal').level, 'none');
  assert.equal(intraAdvice([session(60)], 'normal').level, 'small');
  assert.equal(intraAdvice([session(60)], 'normal').total, 0);
  assert.equal(intraAdvice([session(80)], 'normal').level, 'optional');
  const long = intraAdvice([session(120)], 'normal');
  assert.deepEqual([long.level, long.gLow, long.gHigh, long.total], ['advised', 30, 60, 120]);
  assert.equal(intraAdvice([session(120)], 'low').gHigh, 30);
  assert.equal(intraAdvice([session(120, 'slow')], 'normal').level, 'none', 'easy minutes do not count');
  assert.equal(intraAdvice([{ id: 'w', name: 'Walk', kind: 'walk', min: 120 }], 'normal').level, 'none');
});

const shares = mealCarbShares(4, 2, 'high');
const base: TimingIn = { start: '17:00', sessions: FALLBACK_WEEK[0]!, demand: 'high', day: { p: 180, c: 300, f: 48 }, times: ['08:00', '11:30', '15:00', '18:30'], shares, trainingMeal: 2, tolerance: 'normal', gap: 0, tomorrow: 'moderate', sweatRate: null };

test('timing splits the day\'s own macros and never adds to them', () => {
  const t = timing(base);
  assert.deepEqual([t.pre!.mealTime, t.pre!.gapMin, t.pre!.idealGap], ['15:00', 120, 120]);
  assert.equal(t.pre!.p, 45);
  assert.equal(t.pre!.c, Math.round(300 * shares[2]!));
  assert.equal(t.post!.c, Math.round(300 * shares[3]!));
  assert.equal(t.end, '17:54');
  assert.equal(t.post!.afterMin, 36);
  const all = base.times.map((_, i) => Math.round(300 * shares[i]!)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(all - 300) <= 2);
});

test('the pre-workout advice follows tolerance, the meal gap and personal settings', () => {
  assert.equal(timing({ ...base, tolerance: 'low' }).pre!.idealGap, 180);
  assert.match(timing({ ...base, tolerance: 'low' }).pre!.note, /mai mică/);
  assert.equal(timing({ ...base, gap: 60 }).pre!.idealGap, 60);
  const close = timing({ ...base, start: '15:30' }).pre!;
  assert.ok(close.tooClose);
  const far = timing({ ...base, start: '20:00', times: ['08:00', '11:30', '14:00', '21:30'], trainingMeal: 2 }).pre!;
  assert.equal(far.snackTime, '19:15');
  assert.ok(far.snackC > 0 && far.snackC <= 30);
});

test('training before the first meal has no pre-workout meal and the first meal recovers', () => {
  const t = timing({ ...base, start: '07:00', trainingMeal: -1, shares: mealCarbShares(4, -1, 'high') });
  assert.equal(t.pre, null);
  assert.equal(t.post!.mealTime, '08:00');
  assert.ok(Math.abs(mealCarbShares(4, -1, 'high').reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('recovery looks at tomorrow and at the user\'s real sweat rate', () => {
  assert.equal(timing(base).post!.urgent, false);
  assert.equal(timing({ ...base, tomorrow: 'high' }).post!.urgent, true);
  assert.equal(timing(base).post!.litres, null);
  assert.equal(timing({ ...base, sweatRate: 1 }).post!.litres, 0.9);
  assert.equal(timing({ ...base, trainingMeal: null }).pre, null);
});

const mk = (id: string, name: string, kcal: number, p: number, c: number, f: number) => ({ id, name, en: `en ${name}`, cat: '', kcal, p, c, f, fiber: 0, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda' as const });
const pantry = [mk('b', 'Banană', 89, 1.1, 22.8, 0.3), mk('m', 'Miere', 304, 0.3, 82.4, 0), mk('i', 'Iaurt grecesc degresat', 59, 10, 3.6, 0.4), mk('p', 'Pâine albă', 266, 8.9, 49, 3.3)];
const prefs: Prefs = { meals: 4, exclude: '', allergies: '', maxCook: 60, budget: 0 };

test('light snacks come from real food values and respect allergies', () => {
  const db = new Map(pantry.map((f) => [f.id, f]));
  const list = snackOptions(30, pantry, prefs, '16:15', 'Gustare');
  assert.equal(list.length, 3);
  assert.ok(list.every((m) => m.snack && m.time === '16:15'));
  const banana = macros(list[0]!.items, db);
  assert.ok(Math.abs(banana.c - 30) <= 2, String(banana.c));
  assert.ok(snackOptions(30, pantry, { ...prefs, allergies: 'iaurt' }, '', '').every((m) => m.items.every((i) => i.foodId !== 'i')));
  assert.equal(snackOptions(30, [], prefs, '', '').length, 0);
});

test('a planned snack stays, counts against the day, and takes no meal slot', () => {
  const full = [mk('a', 'Whey (proteină din zer)', 352, 78, 6, 1.6), mk('o', 'Ovăz fulgi, crud', 379, 13, 68, 6.5), mk('e', 'Piept de pui, gătit', 165, 31, 0, 3.6), mk('f', 'Orez alb fiert', 130, 2.7, 28, 0.3), mk('g', 'Ulei de măsline', 884, 0, 0, 100), mk('h', 'Broccoli fiert', 35, 2.4, 7, 0.4), mk('j', 'Piept de curcan, gătit', 147, 30, 0, 2), mk('k', 'Cartofi fierți', 86, 1.7, 20, 0.1), mk('l', 'Somon gătit', 206, 22, 0, 12.4), ...pantry];
  const db = new Map(full.map((f) => [f.id, f]));
  const day = { p: 180, c: 240, f: 50 };
  const times = ['08:00', '12:00', '16:00', '20:00'];
  const even = [0.25, 0.25, 0.25, 0.25];
  const snack = snackOptions(40, full, prefs, '15:00', 'Gustare')[0]!;
  const out = regenerate([...generateDay(day, even, times, [], full, prefs, 1), snack], day, even, times, [], full, prefs, 2);
  assert.equal(out.filter((m) => !m.snack).length, 4);
  assert.equal(out.filter((m) => m.snack).length, 1);
  const sum = macros(out.flatMap((m) => m.items), db);
  assert.ok(Math.abs(sum.c - 240) <= 240 * 0.1, String(sum.c));
});

test('a meal the user chose stays when the rest of the day is rebuilt', () => {
  const full = [mk('a', 'Whey (proteină din zer)', 352, 78, 6, 1.6), mk('o', 'Ovăz fulgi, crud', 379, 13, 68, 6.5), mk('e', 'Piept de pui, gătit', 165, 31, 0, 3.6), mk('f', 'Orez alb fiert', 130, 2.7, 28, 0.3), mk('g', 'Ulei de măsline', 884, 0, 0, 100), mk('h', 'Broccoli fiert', 35, 2.4, 7, 0.4), mk('j', 'Piept de curcan, gătit', 147, 30, 0, 2), mk('k', 'Cartofi fierți', 86, 1.7, 20, 0.1), mk('l', 'Somon gătit', 206, 22, 0, 12.4)];
  const day = { p: 180, c: 240, f: 50 };
  const times = ['08:00', '12:00', '16:00', '20:00'];
  const even = [0.25, 0.25, 0.25, 0.25];
  const list = generateDay(day, even, times, [], full, prefs, 1);
  list[2] = { ...list[2]!, keep: true };
  const chosen = JSON.stringify(list[2]);
  const out = regenerate(list, day, even, times, [], full, prefs, 9);
  assert.equal(out.length, 4);
  assert.equal(JSON.stringify(out.find((m) => m.keep)), chosen);
});

const fb = (o: Feedback): Feedback => o;
const rate = (demand: Rated['demand'], o: Feedback, n: number, from = 1): Rated[] => Array.from({ length: n }, (_, i) => ({ date: `2026-11-${String(i + from).padStart(2, '0')}`, demand, fb: fb(o) }));

test('one bad rating changes nothing: patterns need several', () => {
  assert.deepEqual(insights(rate('high', { energy: 1 }, 1), DEFAULT_FACTORS), []);
  assert.deepEqual(insights(rate('high', { energy: 1 }, MIN_RATINGS - 1), DEFAULT_FACTORS), []);
});

test('repeated low energy suggests a review, states no cause, and acts only if accepted', () => {
  const [x] = insights(rate('high', { energy: 2 }, 4), DEFAULT_FACTORS);
  assert.equal(x!.level, 'watch');
  assert.deepEqual(x!.action, { kind: 'factor', demand: 'high', delta: 0.05 });
  assert.match(x!.body, /Poate ține/);
  assert.equal(DEFAULT_FACTORS.high, 1.25, 'nothing was changed by reading the pattern');
});

test('steady good sessions are recognised, without any change proposed', () => {
  const [x] = insights(rate('high', { energy: 4, performance: 5 }, 4), DEFAULT_FACTORS);
  assert.equal(x!.level, 'good');
  assert.equal(x!.action, undefined);
});

test('hunger on easy days and digestion have their own patterns', () => {
  assert.equal(insights(rate('rest', { hunger: 1 }, 4), DEFAULT_FACTORS)[0]!.id, 'rest-hunger');
  const gut = insights(rate('moderate', { digestion: 2 }, 4), DEFAULT_FACTORS)[0]!;
  assert.deepEqual(gut.action, { kind: 'tolerance' });
});

const row = (o: Partial<DayRow>): DayRow => ({ date: '', demand: 'high', planned: 'high', targetC: 300, eatenC: 300, targetKcal: 2400, eatenKcal: 2400, sessionsDone: 3, sessionsPlanned: 3, ...o });

test('stats by class use only days with food logged', () => {
  const c = byClass([row({}), row({ eatenC: 200 }), row({ eatenKcal: 0, eatenC: 0 })]).find((x) => x.demand === 'high')!;
  assert.deepEqual([c.days, c.eatenC, c.fit], [2, 250, 50]);
});

test('planned against actual counts training days', () => {
  assert.deepEqual(plannedVsActual([row({}), row({ demand: 'rest', sessionsDone: 0 }), row({ sessionsPlanned: 0, sessionsDone: 0, demand: 'rest', planned: 'rest' })]), { days: 2, sameClass: 1, sessionsDone: 3, sessionsPlanned: 6 });
});

test('a backup from an older version gets the new settings', () => {
  const s = parseBackup(JSON.stringify({ v: 1, days: {}, fuel: { cycling: true, factors: DEFAULT_FACTORS, overrides: {}, snap: {} } }));
  assert.equal(s.fuel.cycling, true);
  assert.equal(s.fuel.mode, 'auto');
  assert.equal(s.fuel.tolerance, 'normal');
  assert.deepEqual(s.fuel.cancelled, {});
  assert.equal(s.fuel.weights.boxHard, 1);
});
