import { ctx, dayShort, esc, n0 } from '../app.ts';
import { EVIDENCE, MINERALS } from '../data/supplements.ts';
import { targetFor, weekday, type DayTarget } from '../logic/calc.ts';
import { mealCarbShares, reconcile, weekFuel, type FuelDay } from '../logic/carbs.ts';
import { adherence, status, windowFor } from '../logic/fasting.ts';
import { loadFoods, type Food } from '../logic/foods.ts';
import { alternatives, generateDay, macros, shoppingList, substitute, type Meal } from '../logic/mealplan.ts';
import { buildReport, type DayFacts } from '../logic/report.ts';
import { addDays, finishedWeeks, mondayOf } from '../logic/review.ts';
import { dayMeals, entryFrom, MEALS, totals, type Snap } from '../logic/store.ts';
import { dayPlan, DEMAND_LABEL, readTraining, type DayPlan, type Demand, type Training } from '../logic/training.ts';
import { analyseStack, microTotals, MICROS, sweatLoss, sweatRate, trainingFluid, waterTarget, type MicroEntry } from '../logic/wellness.ts';

type Sub = 'home' | 'carbs' | 'meals' | 'water' | 'supp' | 'micro' | 'report';
let sub: Sub = 'home';
let enter = false;
let mealDay = '';
let microWeek = false;
let notice = '';
let foods: Food[] = [];
let foodMap = new Map<string, Food>();

const training = (): Training => readTraining(localStorage);

function plansFor(monday: string, t: Training): Record<string, DayPlan> {
  const s = ctx.get();
  const out: Record<string, DayPlan> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    out[d] = dayPlan(t, d, ctx.today(), i, s.fuel.overrides[d], s.fuel.limits);
  }
  return out;
}

/** Past days use their frozen carbs; today and later are shared out from what is left of the week. */
function fuelWeek(monday: string, t = training()): { days: FuelDay[]; plans: Record<string, DayPlan> } {
  const s = ctx.get();
  const plans = plansFor(monday, t);
  const locked: Record<string, number> = {};
  for (const d of Object.keys(plans)) if (d < ctx.today()) locked[d] = s.fuel.snap[d]?.c ?? targetFor(s.plan!, d).c;
  return { plans, days: weekFuel(s.plan!, monday, (d) => s.fuel.snap[d]?.demand && d < ctx.today() ? s.fuel.snap[d]!.demand : plans[d]!.rating.demand, s.fuel.factors, s.profile!.sex, locked) };
}

export function dayFuel(date: string): DayTarget {
  const s = ctx.get();
  const snap: Snap | undefined = s.fuel.snap[date];
  if (date < ctx.today() && snap && s.fuel.cycling) return { ...targetFor(s.plan!, date), ...snap };
  if (!s.fuel.cycling) return targetFor(s.plan!, date);
  return fuelWeek(mondayOf(date)).days.find((d) => d.date === date)!;
}

/** Freezes today's plan as it stands, and notices when training changed the week. */
export function syncFuel() {
  const s = ctx.get();
  if (!s.plan || !s.profile || !s.fuel.cycling) return;
  const today = ctx.today();
  const monday = mondayOf(today);
  const { days, plans } = fuelWeek(monday);
  for (const d of days) {
    if (d.date > today) continue;
    if (d.date === today || !s.fuel.snap[d.date]) s.fuel.snap[d.date] = { c: d.c, kcal: d.kcal, p: d.p, f: d.f, demand: plans[d.date]!.plannedRating.demand, reason: plans[d.date]!.rating.reason };
  }
  const sig = days.filter((d) => d.date >= today).map((d) => `${d.date}:${d.demand}`).join('|');
  if (s.fuel.sig && s.fuel.sig.slice(0, 10) === sig.slice(0, 10) && s.fuel.sig !== sig) notice = 'Antrenamentele s-au schimbat, așa că zilele rămase au fost recalculate. Totalul săptămânii e același.';
  if (s.fuel.sig !== sig) { s.fuel.sig = sig; ctx.commit(); }
}

const back = () => `<button class="backbtn" data-f="sub" data-v="home">‹ Fuel</button>`;
const demandTag = (d: Demand) => `<span class="dm ${d}">${DEMAND_LABEL[d]}</span>`;

function home() {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const p = dayPlan(t, today, today, weekday(today), s.fuel.overrides[today], s.fuel.limits);
  const f = dayFuel(today);
  const left = totals(dayMeals(s, today));
  const tiles: [Sub, string, string][] = [['carbs', 'Carb Cycling', s.fuel.cycling ? 'Activ' : 'Oprit'], ['meals', 'Meal Planner', `${(s.fuel.plan[today] ?? []).length} mese azi`], ['water', 'Hidratare', `${n0(waterOn(today))} ml`], ['supp', 'Suplimente', `${s.supps.length} în stack`], ['micro', 'Micronutrienți', '20 urmăriți'], ['report', 'Raport', `${Object.keys(s.reports).length} salvate`]];
  return `<section class="lead"><h1>Fuel</h1><p>${t.linked ? 'Conectat la antrenamentele din Inner Beast.' : 'Inner Beast nu a fost deschis în acest browser: folosesc planul standard din carte.'}</p></section>
  <section class="card fuelhero">${demandTag(p.rating.demand)}<h2>${p.planned.length ? esc(p.planned.filter((x) => x.min > 0).map((x) => x.name).slice(0, 3).join(' + ')) : 'Fără antrenament'}</h2><p class="hint">${esc(p.rating.reason)} ${p.basis === 'manual' ? '' : 'Estimare din tipul și durata sesiunilor.'}</p>
    <div class="stats"><div><b data-count="fk" data-to="${f.kcal}">${n0(f.kcal)}</b><span>kcal țintă</span></div><div><b>${f.p}</b><span>g proteine</span></div><div><b>${f.c}</b><span>g carbo</span></div><div><b>${f.f}</b><span>g grăsimi</span></div></div>
    <p class="hint">Consumat azi: ${n0(left.kcal)} kcal · P ${n0(left.p)} · C ${n0(left.c)} · G ${n0(left.f)}</p></section>
  <div class="tiles">${tiles.map(([k, a, b]) => `<button data-f="sub" data-v="${k}"><b>${a}</b><span>${esc(b)}</span></button>`).join('')}</div>`;
}

function carbs() {
  const s = ctx.get();
  const monday = mondayOf(ctx.today());
  const { days, plans } = fuelWeek(monday);
  const r = reconcile(s.plan!, days);
  const max = Math.max(...days.map((d) => d.c), 1);
  const F = s.fuel.factors;
  return `${back()}<section class="lead"><h1>Carb Cycling</h1><p>Mută carbohidrații spre zilele grele. Caloriile săptămânii, proteina și grăsimile rămân cele din plan.</p></section>
  ${notice ? `<p class="updated">${esc(notice)}</p>` : ''}
  <section class="card"><label class="switch"><input type="checkbox" id="cyc" ${s.fuel.cycling ? 'checked' : ''}><i></i><span>Folosește distribuția în ținta zilnică</span></label>
    <p class="hint">Oprit, ținta rămâne exact cea din plan. Aceasta nu e o metodă Layne Norton: e un calcul al aplicației, peste metoda lui.</p></section>
  <section class="week7">${days.map((d) => {
    const pl = plans[d.date]!;
    const isToday = d.date === ctx.today();
    return `<details class="dayfuel ${d.demand} ${isToday ? 'today' : ''}" ${isToday ? 'open' : ''}><summary><span class="dn">${esc(dayShort(d.date))}</span><span class="cbar"><i data-bar="c-${d.date}" data-to="${d.c / max}"></i></span><b>${d.c} g</b></summary>
      ${demandTag(d.demand)}${d.fixed ? ' <small class="hint">zi încheiată, ținta nu se mai schimbă</small>' : ''}
      <p class="hint">${esc(pl.rating.reason)}${pl.done.length ? ` Făcut: ${esc(pl.done.map((x) => `${x.name} ${x.min} min`).join(', '))}.` : ''}</p>
      <div class="line"><span>Plan</span><b>${n0(d.kcal)} kcal · P ${d.p} · C ${d.c} · G ${d.f}</b></div>
      <div class="line"><span>Față de planul de bază</span><b>${d.shift > 0 ? '+' : ''}${d.shift} g carbo</b></div>
      ${d.fixed ? '' : `<div class="seg small">${(['high', 'moderate', 'low', 'rest'] as Demand[]).map((x) => `<button data-f="ov" data-d="${d.date}" data-v="${x}" class="${s.fuel.overrides[d.date] === x ? 'on' : ''}">${x === 'high' ? 'High' : x === 'moderate' ? 'Mod' : x === 'low' ? 'Low' : 'Rest'}</button>`).join('')}</div>${s.fuel.overrides[d.date] ? `<button class="backbtn" data-f="ov" data-d="${d.date}" data-v="">Revino la automat</button>` : ''}`}
    </details>`;
  }).join('')}</section>
  <section class="card"><h2>Verificare săptămână</h2>
    <div class="line"><span>Calorii plan / distribuție</span><b>${n0(r.kcalPlan)} / ${n0(r.kcalFuel)}</b></div>
    <div class="line"><span>Carbo plan / distribuție</span><b>${n0(r.carbsPlan)} / ${n0(r.carbsFuel)} g</b></div>
    <div class="line"><span>Proteină și grăsimi</span><b>${r.proteinSame && r.fatSame ? 'neschimbate' : 'diferă'}</b></div></section>
  <section class="card"><h2>Factori</h2><p class="hint">Cât primește fiecare tip de zi, înainte de reechilibrarea săptămânii.</p>
    <div class="grid2">${(['high', 'moderate', 'low', 'rest'] as Demand[]).map((k) => `<label class="field">${DEMAND_LABEL[k]}<input type="number" step="0.05" min="0.3" max="2" data-factor="${k}" value="${F[k]}"></label>`).join('')}</div>
    <label class="field">Ora obișnuită de antrenament<input type="time" id="thour" value="${s.fuel.trainingHour}"></label></section>
  <section class="card"><h2>Mese în jurul antrenamentului</h2><p>Înainte: o masă cu carbohidrați ușor de digerat, cu 1–3 ore înainte. După: proteină și carbohidrați la următoarea masă.</p><p class="hint">În zilele de odihnă, carbohidrații se împart egal. Sfat general al aplicației, nu din carte.</p></section>`;
}

const windowTimes = (n: number, date: string) => {
  const s = ctx.get();
  const w = windowFor(s.fast, weekday(date));
  const [h = 8, m = 0] = (w?.start ?? '08:00').split(':').map(Number);
  const span = w ? w.eatMin : 720;
  return Array.from({ length: n }, (_, i) => { const t = h * 60 + m + (n > 1 ? (span * 0.9 * i) / (n - 1) : 0); return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.round(t % 60 / 5) * 5 % 60).padStart(2, '0')}`; });
};

function genDay(date: string, seed: number): Meal[] {
  const s = ctx.get();
  const t = dayFuel(date);
  const n = s.fuel.prefs.meals;
  const times = windowTimes(n, date);
  const demand = (s.fuel.cycling ? fuelWeek(mondayOf(date)).days.find((d) => d.date === date)?.demand : dayPlan(training(), date, ctx.today(), weekday(date), undefined, s.fuel.limits).rating.demand) ?? 'rest';
  const before = times.reduce((best, x, i) => (x <= s.fuel.trainingHour ? i : best), 0);
  const trainingMeal = demand === 'rest' || demand === 'low' ? null : before;
  const tags = times.map((_, i) => (trainingMeal == null ? '' : i === trainingMeal ? 'Înainte de antrenament' : i === trainingMeal + 1 ? 'După antrenament' : ''));
  return generateDay(t, mealCarbShares(n, trainingMeal, demand), times, tags, foods, s.fuel.prefs, seed);
}

function mealCard(m: Meal, i: number) {
  const t = macros(m.items, foodMap);
  return `<details class="mealc ${m.done ? 'done' : ''}"><summary><span class="mt">${esc(m.time)}</span><span><b>${esc(m.name)}</b><small>${esc(m.tag)}${m.tag ? ' · ' : ''}${n0(t.kcal)} kcal · P ${n0(t.p)} · C ${n0(t.c)} · G ${n0(t.f)} · fibre ${n0(t.fiber)}</small></span></summary>
    ${m.items.map((it, k) => { const f = foodMap.get(it.foodId); return `<div class="ing"><span>${n0(it.g)} g ${esc(f?.name ?? '')}</span><button data-f="sw" data-m="${i}" data-i="${k}">Schimbă</button></div>`; }).join('')}
    <p class="hint">${esc(m.steps)}</p>
    <div class="btns"><button class="primary" data-f="eat" data-m="${i}" ${m.done ? 'disabled' : ''}>${m.done ? 'Notată în jurnal' : 'Am mâncat, notează'}</button><button class="ghost" data-f="move" data-m="${i}">Mută pe altă zi</button><button class="ghost" data-f="rm" data-m="${i}">Scoate</button></div></details>`;
}

function meals() {
  const s = ctx.get();
  if (!foods.length) { void loadFoods().then((l) => { foods = l; foodMap = new Map(l.map((f) => [f.id, f])); ctx.render(); }); return `${back()}<div class="skel"></div><div class="skel"></div><div class="skel"></div>`; }
  mealDay ||= ctx.today();
  const monday = mondayOf(ctx.today());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const list = s.fuel.plan[mealDay] ?? [];
  const t = dayFuel(mealDay);
  const sum = macros(list.flatMap((m) => m.items), foodMap);
  const shop = shoppingList(dates.map((d) => s.fuel.plan[d] ?? []), foodMap);
  const p = s.fuel.prefs;
  return `${back()}<section class="lead"><h1>Meal Planner</h1><p>Cantitățile vin din valorile USDA și sunt calculate pe ținta zilei.</p></section>
  <div class="dayrow">${dates.map((d) => `<button data-f="mday" data-v="${d}" class="${d === mealDay ? 'on' : ''}">${esc(dayShort(d))}<small>${(s.fuel.plan[d] ?? []).length || '–'}</small></button>`).join('')}</div>
  <section class="card"><div class="line"><span>Țintă</span><b>${n0(t.kcal)} kcal · P ${t.p} · C ${t.c} · G ${t.f}</b></div><div class="line"><span>Planificat</span><b>${n0(sum.kcal)} kcal · P ${n0(sum.p)} · C ${n0(sum.c)} · G ${n0(sum.f)}</b></div>
    <div class="btns"><button class="primary" data-f="gen">Generează ziua</button><button class="ghost" data-f="genw">Generează săptămâna</button></div></section>
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
  const kg = Object.entries(s.weights).sort().at(-1)?.[1] ?? s.profile!.weightKg;
  const target = waterTarget(kg, s.waterMlKg);
  const drank = waterOn(today);
  const t = training();
  const mins = (t.week[weekday(today)] ?? []).reduce((a, x) => a + (x.kind === 'wimhof' || x.kind === 'breath' ? 0 : x.min), 0);
  const fl = trainingFluid(mins, s.sweat);
  const w = windowFor(s.fast, weekday(today));
  return `${back()}<section class="lead"><h1>Hidratare</h1></section>
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
  return `${back()}<section class="lead"><h1>Suplimente</h1><p>Informații educaționale, nu sfaturi medicale. Aplicația nu recomandă automat nimic.</p></section>
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
    const p = dayPlan(t, date, ctx.today(), i, s.fuel.overrides[date], s.fuel.limits);
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
  return `${back()}<section class="lead"><h1>Raport</h1><p>Doar date salvate de tine. Legăturile dintre cifre nu dovedesc o cauză.</p></section>
  ${card(current, 'Săptămâna curentă, până acum', true)}${list.map((r) => card(r, `Săptămâna din ${r.week}`, false)).join('')}
  ${a.known ? '' : ''}`;
}

export function fuelHtml() {
  const out = `<div class="${enter ? 'subin' : ''}">${{ home, carbs, meals, water, supp, micro, report }[sub]()}</div>`;
  enter = false;
  return out;
}

function setPlan(date: string, list: Meal[]) { ctx.get().fuel.plan[date] = list; }

function openSwap(mi: number, ii: number) {
  const s = ctx.get();
  const list = s.fuel.plan[mealDay]!;
  const it = list[mi]!.items[ii]!;
  const alt = alternatives(it.role, it.foodId, foods, s.fuel.prefs);
  ctx.open(`<h2>Schimbă ${esc(foodMap.get(it.foodId)?.name ?? '')}</h2><p class="hint">Masa se recalculează ca să păstreze macronutrienții.</p>${alt.map((f) => `<button class="row" data-f="swgo" data-m="${mi}" data-i="${ii}" data-v="${f.id}"><span><b>${esc(f.name)}</b></span><em>${n0(f.kcal)}<small> kcal/100 g</small></em></button>`).join('') || '<p class="hint">Nicio variantă pentru preferințele tale.</p>'}`);
}

export function fuelAction(el: HTMLElement): boolean {
  const a = el.dataset['f'];
  if (!a) return false;
  const s = ctx.get();
  const d = el.dataset;
  const v = d['v'] ?? '';
  const mi = Number(d['m']);
  if (a === 'sub') { sub = v as Sub; enter = true; ctx.render(); scrollTo(0, 0); return true; }
  if (a === 'ov') { if (v) s.fuel.overrides[d['d']!] = v as Demand; else delete s.fuel.overrides[d['d']!]; }
  if (a === 'mday') mealDay = v;
  if (a === 'gen') setPlan(mealDay, genDay(mealDay, Date.now() % 97));
  if (a === 'genw') { const m = mondayOf(ctx.today()); for (let i = 0; i < 7; i++) { const x = addDays(m, i); if (x >= ctx.today()) setPlan(x, genDay(x, i * 3 + 1)); } }
  if (a === 'sw') { openSwap(mi, Number(d['i'])); return true; }
  if (a === 'swgo') { const list = s.fuel.plan[mealDay]!; list[mi] = substitute(list[mi]!, Number(d['i']), foodMap.get(v)!, foodMap); ctx.close(); }
  if (a === 'rm') s.fuel.plan[mealDay]!.splice(mi, 1);
  if (a === 'move') {
    const m = mondayOf(ctx.today());
    ctx.open(`<h2>Mută pe</h2>${Array.from({ length: 7 }, (_, i) => addDays(m, i)).filter((x) => x !== mealDay).map((x) => `<button class="row" data-f="movego" data-m="${mi}" data-v="${x}"><span><b>${esc(dayShort(x))} ${x.slice(8)}</b></span></button>`).join('')}`);
    return true;
  }
  if (a === 'movego') { const [meal] = s.fuel.plan[mealDay]!.splice(mi, 1); (s.fuel.plan[v] ??= []).push(meal!); ctx.close(); ctx.toast('Masă mutată. Vezi totalurile zilei.'); }
  if (a === 'eat') {
    const list = s.fuel.plan[mealDay]!;
    const meal = list[mi]!;
    const days = dayMeals(s, mealDay).map((x) => [...x]);
    for (const it of meal.items) { const f = foodMap.get(it.foodId); if (f) days[Math.min(mi, MEALS.length - 1)]!.push(entryFrom(f, it.g)); }
    s.days[mealDay] = days;
    meal.done = true;
  }
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
  on('#cyc', (i) => { s.fuel.cycling = i.checked; if (!i.checked) s.fuel.sig = ''; save(); });
  on('#thour', (i) => { s.fuel.trainingHour = i.value || '17:00'; save(); });
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
