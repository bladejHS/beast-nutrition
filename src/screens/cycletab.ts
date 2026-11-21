/* The Carb Cycling tab (2026-11-15, the user: "când activez opțiunea carb cycling apare un tab nou jos, cu o iconiță
   cu ciclare și o pâine", and a table with each day and what kind of carb cycling day it is). Only there while the
   cycling is on. The numbers are the same week the rest of the app uses (state.ts fuelWeek). */
import { ctx, dayLong, dayShort, esc, n0 } from '../app.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import type { Demand } from '../logic/training.ts';
import { demandTag, head } from './parts.ts';
import { fuelWeek } from './state.ts';


const ORDER: Demand[] = ['high', 'moderate', 'low', 'rest'];
/** What the user picks from (2026-11-21: "tu doar dă-mi macronutrienții pentru low, medium, high"). */
const PICK: [Demand, string][] = [['low', 'LOW'], ['moderate', 'MEDIUM'], ['high', 'HIGH']];
const WEEK = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

/** Macros of each kind of day this week. A kind the week does not use is shown at the rate the week pays the others. */
function levels(days: { demand: Demand; c: number; p: number; f: number; planC: number; fixed: boolean }[]) {
  const f = ctx.get().fuel.factors;
  const open = days.filter((d) => !d.fixed);
  const ref = open.length ? open : days;
  const k = ref.reduce((a, d) => a + d.c, 0) / Math.max(1, ref.reduce((a, d) => a + d.planC * f[d.demand], 0));
  const p = days[0]!.p, fat = days[0]!.f, planC = Math.round(ref.reduce((a, d) => a + d.planC, 0) / ref.length);
  return PICK.map(([lv, name]) => {
    const real = open.filter((d) => d.demand === lv);
    const c = real.length ? Math.round(real.reduce((a, d) => a + d.c, 0) / real.length) : Math.round(planC * f[lv] * k);
    return { lv, name, c, p, f: fat, kcal: p * 4 + c * 4 + fat * 9, used: days.some((d) => d.demand === lv) };
  });
}

/** Manual from the first pick: the other days start from what the app had given them this week. */
export function pickDay(i: number, v: Demand) {
  const s = ctx.get();
  if (s.fuel.mode !== 'manual') {
    const { days } = fuelWeek(mondayOf(ctx.today()));
    s.fuel.pattern = days.map((d) => (d.demand === 'rest' ? 'low' : d.demand));
    s.fuel.mode = 'manual';
  }
  s.fuel.pattern = [...(s.fuel.pattern ?? Array(7).fill(null))];
  s.fuel.pattern[i] = v;
  s.fuel.sig = '';
  ctx.commit(); ctx.render();
}

/** The columns grow once per visit; later redraws show them standing. */
let ran = false;

export function cycleTabHtml(): string {
  const today = ctx.today();
  // the next seven days from today, across the week boundary: each day keeps the numbers of its own week
  const a = fuelWeek(mondayOf(today)), b = fuelWeek(addDays(mondayOf(today), 7));
  const plans = { ...a.plans, ...b.plans };
  const days = [...a.days, ...b.days].filter((d) => d.date >= today).slice(0, 7);
  const what = (d: string) => {
    const p = plans[d];
    const names = (p?.planned ?? []).filter((x) => x.min >= 10).map((x) => x.name);
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') : 'Odihnă';
  };
  const avg = Math.round(days.reduce((a, d) => a + d.c, 0) / 7);
  const count = ORDER.map((k) => [k, days.filter((d) => d.demand === k).length] as const).filter(([, n]) => n);
  const rows = days.map((d) => `<tr class="${d.date === today ? 'now' : ''}${d.date < today ? ' past' : ''}">
      <td><b class="cap">${d.date === today ? 'Azi' : esc(dayShort(d.date))}</b><small>${esc(dayLong(d.date).split(', ')[1] ?? '')}</small></td>
      <td>${demandTag(d.demand)}${d.prefuel ? '<small class="pre">urcat: mâine e HIGH</small>' : ''}<small>${esc(what(d.date))}</small></td>
      <td class="n"><b>${n0(d.c)}</b><small>g carbo</small></td>
      <td class="n"><b>${n0(d.kcal)}</b><small>kcal</small></td></tr>`).join('');
  const s = ctx.get(), manual = s.fuel.mode === 'manual';
  const week = fuelWeek(mondayOf(today));
  const lv = levels(week.days);
  const mine = (i: number) => (manual ? s.fuel.pattern?.[i] ?? 'moderate' : week.days[i]!.demand === 'rest' ? 'low' : week.days[i]!.demand);
  const html = `${head('cycle', 'Carb cycling', manual ? 'Tu alegi zilele. Aplicația îți dă macronutrienții fiecărui tip de zi.' : 'Carbohidrații urmează antrenamentul. Proteinele și grăsimile rămân la fel în fiecare zi.')}
  <section class="card"><h2>Macronutrienți pe tip de zi</h2>
    <div class="lv-grid">${lv.map((x) => `<div class="lv lv-${x.lv}"><b>${x.name}</b><span class="lv-k">${n0(x.kcal)}<small>kcal</small></span><span class="lv-m"><i class="mp">P ${n0(x.p)} g</i><i class="mc">C ${n0(x.c)} g</i><i class="mf">G ${n0(x.f)} g</i></span>${x.used ? '' : '<small class="lv-n">nefolosită săptămâna asta</small>'}</div>`).join('')}</div>
    <p class="hint">Proteinele și grăsimile sunt aceleași în fiecare zi; se mută doar carbohidrații. Săptămâna are exact caloriile planului, așa că valorile se reechilibrează după câte zile HIGH, MEDIUM și LOW alegi.</p>
  </section>
  <section class="card"><h2>Săptămâna ta</h2>
    ${WEEK.map((name, i) => `<div class="pick-row"><span>${name}</span><div class="seg small">${PICK.map(([v, l]) => `<button data-cyc="day" data-i="${i}" data-v="${v}" class="${mine(i) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join('')}
    <p class="hint">${manual ? 'Se aplică în fiecare săptămână, de azi înainte. Zilele trecute rămân cum au fost.' : 'Acum alege aplicația, după antrenamente. Cum atingi o zi, treci pe alegerea ta.'}</p>
    ${manual ? '<button class="ghost wide" data-cyc="auto">Lasă aplicația să aleagă după antrenamente</button>' : ''}
  </section>
  <div class="hero-stage" aria-hidden="true"><canvas class="hero-cv" data-kind="carbs" data-j="${esc(JSON.stringify({ c: days.map((d) => d.c), d: days.map((d) => (d.date === today ? 'AZI' : dayShort(d.date).slice(0, 2).toUpperCase())), t: days.map((d) => d.demand), now: 0, intro: !ran }))}"></canvas></div>
  <h2 class="more-sec">Următoarele 7 zile</h2>
  <section class="card cyc-card"><table class="cyc-t">
    <thead><tr><th>Ziua</th><th>Tipul zilei</th><th class="n">Carbo</th><th class="n">Calorii</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="hint">În fiecare zi: ${n0(days[0]!.p)} g proteine, ${n0(days[0]!.f)} g grăsimi. Media carbohidraților: ${avg} g pe zi. Fiecare săptămână, de luni până duminică, are exact carbohidrații și caloriile planului. ${count.map(([k, n]) => `${n} ${k === 'high' ? 'HIGH' : k === 'moderate' ? 'MODERATE' : k === 'low' ? 'LOWER' : 'RECOVERY'}`).join(', ')}.</p>
  </section>
  <section class="card"><h2>Cum se face corect</h2>
    <p><b>Carbohidrații după efort.</b> Cele mai multe în zilele cu sesiuni grele (Lower Body, Upper + Power, alergarea lungă), mai puține în zilele cu efort mediu, cele mai puține în zilele de recuperare (mers, mobilitate). Principiul „fuel for the work required”: mănânci carbohidrați pentru munca pe care o ai de făcut.</p>
    <p><b>Săptămâna rămâne aceeași.</b> Carb cycling-ul doar mută carbohidrații între zile. Slăbitul vine din deficitul săptămânii, nu din ciclare.</p>
    <p><b>Proteinele la fel, zilnic.</b> Țin masa musculară în deficit; nu se ciclează.</p>
    <p><b>Ziua dinaintea unei zile HIGH urcă puțin</b>, ca să intri în antrenamentul greu cu glicogenul refăcut.</p>
    <p><b>În ziua de antrenament</b>, carbohidrații se adună în masa dinainte și în cea de după.</p>
    <button class="ghost wide" data-tab="fuel" data-sub="carbs">Calendar, factori și setări</button>
  </section>`;
  ran = true;
  return html;
}

export function cycleAction(el: HTMLElement): boolean {
  const a = el.dataset['cyc'];
  if (a == null) return false;
  if (a === 'day') pickDay(Number(el.dataset['i']), el.dataset['v'] as Demand);
  if (a === 'auto') { const s = ctx.get(); s.fuel.mode = 'auto'; s.fuel.sig = ''; ctx.commit(); ctx.render(); }
  return true;
}
