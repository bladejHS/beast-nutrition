/* Azi: what kind of day this is, what is left, what comes next. Read in a hurry, often in a gym. */
import { ctx, dayLong, esc, n0, n1, nb, nowMinutes, nowTime } from '../app.ts';
import type { DayTarget } from '../logic/calc.ts';
import type { Meal } from '../logic/mealplan.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { dayMeals, MEALS, totals, type Entry } from '../logic/store.ts';
import { mealGoal } from '../logic/timing.ts';
import { dayRows, nextMeal } from '../logic/today.ts';
import { CARB_LABEL, type Demand } from '../logic/training.ts';
import { waterTarget } from '../logic/wellness.ts';
import { fastChip } from './fast.ts';
import { eatPlanned, generateToday, uneatPlanned, waterOn } from './fuel.ts';
import { openAdd } from './log.ts';
import { icon, lvl } from './parts.ts';
import { dayFuel, fuelWeek, latestKg, loadPantry, mealSlots, notice, pantry, sessionsOn, timingFor, training } from './state.ts';
import { openWeigh } from './body.ts';
import { glp1Card } from './glp1.ts';

let date = '';
let seen = '';
const openRows = new Set<string>();
/** The meal the card shows when the user steps away from the next one (‹ ›); null follows the next meal. */
let pick: { date: string; i: number } | null = null;
/** Which way the meal card slides after ‹ ›, for one render. */
let slide = '';

export const currentDate = () => date || (date = ctx.today());

/** An app left open overnight: whoever was on today stays on today. True when the screen must change. */
export function followToday(): boolean {
  const now = ctx.today();
  const moved = !!seen && seen !== now && date === seen;
  if (moved) date = now;
  seen = now;
  return moved;
}

const dayTitle = (d: string) => {
  const today = ctx.today();
  const prefix = d === today ? 'Azi, ' : d === addDays(today, 1) ? 'Mâine, ' : d === addDays(today, -1) ? 'Ieri, ' : '';
  return `${prefix}${esc(dayLong(d))}`;
};

const demandOn = (d: string): Demand | null => {
  const s = ctx.get();
  return s.fuel.cycling ? fuelWeek(mondayOf(d)).days.find((x) => x.date === d)?.demand ?? null : null;
};

/** The class of the day, and in one breath the training behind it. */
function hero(d: string, t: DayTarget) {
  const s = ctx.get();
  const demand = demandOn(d);
  const tm = timingFor(d);
  const real = sessionsOn(d, training());
  const names = real.map((x) => x.name);
  const prefuel = s.fuel.cycling && fuelWeek(mondayOf(d)).days.find((x) => x.date === d)?.prefuel;
  const cls = demand ?? 'rest';
  return `<button class="hero ${cls}" data-f="dayopen" data-v="${d}">
    <span class="hero-k"><span class="klass">${demand ? CARB_LABEL[demand] : esc(t.label)}</span>${demand ? lvl(demand) : ''}</span>
    <span class="hero-w">${tm.hasSession ? `${esc(names.join(', '))}. ${tm.minutes} min, de la ${tm.start}.` : 'Fără antrenament.'}${prefuel ? ' Mâine e zi HIGH, așa că azi ai o porție moderată de carbohidrați.' : ''}</span>
  </button>${fastChip(d)}`;
}

/** One macro: its name, the grams counting up, the target, a bar that runs 20 % past it so going over shows. */
function macro(key: string, label: string, val: number, target: number) {
  return `<div class="mc ${key}"><div class="mc-h"><span>${label}</span><b><span data-count="az-${key}" data-to="${Math.round(val)}">${n0(val)}</span><small> / ${n0(target)} g</small></b></div>
    <div class="bl-t"><div data-bar="az-${key}" data-to="${Math.min(1, val / (target * 1.2 || 1)).toFixed(3)}"></div><i></i></div></div>`;
}

/** The day's fuel: the calories left in a ring that fills as the day is eaten, the three macros beside it. */
function numbers(t: DayTarget, sum: ReturnType<typeof totals>) {
  const left = t.kcal - sum.kcal;
  const fill = Math.min(1, sum.kcal / (t.kcal || 1));
  const state = left < -50 ? 'over' : Math.abs(left) <= t.kcal * 0.05 && sum.kcal > 0 ? 'hit' : '';
  return `<section class="dash ${state}">
    <div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rt" cx="60" cy="60" r="52"/><circle class="rv" cx="60" cy="60" r="52" pathLength="100" data-ring="az-k" data-to="${fill.toFixed(3)}"/></svg>
      <div class="ring-in"><b data-count="az-left" data-to="${Math.round(Math.abs(left))}">${n0(Math.abs(left))}</b><span>kcal ${left < 0 ? 'peste' : 'rămase'}</span><em>din ${n0(t.kcal)}</em></div></div>
    <div class="macros">${macro('p', 'Proteine', sum.p, t.p)}${macro('c', 'Carbo', sum.c, t.c)}${macro('f', 'Grăsimi', sum.f, t.f)}
      <p class="fib">Fibre <b>${n0(sum.fiber)}</b> din ${nb(`${t.fiberMin}–${t.fiberMax}`, 'g')}</p></div>
    ${left < -50 ? '<p class="coach">Nu e un eșec și nu trebuie compensat cu foame. Contează media săptămânii, continui normal de la masa următoare.</p>' : ''}
  </section>`;
}

interface Slot { key: string; i: number; time: string; title: string; tag: string; goal: ReturnType<typeof mealGoal> | null; meal: Meal | null; mi: number }

/** The day's meals: the planned ones when a plan exists, otherwise the empty slots with their targets. */
function slotsOf(d: string, t: DayTarget): Slot[] {
  const s = ctx.get();
  const sl = mealSlots(d);
  const n = sl.times.length;
  const plan = s.fuel.plan[d] ?? [];
  const goal = (i: number) => (i < n ? mealGoal(t, n, i, sl.shares, sl.fatShares) : null);
  const rows: Slot[] = plan.length
    ? plan.map((m, mi) => ({ key: m.id, i: Math.min(mi, MEALS.length - 1), time: m.time || sl.times[mi] || '', title: m.name, tag: m.tag, goal: m.snack ? null : goal(mi), meal: m, mi }))
    : sl.times.map((time, i) => ({ key: `s${i}`, i, time, title: MEALS[i]!, tag: sl.tags[i] ?? '', goal: goal(i), meal: null, mi: -1 }));
  // Food logged in a slot the day no longer shows must not disappear.
  dayMeals(s, d).forEach((list, i) => { if (list.length && !rows.some((r) => r.i === i)) rows.push({ key: `s${i}`, i, time: sl.times[i] ?? rows.at(-1)?.time ?? '', title: MEALS[i]!, tag: '', goal: null, meal: null, mi: -1 }); });
  return rows.sort((a, b) => a.time.localeCompare(b.time));
}

const grams = (m: Meal) => m.items.map((it) => `${nb(n0(it.g), 'g')} ${esc(pantry.map.get(it.foodId)?.name ?? '')}`).join(', ');

/** The card's header: what it shows, and ‹ › to step to the meal before or after it. */
function cardHead(title: string, i: number | null, count: number, away: boolean) {
  const at = i ?? count;
  return `<div class="nc-h"><h2>${title}</h2>${away ? '<button class="lnk" data-az="mnow">Înapoi la ce urmează</button>' : ''}
    <button class="ib" data-az="mprev" aria-label="Masa anterioară" ${at > 0 ? '' : 'disabled'}>‹</button><button class="ib" data-az="mnext" aria-label="Masa următoare" ${i != null && i < count - 1 ? '' : 'disabled'}>›</button></div>`;
}

/** The meal card: the next meal, or the one the user stepped to. An eaten planned meal can be taken back out. */
function nextCard(d: string, slots: Slot[], shown: number | null, next: number | null) {
  const s = ctx.get();
  const slot = shown == null ? null : slots[shown] ?? null;
  if (!slot) {
    const tomorrow = addDays(d, 1);
    const f = dayFuel(tomorrow);
    const dem = demandOn(tomorrow);
    return `<section class="nextc">${cardHead('Ziua e completă', null, slots.length, false)}<p>Mâine: ${dem ? `${CARB_LABEL[dem]}, ` : ''}${nb(n0(f.kcal), 'kcal')}, ${nb(f.c, 'g')} carbohidrați.</p><button class="ghost wide" data-day="1">Vezi ziua de mâine</button></section>`;
  }
  const m = slot.meal;
  const g = slot.goal;
  const logged = dayMeals(s, d)[slot.i]!.length > 0 || !!m?.done;
  const title = shown === next ? 'Urmează' : logged ? 'Mâncat' : next == null || shown! < next ? 'Mai devreme' : 'Mai târziu';
  const acts = m && !m.done
    ? `<button class="primary" data-az="eat" data-m="${slot.mi}">Am mâncat</button><button class="ghost" data-add="${slot.i}">Altceva</button>`
    : m?.done
      ? `<button class="ghost" data-az="uneat" data-m="${slot.mi}">Scoate din jurnal</button><button class="ghost" data-add="${slot.i}">Adaugă încă ceva</button>`
      : `<button class="primary" data-add="${slot.i}">${logged ? 'Adaugă încă ceva' : 'Adaugă mâncare'}</button>${(s.fuel.plan[d] ?? []).length ? '' : '<button class="ghost" data-az="gen">Generează mesele</button>'}`;
  const dir = slide; slide = '';
  return `<section class="nextc${logged ? ' ate' : ''}${dir ? ` slide-${dir}` : ''}">${cardHead(title, shown, slots.length, shown !== next && next != null)}
    <div class="next-m"><b class="t">${esc(slot.time)}</b><div><b>${esc(slot.title)}</b>${slot.tag ? `<small>${esc(slot.tag)}</small>` : ''}</div></div>
    ${g ? `<p class="next-g">${nb(g.c, 'g')} carbo, ${nb(g.p, 'g')} proteine, ${nb(g.f, 'g')} grăsimi</p>` : ''}
    ${m && pantry.foods.length ? `<p class="hint">${grams(m)}</p>` : ''}
    <div class="btns">${acts}</div></section>`;
}

function entryRow(e: Entry, i: number) {
  // an entry brought from MyFitnessPal has no weight, only the meal's totals
  return `<div class="entry"><div><b>${esc(e.name)}</b><small>${e.g ? `${nb(n0(e.g), 'g')}, ` : ''}${nb(n0(e.kcal), 'kcal')}, ${nb(n0(e.p), 'g')} proteine</small></div><button class="xs" data-del="${i}:${e.id}" aria-label="Șterge ${esc(e.name)}">×</button></div>`;
}

function mealRow(x: Slot, list: Entry[], isNext: boolean) {
  const sum = totals([list]);
  const sub = x.tag ? `<small>${esc(x.tag)}</small>` : '';
  if (!list.length) {
    return `<li class="r ${isNext ? 'next' : ''}"><button class="r-b" data-add="${x.i}"><span class="sr">Adaugă la</span><span class="t">${esc(x.time)}</span><span class="b"><b>${esc(x.title)}</b>${sub}</span><span class="k">${x.goal ? `${n0(x.goal.kcal)}<small>kcal</small>` : ''}</span><i class="plus" aria-hidden="true"></i></button></li>`;
  }
  return `<li class="r done"><details data-row="${x.key}" ${openRows.has(x.key) ? 'open' : ''}><summary class="r-b"><span class="t">${esc(x.time)}</span><span class="b"><b>${esc(x.title)}</b>${sub}</span><span class="k">${n0(sum.kcal)}<small>kcal</small></span><span class="ok" aria-label="Mâncat">${icon('check')}</span><i class="chev" aria-hidden="true"></i></summary>
    ${list.map((e) => entryRow(e, x.i)).join('')}<button class="ghost wide" data-add="${x.i}">Adaugă la ${esc(x.title)}</button>${x.meal?.done ? `<button class="ghost wide" data-az="uneat" data-m="${x.mi}">Scoate ${esc(x.title)} din jurnal</button>` : ''}</details></li>`;
}

function dayList(d: string, slots: Slot[], next: Slot | null) {
  const s = ctx.get();
  const journal = dayMeals(s, d);
  const tm = timingFor(d);
  const rows = dayRows(slots.map((x) => x.time), tm.hasSession ? { start: tm.start, end: tm.end } : null, d === ctx.today() ? nowTime() : null);
  return `<ol class="daylist">${rows.map((r, k) => {
    if (r.kind === 'now') return `<li class="r nowm"><span>acum, ${esc(r.time)}</span></li>`;
    if (r.kind === 'train') return `<li class="r tr"><button class="r-b" data-f="dayopen" data-v="${d}"><span class="t">${esc(r.time)}</span><span class="b"><b>Antrenament</b><small>până la ${esc(r.end)}, ${tm.minutes} min</small></span><i class="chev" aria-hidden="true"></i></button></li>`;
    const x = slots[r.i]!;
    return mealRow(x, journal[x.i] ?? [], x === next).replace('<li class="r ', `<li style="--i:${k}" class="r `);
  }).join('')}</ol>`;
}

/** Calories of the finished days of this week against what the plan gave them. Today is never counted half done. */
function weekBank() {
  const s = ctx.get();
  const today = ctx.today();
  const start = mondayOf(today);
  let planned = 0, eaten = 0, logged = 0;
  for (let d = start; d < today; d = addDays(d, 1)) {
    const k = totals(dayMeals(s, d)).kcal;
    if (k > 0) { planned += dayFuel(d).kcal; eaten += k; logged++; }
  }
  return { planned, eaten, logged };
}

/** Three things done in one tap, right under the numbers: a glass of water, the weighing, food. */
function quick(d: string, addTo: number) {
  const s = ctx.get();
  if (d !== ctx.today()) return '';
  const lastKg = latestKg();
  const water = waterOn(d), wt = waterTarget(lastKg, s.waterMlKg);
  const weighed = s.weights[d] != null;
  return `<div class="quick">
    <button class="qk" data-f="drink" data-v="250"><span class="qk-ic" data-k="water">${icon('water')}</span><b><span data-count="az-water" data-fmt="1" data-to="${(water / 1000).toFixed(1)}">${n1(water / 1000)}</span><small>/${n1(wt / 1000)} L</small></b><small>+250 ml</small><i class="fbar"><u data-bar="az-w" data-to="${Math.min(1, water / wt).toFixed(3)}"></u></i></button>
    <button class="qk ${weighed ? 'done' : ''}" data-az="weigh"><span class="qk-ic" data-k="scale">${icon(weighed ? 'check' : 'scale')}</span><b>${n1(weighed ? s.weights[d]! : lastKg)}<small> kg</small></b><small>${weighed ? 'Cântărit azi' : 'Cântărește-te'}</small></button>
    <button class="qk" data-add="${addTo}"><span class="qk-ic" data-k="plus">${icon('plus')}</span><b>Adaugă</b><small>mâncare</small></button>
  </div>`;
}

function weekRow(d: string) {
  if (d !== ctx.today()) return '';
  const bank = weekBank();
  return bank.logged ? `<div class="list"><div class="row"><span><b>Media săptămânii</b><small>${bank.logged} ${bank.logged === 1 ? 'zi încheiată' : 'zile încheiate'}</small></span><em>${nb(n0(bank.eaten / bank.logged), 'kcal')}<small>din ${n0(bank.planned / bank.logged)}</small></em></div></div>` : '';
}

export function todayHtml() {
  const s = ctx.get();
  const d = currentDate();
  const today = ctx.today();
  const t = dayFuel(d);
  const journal = dayMeals(s, d);
  const sum = totals(journal);
  const slots = slotsOf(d, t);
  const logged = slots.map((x) => journal[x.i]!.length > 0 || !!x.meal?.done);
  const idx = d === today ? nextMeal(logged, slots.map((x) => x.time), nowMinutes()) : -1;
  const next = idx != null && idx >= 0 ? slots[idx]! : null;
  if (pick && (pick.date !== d || pick.i >= slots.length)) pick = null;
  const shown = pick ? pick.i : idx != null && idx >= 0 ? idx : null;
  if (s.fuel.plan[d]?.length && !pantry.foods.length) void loadPantry().then(() => ctx.render()).catch(() => { /* the meals still show, without their foods */ });
  const yesterday = dayMeals(s, addDays(d, -1)).flat().length > 0;
  const note = notice.text;
  notice.text = '';
  const addTo = next?.i ?? slots.find((x) => !journal[x.i]!.length)?.i ?? 0;
  // the entrance plays once per visit (ctx.fresh), never when an action redraws the screen
  return `<div class="azi${ctx.fresh ? ' enter' : ''}">
  <header class="dhead"><span class="wolf" aria-hidden="true"></span><h1>${dayTitle(d)}</h1><button class="ib" data-day="-1" aria-label="Ziua anterioară">‹</button><button class="ib" data-day="1" aria-label="Ziua următoare">›</button></header>
  ${d === today ? '' : '<button class="backbtn" data-az="today">‹ Înapoi la azi</button>'}
  ${hero(d, t)}
  ${d === today ? glp1Card(d) : ''}
  ${note ? `<p class="updated">${esc(note)}</p>` : ''}
  ${numbers(t, sum)}
  ${quick(d, addTo)}
  ${d === today ? nextCard(d, slots, shown, idx != null && idx >= 0 ? idx : null) : ''}
  <h3 class="az-sec">Ziua</h3>
  ${dayList(d, slots, next)}
  ${weekRow(d)}
  ${yesterday && d >= today && !journal.flat().length ? '<button class="ghost wide" data-az="copy">Copiază mesele de ieri</button>' : ''}
  </div>
  <button class="fab" data-add="${addTo}" aria-label="Adaugă mâncare">${icon('plus')}</button>`;
}

export function todayAction(el: HTMLElement): boolean {
  const s = ctx.get();
  const d = el.dataset;
  if (d['day']) { date = addDays(currentDate(), Number(d['day'])); ctx.fresh = true; ctx.render(); return true; }
  if (d['add'] != null) { openAdd(currentDate(), Number(d['add'])); return true; }
  if (d['del']) {
    const day = currentDate();
    const [i, id] = d['del'].split(':');
    const before = s.days[day];
    const gone = dayMeals(s, day)[Number(i)]?.find((e) => e.id === id);
    s.days[day] = dayMeals(s, day).map((m, k) => (k === Number(i) ? m.filter((e) => e.id !== id) : m));
    // the last food of an eaten planned meal: the meal is not eaten any more, so the card can come back to it
    const meal = gone?.from ? (s.fuel.plan[day] ?? []).find((m) => m.id === gone.from && m.done) : undefined;
    if (meal && !s.days[day].some((l) => l.some((e) => e.from === meal.id))) meal.done = false;
    ctx.commit(); ctx.render();
    ctx.toast('Aliment șters.', () => { if (before) s.days[day] = before; if (meal) meal.done = true; ctx.commit(); ctx.render(); });
    return true;
  }
  const a = d['az'];
  if (!a) return false;
  if (a === 'today') { date = ctx.today(); pick = null; ctx.fresh = true; ctx.render(); }
  if (a === 'mprev' || a === 'mnext' || a === 'mnow') { stepMeal(a); return true; }
  if (a === 'eat') { pick = null; void eatPlanned(currentDate(), Number(d['m'])); }
  if (a === 'uneat') uneatPlanned(currentDate(), Number(d['m']));
  if (a === 'gen') void generateToday(currentDate()).catch(() => ctx.toast('Baza de alimente nu s-a încărcat. Verifică internetul.'));
  if (a === 'weigh') openWeigh();
  if (a === 'copy') {
    const day = currentDate();
    const prev = dayMeals(s, addDays(day, -1));
    const before = s.days[day];
    s.days[day] = dayMeals(s, day).map((m, i) => [...m, ...prev[i]!.map((e) => { const { from: _from, ...rest } = e; return { ...rest, id: crypto.randomUUID() }; })]);
    ctx.commit(); ctx.render();
    ctx.toast('Mesele de ieri au fost copiate.', () => { if (before) s.days[day] = before; else delete s.days[day]; ctx.commit(); ctx.render(); });
  }
  return true;
}

/** ‹ › on the meal card: the meal before or after the one shown; landing on the next meal follows it again. */
function stepMeal(a: string) {
  const d = currentDate();
  const t = dayFuel(d);
  const slots = slotsOf(d, t);
  const journal = dayMeals(ctx.get(), d);
  const logged = slots.map((x) => journal[x.i]!.length > 0 || !!x.meal?.done);
  const n = nextMeal(logged, slots.map((x) => x.time), nowMinutes());
  const at = pick?.date === d ? pick.i : n ?? slots.length;
  const to = a === 'mnow' ? n ?? slots.length : Math.max(0, Math.min(slots.length - 1, at + (a === 'mprev' ? -1 : 1)));
  slide = to > at ? 'r' : to < at ? 'l' : '';
  pick = a === 'mnow' || to === n ? null : { date: d, i: to };
  ctx.render();
}

export function todayBind() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-row]').forEach((x) => x.addEventListener('toggle', () => { const k = x.dataset['row']!; if (x.open) openRows.add(k); else openRows.delete(k); }));
}
