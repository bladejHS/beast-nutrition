import { ctx, dayShort, esc, n0 } from '../app.ts';
import { EVIDENCE, MINERALS } from '../data/supplements.ts';
import { isBreakWeek, weekday } from '../logic/calc.ts';
import { adherence, status, windowFor } from '../logic/fasting.ts';
import { alternatives, macros, mealOptions, regenerate, shoppingList, snackOptions, substitute, type Meal } from '../logic/mealplan.ts';
import { buildReport, type DayFacts } from '../logic/report.ts';
import { addDays, finishedWeeks, mondayOf } from '../logic/review.ts';
import { dayMeals, entryFrom, MEALS, relog, totals } from '../logic/store.ts';
import { CARB_LABEL, DEFAULT_LIMITS, DEFAULT_WEIGHTS, DEMAND_LABEL, type Demand } from '../logic/training.ts';
import { analyseStack, microTotals, MICROS, sweatLoss, sweatRate, trainingFluid, waterTarget, type MicroEntry } from '../logic/wellness.ts';
import { DEFAULT_FACTORS } from '../logic/carbs.ts';
import { insights, type Feedback, type FeedbackKey, type Rated } from '../logic/insights.ts';
import { toTime, type Tolerance } from '../logic/timing.ts';
import { carbsHtml, cv, openCarbs, type View } from './carbs.ts';
import { back, banner, cardSrc } from './parts.ts';
import { dayFuel, dayRating, fuelWeek, fx, loadPantry, mealSlots, notice, pantry, timingFor, training } from './state.ts';

type Sub = 'home' | 'overview' | 'carbs' | 'meals' | 'water' | 'supp' | 'micro' | 'report' | 'advanced' | 'recovery';
let sub: Sub = 'home';
let enter = false;
let mealDay = '';
let microWeek = false;
let pending: Meal[] = [];
const openMeals = new Set<string>();

const demandTag = (d: Demand) => `<span class="dm ${d}">${DEMAND_LABEL[d]}</span>`;
const latestKg = () => Object.entries(ctx.get().weights).sort().at(-1)?.[1] ?? ctx.get().profile!.weightKg;
const kgText = (v: number) => v.toFixed(1).replace('.', ',');

function sleepAvg(): number | null {
  const t = training();
  const list = Array.from({ length: 7 }, (_, i) => t.sleep[addDays(ctx.today(), -i)]).filter((x): x is number => x != null);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

interface CardDef { k: string; label: string; go: string; chip: string }

function cards(): CardDef[] {
  const s = ctx.get();
  const today = ctx.today();
  const f = dayFuel(today);
  const eaten = totals(dayMeals(s, today)).kcal;
  const sleep = sleepAvg();
  const go = (v: Sub | 'engine') => `data-f="sub" data-v="${v}"`;
  const tab = (v: string) => `data-tab="${v}"`;
  return [
    { k: 'nutrition', label: 'Nutrition Overview', go: go('overview'), chip: `${n0(Math.max(0, f.kcal - eaten))} kcal` },
    { k: 'carbs', label: 'Carb Cycling', go: go('carbs'), chip: s.fuel.cycling ? CARB_LABEL[dayRating(today).rating.demand] : 'Oprit' },
    { k: 'meals', label: 'Meal Planner', go: go('meals'), chip: `${(s.fuel.plan[today] ?? []).length} mese` },
    { k: 'food', label: 'Jurnal alimente', go: tab('azi'), chip: `${n0(eaten)} kcal` },
    { k: 'water', label: 'Hidratare', go: go('water'), chip: `${(waterOn(today) / 1000).toFixed(1).replace('.', ',')} L` },
    { k: 'supp', label: 'Suplimente', go: go('supp'), chip: `${s.supps.length} în stack` },
    { k: 'body', label: 'Corp', go: tab('cantar'), chip: `${kgText(latestKg())} kg` },
    { k: 'analytics', label: 'Raport și analize', go: go('report'), chip: `${Object.keys(s.reports).length} rapoarte` },
    { k: 'engine', label: 'Performance Fuel Engine', go: go('engine'), chip: s.fuel.cycling ? 'Activ' : 'Oprit' },
    { k: 'advanced', label: 'Strategii avansate', go: go('advanced'), chip: '' },
    { k: 'recovery', label: 'Recuperare', go: go('recovery'), chip: sleep == null ? '' : `${sleep.toFixed(1).replace('.', ',')} h somn` },
    { k: 'settings', label: 'Plan și setări', go: tab('plan'), chip: '' },
  ];
}

function home() {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const p = dayRating(today, t);
  const f = dayFuel(today);
  const names = p.planned.filter((x) => x.min > 0).map((x) => x.name);
  return `<button class="fh ${p.rating.demand}" data-f="sub" data-v="carbs"><span class="fh-t"><b>${CARB_LABEL[p.rating.demand]}</b><small>${names.length ? esc(names.slice(0, 2).join(' + ')) : 'Fără antrenament'}</small></span><span class="fh-k"><b data-count="fk" data-to="${f.kcal}">${n0(f.kcal)}</b><small>kcal · ${f.c} g carbo</small></span></button>
  ${t.linked ? '' : '<p class="hint">Inner Beast nu a fost deschis în acest browser: folosesc planul standard din carte.</p>'}
  ${s.fuel.cycling ? '' : '<p class="hint">Carb Cycling e oprit: ținta zilnică rămâne cea din plan.</p>'}
  <div class="fcards">${cards().map((c, i) => `<button class="fc" ${c.go} aria-label="${esc(c.label)}${c.chip ? `, ${esc(c.chip)}` : ''}"><img src="${cardSrc(c.k)}" alt="" width="580" height="${i < 4 ? 808 : i < 8 ? 738 : 728}" decoding="sync" ${i > 3 ? 'loading="lazy"' : ''} style="view-transition-name:card-${c.k}">${c.chip ? `<em>${esc(c.chip)}</em>` : ''}</button>`).join('')}</div>`;
}

function overview() {
  const s = ctx.get();
  const today = ctx.today();
  const f = dayFuel(today);
  const sum = totals(dayMeals(s, today));
  const left = f.kcal - sum.kcal;
  const week = Array.from({ length: 7 }, (_, i) => totals(dayMeals(s, addDays(today, -i))).kcal).filter((k) => k > 0);
  const row = (a: string, v: number, t: number, u: string) => `<div class="bar"><div class="bar-h"><span>${a}</span><b>${n0(v)} / ${n0(t)} ${u}</b></div><div class="track"><div data-bar="ov-${a}" data-to="${Math.min(1, v / (t || 1))}"></div></div></div>`;
  const w = windowFor(s.fast, weekday(today));
  return `${back()}${banner('nutrition', 'Nutrition Overview', 'Ziua de azi, din ce ai notat.')}
  <section class="card"><div class="cc-kcal"><div><b data-count="ov-k" data-to="${sum.kcal}">${n0(sum.kcal)}</b><span>din ${n0(f.kcal)} kcal</span></div><div class="cc-left"><b class="${left < 0 ? 'over' : ''}">${n0(Math.abs(left))}</b><span>${left < 0 ? 'peste' : 'rămas'}</span></div></div>
    ${row('Proteine', sum.p, f.p, 'g')}${row('Carbohidrați', sum.c, f.c, 'g')}${row('Grăsimi', sum.f, f.f, 'g')}${row('Fibre', sum.fiber, f.fiberMin, 'g')}</section>
  <section class="card">
    <div class="line"><span>Clasificarea zilei</span><b>${CARB_LABEL[dayRating(today).rating.demand]}</b></div>
    <div class="line"><span>Lichide</span><b>${n0(waterOn(today))} ml</b></div>
    <div class="line"><span>Suplimente bifate</span><b>${(s.suppLog[today] ?? []).length} din ${s.supps.length}</b></div>
    ${w ? `<div class="line"><span>Post</span><b>${status(w, new Date().getHours() * 60 + new Date().getMinutes()).eating ? 'Fereastră de mâncat' : 'În post'}, ${esc(w.ratio)}</b></div>` : ''}
    <div class="line"><span>Greutate</span><b>${kgText(latestKg())} kg</b></div>
    ${week.length ? `<div class="line"><span>Media ultimelor zile notate</span><b>${n0(week.reduce((a, b) => a + b, 0) / week.length)} kcal, ${week.length} ${week.length === 1 ? 'zi' : 'zile'}</b></div>` : ''}
  </section>
  <div class="btns"><button class="primary" data-tab="azi">Notează mâncare</button><button class="ghost" data-f="sub" data-v="micro">Micronutrienți</button></div>`;
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
    ${avg == null ? '<p class="hint">Niciun somn notat. Îl notezi pe ecranul Azi din Inner Beast.</p>' : `<div class="cc-kcal"><div><b>${avg.toFixed(1).replace('.', ',')}</b><span>ore în medie</span></div></div>
    <div class="sl">${dates.map((d) => { const h = t.sleep[d]; return `<div><i><u data-bar="sl-${d}" data-axis="y" data-to="${Math.min(1, (h ?? 0) / 10)}"></u></i><span>${esc(dayShort(d))}</span><b>${h == null ? '–' : String(h).replace('.', ',')}</b></div>`; }).join('')}</div>`}
    <p class="hint">Cartea Inner Beast cere minimum 7 ore pe noapte.</p></section>
  <section class="card"><h2>Încărcare</h2>
    <div class="line"><span>Ultimele 7 zile</span><b>${n0(load)}</b></div>
    <div class="line"><span>Zile REST săptămâna asta</span><b>${days.filter((d) => d.demand === 'rest').length}</b></div>
    ${isBreakWeek(s.plan!, today) ? '<div class="line"><span>Dietă</span><b>Săptămână de pauză la mențineri</b></div>' : ''}
    <p class="hint">Încărcarea e o estimare din tipul și durata sesiunilor.</p></section>
  <a class="ghost wide linkbtn" href="../inner-beast/">Deschide Inner Beast</a>`;
}

function advanced() {
  const row = (attr: string, a: string, b: string) => `<button class="adv" ${attr}><b>${a}</b><span>${b}</span></button>`;
  return `${back()}${banner('advanced', 'Strategii avansate', 'Instrumentele care merg peste planul zilnic.')}
  ${row('data-tab="post"', 'Post progresiv', '12:12, 14:10, 16:8 și programul de 8 săptămâni.')}
  ${row('data-tab="plan"', 'Pauze de dietă și zile cu calorii mari', 'Din Fat Loss Forever, se setează în Plan.')}
  ${row('data-tab="plan"', 'Reverse diet', 'Faza de după slăbire, cu ritm conservator, moderat sau agresiv.')}
  ${row('data-f="sub" data-v="micro"', 'Micronutrienți', '20 de vitamine și minerale, din alimentele notate.')}
  ${row('data-tab="minte"', 'Mentalitate', 'Cele 12 principii din Fat Loss Forever.')}`;
}

function genDay(date: string, seed: number): Meal[] {
  const s = ctx.get();
  const sl = mealSlots(date);
  return regenerate(s.fuel.plan[date] ?? [], dayFuel(date), sl.shares, sl.times, sl.tags, pantry.foods, s.fuel.prefs, seed);
}

const isPast = (d: string) => d < ctx.today();
const needFoods = () => { if (pantry.foods.length) return false; void loadPantry().then(() => ctx.render()); return true; };

function mealCard(m: Meal, i: number) {
  const t = macros(m.items, pantry.map);
  const past = isPast(mealDay);
  return `<details class="mealc ${m.done ? 'done' : ''} ${m.tag ? 'tagged' : ''}" data-id="${m.id}" ${openMeals.has(m.id) ? 'open' : ''}><summary><span class="mt">${esc(m.time)}</span><span><b>${esc(m.name)}</b>${m.tag ? `<i class="mtag">${esc(m.tag)}</i>` : ''}<small>${n0(t.kcal)} kcal · P ${n0(t.p)} · C ${n0(t.c)} · G ${n0(t.f)} · fibre ${n0(t.fiber)}</small></span></summary>
    ${m.items.map((it, k) => { const f = pantry.map.get(it.foodId); return `<div class="ing"><span>${n0(it.g)} g ${esc(f?.name ?? '')}</span>${past ? '' : `<button data-f="sw" data-m="${i}" data-i="${k}">Schimbă</button>`}</div>`; }).join('')}
    <p class="hint">${esc(m.steps)}</p>
    ${past ? '' : `<div class="btns"><button class="${m.done ? 'ghost' : 'primary'}" data-f="${m.done ? 'uneat' : 'eat'}" data-m="${i}">${m.done ? 'Scoate din jurnal' : 'Am mâncat, notează'}</button><button class="ghost" data-f="opts" data-m="${i}">Alte variante</button>${m.done ? '' : `<button class="ghost" data-f="move" data-m="${i}">Mută pe altă zi</button>`}<button class="ghost" data-f="rm" data-m="${i}">Scoate</button></div>`}</details>`;
}

function meals() {
  const s = ctx.get();
  if (needFoods()) return `${back()}<div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  mealDay ||= ctx.today();
  const monday = mondayOf(ctx.today());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
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
  return `${back()}${banner('meals', 'Meal Planner', 'Mese calculate pe ținta zilei, din valorile USDA.')}
  <div class="dayrow">${dates.map((d) => `<button data-f="mday" data-v="${d}" class="${d === mealDay ? 'on' : ''}">${esc(dayShort(d))}<small>${(s.fuel.plan[d] ?? []).length || '–'}</small><i class="dot ${dem(d)}"></i></button>`).join('')}</div>
  ${stale ? `<div class="updated"><p>Ținta zilei s-a schimbat față de planul de mese. Mesele deja notate rămân.</p><button class="ghost" data-f="gen">Actualizează mesele rămase</button></div>` : ''}
  <section class="card">${demandTag(dem(mealDay))}
    <div class="line"><span>Țintă</span><b>${n0(t.kcal)} kcal · P ${t.p} · C ${t.c} · G ${t.f}</b></div>
    <div class="line"><span>Planificat</span><b>${n0(sum.kcal)} kcal · P ${n0(sum.p)} · C ${n0(sum.c)} · G ${n0(sum.f)}</b></div>
    <div class="line"><span>Mâncat</span><b>${n0(ate.kcal)} kcal · P ${n0(ate.p)} · C ${n0(ate.c)} · G ${n0(ate.f)}</b></div>
    <div class="line"><span>Rămas</span><b>${n0(t.kcal - ate.kcal)} kcal · P ${n0(t.p - ate.p)} · C ${n0(t.c - ate.c)} · G ${n0(t.f - ate.f)}</b></div>
    ${past ? '<p class="hint">Zi încheiată: doar pentru citit.</p>' : `<div class="btns"><button class="primary" data-f="gen">Generează ziua</button><button class="ghost" data-f="genw">Generează săptămâna</button></div><p class="hint">Mesele notate în jurnal și cele alese de tine rămân.</p>`}</section>
  ${list.map(mealCard).join('') || '<p class="hint pad">Nicio masă pentru această zi.</p>'}
  <details class="card"><summary><b>Preferințe</b></summary><form id="pf">
    <label class="field">Mese pe zi<select name="meals">${[3, 4, 5].map((n) => `<option ${n === p.meals ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="field">Exclud (separate prin virgulă)<input name="exclude" value="${esc(p.exclude)}" placeholder="somon, nuci"></label>
    <label class="field">Alergii<input name="allergies" value="${esc(p.allergies)}" placeholder="lapte, arahide"></label>
    <label class="field">Timp de gătit maxim pe masă (minute)<input name="maxCook" type="number" min="3" max="60" value="${p.maxCook}"></label>
    <button class="primary wide">Salvează</button></form></details>
  ${shop.length ? `<details class="card"><summary><b>Listă de cumpărături</b> <small class="hint">${shop.length}</small></summary>${shop.map((x) => `<label class="shop ${s.fuel.shopDone.includes(x.id) ? 'done' : ''}"><input type="checkbox" data-shop="${esc(x.id)}" ${s.fuel.shopDone.includes(x.id) ? 'checked' : ''}><span>${esc(x.name)}</span><b>${n0(x.g)} g</b></label>`).join('')}</details>` : ''}`;
}

const waterOn = (d: string) => (ctx.get().drinks[d] ?? []).reduce((a, x) => a + x.ml, 0);

function water() {
  const s = ctx.get();
  const today = ctx.today();
  const kg = latestKg();
  const target = waterTarget(kg, s.waterMlKg);
  const drank = waterOn(today);
  const t = training();
  const mins = (t.week[weekday(today)] ?? []).reduce((a, x) => a + (x.kind === 'wimhof' || x.kind === 'breath' ? 0 : x.min), 0);
  const fl = trainingFluid(mins, s.sweat);
  const w = windowFor(s.fast, weekday(today));
  return `${back()}${banner('water', 'Hidratare')}
  <section class="card tank"><div class="glass"><i data-level="w" data-to="${Math.min(1, drank / target)}"></i><b data-count="wtr" data-to="${drank}">${n0(drank)}</b><small>din ${n0(target)} ml</small></div>
    <div class="chips">${[200, 250, 330, 500].map((m) => `<button data-f="drink" data-v="${m}">+${m} ml</button>`).join('')}</div>
    <div class="seg small"><button data-f="dk" data-v="Apă" class="${dk === 'Apă' ? 'on' : ''}">Apă</button><button data-f="dk" data-v="Cafea/ceai" class="${dk === 'Cafea/ceai' ? 'on' : ''}">Cafea/ceai</button><button data-f="dk" data-v="Altceva" class="${dk === 'Altceva' ? 'on' : ''}">Altceva</button></div>
    ${(s.drinks[today] ?? []).slice(-6).reverse().map((d) => `<div class="line"><span>${esc(d.time)} · ${esc(d.kind)}</span><b>${d.ml} ml</b><button class="xs" data-f="undrink" data-v="${d.id}" aria-label="Șterge">×</button></div>`).join('')}
    ${w && !status(w, new Date().getHours() * 60).eating ? '<p class="hint">Apa și băuturile fără calorii sunt permise în post.</p>' : ''}
    <label class="field">Țintă (ml/kg). 35 e un ghid general, ajustabil.<input type="number" id="mlkg" min="20" max="60" value="${s.waterMlKg}"></label>
    <label class="field">Reamintire în aplicație (minute, 0 = oprit)<input type="number" id="rem" min="0" max="240" value="${s.remindMin}"></label>
  </section>
  <section class="card"><h2>Azi la antrenament</h2><p>${mins ? `${mins} minute planificate.` : 'Fără sesiuni planificate.'} ${fl && mins ? `La rata ta medie de ${fl.rate.toFixed(2)} L/h ai pierde cam ${fl.litres.toFixed(1)} L.` : 'Măsoară rata de transpirație ca să vezi cât pierzi.'}</p><p class="hint">Informativ, nu o prescripție de lichide sau electroliți.</p></section>
  <section class="card"><h2>Rata de transpirație</h2><form id="sf2"><div class="grid2">
    <label class="field">Greutate înainte, kg<input name="pre" type="number" step="0.01" required></label><label class="field">Greutate după, kg<input name="post" type="number" step="0.01" required></label>
    <label class="field">Lichide băute, L<input name="fluidL" type="number" step="0.01" value="0" required></label><label class="field">Urină, L<input name="urineL" type="number" step="0.01" value="0" required></label>
    <label class="field">Durată, ore<input name="hours" type="number" step="0.05" min="0.1" required></label><label class="field">Notă<input name="note"></label></div><button class="primary wide">Calculează</button></form>
    ${[...s.sweat].reverse().slice(0, 6).map((x) => `<div class="line"><span>${esc(x.date)} ${esc(x.note)}</span><b>${(sweatRate(x) ?? 0).toFixed(2)} L/h</b><em>${sweatLoss(x).toFixed(2)} L</em></div>`).join('')}</section>
  <section class="card"><h2>Minerale</h2>${MINERALS.map(([a, b]) => `<p><b>${a}.</b> ${esc(b)}</p>`).join('')}</section>`;
}
let dk = 'Apă';

function supp() {
  const s = ctx.get();
  const today = ctx.today();
  const taken = s.suppLog[today] ?? [];
  const issues = analyseStack(s.supps);
  return `${back()}${banner('supp', 'Suplimente', 'Informații educaționale, nu sfaturi medicale. Aplicația nu recomandă automat nimic.')}
  ${issues.map((i) => `<p class="${i.level === 'warn' ? 'warn' : 'hint'} issue">${esc(i.text)}</p>`).join('')}
  ${s.supps.map((x) => `<section class="card sup"><label class="check"><input type="checkbox" data-take="${x.id}" ${taken.includes(x.id) ? 'checked' : ''}><span><b>${esc(x.product)}</b> ${esc(x.brand)}<br><small class="hint">${esc(x.ingredient)} · ${esc(x.serving)} · ${esc(x.time)} · ${esc(x.freq)}</small></span></label><button class="xs" data-f="delsup" data-v="${x.id}" aria-label="Șterge">×</button></section>`).join('')}
  <details class="card"><summary><b>Adaugă în stack</b></summary><form id="suf">
    ${[['product', 'Produs'], ['brand', 'Marcă'], ['ingredient', 'Ingredient activ'], ['serving', 'Porție'], ['time', 'Când'], ['freq', 'Frecvență'], ['notes', 'Note']].map(([k, l]) => `<label class="field">${l}<input name="${k}" ${k === 'product' || k === 'ingredient' ? 'required' : ''}></label>`).join('')}
    <label class="field">Cantitate pe zi (mg)<input name="mgPerDay" type="number" step="any" value="0"></label><button class="primary wide">Salvează</button></form></details>
  <h3>Baza de dovezi</h3>
  ${EVIDENCE.map((e) => `<details class="card"><summary><b>${esc(e.name)}</b> <span class="ev">${e.strength}</span></summary><p>${esc(e.purpose)}</p>${[['Doze studiate', e.dose], ['Moment', e.timing], ['Efecte adverse', e.effects], ['Contraindicații', e.contra], ['Interacțiuni', e.interactions]].map(([a, b]) => `<p><b>${a}:</b> ${esc(b)}</p>`).join('')}<p class="hint">Alege produse testate de terți (de exemplu Informed Sport sau NSF). Surse: ${esc(e.refs)}.</p></details>`).join('')}`;
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
    return `<details class="mic"><summary><span>${m.name}</span><span class="track"><div data-bar="m-${m.key}" data-to="${Math.min(1, pct)}"></div></span><em>${Math.round(pct * 100)}%</em></summary>
      <p class="hint">${val.toFixed(val < 10 ? 1 : 0)} ${m.unit} din referința de ${ref} ${m.unit}${m.limit ? ', iar peste ea nu e o țintă' : ''}. Date pentru ${Math.round(cov * 100)}% din calorii, deci valoarea reală poate fi mai mare. Surse: ${esc(m.sources)}.</p></details>`;
  };
  return `${back()}<section class="lead"><h1>Micronutrienți</h1><p>Estimări din alimentele notate, față de referințele pentru adulți. Nu arată o carență și nu înseamnă că ai nevoie de suplimente.</p></section>
  <div class="seg"><button data-f="mic" data-v="0" class="${microWeek ? '' : 'on'}">Azi</button><button data-f="mic" data-v="1" class="${microWeek ? 'on' : ''}">Media pe 7 zile</button></div>
  ${entries.length ? `<section class="card"><h2>Vitamine</h2>${MICROS.filter((m) => m.group === 'v').map(row).join('')}</section><section class="card"><h2>Minerale</h2>${MICROS.filter((m) => m.group === 'm').map(row).join('')}</section>` : '<p class="hint pad">Notează alimente ca să apară datele. Valorile lipsă nu sunt tratate ca zero.</p>'}
  <p class="hint">Iodul nu există în baza USDA, deci nu poate fi calculat. Produsele Open Food Facts și alimentele manuale nu au micronutrienți.</p>`;
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
    <div class="stats"><div><b>${n0(r.avg.kcal)}</b><span>kcal / ${n0(r.target.kcal)}</span></div><div><b>${r.avg.p}</b><span>g P / ${r.target.p}</span></div><div><b>${r.avg.c}</b><span>g carbo</span></div><div><b>${r.avg.f}</b><span>g grăsimi</span></div></div>
    <div class="line"><span>Zile notate</span><b>${r.logged} din 7</b></div><div class="line"><span>Fibre, medie</span><b>${r.avg.fiber} g</b></div>
    <div class="line"><span>Zile HIGH / MOD / LOW / REST</span><b>${r.demand['high']} / ${r.demand['moderate']} / ${r.demand['low']} / ${r.demand['rest']}</b></div>
    <div class="line"><span>Sesiuni făcute din planificate</span><b>${r.done} din ${r.planned}</b></div>
    ${r.carbFit != null ? `<div class="line"><span>Zile la ±15% de ținta de carbo</span><b>${r.carbFit}%</b></div>` : ''}
    <div class="line"><span>Lichide, medie</span><b>${r.avg.water ? `${n0(r.avg.water)} ml` : 'nenotat'}</b></div>
    <div class="line"><span>Zile cu suplimente bifate</span><b>${r.suppDays}</b></div>
    ${r.fastKnown ? `<div class="line"><span>Post respectat</span><b>${r.fastKept} din ${r.fastKnown}</b></div>` : ''}
    ${r.weight != null ? `<div class="line"><span>Greutate medie</span><b>${r.weight.toFixed(1)} kg${r.weightChange != null ? ` (${r.weightChange > 0 ? '+' : ''}${r.weightChange.toFixed(2)})` : ''}</b></div>` : ''}
    ${r.waist != null ? `<div class="line"><span>Talie</span><b>${r.waist} cm</b></div>` : ''}
    ${r.recs.map((x) => `<p class="coach">${esc(x)}</p>`).join('')}</details>`;
  const a = adherence(s.fast, today);
  return `${back()}${banner('analytics', 'Analytics', 'Doar date salvate de tine. Legăturile dintre cifre nu dovedesc o cauză.')}<button class="ghost wide" data-f="sub" data-v="micro">Micronutrienți</button>
  ${card(current, 'Săptămâna curentă, până acum', true)}${list.map((r) => card(r, `Săptămâna din ${r.week}`, false)).join('')}
  ${a.known ? '' : ''}`;
}

export function fuelHtml() {
  const out = `<div class="${enter ? 'subin' : ''}">${{ home, overview, carbs: carbsHtml, meals, water, supp, micro, report, advanced, recovery }[sub]()}</div>`;
  enter = false;
  fx.recalc = false;
  return out;
}

function openSwap(mi: number, ii: number) {
  const s = ctx.get();
  const list = s.fuel.plan[mealDay]!;
  const it = list[mi]!.items[ii]!;
  const alt = alternatives(it.role, it.foodId, pantry.foods, s.fuel.prefs);
  ctx.open(`<h2>Schimbă ${esc(pantry.map.get(it.foodId)?.name ?? '')}</h2><p class="hint">Masa se recalculează ca să păstreze macronutrienții.</p>${alt.map((f) => `<button class="row" data-f="swgo" data-m="${mi}" data-i="${ii}" data-v="${f.id}"><span><b>${esc(f.name)}</b></span><em>${n0(f.kcal)}<small> kcal/100 g</small></em></button>`).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
}

const entriesOf = (m: Meal) => m.items.flatMap((it) => { const f = pantry.map.get(it.foodId); return f ? [entryFrom(f, it.g)] : []; });
const slotOf = (mi: number) => Math.min(mi, MEALS.length - 1);

/** After a logged meal changed: the journal and the remaining targets follow. False when it cannot be matched. */
function syncLog(meal: Meal, mi: number, next: ReturnType<typeof entriesOf>): boolean {
  const s = ctx.get();
  const days = relog(dayMeals(s, mealDay), meal.id, next, slotOf(mi), meal.done);
  if (!days) { ctx.toast('Masa a fost notată înainte de această versiune. Schimb-o din Azi.'); return false; }
  s.days[mealDay] = days;
  return true;
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
  pending = kind === 'snack' ? snackOptions(Math.min(40, Math.round(slot.c * 0.5)), pantry.foods, s.fuel.prefs, time, tag) : mealOptions({ p: slot.p, c: slot.c, f: slot.f }, pantry.foods, s.fuel.prefs, time, tag, Date.now() % 97);
  ctx.open(`<h2>${esc(tag)}</h2><p class="hint">Din baza de alimente, cu valorile ei reale. Mesele rămase se ajustează ca ziua să iasă pe țintă.</p>${pending.map((o, k) => { const m = macros(o.items, pantry.map); return `<button class="row" data-f="tplace" data-d="${date}" data-v="${k}"><span><b>${esc(o.name)}</b><small>${o.items.map((it) => `${n0(it.g)} g ${esc(pantry.map.get(it.foodId)?.name ?? '')}`).join(', ')}</small></span><em>${n0(m.kcal)}<small> kcal</small><br>P ${n0(m.p)} · C ${n0(m.c)} · G ${n0(m.f)}</em></button>`; }).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
}

/** Actions that only touch how Carb Cycling is shown or configured. */
function carbAction(a: string, el: HTMLElement): boolean {
  const s = ctx.get();
  const d = el.dataset;
  const v = d['v'] ?? '';
  const change = () => { fx.recalc = true; s.fuel.sig = ''; notice.text = ''; ctx.commit(); ctx.render(); return true; };
  if (a === 'cv') { openCarbs(v as View); ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'dd') { cv.detail = v; if (v) cv.pick = v; enter = true; ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'wk') { cv.week += Number(v); cv.dir = Number(v); ctx.render(); return true; }
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
  ctx.open(`<h2>${esc(m.tag || 'Alte variante')}</h2><p class="hint">Aceleași macronutrienți, alte alimente.</p>${pending.map((o, k) => { const t = macros(o.items, pantry.map); return `<button class="row" data-f="optgo" data-m="${mi}" data-v="${k}"><span><b>${esc(o.name)}</b><small>${o.items.map((it) => `${n0(it.g)} g ${esc(pantry.map.get(it.foodId)?.name ?? '')}`).join(', ')}</small></span><em>${n0(t.kcal)}<small> kcal</small><br>P ${n0(t.p)} · C ${n0(t.c)} · G ${n0(t.f)}</em></button>`; }).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
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
      if (v === 'engine') openCarbs('config'); else if (v === 'carbs') openCarbs('today');
      sub = (v === 'engine' ? 'carbs' : v) as Sub; enter = true; notice.text = sub === 'carbs' ? notice.text : ''; ctx.render(); scrollTo(0, 0);
    };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
    return true;
  }
  if (carbAction(a, el)) return true;
  if (a === 'topt') { void openTiming(d['d']!, v as 'pre' | 'post' | 'snack'); return true; }
  if (a === 'tplace') { placeMeal(d['d']!, pending[Number(v)]!); ctx.close(); ctx.toast('Programată în Meal Planner.'); }
  if (a === 'mday') mealDay = v;
  if (a === 'gen') { s.fuel.plan[mealDay] = genDay(mealDay, Date.now() % 97); }
  if (a === 'genw') { const m = mondayOf(ctx.today()); for (let i = 0; i < 7; i++) { const x = addDays(m, i); if (x >= ctx.today()) s.fuel.plan[x] = genDay(x, i * 3 + 1); } }
  if (a === 'sw') { openSwap(mi, Number(d['i'])); return true; }
  if (a === 'opts') { openOptions(mi); return true; }
  if (a === 'swgo') {
    const next = substitute(meal!, Number(d['i']), pantry.map.get(v)!, pantry.map);
    if (meal!.done && !syncLog(next, mi, entriesOf(next))) return true;
    plan[mi] = next; ctx.close();
  }
  if (a === 'optgo') {
    const next = { ...pending[Number(v)]!, id: meal!.id, done: meal!.done };
    if (meal!.done && !syncLog(next, mi, entriesOf(next))) return true;
    plan[mi] = next; ctx.close();
  }
  if (a === 'rm') { if (meal!.done && !syncLog(meal!, mi, [])) return true; plan.splice(mi, 1); }
  if (a === 'move') {
    const m = mondayOf(ctx.today());
    ctx.open(`<h2>Mută pe</h2>${Array.from({ length: 7 }, (_, i) => addDays(m, i)).filter((x) => x !== mealDay && x >= ctx.today()).map((x) => `<button class="row" data-f="movego" data-m="${mi}" data-v="${x}"><span><b>${esc(dayShort(x))} ${x.slice(8)}</b></span></button>`).join('')}`);
    return true;
  }
  if (a === 'movego') { const [m] = plan.splice(mi, 1); (s.fuel.plan[v] ??= []).push(m!); ctx.close(); ctx.toast('Masă mutată. Vezi totalurile zilei.'); }
  if (a === 'eat') { if (!syncLog({ ...meal!, done: false }, mi, entriesOf(meal!))) return true; meal!.done = true; }
  if (a === 'uneat') { if (!syncLog(meal!, mi, [])) return true; meal!.done = false; }
  if (a === 'drink') { const now = new Date(); (s.drinks[ctx.today()] ??= []).push({ id: crypto.randomUUID(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ml: Number(v), kind: dk }); }
  if (a === 'dk') dk = v;
  if (a === 'undrink') s.drinks[ctx.today()] = (s.drinks[ctx.today()] ?? []).filter((x) => x.id !== v);
  if (a === 'delsup') s.supps = s.supps.filter((x) => x.id !== v);
  if (a === 'mic') microWeek = v === '1';
  ctx.commit(); ctx.render();
  return true;
}

let reminder = 0;

export function fuelBind() {
  const s = ctx.get();
  const on = (sel: string, fn: (i: HTMLInputElement) => void) => document.querySelector<HTMLInputElement>(sel)?.addEventListener('change', (ev) => fn(ev.target as HTMLInputElement));
  const save = () => { ctx.commit(); ctx.render(); };
  on('#cyc', (i) => { s.fuel.cycling = i.checked; if (!i.checked) s.fuel.sig = ''; fx.recalc = true; save(); });
  const flag = (id: string, fn: (on: boolean) => void) => on(id, (i) => { fn(i.checked); s.fuel.sig = ''; fx.recalc = true; save(); });
  flag('#csync', (v) => { s.fuel.sync = v; });
  flag('#cbox', (v) => { s.fuel.boxStrength = v; });
  on('#cintra', (i) => { s.fuel.intra = i.checked; save(); });
  on('#pregap', (i) => { s.fuel.preGap = Math.max(0, Number(i.value) || 0); save(); });
  on('#frpe', (i) => { (s.fuel.feedback[i.dataset['d']!] ??= {} as Feedback).rpe = Number(i.value); fx.recalc = true; save(); });
  document.querySelectorAll<HTMLInputElement>('[data-weight]').forEach((i) => i.addEventListener('change', () => { s.fuel.weights[i.dataset['weight'] as keyof typeof s.fuel.weights] = Math.min(1.5, Math.max(0, Number(i.value) || 0)); s.fuel.sig = ''; save(); }));
  document.querySelectorAll<HTMLInputElement>('[data-time]').forEach((i) => i.addEventListener('change', () => { s.fuel.times[Number(i.dataset['time'])] = i.value; save(); }));
  on('#thour', (i) => { s.fuel.trainingHour = i.value || '17:00'; save(); });
  document.querySelectorAll<HTMLInputElement>('[data-limit]').forEach((i) => i.addEventListener('change', () => { s.fuel.limits[i.dataset['limit'] as 'high' | 'moderate'] = Math.max(5, Number(i.value) || 0); save(); }));
  document.querySelectorAll<HTMLDetailsElement>('details.mealc').forEach((m) => m.addEventListener('toggle', () => { if (m.open) openMeals.add(m.dataset['id']!); else openMeals.delete(m.dataset['id']!); }));
  on('#mlkg', (i) => { s.waterMlKg = Number(i.value) || 35; save(); });
  on('#rem', (i) => { s.remindMin = Number(i.value) || 0; save(); if (s.remindMin && 'Notification' in window) void Notification.requestPermission(); });
  document.querySelectorAll<HTMLInputElement>('[data-factor]').forEach((i) => i.addEventListener('change', () => { s.fuel.factors[i.dataset['factor'] as Demand] = Math.min(2, Math.max(0.3, Number(i.value) || 1)); save(); }));
  document.querySelectorAll<HTMLInputElement>('[data-shop]').forEach((i) => i.addEventListener('change', () => { const id = i.dataset['shop']!; s.fuel.shopDone = i.checked ? [...s.fuel.shopDone, id] : s.fuel.shopDone.filter((x) => x !== id); i.closest('.shop')?.classList.toggle('done', i.checked); ctx.commit(); }));
  document.querySelectorAll<HTMLInputElement>('[data-take]').forEach((i) => i.addEventListener('change', () => { const t = ctx.today(); const list = s.suppLog[t] ?? []; s.suppLog[t] = i.checked ? [...list, i.dataset['take']!] : list.filter((x) => x !== i.dataset['take']); ctx.commit(); }));
  const form = (id: string, fn: (d: FormData) => void) => document.querySelector<HTMLFormElement>(id)?.addEventListener('submit', (ev) => { ev.preventDefault(); fn(new FormData(ev.target as HTMLFormElement)); save(); });
  form('#pf', (d) => { s.fuel.prefs = { ...s.fuel.prefs, meals: Number(d.get('meals')) as 3 | 4 | 5, exclude: String(d.get('exclude')), allergies: String(d.get('allergies')), maxCook: Number(d.get('maxCook')) || 30 }; });
  form('#sf2', (d) => { const n = (k: string) => Number(d.get(k)); s.sweat.push({ id: crypto.randomUUID(), date: ctx.today(), pre: n('pre'), post: n('post'), fluidL: n('fluidL'), urineL: n('urineL'), hours: n('hours'), note: String(d.get('note') ?? '') }); });
  form('#suf', (d) => { const t = (k: string) => String(d.get(k) ?? ''); s.supps.push({ id: crypto.randomUUID(), product: t('product'), brand: t('brand'), ingredient: t('ingredient'), serving: t('serving'), mgPerDay: Number(d.get('mgPerDay')) || 0, time: t('time'), freq: t('freq'), start: ctx.today(), notes: t('notes') }); });
  clearInterval(reminder);
  if (s.remindMin > 0) reminder = window.setInterval(() => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Hidratare', { body: 'E momentul pentru un pahar de apă.' }); else ctx.toast('E momentul pentru un pahar de apă.');
  }, s.remindMin * 60000);
}
