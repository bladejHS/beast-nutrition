/* Carb Cycling: today's strategy first, then the week, then the engine behind it. */
import { ctx, dayShort, esc, n0 } from '../app.ts';
import { dayBand, reconcile, type FuelDay } from '../logic/carbs.ts';
import { status, windowFor } from '../logic/fasting.ts';
import { weekday } from '../logic/calc.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { CARB_LABEL, DEMAND_LABEL, nextSession, picks, type DayPlan, type Demand, type Session } from '../logic/training.ts';
import { back, banner } from './parts.ts';
import { dayFuel, fuelWeek, mealSlots, notice, training } from './state.ts';

const LEVELS: Demand[] = ['high', 'moderate', 'low', 'rest'];
const SHORT: Record<Demand, string> = { high: 'High', moderate: 'Mod', low: 'Low', rest: 'Rest' };
const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });

let calDay = '';
let calWeek = 0;
let lastClass = '';
let lastCal = '';

export function pickDay(date: string) { calDay = date; }
export function pickWeek(next: number) { calWeek = next; }

function macro(name: string, key: string, target: number, eaten: number) {
  const left = Math.round(target - eaten);
  const lit = Math.min(10, Math.round((eaten / (target || 1)) * 10));
  return `<div class="mc"><span>${name}</span><b data-count="cc-${key}" data-to="${target}">${n0(target)}</b>
    <div class="msegs" role="img" aria-label="${n0(eaten)} din ${n0(target)} g">${Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</div>
    <p>${n0(eaten)} mâncat<br><em class="${left < 0 ? 'over' : ''}">${left >= 0 ? `${n0(left)} rămas` : `${n0(-left)} peste`}</em></p></div>`;
}

function hero(day: FuelDay, p: DayPlan) {
  const s = ctx.get();
  const today = ctx.today();
  const f = dayFuel(today);
  const eaten = totals(dayMeals(s, today));
  const left = f.kcal - eaten.kcal;
  const flip = lastClass && lastClass !== day.demand;
  lastClass = day.demand;
  const [a, b] = CARB_LABEL[day.demand].split(' ');
  const names = p.planned.filter((x) => x.min > 0).map((x) => x.name);
  return `<section class="cc ${day.demand} ${flip ? 'flip' : ''}">
    <p class="cc-k"><span>${esc(longDay(today))}</span><b>${esc(f.label)}</b></p>
    <h1 class="cc-class"><span>${a}</span>${b ? ` ${b}` : ''}</h1>
    <ol class="flow"><li><span>Antrenament</span><b>${names.length ? esc(names.slice(0, 2).join(' + ')) + (names.length > 2 ? ` +${names.length - 2}` : '') : 'Odihnă'}</b></li><li><span>Cerere</span><b>${DEMAND_LABEL[day.demand]}${p.basis === 'manual' ? ', manual' : ''}</b></li><li><span>Fuel</span><b>${f.c} g carbo</b></li></ol>
    <div class="cc-kcal"><div><b data-count="cc-k" data-to="${f.kcal}">${n0(f.kcal)}</b><span>kcal țintă</span></div><div class="cc-left"><b>${n0(eaten.kcal)}</b><span>mâncat</span></div><div class="cc-left"><b class="${left < 0 ? 'over' : ''}">${n0(Math.abs(left))}</b><span>${left < 0 ? 'peste' : 'rămas'}</span></div></div>
    <div class="mcs">${macro('Proteine', 'p', f.p, eaten.p)}${macro('Carbo', 'c', f.c, eaten.c)}${macro('Grăsimi', 'f', f.f, eaten.f)}</div>
  </section>`;
}

const sessionRow = (x: Session, p: DayPlan, next: Session | null) => {
  const done = p.done.some((d) => d.block === x.id);
  const on = next?.id === x.id;
  return `<li class="${done ? 'done' : on ? 'next' : ''}"><span><b>${esc(x.name)}</b><small>${x.min} min${x.alt?.detail ? ` · ${esc(x.alt.detail)}` : ''}</small></span><em>${done ? 'Făcut' : on ? 'Urmează' : ''}</em></li>`;
};

function sessionCard(p: DayPlan) {
  const next = nextSession(p);
  const alts = picks(p.planned);
  return `<section class="card"><h2>Sesiunea de azi</h2>
    ${p.planned.length ? `<ul class="sess">${p.planned.map((x) => sessionRow(x, p, next)).join('')}</ul>` : '<p class="hint">Zi fără antrenament planificat.</p>'}
    ${alts.length ? `<p class="hint">Alegerile tale: ${esc(alts.join('; '))}.</p>` : ''}
    <p class="hint">${esc(p.rating.reason)}${p.basis === 'manual' ? '' : ' Estimare din tipul, durata și intensitatea sesiunilor.'}</p>
    ${training().linked ? '' : '<p class="warn">Inner Beast nu a fost deschis în acest browser: folosesc planul standard din carte.</p>'}</section>`;
}

function around(date: string) {
  const s = ctx.get();
  const f = dayFuel(date);
  const sl = mealSlots(date);
  const n = sl.times.length;
  const head = '<h2>Mese în jurul antrenamentului</h2>';
  if (sl.trainingMeal == null) return `<section class="card">${head}<p>${sl.demand === 'rest' ? 'Zi de recuperare: carbohidrații se împart egal pe mese.' : 'Efort ușor: nu ai nevoie de o masă specială, carbohidrații se împart egal pe mese.'}</p><button class="ghost wide" data-f="sub" data-v="meals">Meal Planner</button></section>`;
  const slot = (i: number) => `<b>${sl.times[i]}</b><span>P ${Math.round(f.p / n)} · C ${Math.round(f.c * sl.shares[i]!)} · G ${Math.round(f.f / n)}</span>`;
  const tm = sl.trainingMeal;
  const [h = 17, m = 0] = s.fuel.trainingHour.split(':').map(Number);
  const w = windowFor(s.fast, weekday(date));
  const closed = w && !status(w, h * 60 + m).eating;
  return `<section class="card">${head}<div class="gd">
    <div><h3>Înainte</h3>${slot(tm)}<p>Carbohidrați ușor de digerat, cu 1–3 ore înainte. Grăsimi și fibre puține.</p></div>
    <div><h3>După</h3>${tm + 1 < n ? slot(tm + 1) : '<b>Ultima masă</b><span>Nu mai urmează nimic azi</span>'}<p>Proteină și carbohidrați la următoarea masă.</p></div>
  </div>
  ${closed ? `<p class="warn">Antrenamentul de la ${esc(s.fuel.trainingHour)} cade în afara ferestrei de mâncat.</p>` : ''}
  <p class="hint">Sfat general al aplicației, nu din carte. Ora antrenamentului se schimbă în Fuel Engine.</p>
  <button class="ghost wide" data-f="sub" data-v="meals">Vezi variantele în Meal Planner</button></section>`;
}

function calendar(days: FuelDay[], plans: Record<string, DayPlan>) {
  const s = ctx.get();
  const today = ctx.today();
  if (!days.some((d) => d.date === calDay)) calDay = days.some((d) => d.date === today) ? today : days[0]!.date;
  const max = Math.max(...days.map((d) => d.c), ...days.map((d) => totals(dayMeals(s, d.date)).c), 1);
  const d = days.find((x) => x.date === calDay)!;
  const pl = plans[calDay]!;
  const flip = lastCal && lastCal !== calDay;
  lastCal = calDay;
  const strip = days.map((x) => {
    const ate = totals(dayMeals(s, x.date)).c;
    return `<button class="cd ${x.demand} ${x.date === calDay ? 'on' : ''} ${x.date === today ? 'now' : ''}" data-f="cal" data-v="${x.date}" aria-pressed="${x.date === calDay}" aria-label="${esc(longDay(x.date))}, ${CARB_LABEL[x.demand]}, ${x.c} grame carbohidrați">
      <span>${esc(dayShort(x.date))}</span><b>${Number(x.date.slice(8))}</b>
      <i class="cdb"><u data-bar="cd-${x.date}" data-axis="y" data-to="${x.c / max}"></u>${ate > 0 ? `<s style="bottom:${Math.min(100, (ate / max) * 100)}%"></s>` : ''}</i>
      <em>${x.c}</em></button>`;
  }).join('');
  const alts = picks(pl.planned);
  return `<h2 class="sect">Calendarul săptămânii</h2>
  <div class="seg small"><button data-f="calw" data-v="0" class="${calWeek ? '' : 'on'}">Săptămâna asta</button><button data-f="calw" data-v="1" class="${calWeek ? 'on' : ''}">Săptămâna viitoare</button></div>
  <section class="cal"><div class="cal-s">${strip}</div>
    <div class="cp ${d.demand} ${flip ? 'flip' : ''}">
      <h3>${esc(longDay(d.date))}</h3>
      <div class="cp-t"><span class="dm ${d.demand}">${DEMAND_LABEL[d.demand]}</span><span class="dm ${d.demand}">${CARB_LABEL[d.demand]}</span>${pl.basis === 'manual' ? '<span class="dm">Ales de tine</span>' : ''}</div>
      ${pl.planned.length ? `<ul class="sess">${pl.planned.map((x) => sessionRow(x, pl, null)).join('')}</ul>` : '<p class="hint">Fără antrenament planificat.</p>'}
      ${alts.length ? `<p class="hint">Alegeri: ${esc(alts.join('; '))}.</p>` : ''}
      <p class="hint">${esc(pl.rating.reason)}${pl.done.length && d.date < today ? ` Făcut: ${esc(pl.done.map((x) => `${x.name} ${x.min} min`).join(', '))}.` : ''}</p>
      <div class="stats"><div><b>${n0(d.kcal)}</b><span>kcal</span></div><div><b>${d.p}</b><span>g proteine</span></div><div><b>${d.c}</b><span>g carbo</span></div><div><b>${d.f}</b><span>g grăsimi</span></div></div>
      <div class="line"><span>Față de planul de bază</span><b>${d.shift > 0 ? '+' : ''}${d.shift} g carbo</b></div>
      ${d.fixed ? '<p class="hint">Zi încheiată: ținta și mesele ei nu se mai schimbă.</p>' : `<div class="seg small">${LEVELS.map((x) => `<button data-f="ov" data-d="${d.date}" data-v="${x}" class="${s.fuel.overrides[d.date] === x ? 'on' : ''}">${SHORT[x]}</button>`).join('')}</div>${s.fuel.overrides[d.date] ? `<button class="backbtn" data-f="ov" data-d="${d.date}" data-v="">Revino la automat</button>` : ''}`}
    </div></section>
  <p class="hint">Barele arată ținta de carbohidrați, linia subțire ce ai mâncat.</p>`;
}

function verify(days: FuelDay[]) {
  const r = reconcile(ctx.get().plan!, days);
  const ok = r.kcalFuel === r.kcalPlan && r.carbsFuel === r.carbsPlan && r.proteinSame && r.fatSame;
  return { r, ok };
}

export function carbsHtml() {
  const s = ctx.get();
  const today = ctx.today();
  const { days, plans } = fuelWeek(mondayOf(today));
  const day = days.find((d) => d.date === today)!;
  const shown = calWeek ? fuelWeek(addDays(mondayOf(today), 7)) : { days, plans };
  const { r, ok } = verify(shown.days);
  return `${back()}${hero(day, plans[today]!)}
  ${notice.text ? `<p class="updated">${esc(notice.text)}</p>` : ''}
  <section class="card"><label class="switch"><input type="checkbox" id="cyc" ${s.fuel.cycling ? 'checked' : ''}><i></i><span>Folosește distribuția în ținta zilnică</span></label>
    <p class="hint">${s.fuel.cycling ? `Pornit: caloriile săptămânii rămân ${n0(r.kcalPlan)} kcal, se mută doar carbohidrații.` : `Oprit: ținta rămâne cea din plan. Pornit, azi ai avea ${day.c} g carbo.`} Nu e o metodă Layne Norton, e un calcul al aplicației peste metoda lui.</p></section>
  ${sessionCard(plans[today]!)}${around(today)}${calendar(shown.days, shown.plans)}
  <p class="recon ${ok ? 'ok' : ''}">Săptămâna: ${n0(r.kcalFuel)} din ${n0(r.kcalPlan)} kcal și ${n0(r.carbsFuel)} din ${n0(r.carbsPlan)} g carbo. Proteine și grăsimi ${r.proteinSame && r.fatSame ? 'neschimbate' : 'diferite'}.${ok ? '' : ' Diferența rămasă nu se mai recuperează, ca să nu încarce o singură zi.'}</p>
  <button class="ghost wide" data-f="sub" data-v="engine">Performance Fuel Engine</button>`;
}

export function engineHtml() {
  const s = ctx.get();
  const { days, plans } = fuelWeek(mondayOf(ctx.today()));
  const { r } = verify(days);
  const F = s.fuel.factors;
  const band = dayBand(F);
  return `${back()}${banner('engine', 'Fuel Engine', 'Regulile care transformă antrenamentul în carbohidrați.')}
  <section class="card"><h2>Încărcarea săptămânii</h2>
    ${days.map((d) => `<div class="line"><span class="cap">${esc(dayShort(d.date))}</span><b>${plans[d.date]!.rating.load}</b><em><span class="dm ${d.demand}">${DEMAND_LABEL[d.demand]}</span></em></div>`).join('')}
    <p class="hint">Încărcarea = minute × intensitatea tipului de sesiune. Box și forță în aceeași zi înseamnă HIGH. E o estimare, nu o măsurătoare, iar regulile sunt ale aplicației, nu ale lui Layne Norton.</p></section>
  <section class="card"><h2>Praguri</h2><div class="grid2">
    <label class="field">HIGH de la<input type="number" min="10" max="200" data-limit="high" value="${s.fuel.limits.high}"></label>
    <label class="field">MODERATE de la<input type="number" min="5" max="150" data-limit="moderate" value="${s.fuel.limits.moderate}"></label></div></section>
  <section class="card"><h2>Factori</h2><p class="hint">Cât primește fiecare tip de zi, înainte de reechilibrarea săptămânii. Nicio zi nu iese din intervalul ${String(band.lo.toFixed(2)).replace('.', ',')}–${String(band.hi.toFixed(2)).replace('.', ',')} × carbohidrații din plan.</p>
    <div class="grid2">${LEVELS.map((k) => `<label class="field">${DEMAND_LABEL[k]}<input type="number" step="0.05" min="0.3" max="2" data-factor="${k}" value="${F[k]}"></label>`).join('')}</div>
    <label class="field">Ora obișnuită de antrenament<input type="time" id="thour" value="${s.fuel.trainingHour}"></label></section>
  <section class="card"><h2>Verificare</h2>
    <div class="line"><span>Calorii plan / distribuție</span><b>${n0(r.kcalPlan)} / ${n0(r.kcalFuel)}</b></div>
    <div class="line"><span>Carbo plan / distribuție</span><b>${n0(r.carbsPlan)} / ${n0(r.carbsFuel)} g</b></div>
    <div class="line"><span>Proteină și grăsimi</span><b>${r.proteinSame && r.fatSame ? 'neschimbate' : 'diferă'}</b></div></section>`;
}
