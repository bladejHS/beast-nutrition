/* Corp: the scale, the weekly decision, the check-in and the measurements. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { kcalFloor, shiftCarbsFat } from '../logic/calc.ts';
import { addDays, finishedWeeks, mondayOf, review, type CheckIn } from '../logic/review.ts';
import { chartRange, trendAlpha, trendChange, weightTrend, type TrendPoint } from '../logic/trend.ts';
import { fatMass, type Measure } from '../logic/wellness.ts';
import { banner, shortDate } from './parts.ts';
import { latestKg } from './state.ts';

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
  const act = r.pct == null ? '' : applied
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
    const before = s.weights[today];
    s.weights[today] = kg;
    ctx.close(); ctx.commit(); ctx.render();
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

const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('bn-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function putPhoto(id: string, url: string) {
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put({ id, url }); t.oncomplete = res; t.onerror = rej; });
}
async function dropPhoto(id: string) {
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').delete(id); t.oncomplete = res; t.onerror = rej; });
}
async function allPhotos(): Promise<{ id: string; url: string }[]> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction('p').objectStore('p').getAll(); r.onsuccess = () => res(r.result as { id: string; url: string }[]); r.onerror = rej; });
}

export function bodyHtml() {
  const s = ctx.get();
  const points = weightTrend(s.weights, trendAlpha(s.plan!.phase));
  return `${banner('body', 'Corp')}
  ${reviewCard()}
  ${weighCard(points)}
  ${checkinCard()}
  ${weeksCard()}
  ${measuresCard(points)}
  <details class="card"><summary><b>Fotografii</b></summary><p class="hint">Stau doar pe acest dispozitiv și nu intră în backup.</p>
    <label class="ghost file wide">Adaugă o fotografie<input type="file" id="ph" accept="image/*"></label><div id="phs" class="photos"></div></details>`;
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
  if (d['photo']) {
    const id = d['photo'];
    void dropPhoto(id).then(() => { ctx.render(); ctx.toast('Fotografie ștearsă.'); });
    return true;
  }
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
  const box = document.querySelector('#phs');
  if (box && 'indexedDB' in window) {
    void allPhotos().then((list) => { box.innerHTML = list.slice(-6).reverse().map((p) => `<figure><img src="${p.url}" alt="Fotografie din ${esc(p.id.slice(0, 10))}"><figcaption>${esc(p.id.slice(0, 10))}<button class="xs" data-photo="${esc(p.id)}" aria-label="Șterge fotografia">×</button></figcaption></figure>`).join(''); }).catch(() => {});
  }
  document.querySelector<HTMLInputElement>('#ph')?.addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      void putPhoto(`${ctx.today()}-${Date.now()}`, c.toDataURL('image/jpeg', 0.8)).then(() => ctx.render());
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
