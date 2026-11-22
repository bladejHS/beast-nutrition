/* Corp: the scale, the weekly decision, the check-in and the measurements. */
import { photosBind, photosCard } from './photos.ts';
import { pilotCard } from './pilot.ts';
import { audioOn, transformCard, trendNow, trophyCheck, trophyInit, weighReveal } from './show.ts';
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { kcalFloor, shiftCarbsFat } from '../logic/calc.ts';
import { addDays, finishedWeeks, mondayOf, review, type CheckIn } from '../logic/review.ts';
import { chartRange, trendAlpha, trendChange, weightTrend, type TrendPoint } from '../logic/trend.ts';
import { fatMass, type Measure } from '../logic/wellness.ts';
import { banner, heroBand, shortDate } from './parts.ts';
import { latestKg } from './state.ts';
import { goalCard } from './extra.ts';
import { pmHero, pmIn, pmSect, pmStats, ribbonArt, summit } from './premium.ts';

const FIELDS: [keyof Measure, string][] = [['hips', 'Șolduri, cm'], ['chest', 'Piept, cm'], ['arm', 'Braț, cm'], ['thigh', 'Coapsă, cm'], ['bf', 'Grăsime, %']];
const FEEL: [keyof CheckIn, string][] = [['energy', 'Energie'], ['strength', 'Forță'], ['hunger', 'Foame (10 = deloc)'], ['mood', 'Dispoziție'], ['stress', 'Stres (10 = deloc)'], ['sleep', 'Somn']];
const FOLLOW: [number, string][] = [[10, 'Tot'], [9, 'Aproape tot'], [8, 'Majoritar'], [7, 'Pe jumătate'], [5, 'Puțin']];
const RANGES: [number, string][] = [[28, '4 săpt.'], [84, '12 săpt.'], [182, '6 luni']];

let range = 84;

/** A check-in describes the last days: from Monday to Wednesday it still belongs to the week that just ended. */
export const checkinWeek = (today: string) => mondayOf(addDays(today, -3));

/** `rate`: the plan's expected change per week in %, drawn as a dashed target from the first visible point (0 = hold). */
function trendChart(points: TrendPoint[], rate = 0) {
  if (points.length < 2) return '<p class="hint pad">Graficul apare după câteva cântăriri.</p>';
  const W = 358, H = 168, L = 8, R = 46, T = 10, B = 22;
  const first = Date.parse(points[0]!.date), last = Date.parse(points.at(-1)!.date);
  const span = Math.max(1, last - first);
  const weeks = (d: string) => (Date.parse(d) - first) / (7 * 864e5);
  const target = (d: string) => points[0]!.trend * (1 + rate / 100) ** weeks(d);
  const [lo, hi] = chartRange(points.flatMap((p) => [p.kg, p.trend]).concat(rate ? [target(points.at(-1)!.date)] : []));
  const x = (d: string) => L + ((Date.parse(d) - first) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const end = points.at(-1)!;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Greutatea, de la ${n1(points[0]!.trend)} la ${n1(end.trend)} kilograme">
    <line class="ax" x1="${L}" x2="${W - R}" y1="${H - B + 4}" y2="${H - B + 4}"/>
    ${points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2.2"/>`).join('')}
    ${rate ? `<polyline class="goal" points="${points.map((p) => `${x(p.date).toFixed(1)},${y(target(p.date)).toFixed(1)}`).join(' ')}"/><text class="goal-t" x="${W - R - 6}" y="${(y(target(end.date)) + (y(target(end.date)) > y(end.trend) ? 14 : -6)).toFixed(1)}" text-anchor="end">ținta ${n1(target(end.date))}</text>` : ''}
    <polyline points="${points.map((p) => `${x(p.date).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ')}"/>
    <text class="end" x="${W - R + 6}" y="${(y(end.trend) + 5).toFixed(1)}">${n1(end.trend)}</text>
    <text x="${L}" y="${H - 4}">${shortDate(points[0]!.date)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${shortDate(end.date)}</text></svg>`;
}

function reviewCard() {
  const s = ctx.get();
  const plan = s.plan!;
  const today = ctx.today();
  const r = review(plan, finishedWeeks(s.weights, today), s.checkins);
  // One decision per week: the new target needs a full week before anyone can judge it.
  const applied = plan.adjustments.filter((a) => a.date >= mondayOf(today)).at(-1);
  // with the pilot on, the week's decision is its job: two voices proposing two different cuts is how a user ends
  // up eating 15% less twice in the same week (2026-11-22)
  const piloted = !!s.pilot?.on;
  const act = r.pct == null ? '' : piloted
    ? '<p class="hint">Pilotul se ocupă de ajustări: schimbă ținta singur, din întreținerea măsurată, cel mult o dată la șapte zile. Oprește-l din Carb Cycling → Reguli dacă vrei să decizi tu.</p>'
    : applied
    ? `<p class="hint">Ai aplicat ${applied.pct > 0 ? '+' : '−'}${Math.abs(applied.pct)}% săptămâna asta. Următoarea decizie vine după o săptămână întreagă cu noua țintă.</p>`
    : `<button class="primary wide" data-apply="${r.pct}" data-note="${esc(r.note ?? '')}">Aplică ${r.pct > 0 ? '+' : '−'}${Math.abs(r.pct)}% la carbohidrați și grăsimi</button>`;
  const rev = r.suggestReverse ? '<button class="primary wide" data-phase="reverse">Treci la reverse diet</button>' : '';
  return `<section class="card review ${r.level}"><h2>${esc(r.title)}</h2><p>${esc(r.body.replace(/(\d)\.(\d)/g, '$1,$2'))}</p>${act}${rev}</section>`;
}

function weighCard(points: TrendPoint[]) {
  const s = ctx.get();
  const today = ctx.today();
  const change = trendChange(points);
  const end = points.at(-1);
  const from = addDays(today, -range);
  return `<section class="card">
    ${end ? `<p class="big"><b>${n1(end.trend)}</b> kg, tendința</p><p class="hint">${change == null ? 'Punctele sunt cântăririle, linia e tendința.' : `${change > 0 ? '+' : '−'}${nb(n1(Math.abs(change)), 'kg')} în 7 zile. Punctele sunt cântăririle, linia e tendința.`}</p>` : ''}
    <div class="seg small">${RANGES.map(([v, l]) => `<button data-range="${v}" class="${range === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${trendChart(points.filter((p) => p.date >= from), s.plan?.phase === 'cut' ? -s.plan.ratePct : 0)}
    <button class="${s.weights[today] == null ? 'primary' : 'ghost'} wide" data-weigh>${s.weights[today] == null ? 'Notează greutatea de azi' : `Azi: ${nb(n1(s.weights[today]!), 'kg')}, schimbă`}</button>
    <p class="hint">Dimineața, după baie, pe același cântar.</p></section>`;
}

export function openWeigh() {
  const s = ctx.get();
  const today = ctx.today();
  ctx.open(`<h2>Cântărirea de azi</h2><p class="hint">Dimineața, după baie, pe același cântar.</p>
    <div class="amount"><button class="step" data-kg="-0.1" aria-label="Scade 100 de grame">−</button><label><span class="sr">Greutate în kilograme</span><input id="kg" type="text" inputmode="decimal" value="${n1(s.weights[today] ?? latestKg())}" autocomplete="off"></label><span class="unit">kg</span><button class="step" data-kg="0.1" aria-label="Crește cu 100 de grame">+</button></div>
    <button class="primary wide" id="kgsave">Salvează</button>`, 'Cântărirea de azi');
  const input = document.querySelector<HTMLInputElement>('#kg')!;
  document.querySelectorAll<HTMLButtonElement>('[data-kg]').forEach((b) => b.addEventListener('click', () => { input.value = n1(Math.round(((parseNum(input.value) || 0) + Number(b.dataset['kg'])) * 10) / 10); }));
  document.querySelector('#kgsave')!.addEventListener('click', () => {
    const kg = parseNum(input.value);
    if (!(kg > 30 && kg < 350)) { ctx.toast('Scrie greutatea în kilograme, de exemplu 82,5.'); return; }
    audioOn();
    const before = s.weights[today];
    const beforeTrend = trendNow();
    trophyInit();
    s.weights[today] = kg;
    ctx.close(); ctx.commit(); ctx.render();
    // the number lands like a result, then any trophy the trend has passed (show.ts)
    weighReveal(kg, beforeTrend);
    trophyCheck(matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 6900);
    ctx.toast('Greutate salvată.', () => { if (before == null) delete s.weights[today]; else s.weights[today] = before; ctx.commit(); ctx.render(); });
  });
}

function checkinCard() {
  const s = ctx.get();
  const week = checkinWeek(ctx.today());
  const c = s.checkins[week] ?? {};
  return `<section class="card"><h2>Check-in săptămânal</h2><p class="hint">Pentru săptămâna din ${shortDate(week)}. Totul e opțional, ce lași gol nu contează.</p><form id="ci">
    <fieldset class="pick5"><legend>Cât din plan ai respectat?</legend><div>${FOLLOW.map(([v, l]) => `<label><input type="radio" name="adherence" value="${v}" ${c.adherence === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <label class="field">Talie, cm<input name="waist" type="text" inputmode="decimal" value="${c.waist != null ? n1(c.waist) : ''}" autocomplete="off"></label>
    <details class="sub"><summary>Cum te-ai simțit</summary>${FEEL.map(([k, l]) => `<label class="range"><span>${l}</span><input type="range" name="${k}" min="1" max="10" value="${c[k] ?? 5}" ${c[k] != null ? 'data-touched' : ''}><output>${c[k] ?? '–'}</output></label>`).join('')}</details>
    <button class="primary wide">Salvează check-in-ul</button></form></section>`;
}

function weeksCard() {
  const s = ctx.get();
  const weeks = finishedWeeks(s.weights, ctx.today()).slice(-6).reverse();
  if (!weeks.length) return '';
  return `<details class="card"><summary><b>Mediile pe săptămână</b></summary>${weeks.map((w, i) => {
    const prev = weeks[i + 1];
    const diff = prev ? w.avg - prev.avg : null;
    return `<div class="line"><span>${shortDate(w.start)}</span><b>${nb(n1(w.avg), 'kg')}</b><em>${diff == null ? '' : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</em></div>`;
  }).join('')}</details>`;
}

function measuresCard(points: TrendPoint[]) {
  const s = ctx.get();
  const last = [...s.measures].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const est = points.length && last?.bf != null ? fatMass(points.at(-1)!.trend, last.bf) : null;
  return `<details class="card"><summary><b>Măsurători</b></summary>
    ${est ? `<p class="hint">Estimare, nu măsurătoare: ${nb(n1(est.fat), 'kg')} grăsime și ${nb(n1(est.lean), 'kg')} masă slabă, din grăsimea de ${n1(last!.bf!)}% notată.</p>` : ''}
    <form id="mf2"><div class="grid2">${FIELDS.map(([k, l]) => `<label class="field">${l}<input name="${k}" type="text" inputmode="decimal" value="${last?.[k] != null ? n1(last[k] as number) : ''}" autocomplete="off"></label>`).join('')}</div>
    <button class="primary wide">Salvează măsurătorile</button></form></details>`;
}

export function bodyHtml() {
  const s = ctx.get();
  const points = weightTrend(s.weights, trendAlpha(s.plan!.phase));
  const end = points.at(-1);
  const change = trendChange(points);
  const goal = s.goal?.kg ?? null;
  const start = points[0]?.trend ?? null;
  const gone = start != null && end ? start - end.trend : null;
  const left = goal != null && end ? end.trend - goal : null;
  const weeks = finishedWeeks(s.weights, ctx.today()).length;
  return `${banner('body', 'Corp')}
  <div class="pm${pmIn()}">
  ${pmHero({ eyebrow: points.length > 1 ? `${points.length} cântăriri din ${shortDate(points[0]!.date)}` : 'Prima zi', title: end ? `${n1(end.trend)} kg` : 'Prima cântărire', sub: end ? (change == null ? 'Linia e tendința, nu cântărirea de azi.' : `${change > 0 ? '+' : '−'}${n1(Math.abs(change))} kg în ultimele 7 zile, pe tendință.`) : 'Notează-ți greutatea și începe graficul.', art: points.length > 1 ? summit(points, goal) : ribbonArt(), tall: points.length > 1 })}
  ${pmStats([[gone != null && gone > 0 ? `−${n1(gone)}` : gone != null ? n1(-gone) : '–', 'kg de la start'], [left != null ? n1(Math.max(0, left)) : '–', 'kg până la țintă'], [String(weeks), weeks === 1 ? 'săptămână' : 'săptămâni'], [String(Object.keys(s.weights).length), 'cântăriri']])}
  ${heroBand('weigh')}
  ${pmSect('Ținta')}
  ${goalCard()}
  ${pmSect('Decizia săptămânii')}
  ${pilotCard(true)}
  ${reviewCard()}
  ${pmSect('Cântarul')}
  ${weighCard(points)}
  ${transformCard()}
  ${pmSect('Cum te simți')}
  ${checkinCard()}
  ${weeksCard()}
  ${pmSect('Măsurători și poze')}
  ${measuresCard(points)}
  ${photosCard()}</div>`;
}

/** The only way the plan's numbers move from here: one change a week, never under the floor, and it can be undone. */
function applyStep(pct: number, note: string) {
  const s = ctx.get();
  const plan = s.plan!;
  const today = ctx.today();
  const floor = kcalFloor(s.profile!.sex);
  const to = shiftCarbsFat(plan.macros, pct);
  if (pct < 0 && to.kcal < floor) { ctx.toast(`Ținta ar ajunge la ${n0(to.kcal)} kcal, sub limita de ${n0(floor)}. Alege o pauză de dietă sau reverse.`); return; }
  const before = { macros: plan.macros, maintenance: plan.maintenance, adjustments: plan.adjustments };
  plan.adjustments = [...plan.adjustments, { date: today, pct, note, from: plan.macros.kcal, to: to.kcal }];
  plan.macros = to;
  if (plan.phase !== 'cut') plan.maintenance = to.kcal;
  ctx.commit(); ctx.render();
  ctx.toast(`Noua țintă: ${n0(to.kcal)} kcal.`, () => { Object.assign(plan, before); ctx.commit(); ctx.render(); });
}

export function bodyAction(el: HTMLElement): boolean {
  const d = el.dataset;
  if (d['weigh'] != null) { openWeigh(); return true; }
  if (d['apply']) { applyStep(Number(d['apply']), d['note'] ?? ''); return true; }
  if (d['range']) { range = Number(d['range']); ctx.render(); return true; }
  return false;
}

export function bodyBind() {
  const s = ctx.get();
  const week = checkinWeek(ctx.today());
  const ci = document.querySelector<HTMLFormElement>('#ci');
  ci?.addEventListener('input', (ev) => { const t = ev.target as HTMLInputElement; if (t.type === 'range') { t.dataset['touched'] = ''; t.nextElementSibling!.textContent = t.value; } });
  ci?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(ci);
    const c: CheckIn = { ...s.checkins[week] };
    const adherence = parseNum(d.get('adherence')), waist = parseNum(d.get('waist'));
    if (adherence > 0) c.adherence = adherence;
    if (waist > 0) c.waist = waist; else delete c.waist;
    for (const [k] of FEEL) { const el = ci.elements.namedItem(k) as HTMLInputElement; if (el.dataset['touched'] != null) c[k] = Number(el.value); }
    s.checkins[week] = c;
    ctx.commit(); ctx.render(); ctx.toast('Check-in salvat.');
  });
  const form = document.querySelector<HTMLFormElement>('#mf2');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const today = ctx.today();
    const m: Measure = { date: today };
    for (const [k] of FIELDS) { const v = parseNum(d.get(k)); if (v > 0) (m as unknown as Record<string, number>)[k] = v; }
    s.measures = [...s.measures.filter((x) => x.date !== today), m];
    s.checkins[week] = { ...s.checkins[week], ...(m.hips != null ? { hips: m.hips } : {}), ...(m.bf != null ? { bf: m.bf } : {}) };
    ctx.commit(); ctx.render(); ctx.toast('Măsurători salvate.');
  });
  photosBind();
}
