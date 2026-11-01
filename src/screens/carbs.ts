/* Carb Cycling: today's strategy first, the rest one tap away. */
import { ctx, esc, n0 } from '../app.ts';
import { mondayOf } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import type { Timing } from '../logic/timing.ts';
import { CARB_LABEL, DEMAND_LABEL, nextSession, picks, type DayPlan, type Demand } from '../logic/training.ts';
import { configView, insightsView, timingView } from './carbmore.ts';
import { dayDetail, weekSummary, weekView } from './carbweek.ts';
import { back, longDay, macroTile, sessionRow } from './parts.ts';
import { dayFuel, fuelWeek, fx, mealSlots, notice, timingFor, training } from './state.ts';

export type View = 'today' | 'week' | 'timing' | 'insights' | 'config';
const TABS: [View, string][] = [['today', 'Azi'], ['week', 'Săptămâna'], ['timing', 'Timing'], ['insights', 'Insights'], ['config', 'Setări']];

/** Where the user is inside Carb Cycling. `dir` slides the week the way it was changed. */
export const cv = { view: 'today' as View, detail: '', week: 0, pick: '', tday: '', dir: 0, fresh: false };
let lastClass = '';

export function openCarbs(view: View) { cv.view = view; cv.detail = ''; cv.fresh = true; }

/** WORKOUT → DEMAND → CLASS → TARGETS: how the day came to be what it is. */
export function flow(p: DayPlan, demand: Demand, kcal: number, c: number) {
  const names = p.planned.filter((x) => x.min > 0).map((x) => x.name);
  const work = names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}` : 'Odihnă';
  const [level = ''] = DEMAND_LABEL[demand].split(' ');
  return `<ol class="flow" aria-label="De la antrenament la ținte"><li><span>Antrenament</span><b>${esc(work)}</b></li><li><span>Cerere</span><b>${level}${p.rating.load ? ` · ${p.rating.load}` : ''}</b></li><li><span>Clasă</span><b>${CARB_LABEL[demand]}</b></li><li><span>Ținte</span><b>${n0(kcal)} kcal · ${c} g</b></li></ol>`;
}

function hero(demand: Demand, p: DayPlan, prefuel: boolean) {
  const s = ctx.get();
  const today = ctx.today();
  const f = dayFuel(today);
  const eaten = totals(dayMeals(s, today));
  const left = f.kcal - eaten.kcal;
  const flip = lastClass && lastClass !== demand;
  lastClass = demand;
  const [a, b] = CARB_LABEL[demand].split(' ');
  const basis = p.basis === 'manual' ? 'Ales de tine.' : p.done.length ? 'Din ce ai făcut azi și ce mai e în plan.' : 'Estimare din planul de azi.';
  return `<section class="cc ${demand} ${flip ? 'flip' : ''} ${fx.recalc ? 'recalc' : ''}"><i class="cc-sweep"></i>
    <p class="cc-k"><span>Today's Fuel Strategy</span><b>${esc(longDay(today))}</b></p>
    <h1 class="cc-class"><span>${a}</span>${b ? ` ${b}` : ''}</h1>
    <p class="cc-why">${esc(p.rating.reason)} ${basis}${prefuel ? ' Mâine e o zi HIGH, așa că azi primești o porție moderată de carbohidrați.' : ''}</p>
    ${flow(p, demand, f.kcal, f.c)}
    <div class="cc-kcal"><div><b data-count="cc-k" data-to="${f.kcal}">${n0(f.kcal)}</b><span>kcal țintă</span></div><div class="cc-left"><b data-count="cc-e" data-to="${Math.round(eaten.kcal)}">${n0(eaten.kcal)}</b><span>mâncat</span></div><div class="cc-left"><b class="${left < 0 ? 'over' : ''}" data-count="cc-l" data-to="${Math.abs(Math.round(left))}">${n0(Math.abs(left))}</b><span>${left < 0 ? 'peste' : 'rămas'}</span></div></div>
    <div class="mcs">${macroTile('Proteine', 'cc-p', f.p, eaten.p)}${macroTile('Carbo', 'cc-c', f.c, eaten.c)}${macroTile('Grăsimi', 'cc-f', f.f, eaten.f)}</div>
  </section>`;
}

function timingStrip(t: Timing, demand: Demand) {
  if (!t.hasSession) return '';
  const node = (cls: string, label: string, value: string, sub: string) => `<span class="tn ${cls}"><i></i><small>${label}</small><b>${value}</b><em>${sub}</em></span>`;
  return `<button class="tstrip ${demand}" data-f="cv" data-v="timing" aria-label="Deschide nutrient timing">
    ${node('pre', 'Înainte', t.pre?.mealTime ?? '–', t.pre ? `C ${t.pre.c} · P ${t.pre.p}` : 'fără masă')}
    ${node('ses', 'Antrenament', t.start, `${t.minutes} min`)}
    ${node('post', 'După', t.post?.mealTime ?? '–', t.post ? `C ${t.post.c} · P ${t.post.p}` : 'fără masă')}
  </button>`;
}

function mealStrip(date: string) {
  const sl = mealSlots(date);
  const f = dayFuel(date);
  return `<section class="card"><h2>Distribuția pe mese</h2><div class="mdist">${sl.times.map((t, i) => `<div class="${sl.tags[i] ? 'tr' : ''}" style="flex:${sl.shares[i]!.toFixed(3)} 1 0"><b>${Math.round(f.c * sl.shares[i]!)} g</b><i></i><span>${t}</span></div>`).join('')}</div>
    <p class="hint">Carbohidrați pe masă. Proteina și grăsimile se împart egal.</p></section>`;
}

function todayView() {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const { days, plans } = fuelWeek(mondayOf(today), t);
  const day = days.find((d) => d.date === today)!;
  const p = plans[today]!;
  const off = s.fuel.cancelled[today] ?? [];
  const next = nextSession(p, off);
  const alts = picks(p.planned);
  return `${hero(day.demand, p, day.prefuel)}
  ${notice.text ? `<p class="updated">${esc(notice.text)}</p>` : ''}
  ${s.fuel.cycling ? '' : `<section class="card"><label class="switch"><input type="checkbox" id="cyc"><i></i><span>Folosește distribuția în ținta zilnică</span></label><p class="hint">Oprit: ținta rămâne cea din plan. Pornit, azi ai avea ${day.c} g carbo.</p></section>`}
  ${timingStrip(timingFor(today), day.demand)}
  <section class="card"><div class="ch"><h2>Sesiunea de azi</h2><button class="lnk" data-f="dd" data-v="${today}">De ce această clasă</button></div>
    ${p.planned.length ? `<ul class="sess">${p.planned.map((x) => sessionRow(x, p, today, today, next, off)).join('')}</ul>` : '<p class="hint">Zi fără antrenament planificat.</p>'}
    ${alts.length ? `<p class="hint">Alegerile tale: ${esc(alts.join('; '))}.</p>` : ''}
    ${t.linked ? '' : '<p class="warn">Inner Beast nu a fost deschis în acest browser: folosesc planul standard din carte, ca estimare.</p>'}</section>
  ${mealStrip(today)}
  ${weekSummary(days, plans)}`;
}

export function carbsHtml() {
  if (cv.detail) return dayDetail(cv.detail);
  const views: Record<View, () => string> = { today: todayView, week: weekView, timing: timingView, insights: insightsView, config: configView };
  const fresh = cv.fresh;
  cv.fresh = false;
  return `${back()}<nav class="cnav" aria-label="Carb Cycling">${TABS.map(([k, l]) => `<button data-f="cv" data-v="${k}" class="${cv.view === k ? 'on' : ''}" ${cv.view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>
  <div class="cv ${fresh ? 'in' : ''}">${views[cv.view]()}</div>`;
}
