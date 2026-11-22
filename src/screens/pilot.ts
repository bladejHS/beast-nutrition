/* The pilot, connected to the app (2026-11-22). logic/autopilot.ts decides; this file collects what it needs out of
   the saved state, applies the decision once a day when the switch is on, and writes what it did where the user can
   see it and undo it.

   Applying means moving carbohydrate and fat only. Protein never moves: the research is one-sided that on a GLP-1
   drug protein is a floor to defend, not a dial. So a change of `delta` kcal is spread over the calories that are not
   protein, which is why the percentage here is bigger than delta / target. */
import { ctx, esc, n0 } from '../app.ts';
import { shiftCarbsFat } from '../logic/calc.ts';
import { pilot, willApply, type PilotOut } from '../logic/autopilot.ts';
import { finishedWeeks } from '../logic/review.ts';
import { dayMeals, totals, type State } from '../logic/store.ts';
import { addDaysUtc } from '../logic/tdee.ts';
import { flagText } from '../logic/safety.ts';

/** Everything eaten on a day, for the days that have anything logged. */
function intakeOf(s: State, today: string, days = 30): Array<{ date: string; kcal: number }> {
  const out: Array<{ date: string; kcal: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysUtc(today, -i);
    const meals = dayMeals(s, d);
    if (!meals.flat().length) continue;
    out.push({ date: d, kcal: totals(meals).kcal });
  }
  return out.reverse();
}

/** Mean protein over the same window as the estimate, or null when too few days were logged. */
function proteinMean(s: State, today: string, days = 21): number | null {
  const vals: number[] = [];
  for (let i = 0; i < days; i++) {
    const meals = dayMeals(s, addDaysUtc(today, -i));
    if (!meals.flat().length) continue;
    vals.push(totals(meals).p);
  }
  return vals.length >= 7 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** The decision for today, without changing anything. */
export function decision(): PilotOut | null {
  const s = ctx.get();
  if (!s.plan || !s.profile) return null;
  const today = ctx.today();
  return pilot({
    plan: s.plan,
    profile: s.profile,
    goalKg: s.goal?.kg,
    today,
    intake: intakeOf(s, today),
    weights: s.weights,
    weeks: finishedWeeks(s.weights, today),
    proteinG: proteinMean(s, today),
    lastChange: s.plan.adjustments.at(-1)?.date,
  });
}

/** The percentage to pass to shiftCarbsFat so the day lands `delta` kcal away, with protein untouched. */
export const shiftPct = (kcal: number, proteinG: number, delta: number): number => {
  const rest = Math.max(1, kcal - proteinG * 4);
  return (delta / rest) * 100;
};

/** Fat never goes under 0.5 g per kg of body weight (perf.ts, the 2016 position stand's lower limit): when a cut
 *  would push it there, the carbohydrate pays instead. The calories and the protein of the step stay exactly. */
export function keepFatFloor(m: { kcal: number; p: number; c: number; f: number }, weightKg: number) {
  const need = Math.ceil(weightKg * 0.5);
  if (m.f >= need) return m;
  const moved = need - m.f;
  const c = Math.max(0, Math.round((m.c - (moved * 9) / 4) / 5) * 5);
  return { ...m, f: need, c, kcal: m.p * 4 + c * 4 + need * 9 };
}

let ranFor = '';

/**
 * Called when the app opens. Runs at most once a day, writes only when the switch is on and the decision is a real
 * change, and leaves a toast with an undo.
 */
export function runPilot(): void {
  const s = ctx.get();
  const today = ctx.today();
  if (ranFor === today || !s.plan || !s.profile) return;
  ranFor = today;
  s.pilot ??= { on: false, log: [] };
  if (!s.pilot.on) return;
  const o = decision();
  if (!o || !willApply(o, true)) return;

  const plan = s.plan;
  const before = { macros: plan.macros, maintenance: plan.maintenance, adjustments: plan.adjustments, log: [...s.pilot.log], last: s.pilot.last };
  const pct = shiftPct(plan.macros.kcal, plan.macros.p, o.delta);
  const bodyKg = s.weights[Object.keys(s.weights).sort().at(-1) ?? ''] ?? s.profile.weightKg;
  const next = keepFatFloor(shiftCarbsFat(plan.macros, pct), bodyKg);
  plan.adjustments = [...plan.adjustments, { date: today, pct: Math.round(pct * 10) / 10, note: o.note ?? 'Pilot', from: plan.macros.kcal, to: next.kcal }];
  plan.macros = next;
  if (plan.phase !== 'cut') plan.maintenance = next.kcal;
  s.pilot.last = today;
  s.pilot.log = [...s.pilot.log, { date: today, kind: o.kind, from: before.macros.kcal, to: next.kcal, why: o.body }].slice(-30);
  ctx.commit();
  ctx.render();
  ctx.toast(`Pilotul a mutat ținta la ${n0(next.kcal)} kcal.`, () => {
    Object.assign(plan, { macros: before.macros, maintenance: before.maintenance, adjustments: before.adjustments });
    s.pilot = { on: true, last: before.last, log: before.log };
    ctx.commit();
    ctx.render();
  });
}

const KIND_CLASS: Record<string, string> = { cut: 'act', raise: 'act', hold: 'ok', wait: 'ok', stop: 'warn' };

/** The card that explains where the pilot stands, for Carb cycling and Corp. */
export function pilotCard(compact = false): string {
  const s = ctx.get();
  const on = !!s.pilot?.on;
  const o = decision();
  if (!o) return '';
  const t = o.tdee;
  const flags = o.flags.filter((f) => f.id !== 'too-slow');
  return `<section class="card pilot ${KIND_CLASS[o.kind] ?? ''}">
    <div class="ch"><h2>Pilot</h2><label class="switch"><input type="checkbox" id="pilot-on" ${on ? 'checked' : ''}><i></i><span>${on ? 'Pornit' : 'Oprit'}</span></label></div>
    <p class="big"><b>${t.usable ? n0(t.kcal) : '–'}</b> kcal, întreținerea măsurată</p>
    <p class="hint">${t.usable
      ? `Din ${t.logged} zile cu mâncare notată și ${t.span} zile de cântăriri. Planul pornise de la ${n0(s.plan!.maintenance)} kcal.`
      : `Mai am nevoie de date: ${t.logged} zile cu mâncare notată din 21 și ${t.span} zile de cântăriri.`}</p>
    <h3>${esc(o.title)}</h3>
    <p>${esc(o.body)}</p>
    ${flags.map((f) => { const x = flagText(f); return `<p class="${f.level === 'stop' ? 'warn' : 'hint'} issue"><b>${esc(x.title)}.</b> ${esc(x.body)}</p>`; }).join('')}
    ${on ? '' : '<p class="hint">Cât e oprit, îți spune doar ce ar face. Pornit, mută ținta singur, o dată pe săptămână cel mult, și îți lasă posibilitatea să anulezi.</p>'}
    ${compact ? '' : `<p class="hint">Ține minte: după o zi cu mulți carbohidrați cântarul urcă 0,5–1,5 kg de apă și glicogen. Pilotul citește panta pe 21 de zile tocmai ca să nu reacționeze la asta.</p>`}
    ${s.pilot?.log?.length ? `<details class="sub"><summary>Ce a făcut (${s.pilot.log.length})</summary>${[...s.pilot.log].reverse().slice(0, 10).map((e) => `<div class="line"><span>${esc(e.date)}</span><b>${n0(e.from)} → ${n0(e.to)} kcal</b></div>`).join('')}</details>` : ''}
  </section>`;
}

/** The switch, bound after every render like the other switches of the app. */
export function pilotBind(): void {
  const el = document.querySelector<HTMLInputElement>('#pilot-on');
  if (!el) return;
  el.addEventListener('change', () => {
    const s = ctx.get();
    s.pilot ??= { on: false, log: [] };
    s.pilot.on = el.checked;
    ctx.commit();
    if (s.pilot.on) { ranFor = ''; runPilot(); }
    ctx.render();
  });
}
