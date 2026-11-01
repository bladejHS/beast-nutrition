/* The Weekly Fuel Calendar and the detail of one day. */
import { ctx, dayShort, esc, n0, nb } from '../app.ts';
import { reconcile, type FuelDay } from '../logic/carbs.ts';
import { FEEDBACK } from '../logic/insights.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { sportRows } from '../logic/timing.ts';
import { bandCount } from '../logic/today.ts';
import { CARB_LABEL, nextSession, picks, sessionStatus, type DayPlan, type Demand } from '../logic/training.ts';
import { cv, flow } from './carbs.ts';
import { back, comma, LEVELS, longDay, lvl, SHORT, sessionRow, shortDate } from './parts.ts';
import { dayFuel, fuelWeek, fx, latestKg, mealSlots, rules, timingFor, training } from './state.ts';

export function weekCheck(days: FuelDay[]) {
  const r = reconcile(ctx.get().plan!, days);
  return { r, ok: r.kcalFuel === r.kcalPlan && r.carbsFuel === r.carbsPlan && r.proteinSame && r.fatSame };
}

/** How the week is shared out and whether it adds up. */
export function weekSummary(days: FuelDay[], plans: Record<string, DayPlan>) {
  const { r, ok } = weekCheck(days);
  const done = days.reduce((a, d) => a + plans[d.date]!.done.length, 0);
  const all = days.reduce((a, d) => a + plans[d.date]!.planned.filter((x) => x.min > 0).length, 0);
  return `<section class="card wsum"><div class="wcount">${LEVELS.map((l) => `<div class="${l}">${lvl(l)}<b>${days.filter((d) => d.demand === l).length}</b><span>${SHORT[l]}</span></div>`).join('')}<div><b>${done}<small>/${all}</small></b><span>Sesiuni</span></div></div>
    <p class="recon ${ok ? 'ok' : ''}">Săptămâna are ${n0(r.kcalFuel)} din ${nb(n0(r.kcalPlan), 'kcal')} și ${n0(r.carbsFuel)} din ${nb(n0(r.carbsPlan), 'g')} carbo. Proteinele și grăsimile ${r.proteinSame && r.fatSame ? 'rămân neschimbate' : 'diferă'}.${ok ? '' : ' Diferența rămasă nu se mai recuperează, ca să nu încarce o singură zi.'}</p></section>`;
}

const weekName = (n: number) => (n === 0 ? 'Săptămâna asta' : n === 1 ? 'Săptămâna viitoare' : n === -1 ? 'Săptămâna trecută' : `Acum ${-n} săptămâni`);

function dayRow(d: FuelDay, p: DayPlan, today: string) {
  const s = ctx.get();
  const off = s.fuel.cancelled[d.date] ?? [];
  const real = p.planned.filter((x) => x.min > 0);
  const done = real.filter((x) => ['done', 'partial', 'changed'].includes(sessionStatus(x, p.done, d.date, today, off))).length;
  const names = real.filter((x) => !off.includes(x.id)).map((x) => x.name);
  const notes = [s.fuel.overrides[d.date] ? 'ales manual' : '', d.prefuel ? 'pre-fuel' : '', real.length ? `${done} din ${real.length} făcute` : ''].filter(Boolean).join(', ');
  return `<button class="dr ${d.demand} ${d.date === today ? 'now' : ''}" data-f="dd" data-v="${d.date}">
    <span class="dr-d"><small>${esc(dayShort(d.date))}</small><b>${Number(d.date.slice(8))}</b></span>
    <span class="dr-m"><b>${lvl(d.demand)}${CARB_LABEL[d.demand]}</b><small>${names.length ? esc(names.join(', ')) : 'Odihnă'}</small>${notes ? `<small>${esc(notes)}</small>` : ''}</span>
    <span class="dr-n"><b>${d.c}</b><small>g carbo</small></span>
  </button>`;
}

/** Bars for the plan with the ±15% band behind them; the short line is what was eaten. */
function chart(days: FuelDay[]) {
  const s = ctx.get();
  const today = ctx.today();
  const eaten = (d: string) => totals(dayMeals(s, d)).c;
  const max = Math.max(...days.map((d) => d.c * 1.15), ...days.map((d) => eaten(d.date)), 1);
  if (!days.some((d) => d.date === cv.pick)) cv.pick = days.find((d) => d.date === today)?.date ?? days[0]!.date;
  const fit = bandCount(days.filter((d) => d.date < today).map((d) => ({ eaten: eaten(d.date), target: d.c })));
  const picked = days.find((d) => d.date === cv.pick)!;
  const ate = eaten(picked.date);
  return `${fit.logged ? `<p class="lead-l"><b>${fit.inside} din ${fit.logged}</b> zile notate în intervalul de carbohidrați</p>` : ''}
  <div class="wchart">${days.map((d) => {
    const got = eaten(d.date);
    const on = d.date === cv.pick;
    const pos = (v: number) => `${((v / max) * 100).toFixed(1)}%`;
    return `<button class="wb ${d.demand} ${on ? 'on' : ''} ${d.date === today ? 'now' : ''}" data-f="wpick" data-v="${d.date}" aria-pressed="${on}" aria-label="${esc(dayShort(d.date))}, ${longDay(d.date)}, ${CARB_LABEL[d.demand]}, ${d.c} grame">
      <i class="wbar"><em style="bottom:${pos(d.c * 0.85)};height:${pos(d.c * 0.3)}"></em><u data-bar="wb-${d.date}" data-axis="y" data-to="${(d.c / max).toFixed(3)}"></u>${got > 0 ? `<s style="bottom:${pos(Math.min(got, max))}"></s>` : ''}</i>
      <span>${esc(dayShort(d.date))}</span></button>`;
  }).join('')}</div>
  <p class="wpick"><b class="cap">${esc(longDay(picked.date))}</b><span>${nb(picked.c, 'g')} carbo${ate > 0 ? `, mâncat ${nb(n0(ate), 'g')}` : ''}, ${nb(n0(picked.kcal), 'kcal')}</span></p>`;
}

export function weekView() {
  const today = ctx.today();
  const monday = addDays(mondayOf(today), cv.week * 7);
  const { days, plans } = fuelWeek(monday);
  return `<div class="wknav"><button class="ib" data-f="wk" data-v="-1" aria-label="Săptămâna anterioară" ${cv.week <= -12 ? 'disabled' : ''}>‹</button><div><b>${shortDate(monday)} – ${shortDate(addDays(monday, 6))}</b><span>${weekName(cv.week)}</span></div><button class="ib" data-f="wk" data-v="1" aria-label="Săptămâna următoare" ${cv.week >= 1 ? 'disabled' : ''}>›</button></div>
  ${chart(days)}
  <div class="list">${days.map((d) => dayRow(d, plans[d.date]!, today)).join('')}</div>
  ${weekSummary(days, plans)}`;
}

function analysis(p: DayPlan) {
  const lim = rules().limits;
  const top = Math.max(lim.high * 1.3, p.rating.load, 1);
  const pct = (v: number) => `${Math.min(100, (v / top) * 100).toFixed(1)}%`;
  return `<details class="card"><summary><b>Analiza cererii</b> <span class="hint">încărcare ${p.rating.load}</span></summary>
    ${p.rating.parts.length ? p.rating.parts.map((x) => `<div class="line"><span>${esc(x.name)}</span><b>${x.min} min × ${comma(x.intensity)}${x.rpe != null ? `, RPE ${x.rpe}` : ''} = ${Math.round(x.load)}</b></div>`).join('') : '<p class="hint">Nicio sesiune care să conteze.</p>'}
    <div class="thr"><div class="track"><div data-bar="an-t" data-to="${Math.min(1, p.rating.load / top)}"></div></div><i style="left:${pct(lim.moderate)}"></i><i style="left:${pct(lim.high)}"></i></div>
    <div class="thl"><span style="left:${pct(lim.moderate)}">Moderate ${Math.round(lim.moderate)}</span><span style="left:${pct(lim.high)}">High ${Math.round(lim.high)}</span></div>
    <p class="hint">Scorul e al aplicației: minute × intensitatea tipului de sesiune. E o estimare, nu o măsurare validată a nevoii de carbohidrați.</p></details>`;
}

function sportCard(demand: Demand, f: { p: number; c: number; f: number }) {
  const rows = sportRows(f, latestKg(), ctx.get().fuel.prefs.meals, demand);
  return `<details class="card"><summary><b>Repere sportive</b></summary>${rows.map((r) => `<div class="line"><span>${r.label}</span><b>${r.value}</b><em>${r.ref}</em></div>`).join('')}
    <p class="hint">Repere pentru sportivi la mențineri (ACSM 2016, ISSN), doar informative, nu ținte. În deficit carbohidrații stau normal sub interval: de aceea contează masa dinainte de antrenament.</p></details>`;
}

const RPE_WORDS: [number, string][] = [[3, 'ușor'], [5, 'moderat'], [7, 'greu'], [9, 'foarte greu']];

function feedbackCard(date: string) {
  const fb = ctx.get().fuel.feedback[date] ?? {};
  return `<details class="card"><summary><b>Cum a mers</b> <span class="hint">opțional</span></summary><p class="hint">1 e slab, 5 e bine. O notă nu schimbă singură nicio țintă.</p>
    ${FEEDBACK.map(([k, l]) => `<div class="fbk"><span>${l}</span><div>${[1, 2, 3, 4, 5].map((v) => `<button data-f="fb" data-d="${date}" data-k="${k}" data-v="${v}" class="${fb[k] === v ? 'on' : ''}" aria-pressed="${fb[k] === v}" aria-label="${l}: ${v}">${v}</button>`).join('')}</div></div>`).join('')}
    <label class="range"><span>Efort resimțit, de la 1 la 10</span><input type="range" min="1" max="10" id="frpe" data-d="${date}" value="${fb.rpe ?? 6}"><output>${fb.rpe ?? '–'}</output></label>
    <p class="hint">${RPE_WORDS.map(([n, w]) => `${n} ${w}`).join(', ')}.</p></details>`;
}

function mealStrip(date: string) {
  const sl = mealSlots(date);
  const f = dayFuel(date);
  return `<details class="card"><summary><b>Carbohidrați pe mese</b></summary><div class="mdist">${sl.times.map((t, i) => `<div class="${sl.tags[i] ? 'tr' : ''}" style="flex:${sl.shares[i]!.toFixed(3)} 1 0"><b>${Math.round(f.c * sl.shares[i]!)} g</b><i></i><span>${t}</span></div>`).join('')}</div>
    <p class="hint">Proteina se împarte egal. Mesele din jurul antrenamentului primesc mai mulți carbohidrați.</p></details>`;
}

/** One day in full: first what it is, then, on request, how its numbers were reached. */
export function dayDetail(date: string) {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const { days, plans } = fuelWeek(mondayOf(date), t);
  const d = days.find((x) => x.date === date)!;
  const p = plans[date]!;
  const off = s.fuel.cancelled[date] ?? [];
  const f = dayFuel(date);
  const eaten = totals(dayMeals(s, date));
  const tm = timingFor(date);
  const alts = picks(p.planned);
  const next = date === today ? nextSession(p, off) : null;
  const snap = s.fuel.snap[date];
  const planned: Demand = snap?.planned ?? p.plannedRating.demand;
  const hasActual = date <= today && p.done.length > 0;
  return `${cv.fromToday ? back('Azi', 'data-tab="azi"') : back('Săptămâna', 'data-f="dd" data-v=""')}
  <section class="cc ${d.demand} ${fx.recalc ? 'recalc' : ''}">
    <p class="cc-k cap">${esc(longDay(date))}${d.fixed ? ', încheiată' : ''}</p>
    <h1 class="klass">${CARB_LABEL[d.demand]}</h1>
    <p class="cc-why">${esc(p.rating.reason)}</p>
    ${flow(p, d.demand, f.kcal, f.c)}
    <div class="stats"><div><b>${n0(f.kcal)}</b><span>kcal</span></div><div><b>${f.p}</b><span>g proteine</span></div><div><b>${n0(f.c)}</b><span>g carbo</span></div><div><b>${f.f}</b><span>g grăsimi</span></div></div>
    ${eaten.kcal > 0 ? `<p class="hint">Mâncat: ${nb(n0(eaten.kcal), 'kcal')}, ${nb(n0(eaten.p), 'g')} proteine, ${nb(n0(eaten.c), 'g')} carbo, ${nb(n0(eaten.f), 'g')} grăsimi.</p>` : ''}
  </section>
  <section class="card"><h2>Antrenament</h2>
    ${p.planned.length ? `<ul class="sess">${p.planned.map((x) => sessionRow(x, p, date, today, next, off)).join('')}</ul>` : '<p class="hint">Fără antrenament planificat.</p>'}
    ${alts.length ? `<p class="hint">Alegeri: ${esc(alts.join('; '))}.</p>` : ''}
    ${date >= today && p.planned.length ? '<p class="hint">× anulează o sesiune: cererea și zilele rămase se recalculează.</p>' : ''}
    ${t.linked ? '' : '<p class="warn">Inner Beast nu a fost deschis în acest browser, așa că folosesc săptămâna standard Inner Beast, ca estimare.</p>'}
    <div class="line"><span>Planificat</span><b>${CARB_LABEL[planned]}</b></div>
    <div class="line"><span>Realizat</span><b>${hasActual ? `${CARB_LABEL[p.rating.demand]}, încărcare ${p.rating.load}` : date < today ? 'Nimic notat' : 'Încă nu'}</b></div>
    ${date < today ? '<p class="hint">Ce ai făcut nu rescrie ținta unei zile trecute și nu adaugă calorii.</p>' : ''}</section>
  ${tm.hasSession && (tm.pre || tm.post) ? `<section class="card"><h2>Mese</h2>
    ${tm.pre ? `<div class="line"><span>Înainte, ${tm.pre.mealTime}</span><b>${nb(tm.pre.c, 'g')} carbo, ${nb(tm.pre.p, 'g')} proteine</b></div>` : ''}
    <div class="line"><span>Antrenament</span><b>${tm.start}–${tm.end}</b></div>
    ${tm.post ? `<div class="line"><span>După, ${tm.post.mealTime}</span><b>${nb(tm.post.c, 'g')} carbo, ${nb(tm.post.p, 'g')} proteine</b></div>` : ''}
    <button class="ghost wide" data-f="tgo" data-v="${date}">Vezi timing-ul zilei</button></section>` : ''}
  ${analysis(p)}
  <details class="card"><summary><b>Cum s-a calculat</b></summary>
    <div class="line"><span>Carbohidrați din plan</span><b>${nb(d.planC, 'g')}</b></div>
    <div class="line"><span>Factor ${SHORT[d.demand]}${d.prefuel ? ', ridicat: mâine e HIGH' : ''}</span><b>${comma(d.prefuel ? Math.max(s.fuel.factors[d.demand], s.fuel.factors.moderate) : s.fuel.factors[d.demand])}</b></div>
    <div class="line"><span>După echilibrarea săptămânii</span><b>${nb(d.c, 'g')} (${d.shift > 0 ? '+' : ''}${d.shift})</b></div>
    <div class="line"><span>Calorii</span><b>${d.p}×4 + ${d.c}×4 + ${d.f}×9 = ${n0(d.kcal)}</b></div>
    <p class="hint">${s.fuel.cycling ? 'Se mută doar carbohidrații între zile. Proteina, grăsimile și caloriile săptămânii rămân cele din plan.' : 'Carb Cycling e oprit: ținta aplicată e cea din plan, cifrele de aici arată distribuția dacă îl pornești.'}</p></details>
  ${mealStrip(date)}
  ${sportCard(d.demand, f)}
  ${d.fixed ? '<p class="hint pad">Zi încheiată: ținta și mesele ei nu se mai schimbă.</p>' : `<details class="card"><summary><b>Schimbă clasa zilei</b>${s.fuel.overrides[date] ? ' <span class="hint">aleasă manual</span>' : ''}</summary><div class="seg small">${LEVELS.map((x) => `<button data-f="ov" data-d="${date}" data-v="${x}" class="${s.fuel.overrides[date] === x ? 'on' : ''}">${SHORT[x]}</button>`).join('')}</div>${s.fuel.overrides[date] ? `<button class="ghost wide" data-f="ov" data-d="${date}" data-v="">Revino la automat</button>` : ''}</details>`}
  ${date <= today && p.planned.length ? feedbackCard(date) : ''}`;
}

