/* The Weekly Fuel Calendar and the detail of one day. */
import { ctx, dayShort, esc, n0 } from '../app.ts';
import { reconcile, type FuelDay } from '../logic/carbs.ts';
import { FEEDBACK } from '../logic/insights.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { CARB_LABEL, DEMAND_LABEL, nextSession, picks, sessionStatus, type DayPlan, type Demand } from '../logic/training.ts';
import { cv, flow } from './carbs.ts';
import { comma, LEVELS, longDay, SHORT, sessionRow, shortDate } from './parts.ts';
import { dayFuel, fuelWeek, fx, rules, timingFor, training } from './state.ts';

export function weekCheck(days: FuelDay[]) {
  const r = reconcile(ctx.get().plan!, days);
  return { r, ok: r.kcalFuel === r.kcalPlan && r.carbsFuel === r.carbsPlan && r.proteinSame && r.fatSame };
}

/** The overview line: how the week is shared out and whether it adds up. */
export function weekSummary(days: FuelDay[], plans: Record<string, DayPlan>) {
  const { r, ok } = weekCheck(days);
  const done = days.reduce((a, d) => a + plans[d.date]!.done.length, 0);
  const all = days.reduce((a, d) => a + plans[d.date]!.planned.filter((x) => x.min > 0).length, 0);
  return `<section class="card wsum"><div class="wcount">${LEVELS.map((l) => `<div class="${l}"><b>${days.filter((d) => d.demand === l).length}</b><span>${SHORT[l]}</span></div>`).join('')}<div><b>${done}<small>/${all}</small></b><span>Sesiuni</span></div></div>
    <p class="recon ${ok ? 'ok' : ''}">Săptămâna: ${n0(r.kcalFuel)} din ${n0(r.kcalPlan)} kcal și ${n0(r.carbsFuel)} din ${n0(r.carbsPlan)} g carbo. Proteine și grăsimi ${r.proteinSame && r.fatSame ? 'neschimbate' : 'diferite'}.${ok ? '' : ' Diferența rămasă nu se mai recuperează, ca să nu încarce o singură zi.'}</p></section>`;
}

const weekName = (n: number) => (n === 0 ? 'Săptămâna curentă' : n === 1 ? 'Săptămâna viitoare' : n === -1 ? 'Săptămâna trecută' : `Acum ${-n} săptămâni`);

function dayRow(d: FuelDay, p: DayPlan, today: string, i: number) {
  const s = ctx.get();
  const off = s.fuel.cancelled[d.date] ?? [];
  const real = p.planned.filter((x) => x.min > 0);
  const done = real.filter((x) => ['done', 'partial', 'changed'].includes(sessionStatus(x, p.done, d.date, today, off))).length;
  const names = real.filter((x) => !off.includes(x.id)).map((x) => x.name);
  const alts = picks(p.planned);
  return `<button class="dr ${d.demand} ${d.date === today ? 'now' : ''}" data-f="dd" data-v="${d.date}" style="--i:${i}">
    <span class="dr-d"><small>${esc(dayShort(d.date))}</small><b>${Number(d.date.slice(8))}</b></span>
    <span class="dr-m"><b>${names.length ? esc(names.join(' + ')) : 'Odihnă'}</b>${alts.length ? `<small>${esc(alts.join('; '))}</small>` : ''}
      <span class="dr-t"><i class="dm ${d.demand}">${DEMAND_LABEL[d.demand]}</i><i class="dm ${d.demand}">${CARB_LABEL[d.demand]}</i>${s.fuel.overrides[d.date] ? '<i class="dm">Manual</i>' : ''}</span>
      <small class="dr-n"><b>${n0(d.kcal)} kcal</b> · P ${d.p} · C ${d.c} · G ${d.f}${real.length ? ` · ${done}/${real.length} făcute` : ''}</small></span>
  </button>`;
}

function chart(days: FuelDay[]) {
  const s = ctx.get();
  const today = ctx.today();
  const eaten = (d: string) => totals(dayMeals(s, d)).c;
  const max = Math.max(...days.map((d) => d.c), ...days.map((d) => eaten(d.date)), 1);
  if (!days.some((d) => d.date === cv.pick)) cv.pick = days.find((d) => d.date === today)?.date ?? days[0]!.date;
  return `<div class="wchart">${days.map((d, i) => {
    const ate = eaten(d.date);
    const on = d.date === cv.pick;
    return `<button class="wb ${d.demand} ${on ? 'on' : ''} ${d.date === today ? 'now' : ''}" data-f="wpick" data-v="${d.date}" aria-pressed="${on}" aria-label="${esc(longDay(d.date))}, ${CARB_LABEL[d.demand]}, ${d.c} grame carbohidrați" style="--i:${i}">
      ${on ? `<span class="tip ${i > 4 ? 'r' : i < 2 ? 'l' : ''}"><b>${d.c} g carbo</b>${n0(d.kcal)} kcal${ate > 0 ? `<br>mâncat ${n0(ate)} g` : ''}</span>` : ''}
      <i class="wbar"><u data-bar="wb-${i}" data-axis="y" data-to="${d.c / max}"></u>${ate > 0 ? `<s style="bottom:${Math.min(100, (ate / max) * 100)}%"></s>` : ''}</i>
      <span>${esc(dayShort(d.date))}</span></button>`;
  }).join('')}</div><p class="hint">Barele arată ținta de carbohidrați, linia subțire ce ai mâncat. Atinge o bară pentru cifre, o zi din listă pentru detalii.</p>`;
}

export function weekView() {
  const s = ctx.get();
  const today = ctx.today();
  const monday = addDays(mondayOf(today), cv.week * 7);
  const { days, plans } = fuelWeek(monday);
  const slide = cv.dir ? (cv.dir > 0 ? 'sl' : 'sr') : '';
  cv.dir = 0;
  return `<div class="wknav"><button data-f="wk" data-v="-1" aria-label="Săptămâna anterioară" ${cv.week <= -12 ? 'disabled' : ''}>‹</button><div><b>${shortDate(monday)} – ${shortDate(addDays(monday, 6))}</b><span>${weekName(cv.week)}</span></div><button data-f="wk" data-v="1" aria-label="Săptămâna următoare" ${cv.week >= 1 ? 'disabled' : ''}>›</button></div>
  <div class="seg small"><button data-f="cmode" data-v="auto" class="${s.fuel.mode === 'auto' ? 'on' : ''}">Clasificare automată</button><button data-f="cmode" data-v="manual" class="${s.fuel.mode === 'manual' ? 'on' : ''}">Manuală</button></div>
  <div class="wk ${slide}">${chart(days)}${days.map((d, i) => dayRow(d, plans[d.date]!, today, i)).join('')}</div>
  ${weekSummary(days, plans)}`;
}

function analysis(p: DayPlan) {
  const lim = rules().limits;
  const top = Math.max(lim.high * 1.3, p.rating.load, 1);
  const pct = (v: number) => `${Math.min(100, (v / top) * 100).toFixed(1)}%`;
  return `<section class="card"><h2>Analiza cererii</h2>
    ${p.rating.parts.length ? p.rating.parts.map((x) => `<div class="an"><div><span>${esc(x.name)}</span><b>${x.min} min × ${comma(x.intensity)}${x.rpe != null ? `, RPE ${x.rpe}` : ''} = ${Math.round(x.load)}</b></div></div>`).join('') : '<p class="hint">Nicio sesiune care să conteze.</p>'}
    <div class="thr"><div class="track big"><div data-bar="an-t" data-to="${Math.min(1, p.rating.load / top)}"></div></div><i style="left:${pct(lim.moderate)}"></i><i style="left:${pct(lim.high)}"></i></div>
    <div class="thl"><span style="left:${pct(lim.moderate)}">MOD ${Math.round(lim.moderate)}</span><span style="left:${pct(lim.high)}">HIGH ${Math.round(lim.high)}</span></div>
    <p class="hint">Încărcare ${p.rating.load}. Scorul e al aplicației: minute × intensitatea tipului de sesiune. E o estimare, nu o măsurare validată a nevoii de carbohidrați.</p></section>`;
}

function feedbackCard(date: string) {
  const fb = ctx.get().fuel.feedback[date] ?? {};
  return `<section class="card"><h2>Cum a mers</h2><p class="hint">Opțional, 5 e bine. O notă nu schimbă singură nicio țintă.</p>
    ${FEEDBACK.map(([k, l]) => `<div class="fbk"><span>${l}</span><div>${[1, 2, 3, 4, 5].map((v) => `<button data-f="fb" data-d="${date}" data-k="${k}" data-v="${v}" class="${fb[k] === v ? 'on' : ''}" aria-pressed="${fb[k] === v}" aria-label="${l}: ${v}">${v}</button>`).join('')}</div></div>`).join('')}
    <label class="range"><span>RPE, efort resimțit</span><input type="range" min="1" max="10" id="frpe" data-d="${date}" value="${fb.rpe ?? 6}"><output>${fb.rpe ?? '–'}</output></label></section>`;
}

/** One day in full: what decided its class and how its numbers were reached. */
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
  return `<button class="backbtn" data-f="dd" data-v="">‹ Înapoi</button>
  <section class="cc ${d.demand} dd ${fx.recalc ? 'recalc' : ''}"><i class="cc-sweep"></i>
    <p class="cc-k"><span>${esc(longDay(date))}</span><b>${d.fixed ? 'Zi încheiată' : date === today ? 'Azi' : 'Planificat'}</b></p>
    <h1 class="cc-class small"><span>${CARB_LABEL[d.demand].split(' ')[0]}</span>${CARB_LABEL[d.demand].split(' ')[1] ? ` ${CARB_LABEL[d.demand].split(' ')[1]}` : ''}</h1>
    <p class="cc-why">${esc(p.rating.reason)}</p>
    ${flow(p, d.demand, f.kcal, f.c)}
    <div class="stats"><div><b data-count="dd-k" data-to="${f.kcal}">${n0(f.kcal)}</b><span>kcal</span></div><div><b>${f.p}</b><span>g proteine</span></div><div><b data-count="dd-c" data-to="${f.c}">${n0(f.c)}</b><span>g carbo</span></div><div><b>${f.f}</b><span>g grăsimi</span></div></div>
    ${eaten.kcal > 0 ? `<p class="hint">Mâncat: ${n0(eaten.kcal)} kcal · P ${n0(eaten.p)} · C ${n0(eaten.c)} · G ${n0(eaten.f)}</p>` : ''}
  </section>
  <section class="card"><h2>Antrenament</h2>
    ${p.planned.length ? `<ul class="sess">${p.planned.map((x) => sessionRow(x, p, date, today, next, off)).join('')}</ul>` : '<p class="hint">Fără antrenament planificat.</p>'}
    ${alts.length ? `<p class="hint">Alegeri: ${esc(alts.join('; '))}.</p>` : ''}
    ${date >= today && p.planned.length ? '<p class="hint">× anulează o sesiune: cererea și zilele rămase se recalculează.</p>' : ''}
    <div class="line"><span>Planificat</span><b>${CARB_LABEL[planned]}</b></div>
    <div class="line"><span>Realizat</span><b>${hasActual ? `${CARB_LABEL[p.rating.demand]}, încărcare ${p.rating.load}` : date < today ? 'Nimic notat' : 'Încă nu'}</b></div>
    ${date < today ? '<p class="hint">Ce ai făcut nu rescrie ținta unei zile trecute și nu adaugă calorii.</p>' : ''}</section>
  ${analysis(p)}
  <section class="card"><h2>Cum s-a calculat</h2>
    <div class="line"><span>Carbo din plan</span><b>${d.planC} g</b></div>
    <div class="line"><span>Factor ${SHORT[d.demand]}</span><b>${comma(s.fuel.factors[d.demand])}</b></div>
    <div class="line"><span>După echilibrarea săptămânii</span><b>${d.c} g (${d.shift > 0 ? '+' : ''}${d.shift})</b></div>
    <div class="line"><span>Calorii</span><b>${d.p}×4 + ${d.c}×4 + ${d.f}×9 = ${n0(d.kcal)}</b></div>
    <p class="hint">${s.fuel.cycling ? 'Se mută doar carbohidrații între zile. Proteina, grăsimile și caloriile săptămânii rămân cele din plan.' : 'Carb Cycling e oprit: ținta aplicată e cea din plan, cifrele de aici arată distribuția dacă îl pornești.'}</p></section>
  ${tm.hasSession && (tm.pre || tm.post) ? `<section class="card"><h2>Mese</h2>
    ${tm.pre ? `<div class="line"><span>Înainte, ${tm.pre.mealTime}</span><b>P ${tm.pre.p} · C ${tm.pre.c} · G ${tm.pre.f}</b></div>` : ''}
    <div class="line"><span>Antrenament</span><b>${tm.start}–${tm.end}</b></div>
    ${tm.post ? `<div class="line"><span>După, ${tm.post.mealTime}</span><b>P ${tm.post.p} · C ${tm.post.c} · G ${tm.post.f}</b></div>` : ''}
    <button class="ghost wide" data-f="tgo" data-v="${date}">Nutrient timing</button></section>` : ''}
  ${d.fixed ? '<p class="hint pad">Zi încheiată: ținta și mesele ei nu se mai schimbă.</p>' : `<section class="card"><h2>Clasă manuală</h2><div class="seg small">${LEVELS.map((x) => `<button data-f="ov" data-d="${date}" data-v="${x}" class="${s.fuel.overrides[date] === x ? 'on' : ''}">${SHORT[x]}</button>`).join('')}</div>${s.fuel.overrides[date] ? `<button class="backbtn" data-f="ov" data-d="${date}" data-v="">Revino la automat</button>` : ''}</section>`}
  ${date <= today && p.planned.length ? feedbackCard(date) : ''}`;
}
