import { ctx, dayLong, dayShort, esc, n0, n1, nb, nowMinutes, nowTime, parseNum } from '../app.ts';
import { AVOID, EVIDENCE, MINERALS } from '../data/supplements.ts';
import { DEFAULT_FACTORS } from '../logic/carbs.ts';
import { isBreakWeek, weekday } from '../logic/calc.ts';
import { status, windowFor } from '../logic/fasting.ts';
import { insights, type Feedback, type FeedbackKey, type Rated } from '../logic/insights.ts';
import { alternatives, macros, mealOptions, regenerate, shoppingList, snackOptions, substitute, type Meal } from '../logic/mealplan.ts';
import { buildReport, type DayFacts } from '../logic/report.ts';
import { addDays, finishedWeeks, mondayOf } from '../logic/review.ts';
import { dayMeals, entryFrom, MEALS, relog, totals } from '../logic/store.ts';
import { toTime, type Tolerance } from '../logic/timing.ts';
import { CARB_LABEL, DEFAULT_LIMITS, DEFAULT_WEIGHTS, type Demand } from '../logic/training.ts';
import { analyseStack, microTotals, MICROS, sweatLoss, sweatRate, trainingFluid, waterTarget, type MicroEntry } from '../logic/wellness.ts';
import { carbsHtml, cv, openCarbs, type View } from './carbs.ts';
import { back, banner, cardSrc, demandTag, listRow } from './parts.ts';
import { dayFuel, dayRating, fuelWeek, fx, latestKg, loadPantry, mealSlots, notice, pantry, sessionsOn, timingFor, training } from './state.ts';

type Sub = 'home' | 'carbs' | 'meals' | 'water' | 'supp' | 'micro' | 'report' | 'recovery';
let sub: Sub = 'home';
let mealDay = '';
let mealWeek = 0;
let microWeek = false;
let dk = 'Apă';
let pending: Meal[] = [];
const openMeals = new Set<string>();

/** The catalogue again, when its tab is tapped from inside a section. */
export function fuelHome() { sub = 'home'; }
const fuelOpen = (v: Sub) => { sub = v; };

/** Opens one day of Carb Cycling from anywhere in the app. */
export function openDay(date: string) { openCarbs('week'); cv.detail = date; cv.pick = date; cv.fromToday = true; fuelOpen('carbs'); ctx.go('fuel'); scrollTo(0, 0); }

function sleepAvg(): number | null {
  const t = training();
  const list = Array.from({ length: 7 }, (_, i) => t.sleep[addDays(ctx.today(), -i)]).filter((x): x is number => x != null);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

export const waterOn = (d: string) => (ctx.get().drinks[d] ?? []).reduce((a, x) => a + x.ml, 0);
const litres = (ml: number) => nb(n1(ml / 1000), 'L');

function home() {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const sleep = sleepAvg();
  const go = (v: Sub) => `data-f="sub" data-v="${v}"`;
  const w = windowFor(s.fast, weekday(today));
  const meals = (s.fuel.plan[today] ?? []).length;
  const tiles: [string, string, string, string][] = [
    ['carbs', 'Carb Cycling', s.fuel.cycling ? CARB_LABEL[fuelWeek(mondayOf(today)).days.find((d) => d.date === today)?.demand ?? 'moderate'] : 'Oprit', go('carbs')],
    ['meals', 'Plan de mese', meals ? `${meals} mese azi` : 'Generează ziua', go('meals')],
    ['water', 'Hidratare', `${litres(waterOn(today))} din ${litres(waterTarget(latestKg(), s.waterMlKg))}`, go('water')],
    ['supp', 'Suplimente', s.supps.length ? `${(s.suppLog[today] ?? []).length} din ${s.supps.length} luate` : 'Ce merită luat', go('supp')],
    ['recovery', 'Recuperare', sleep == null ? 'Somn și încărcare' : `${nb(n1(sleep), 'h')} somn`, go('recovery')],
    ['analytics', 'Raport', 'Săptămâna în cifre', go('report')],
  ];
  return `${banner('nutrition', 'Fuel', 'Instrumentele din spatele zilei tale.')}
  ${t.linked ? '' : '<p class="hint">Inner Beast nu a fost deschis în acest browser, așa că folosesc săptămâna standard Inner Beast.</p>'}
  <div class="fcards">${tiles.map(([k, label, state, attr], i) => `<button class="fc" ${attr}><img src="${cardSrc(k)}" alt="" width="580" height="480" ${i > 3 ? 'loading="lazy"' : ''} style="view-transition-name:card-${k}"><span class="fc-t"><b>${label}</b><small>${state}</small></span></button>`).join('')}</div>
  <div class="list">
    ${listRow('data-tab="post"', 'Post', w ? `${w.ratio}, fereastră ${w.start}–${w.end}` : 'Oprit')}
    ${listRow('data-f="sub" data-v="micro"', 'Micronutrienți', 'Vitamine și minerale din ce ai notat')}
    ${listRow('data-tab="minte"', 'Mentalitate', 'Cele 12 principii din Fat Loss Forever')}
  </div>`;
}

function recovery() {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const avg = sleepAvg();
  const { days } = fuelWeek(mondayOf(today), t);
  const load = dates.reduce((a, d) => a + dayRating(d, t).rating.load, 0);
  return `${back()}${banner('recovery', 'Recuperare', 'Somnul și încărcarea, din ce ai notat în Inner Beast.')}
  <section class="card"><h2>Somn, ultimele 7 nopți</h2>
    ${avg == null ? '<p class="hint">Niciun somn notat. Îl notezi pe ecranul Azi din Inner Beast.</p>' : `<p class="big"><b>${n1(avg)}</b> ore în medie</p>
    <div class="sl">${dates.map((d) => { const h = t.sleep[d]; return `<div><b>${h == null ? '–' : n1(h)}</b><i><u data-bar="sl-${d}" data-axis="y" data-to="${Math.min(1, (h ?? 0) / 10)}"></u></i><span>${esc(dayShort(d))}</span></div>`; }).join('')}</div>`}
    <p class="hint">Cartea Inner Beast cere minimum 7 ore pe noapte.</p></section>
  <section class="card"><h2>Încărcare</h2>
    <div class="line"><span>Ultimele 7 zile</span><b>${n0(load)}</b></div>
    <div class="line"><span>Zile de recuperare săptămâna asta</span><b>${days.filter((d) => d.demand === 'rest').length}</b></div>
    ${isBreakWeek(s.plan!, today) ? '<div class="line"><span>Dietă</span><b>Săptămână de pauză la mențineri</b></div>' : ''}
    <p class="hint">Încărcarea e o estimare din tipul și durata sesiunilor.</p></section>
  <a class="ghost wide linkbtn" href="../inner-beast/">Deschide Inner Beast</a>`;
}

function genDay(date: string, seed: number): Meal[] {
  const s = ctx.get();
  const sl = mealSlots(date);
  const recent = [-2, -1, 1].flatMap((k) => s.fuel.plan[addDays(date, k)] ?? []).map((m) => m.name);
  return regenerate(s.fuel.plan[date] ?? [], dayFuel(date), sl.shares, sl.times, sl.tags, pantry.foods, s.fuel.prefs, seed, sl.fatShares, recent);
}

const isPast = (d: string) => d < ctx.today();
const needFoods = () => { if (pantry.foods.length) return false; void loadPantry().then(() => ctx.render()).catch(() => { pantry.failed = true; ctx.render(); }); return true; };

function mealCard(m: Meal, i: number) {
  const t = macros(m.items, pantry.map);
  const past = isPast(mealDay);
  return `<details class="mealc ${m.done ? 'done' : ''}" data-id="${m.id}" ${openMeals.has(m.id) ? 'open' : ''}><summary><span class="mt">${esc(m.time)}</span><span class="mb"><b>${esc(m.name)}</b>${m.tag ? `<em>${esc(m.tag)}</em>` : ''}<small>${nb(n0(t.kcal), 'kcal')}, ${nb(n0(t.p), 'g')} proteine, ${nb(n0(t.c), 'g')} carbo, ${nb(n0(t.f), 'g')} grăsimi</small></span></summary>
    ${m.items.map((it, k) => { const f = pantry.map.get(it.foodId); return `<div class="ing"><span>${nb(n0(it.g), 'g')} ${esc(f?.name ?? '')}</span>${past ? '' : `<button class="lnk" data-f="sw" data-m="${i}" data-i="${k}">Schimbă</button>`}</div>`; }).join('')}
    <p class="hint">${esc(m.steps)}</p>
    ${past ? '' : `<div class="btns"><button class="${m.done ? 'ghost' : 'primary'}" data-f="${m.done ? 'uneat' : 'eat'}" data-m="${i}">${m.done ? 'Scoate din jurnal' : 'Am mâncat'}</button><button class="ghost" data-f="opts" data-m="${i}">Alte variante</button>${m.done ? '' : `<button class="ghost" data-f="move" data-m="${i}">Mută pe altă zi</button>`}<button class="ghost" data-f="rm" data-m="${i}">Scoate</button></div>`}</details>`;
}

const tableRow = (label: string, x: { kcal: number; p: number; c: number; f: number }) => `<tr><th scope="row">${label}</th><td>${n0(x.kcal)}</td><td>${n0(x.p)}</td><td>${n0(x.c)}</td><td>${n0(x.f)}</td></tr>`;

function meals() {
  const s = ctx.get();
  if (pantry.failed) return `${back()}<section class="card"><h2>Baza de alimente nu s-a încărcat</h2><p>Planul de mese are nevoie de ea. Verifică internetul și încearcă din nou.</p><button class="primary wide" data-f="retry">Încearcă din nou</button></section>`;
  if (needFoods()) return `${back()}<div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  const monday = addDays(mondayOf(ctx.today()), mealWeek * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  if (!dates.includes(mealDay)) mealDay = dates.includes(ctx.today()) ? ctx.today() : dates[0]!;
  const list = s.fuel.plan[mealDay] ?? [];
  const t = dayFuel(mealDay);
  const sum = macros(list.flatMap((m) => m.items), pantry.map);
  const ate = totals(dayMeals(s, mealDay));
  const shop = shoppingList(dates.map((d) => s.fuel.plan[d] ?? []), pantry.map);
  const p = s.fuel.prefs;
  const past = isPast(mealDay);
  const stale = !past && list.length > 0 && Math.abs(sum.kcal - t.kcal) > t.kcal * 0.06 && list.some((m) => !m.done);
  const { days } = fuelWeek(monday);
  const dem = (d: string) => days.find((x) => x.date === d)!.demand;
  return `${back()}${banner('meals', 'Plan de mese', 'Mese calculate pe ținta zilei, din valorile USDA.')}
  <div class="wknav"><button class="ib" data-f="mwk" data-v="0" aria-label="Săptămâna curentă" ${mealWeek === 0 ? 'disabled' : ''}>‹</button><b>${mealWeek ? 'Săptămâna viitoare' : 'Săptămâna asta'}</b><button class="ib" data-f="mwk" data-v="1" aria-label="Săptămâna viitoare" ${mealWeek === 1 ? 'disabled' : ''}>›</button></div>
  <div class="dayrow">${dates.map((d) => `<button data-f="mday" data-v="${d}" class="${d === mealDay ? 'on' : ''}" aria-pressed="${d === mealDay}"><span>${esc(dayShort(d))}</span><small>${(s.fuel.plan[d] ?? []).length || '–'}</small><i class="dot ${dem(d)}"></i></button>`).join('')}</div>
  ${stale ? `<div class="updated"><p>Ținta zilei s-a schimbat față de planul de mese. Mesele deja notate rămân.</p><button class="ghost wide" data-f="gen">Actualizează mesele rămase</button></div>` : ''}
  <section class="card"><div class="ch"><h2 class="cap">${esc(dayLong(mealDay))}</h2>${demandTag(dem(mealDay))}</div>
    <table class="tbl"><thead><tr><td></td><th scope="col">kcal</th><th scope="col">P</th><th scope="col">C</th><th scope="col">G</th></tr></thead><tbody>${tableRow('Țintă', t)}${list.length ? tableRow('Planificat', sum) : ''}${tableRow('Mâncat', ate)}</tbody></table>
    ${past ? '<p class="hint">Zi încheiată, doar pentru citit.</p>' : `<div class="btns"><button class="primary" data-f="gen">Generează ziua</button><button class="ghost" data-f="genw">Toată săptămâna</button></div><p class="hint">Mesele notate în jurnal și cele alese de tine rămân.</p>`}</section>
  ${list.map(mealCard).join('') || '<p class="hint pad">Nicio masă pentru această zi. Generează ziua și ajustezi apoi ce vrei.</p>'}
  <details class="card"><summary><b>Preferințe</b></summary><form id="pf">
    <label class="field">Mese pe zi<select name="meals">${[3, 4].map((n) => `<option ${n === Math.min(4, p.meals) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="field">Exclud, separate prin virgulă<input name="exclude" value="${esc(p.exclude)}" placeholder="somon, nuci"></label>
    <label class="field">Alergii<input name="allergies" value="${esc(p.allergies)}" placeholder="lapte, arahide"></label>
    <label class="field">Timp de gătit maxim pe masă, în minute<input name="maxCook" type="text" inputmode="numeric" value="${p.maxCook}"></label>
    <button class="primary wide">Salvează</button></form></details>
  ${shop.length ? `<details class="card"><summary><b>Listă de cumpărături</b> <span class="hint">${shop.length} produse</span></summary>${shop.map((x) => `<label class="shop ${s.fuel.shopDone.includes(x.id) ? 'done' : ''}"><input type="checkbox" data-shop="${esc(x.id)}" ${s.fuel.shopDone.includes(x.id) ? 'checked' : ''}><span>${esc(x.name)}</span><b>${nb(n0(x.g), 'g')}</b></label>`).join('')}</details>` : ''}`;
}

function water() {
  const s = ctx.get();
  const today = ctx.today();
  const target = waterTarget(latestKg(), s.waterMlKg);
  const drank = waterOn(today);
  const mins = sessionsOn(today).reduce((a, x) => a + x.min, 0);
  const fl = trainingFluid(mins, s.sweat);
  const w = windowFor(s.fast, weekday(today));
  return `${back()}${banner('water', 'Hidratare')}
  <section class="card"><p class="big"><b>${n1(drank / 1000)}</b> din ${litres(target)}</p>
    <div class="track"><div data-bar="wtr" data-to="${Math.min(1, drank / target)}"></div></div>
    <div class="chips four">${[200, 250, 330, 500].map((m) => `<button data-f="drink" data-v="${m}">+${m} ml</button>`).join('')}</div>
    <div class="seg small">${['Apă', 'Cafea/ceai', 'Altceva'].map((k) => `<button data-f="dk" data-v="${k}" class="${dk === k ? 'on' : ''}">${k}</button>`).join('')}</div>
    ${(s.drinks[today] ?? []).slice(-6).reverse().map((d) => `<div class="line"><span>${esc(d.time)}, ${esc(d.kind)}</span><b>${nb(d.ml, 'ml')}</b><button class="xs" data-f="undrink" data-v="${d.id}" aria-label="Șterge">×</button></div>`).join('')}
    ${w && !status(w, nowMinutes()).eating ? '<p class="hint">Apa și băuturile fără calorii sunt permise în post.</p>' : ''}</section>
  <section class="card"><h2>Azi la antrenament</h2><p>${mins ? `${mins} minute planificate.` : 'Fără sesiuni planificate.'} ${fl && mins ? `La rata ta medie de ${n1(fl.rate)} L/h ai pierde cam ${litres(fl.litres * 1000)}.` : 'Măsoară rata de transpirație ca să vezi cât pierzi.'}</p><p class="hint">Informativ, nu o prescripție de lichide sau electroliți.</p></section>
  <details class="card"><summary><b>Rata de transpirație</b></summary><form id="sf2"><div class="grid2">
    <label class="field">Greutate înainte, kg<input name="pre" type="text" inputmode="decimal" required></label><label class="field">Greutate după, kg<input name="post" type="text" inputmode="decimal" required></label>
    <label class="field">Lichide băute, L<input name="fluidL" type="text" inputmode="decimal" value="0" required></label><label class="field">Urină, L<input name="urineL" type="text" inputmode="decimal" value="0" required></label>
    <label class="field">Durată, ore<input name="hours" type="text" inputmode="decimal" required></label><label class="field">Notă<input name="note"></label></div><button class="primary wide">Calculează</button></form>
    ${[...s.sweat].reverse().slice(0, 6).map((x) => `<div class="line"><span>${esc(x.date)} ${esc(x.note)}</span><b>${n1(sweatRate(x) ?? 0)} L/h</b><em>${litres(sweatLoss(x) * 1000)}</em></div>`).join('')}</details>
  <details class="card"><summary><b>Minerale</b></summary>${MINERALS.map(([a, b]) => `<p><b>${a}.</b> ${esc(b)}</p>`).join('')}</details>
  <details class="card"><summary><b>Țintă și memento</b></summary>
    <label class="field">Țintă, ml pe kg. 35 e un ghid general, ajustabil.<input type="text" inputmode="numeric" id="mlkg" value="${s.waterMlKg}"></label>
    <label class="field">Memento în minute, 0 = oprit<input type="text" inputmode="numeric" id="rem" value="${s.remindMin}"></label>
    <p class="hint">Mementoul merge doar cât aplicația e deschisă.</p></details>`;
}

function supp() {
  const s = ctx.get();
  const today = ctx.today();
  const taken = s.suppLog[today] ?? [];
  const issues = analyseStack(s.supps);
  return `${back()}${banner('supp', 'Suplimente', 'Informații educaționale, nu sfaturi medicale.')}
  ${issues.map((i) => `<p class="${i.level === 'warn' ? 'warn' : 'hint'} issue">${esc(i.text)}</p>`).join('')}
  ${s.supps.map((x) => `<section class="card sup"><label class="check"><input type="checkbox" data-take="${x.id}" ${taken.includes(x.id) ? 'checked' : ''}><span><b>${esc(x.product)}</b> ${esc(x.brand)}<small class="hint">${[x.ingredient, x.serving, x.time, x.freq].filter(Boolean).map(esc).join(', ')}</small></span></label><button class="xs" data-f="delsup" data-v="${x.id}" aria-label="Șterge ${esc(x.product)}">×</button></section>`).join('')}
  <details class="card"><summary><b>Adaugă un supliment</b></summary><form id="suf">
    ${[['product', 'Produs'], ['brand', 'Marcă'], ['ingredient', 'Ingredient activ'], ['serving', 'Porție'], ['time', 'Când'], ['freq', 'Frecvență'], ['notes', 'Note']].map(([k, l]) => `<label class="field">${l}<input name="${k}" ${k === 'product' || k === 'ingredient' ? 'required' : ''}></label>`).join('')}
    <label class="field">Cantitate pe zi, mg<input name="mgPerDay" type="text" inputmode="decimal" value="0"></label><button class="primary wide">Salvează</button></form></details>
  <h2 class="sect">Ce spun dovezile</h2><p class="hint">În ordinea dovezilor, nu o prescripție.</p>
  ${EVIDENCE.map((e) => `<details class="card"><summary><b>${esc(e.name)}</b> <span class="ev">${e.strength}</span></summary><p>${esc(e.purpose)}</p>${[[e.strength === 'Doar la deficit' || e.name === 'Omega-3' ? 'Doză și limită' : 'Doze studiate', e.dose], ['Moment', e.timing], ['Efecte adverse', e.effects], ['Contraindicații', e.contra], ['Interacțiuni', e.interactions]].map(([a, b]) => `<p><b>${a}:</b> ${esc(b)}</p>`).join('')}<p class="hint">Alege produse testate de terți, de exemplu Informed Sport sau NSF. Surse: ${esc(e.refs)}.</p></details>`).join('')}
  <section class="card"><h2>De evitat</h2>${AVOID.map(([a, b]) => `<p><b>${a}.</b> ${esc(b)}</p>`).join('')}</section>`;
}

function micro() {
  const s = ctx.get();
  const today = ctx.today();
  const days = microWeek ? Array.from({ length: 7 }, (_, i) => addDays(today, -i)) : [today];
  const logged = days.filter((d) => dayMeals(s, d).flat().length);
  const entries: MicroEntry[] = logged.flatMap((d) => dayMeals(s, d).flat());
  const t = microTotals(entries);
  const n = logged.length || 1;
  const row = (m: (typeof MICROS)[number]) => {
    const v = t.total[m.key];
    const ref = m.ref(s.profile!.sex, s.profile!.age);
    if (v == null) return `<div class="mic none"><span>${m.name}</span><em>fără date</em></div>`;
    const val = v / n, cov = t.coverage(m.key);
    const pct = val / ref;
    return `<details class="mic"><summary><span>${m.name}</span>${m.limit ? `<span class="hint">limită, nu țintă</span>` : `<span class="track"><div data-bar="m-${m.key}" data-to="${Math.min(1, pct)}"></div></span>`}<em>${Math.round(pct * 100)}%</em></summary>
      <p class="hint">${val.toLocaleString('ro-RO', { maximumFractionDigits: val < 10 ? 1 : 0 })} ${m.unit} din referința de ${ref} ${m.unit}${m.limit ? ', iar peste ea nu e o țintă' : ''}. Date pentru ${Math.round(cov * 100)}% din calorii, deci valoarea reală poate fi mai mare. Surse: ${esc(m.sources)}.</p></details>`;
  };
  return `${back()}${banner('food', 'Micronutrienți', 'Estimări din alimentele notate. Nu arată o carență.')}
  <div class="seg"><button data-f="mic" data-v="0" class="${microWeek ? '' : 'on'}">Azi</button><button data-f="mic" data-v="1" class="${microWeek ? 'on' : ''}">Media pe 7 zile</button></div>
  ${entries.length ? `<section class="card"><h2>Vitamine</h2>${MICROS.filter((m) => m.group === 'v').map(row).join('')}</section><section class="card"><h2>Minerale</h2>${MICROS.filter((m) => m.group === 'm').map(row).join('')}</section>` : '<p class="hint pad">Notează alimente ca să apară datele. Valorile lipsă nu sunt tratate ca zero.</p>'}
  <p class="hint">Iodul nu există în baza USDA, deci nu poate fi calculat. Produsele de marcă și alimentele manuale nu au micronutrienți.</p>`;
}

function factsFor(week: string): DayFacts[] {
  const s = ctx.get();
  const t = training();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week, i);
    const sum = totals(dayMeals(s, date));
    const p = dayRating(date, t);
    const f = dayFuel(date);
    return { date, kcal: sum.kcal, p: sum.p, c: sum.c, f: sum.f, fiber: sum.fiber, tKcal: f.kcal, tP: f.p, tC: f.c, demand: p.rating.demand, plannedSessions: p.planned.length, doneSessions: p.done.length, water: waterOn(date), suppsTaken: (s.suppLog[date] ?? []).length, fastKept: s.fast.log[date] ?? null };
  });
}

function makeReports() {
  const s = ctx.get();
  const weeks = finishedWeeks(s.weights, ctx.today());
  const last = addDays(mondayOf(ctx.today()), -7);
  if (s.reports[last]) return;
  const has = Array.from({ length: 7 }, (_, i) => addDays(last, i)).some((d) => dayMeals(s, d).flat().length || s.weights[d]);
  if (!has) return;
  const w = weeks.find((x) => x.start === last), prev = weeks.find((x) => x.start === addDays(last, -7));
  s.reports[last] = buildReport(last, factsFor(last), w?.avg ?? null, prev?.avg ?? null, s.checkins[last]?.waist ?? null);
  ctx.commit();
}

function report() {
  makeReports();
  const s = ctx.get();
  const today = ctx.today();
  const current = buildReport(mondayOf(today), factsFor(mondayOf(today)), null, null, null);
  const list = Object.values(s.reports).sort((a, b) => b.week.localeCompare(a.week));
  const card = (r: typeof current, title: string, open: boolean) => `<details class="card rep" ${open ? 'open' : ''}><summary><b>${esc(title)}</b></summary>
    <div class="stats"><div><b>${n0(r.avg.kcal)}</b><span>kcal din ${n0(r.target.kcal)}</span></div><div><b>${r.avg.p}</b><span>g proteine din ${r.target.p}</span></div><div><b>${r.avg.c}</b><span>g carbo</span></div><div><b>${r.avg.f}</b><span>g grăsimi</span></div></div>
    <div class="line"><span>Zile notate</span><b>${r.logged} din 7</b></div><div class="line"><span>Fibre, medie</span><b>${nb(r.avg.fiber, 'g')}</b></div>
    <div class="line"><span>Zile HIGH, MOD, LOW, REST</span><b>${r.demand['high']}, ${r.demand['moderate']}, ${r.demand['low']}, ${r.demand['rest']}</b></div>
    <div class="line"><span>Sesiuni făcute din planificate</span><b>${r.done} din ${r.planned}</b></div>
    ${r.carbFit != null ? `<div class="line"><span>Zile la ±15% de ținta de carbo</span><b>${r.carbFit}%</b></div>` : ''}
    <div class="line"><span>Lichide, medie</span><b>${r.avg.water ? nb(n0(r.avg.water), 'ml') : 'nenotat'}</b></div>
    <div class="line"><span>Zile cu suplimente bifate</span><b>${r.suppDays}</b></div>
    ${r.fastKnown ? `<div class="line"><span>Post respectat</span><b>${r.fastKept} din ${r.fastKnown}</b></div>` : ''}
    ${r.weight != null ? `<div class="line"><span>Greutate medie</span><b>${nb(n1(r.weight), 'kg')}${r.weightChange != null ? ` (${r.weightChange > 0 ? '+' : ''}${r.weightChange.toLocaleString('ro-RO', { maximumFractionDigits: 2 })})` : ''}</b></div>` : ''}
    ${r.waist != null ? `<div class="line"><span>Talie</span><b>${nb(n1(r.waist), 'cm')}</b></div>` : ''}
    ${r.recs.map((x) => `<p class="coach">${esc(x)}</p>`).join('')}</details>`;
  return `${back()}${banner('analytics', 'Raport', 'Doar date salvate de tine. Legăturile dintre cifre nu dovedesc o cauză.')}
  ${card(current, 'Săptămâna curentă, până acum', true)}${list.map((r) => card(r, `Săptămâna din ${new Date(`${r.week}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`, false)).join('')}`;
}

export function fuelHtml() {
  const out = { home, carbs: carbsHtml, meals, water, supp, micro, report, recovery }[sub]();
  fx.recalc = false;
  return out;
}

function openSwap(mi: number, ii: number) {
  const s = ctx.get();
  const list = s.fuel.plan[mealDay]!;
  const meal = list[mi]!;
  const it = meal.items[ii]!;
  const rest = meal.items.filter((_, k) => k !== ii).map((x) => pantry.map.get(x.foodId)?.name ?? '');
  const alt = alternatives(it.role, it.foodId, pantry.foods, s.fuel.prefs, rest);
  ctx.open(`<h2>Schimbă ${esc(pantry.map.get(it.foodId)?.name ?? '')}</h2><p class="hint">Masa se recalculează ca să păstreze macronutrienții.</p>${alt.map((f) => `<button class="row" data-f="swgo" data-m="${mi}" data-i="${ii}" data-v="${f.id}"><span><b>${esc(f.name)}</b></span><em>${nb(n0(f.kcal), 'kcal')}<small>la 100 g</small></em></button>`).join('') || '<p class="hint">Nicio variantă care să respecte regulile mesei și preferințele tale.</p>'}`);
}

const entriesOf = (m: Meal) => m.items.flatMap((it) => { const f = pantry.map.get(it.foodId); return f ? [entryFrom(f, it.g)] : []; });
const slotOf = (mi: number) => Math.min(mi, MEALS.length - 1);

/** After a logged meal changed: the journal and the remaining targets follow. False when it cannot be matched. */
function syncLog(date: string, meal: Meal, mi: number, next: ReturnType<typeof entriesOf>): boolean {
  const s = ctx.get();
  const days = relog(dayMeals(s, date), meal.id, next, slotOf(mi), meal.done);
  if (!days) { ctx.toast('Masa a fost notată înainte de această versiune. Schimb-o din Azi.'); return false; }
  s.days[date] = days;
  return true;
}

/** Logs a planned meal in one tap, from Azi or from the plan, and the toast can take it back. */
export async function eatPlanned(date: string, mi: number) {
  await loadPantry();
  const s = ctx.get();
  const meal = s.fuel.plan[date]?.[mi];
  if (!meal || !syncLog(date, { ...meal, done: false }, mi, entriesOf(meal))) return;
  meal.done = true;
  ctx.commit(); ctx.render();
  ctx.toast(`${meal.name} notată.`, () => { if (syncLog(date, meal, mi, [])) meal.done = false; ctx.commit(); ctx.render(); });
}

/** Takes an eaten planned meal back out of the journal, from Azi as well as from the plan; the toast puts it back. */
export function uneatPlanned(date: string, mi: number) {
  const s = ctx.get();
  const meal = s.fuel.plan[date]?.[mi];
  if (!meal?.done) return;
  const before = s.days[date];
  // its food may already have been deleted by hand: then only the mark goes
  const logged = dayMeals(s, date).some((l) => l.some((e) => e.from === meal.id));
  if (logged && !syncLog(date, meal, mi, [])) return;
  meal.done = false;
  ctx.commit(); ctx.render();
  ctx.toast(`${meal.name} scoasă din jurnal.`, () => { if (before) s.days[date] = before; meal.done = true; ctx.commit(); ctx.render(); });
}

/** Builds the day's meals, for Azi as well as for the plan. */
export async function generateToday(date: string) {
  await loadPantry();
  mealDay = date;
  ctx.get().fuel.plan[date] = genDay(date, Date.now() % 97);
  ctx.commit(); ctx.render();
}

/** Puts a chosen meal on the day: it takes its slot, and the meals not eaten yet share what is left. */
function placeMeal(date: string, meal: Meal) {
  const s = ctx.get();
  const list = s.fuel.plan[date] ?? genDay(date, 1);
  const same = meal.snack ? -1 : list.findIndex((m) => m.tag === meal.tag && !m.done);
  if (same >= 0) list[same] = { ...meal, id: list[same]!.id, keep: true };
  else list.push(meal.snack ? meal : { ...meal, keep: true });
  s.fuel.plan[date] = list;
  s.fuel.plan[date] = genDay(date, 3);
}

async function openTiming(date: string, kind: 'pre' | 'post' | 'snack') {
  await loadPantry();
  const s = ctx.get();
  const t = timingFor(date);
  const slot = kind === 'post' ? t.post : t.pre;
  if (!slot) return;
  const tag = kind === 'post' ? 'După antrenament' : kind === 'snack' ? 'Gustare înainte de antrenament' : 'Înainte de antrenament';
  const [h = 0, m = 0] = t.start.split(':').map(Number);
  const time = kind === 'snack' ? (t.pre?.snackTime ?? toTime(h * 60 + m - 45)) : slot.mealTime;
  pending = kind === 'snack' ? snackOptions(t.pre?.snackC || Math.min(30, Math.round(slot.c * 0.5)), pantry.foods, s.fuel.prefs, time, tag) : mealOptions({ p: slot.p, c: slot.c, f: slot.f }, pantry.foods, s.fuel.prefs, time, tag, Date.now() % 97);
  ctx.open(`<h2>${esc(tag)}</h2><p class="hint">Din baza de alimente, cu valorile ei reale. Mesele rămase se ajustează ca ziua să iasă pe țintă.</p>${pending.map((o, k) => { const g = macros(o.items, pantry.map); return `<button class="row" data-f="tplace" data-d="${date}" data-v="${k}"><span><b>${esc(o.name)}</b><small>${o.items.map((it) => `${nb(n0(it.g), 'g')} ${esc(pantry.map.get(it.foodId)?.name ?? '')}`).join(', ')}</small></span><em>${nb(n0(g.kcal), 'kcal')}<small>${nb(n0(g.c), 'g')} carbo</small></em></button>`; }).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
}

/** Actions that only touch how Carb Cycling is shown or configured. */
function carbAction(a: string, el: HTMLElement): boolean {
  const s = ctx.get();
  const d = el.dataset;
  const v = d['v'] ?? '';
  const change = () => { fx.recalc = true; s.fuel.sig = ''; notice.text = ''; ctx.commit(); ctx.render(); return true; };
  if (a === 'cv') { openCarbs(v as View); ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'dd') { cv.detail = v; if (v) cv.pick = v; ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'wk') { cv.week += Number(v); ctx.render(); return true; }
  if (a === 'wpick') { cv.pick = v; ctx.render(); return true; }
  if (a === 'tday') { cv.tday = v; ctx.render(); return true; }
  if (a === 'tgo') { cv.tday = v; openCarbs('timing'); ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'ov') { if (v) s.fuel.overrides[d['d']!] = v as Demand; else delete s.fuel.overrides[d['d']!]; return change(); }
  if (a === 'cmode') { s.fuel.mode = v as 'auto' | 'manual'; return change(); }
  if (a === 'sens') { s.fuel.sensitivity = Number(v); return change(); }
  if (a === 'tol') { s.fuel.tolerance = v as Tolerance; ctx.commit(); ctx.render(); return true; }
  if (a === 'cancel') {
    const date = d['d']!, list = s.fuel.cancelled[date] ?? [];
    s.fuel.cancelled[date] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    return change();
  }
  if (a === 'fb') { const date = d['d']!; (s.fuel.feedback[date] ??= {} as Feedback)[d['k'] as FeedbackKey] = Number(v); ctx.commit(); ctx.render(); return true; }
  if (a === 'acc') {
    const rated: Rated[] = Object.entries(s.fuel.feedback).map(([date, fb]) => ({ date, fb, demand: s.fuel.snap[date]?.demand ?? 'moderate' }));
    const act = insights(rated, s.fuel.factors).find((x) => x.id === v)?.action;
    if (act?.kind === 'factor') s.fuel.factors[act.demand] = Math.round((s.fuel.factors[act.demand] + act.delta) * 100) / 100;
    if (act?.kind === 'tolerance') s.fuel.tolerance = 'low';
    ctx.toast('Aplicat pentru zilele următoare.');
    return change();
  }
  if (a === 'crst') { s.fuel.factors = { ...DEFAULT_FACTORS }; s.fuel.limits = { ...DEFAULT_LIMITS }; s.fuel.weights = { ...DEFAULT_WEIGHTS }; s.fuel.sensitivity = 1; s.fuel.boxStrength = true; return change(); }
  return false;
}

function openOptions(mi: number) {
  const s = ctx.get();
  const m = s.fuel.plan[mealDay]![mi]!;
  const g = macros(m.items, pantry.map);
  pending = mealOptions(g, pantry.foods, s.fuel.prefs, m.time, m.tag, Date.now() % 97, m.name);
  ctx.open(`<h2>${esc(m.tag || 'Alte variante')}</h2><p class="hint">Aceleași macronutrienți, alte alimente.</p>${pending.map((o, k) => { const t = macros(o.items, pantry.map); return `<button class="row" data-f="optgo" data-m="${mi}" data-v="${k}"><span><b>${esc(o.name)}</b><small>${o.items.map((it) => `${nb(n0(it.g), 'g')} ${esc(pantry.map.get(it.foodId)?.name ?? '')}`).join(', ')}</small></span><em>${nb(n0(t.kcal), 'kcal')}<small>${nb(n0(t.c), 'g')} carbo</small></em></button>`; }).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
}

export function drink(ml: number) {
  const s = ctx.get();
  const today = ctx.today();
  const item = { id: crypto.randomUUID(), time: nowTime(), ml, kind: dk };
  (s.drinks[today] ??= []).push(item);
  return item;
}

export function fuelAction(el: HTMLElement): boolean {
  const a = el.dataset['f'];
  if (!a) return false;
  const s = ctx.get();
  const d = el.dataset;
  const v = d['v'] ?? '';
  const mi = Number(d['m']);
  const plan = s.fuel.plan[mealDay] ?? [];
  const meal = plan[mi];
  if (a === 'sub') {
    const go = () => {
      if (v === 'carbs') openCarbs('week');
      fuelOpen(v as Sub); notice.text = sub === 'carbs' ? notice.text : ''; ctx.render(); scrollTo(0, 0);
    };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
    return true;
  }
  if (carbAction(a, el)) return true;
  if (a === 'dayopen') { openDay(v); return true; }
  if (a === 'topt') { void openTiming(d['d']!, v as 'pre' | 'post' | 'snack'); return true; }
  if (a === 'tplace') { placeMeal(d['d']!, pending[Number(v)]!); ctx.close(); ctx.toast('Masa e în planul de mese.'); }
  if (a === 'retry') { pantry.failed = false; }
  if (a === 'mday') mealDay = v;
  if (a === 'mwk') { mealWeek = Number(v); mealDay = ''; }
  if (a === 'gen') { s.fuel.plan[mealDay] = genDay(mealDay, Date.now() % 97); }
  if (a === 'genw') { const m = addDays(mondayOf(ctx.today()), mealWeek * 7); for (let i = 0; i < 7; i++) { const x = addDays(m, i); if (x >= ctx.today()) s.fuel.plan[x] = genDay(x, i * 3 + 1); } }
  if (a === 'sw') { openSwap(mi, Number(d['i'])); return true; }
  if (a === 'opts') { openOptions(mi); return true; }
  if (a === 'swgo') {
    const next = substitute(meal!, Number(d['i']), pantry.map.get(v)!, pantry.map);
    if (meal!.done && !syncLog(mealDay, next, mi, entriesOf(next))) return true;
    plan[mi] = next; ctx.close();
  }
  if (a === 'optgo') {
    const next = { ...pending[Number(v)]!, id: meal!.id, done: meal!.done };
    if (meal!.done && !syncLog(mealDay, next, mi, entriesOf(next))) return true;
    plan[mi] = next; ctx.close();
  }
  if (a === 'rm') {
    if (meal!.done && !syncLog(mealDay, meal!, mi, [])) return true;
    const list = [...plan]; plan.splice(mi, 1);
    ctx.toast('Masă scoasă.', () => { s.fuel.plan[mealDay] = list; ctx.commit(); ctx.render(); });
  }
  if (a === 'move') {
    const m = mondayOf(ctx.today());
    ctx.open(`<h2>Mută pe</h2>${Array.from({ length: 14 }, (_, i) => addDays(m, i)).filter((x) => x !== mealDay && x >= ctx.today()).map((x) => `<button class="row" data-f="movego" data-m="${mi}" data-v="${x}"><span><b class="cap">${esc(dayLong(x))}</b></span></button>`).join('')}`);
    return true;
  }
  if (a === 'movego') { const [m] = plan.splice(mi, 1); (s.fuel.plan[v] ??= []).push(m!); ctx.close(); ctx.toast('Masă mutată. Vezi totalurile zilei.'); }
  if (a === 'eat') { void eatPlanned(mealDay, mi); return true; }
  if (a === 'uneat') { uneatPlanned(mealDay, mi); return true; }
  if (a === 'drink') { const item = drink(Number(v)); ctx.commit(); ctx.render(); ctx.toast(`Am notat ${item.ml} ml.`, () => { s.drinks[ctx.today()] = (s.drinks[ctx.today()] ?? []).filter((x) => x.id !== item.id); ctx.commit(); ctx.render(); }); return true; }
  if (a === 'dk') dk = v;
  if (a === 'undrink') s.drinks[ctx.today()] = (s.drinks[ctx.today()] ?? []).filter((x) => x.id !== v);
  if (a === 'delsup') {
    const list = s.supps;
    s.supps = s.supps.filter((x) => x.id !== v);
    ctx.toast('Supliment șters.', () => { s.supps = list; ctx.commit(); ctx.render(); });
  }
  if (a === 'mic') microWeek = v === '1';
  ctx.commit(); ctx.render();
  return true;
}

let reminder = 0;
let reminderEvery = 0;

/** A page cannot call `new Notification` on a phone; the service worker can. Falls back to a toast. */
function remind() {
  const body = 'E momentul pentru un pahar de apă.';
  if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.ready.then((r) => r.showNotification('Hidratare', { body })).catch(() => ctx.toast(body));
  } else ctx.toast(body);
}

function keepReminder(every: number) {
  if (every === reminderEvery) return;
  reminderEvery = every;
  clearInterval(reminder);
  if (every > 0) reminder = window.setInterval(remind, every * 60000);
}

export function fuelBind() {
  const s = ctx.get();
  const on = (sel: string, fn: (i: HTMLInputElement) => void) => document.querySelector<HTMLInputElement>(sel)?.addEventListener('change', (ev) => fn(ev.target as HTMLInputElement));
  const save = () => { ctx.commit(); ctx.render(); };
  on('#cyc', (i) => { s.fuel.cycling = i.checked; if (!i.checked) s.fuel.sig = ''; fx.recalc = true; save(); });
  const flag = (id: string, fn: (on: boolean) => void) => on(id, (i) => { fn(i.checked); s.fuel.sig = ''; fx.recalc = true; save(); });
  flag('#csync', (v) => { s.fuel.sync = v; });
  flag('#cbox', (v) => { s.fuel.boxStrength = v; });
  flag('#cpre', (v) => { s.fuel.prefuel = v; });
  on('#cintra', (i) => { s.fuel.intra = i.checked; save(); });
  on('#pregap', (i) => { s.fuel.preGap = Math.max(0, parseNum(i.value) || 0); save(); });
  on('#frpe', (i) => { (s.fuel.feedback[i.dataset['d']!] ??= {} as Feedback).rpe = Number(i.value); fx.recalc = true; save(); });
  document.querySelectorAll<HTMLInputElement>('[data-weight]').forEach((i) => i.addEventListener('change', () => { s.fuel.weights[i.dataset['weight'] as keyof typeof s.fuel.weights] = Math.min(1.5, Math.max(0, parseNum(i.value) || 0)); s.fuel.sig = ''; save(); }));
  document.querySelectorAll<HTMLInputElement>('[data-time]').forEach((i) => i.addEventListener('change', () => { s.fuel.times[Number(i.dataset['time'])] = i.value; save(); }));
  on('#thour', (i) => { s.fuel.trainingHour = i.value || '17:00'; save(); });
  document.querySelectorAll<HTMLInputElement>('[data-limit]').forEach((i) => i.addEventListener('change', () => { s.fuel.limits[i.dataset['limit'] as 'high' | 'moderate'] = Math.max(5, parseNum(i.value) || 0); save(); }));
  document.querySelectorAll<HTMLDetailsElement>('details.mealc').forEach((m) => m.addEventListener('toggle', () => { if (m.open) openMeals.add(m.dataset['id']!); else openMeals.delete(m.dataset['id']!); }));
  on('#mlkg', (i) => { s.waterMlKg = parseNum(i.value) || 35; save(); });
  on('#rem', (i) => { s.remindMin = parseNum(i.value) || 0; save(); if (s.remindMin && 'Notification' in window) void Notification.requestPermission(); });
  document.querySelectorAll<HTMLInputElement>('[data-factor]').forEach((i) => i.addEventListener('change', () => { s.fuel.factors[i.dataset['factor'] as Demand] = Math.min(2, Math.max(0.3, parseNum(i.value) || 1)); save(); }));
  document.querySelectorAll<HTMLInputElement>('[data-shop]').forEach((i) => i.addEventListener('change', () => { const id = i.dataset['shop']!; s.fuel.shopDone = i.checked ? [...s.fuel.shopDone, id] : s.fuel.shopDone.filter((x) => x !== id); i.closest('.shop')?.classList.toggle('done', i.checked); ctx.commit(); }));
  document.querySelectorAll<HTMLInputElement>('[data-take]').forEach((i) => i.addEventListener('change', () => { const t = ctx.today(); const list = s.suppLog[t] ?? []; s.suppLog[t] = i.checked ? [...list, i.dataset['take']!] : list.filter((x) => x !== i.dataset['take']); ctx.commit(); }));
  const form = (id: string, fn: (d: FormData) => void) => document.querySelector<HTMLFormElement>(id)?.addEventListener('submit', (ev) => { ev.preventDefault(); fn(new FormData(ev.target as HTMLFormElement)); save(); });
  form('#pf', (d) => { s.fuel.prefs = { ...s.fuel.prefs, meals: Number(d.get('meals')) as 3 | 4, exclude: String(d.get('exclude')), allergies: String(d.get('allergies')), maxCook: parseNum(d.get('maxCook')) || 30 }; });
  form('#sf2', (d) => { const n = (k: string) => parseNum(d.get(k)) || 0; s.sweat.push({ id: crypto.randomUUID(), date: ctx.today(), pre: n('pre'), post: n('post'), fluidL: n('fluidL'), urineL: n('urineL'), hours: n('hours'), note: String(d.get('note') ?? '') }); });
  form('#suf', (d) => { const t = (k: string) => String(d.get(k) ?? ''); s.supps.push({ id: crypto.randomUUID(), product: t('product'), brand: t('brand'), ingredient: t('ingredient'), serving: t('serving'), mgPerDay: parseNum(d.get('mgPerDay')) || 0, time: t('time'), freq: t('freq'), start: ctx.today(), notes: t('notes') }); });
  keepReminder(s.remindMin);
}
