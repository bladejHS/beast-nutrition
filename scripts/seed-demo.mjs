/* Builds a valid saved state for looking at screens in a browser (2026-11-22).
 * Dev aid only: never imported by the app. Run with
 *   node scripts/seed-demo.mjs > ../seed.json
 * then paste the JSON into localStorage under `beast-nutrition:v2`. */
import { empty } from '../src/logic/store.ts';
import { buildPlan, predictedMaintenance } from '../src/logic/calc.ts';
import { freshGlp1 } from '../src/logic/glp1.ts';

const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const s = empty();
s.profile = { sex: 'm', age: 23, heightCm: 200, weightKg: 134, bf: 32, activity: 1.5, lifts: true };
const maintenance = predictedMaintenance(s.profile);
s.plan = buildPlan(s.profile, {
  phase: 'cut', startDate: day(-84), ratePct: 0.5, carbShare: 0.67, maintenance,
  highDays: [0, 3], breaks: { on: 4, off: 1 }, pace: 'steady',
});

// twelve weeks of weigh-ins drifting down, so the trend and the pace have something to read
for (let i = 84; i >= 0; i--) {
  const noise = Math.sin(i * 1.7) * 0.35;
  s.weights[day(-i)] = Math.round((134 - (84 - i) * 0.095 + noise) * 10) / 10;
}
s.measures = [
  { date: day(-84), waist: 128, hips: 122, bf: 34 },
  { date: day(-28), waist: 123, hips: 119, bf: 32 },
];
s.goal = { kg: 105, by: day(240), from: 134 };

// semaglutide: on the top dose, held six weeks, so the protocol sits in the "cut" phase
const g = freshGlp1();
g.on = true;
g.mg = 2.4;
g.day = 2;
g.start = day(-140);
g.screened = day(-150);
for (let i = 19; i >= 0; i--) {
  const mg = i > 13 ? 0.25 : i > 10 ? 0.5 : i > 7 ? 1 : i > 5 ? 1.7 : 2.4;
  g.shots.push({ date: day(-i * 7), mg, site: (19 - i) % 6, nausea: i > 15 ? 1 : 0 });
}
g.glucose = [
  { id: 'g1', date: day(-12), time: '07:10', mg: 104, when: 'fasting' },
  { id: 'g2', date: day(-5), time: '07:20', mg: 97, when: 'fasting' },
  { id: 'g3', date: day(-2), time: '20:40', mg: 131, when: 'post' },
];
s.glp1 = g;

s.labs = ['hba1c', 'glucose', 'insulin', 'ldl', 'hdl', 'tg', 'alt'].map((marker, i) => ({
  id: `l${i}`, marker, date: day(-30), value: 5.4 + i, note: '',
}));
s.supps = [{ id: 's1', product: 'Creatină monohidrat', brand: '', ingredient: 'Creatină', serving: '5 g', times: [] }];

process.stdout.write(JSON.stringify(s));
