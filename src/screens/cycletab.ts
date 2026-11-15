/* The Carb Cycling tab (2026-11-15, the user: "când activez opțiunea carb cycling apare un tab nou jos, cu o iconiță
   cu ciclare și o pâine", and a table with each day and what kind of carb cycling day it is). Only there while the
   cycling is on. The numbers are the same week the rest of the app uses (state.ts fuelWeek). */
import { ctx, dayLong, dayShort, esc, n0 } from '../app.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import type { Demand } from '../logic/training.ts';
import { demandTag, head } from './parts.ts';
import { fuelWeek } from './state.ts';


const ORDER: Demand[] = ['high', 'moderate', 'low', 'rest'];

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
  const html = `${head('cycle', 'Carb cycling', 'Carbohidrații urmează antrenamentul. Proteinele și grăsimile rămân la fel în fiecare zi.')}
  <div class="hero-stage" aria-hidden="true"><canvas class="hero-cv" data-kind="carbs" data-j="${esc(JSON.stringify({ c: days.map((d) => d.c), d: days.map((d) => (d.date === today ? 'AZI' : dayShort(d.date).slice(0, 2).toUpperCase())), t: days.map((d) => d.demand), now: 0, intro: !ran }))}"></canvas></div>
  <h2 class="more-sec">Următoarele 7 zile</h2>
  <section class="card cyc-card"><table class="cyc-t">
    <thead><tr><th>Ziua</th><th>Tipul zilei</th><th class="n">Carbo</th><th class="n">Calorii</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="hint">În fiecare zi: ${n0(days[0]!.p)} g proteine, ${n0(days[0]!.f)} g grăsimi. Media carbohidraților: ${avg} g pe zi. Fiecare săptămână, de luni până duminică, are exact carbohidrații și caloriile planului. ${count.map(([k, n]) => `${n} ${k === 'high' ? 'HIGH' : k === 'moderate' ? 'MODERATE' : k === 'low' ? 'LOWER' : 'RECOVERY'}`).join(', ')}.</p>
  </section>
  <section class="card"><h2>Cum se face corect</h2>
    <p><b>Carbohidrații după efort.</b> Cele mai multe în zilele cu sesiuni grele (box cu forță, zi de picioare), mai puține în zilele cu efort mediu, cele mai puține în zilele de recuperare (mers, mobilitate). Principiul „fuel for the work required”: mănânci carbohidrați pentru munca pe care o ai de făcut.</p>
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
  return el.dataset['cyc'] != null;
}
