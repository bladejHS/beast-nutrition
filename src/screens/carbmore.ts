/* Carb Cycling: nutrient timing, what the logs show, and the settings. */
import { ctx, dayShort, esc, n0 } from '../app.ts';
import { dayBand } from '../logic/carbs.ts';
import { byClass, insights, MIN_RATINGS, plannedVsActual, type DayRow, type Rated } from '../logic/insights.ts';
import { addDays, mondayOf } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { TOLERANCE_LABEL, waterBefore, type Timing, type Tolerance } from '../logic/timing.ts';
import { CARB_LABEL, DEFAULT_RULES, DEMAND_LABEL, WEIGHT_LABEL, type WeightKey } from '../logic/training.ts';
import { cv } from './carbs.ts';
import { weekCheck } from './carbweek.ts';
import { comma, LEVELS, longDay, SHORT, shortDate } from './parts.ts';
import { fuelWeek, latestKg, mealSlots, timingFor, training, trainingTime } from './state.ts';

const macroLine = (x: { p: number; c: number; f: number }) => `P ${x.p} · C ${x.c} · G ${x.f}`;

function preCard(t: Timing, date: string) {
  const p = t.pre;
  if (!p) return `<li class="ts pre"><h3>Înainte</h3><p>Antrenamentul vine înaintea primei mese. Nu ai nevoie de o masă mare înainte; prima masă a zilei devine masa de după.</p></li>`;
  return `<li class="ts pre"><h3>Înainte</h3><div class="ts-h"><b>${p.mealTime}</b><span>cu ${p.gapMin} min înainte, ideal ${p.idealGap}</span></div>
    <div class="ts-m">${macroLine(p)}</div><p>${esc(p.note)}</p>
    ${p.snackTime ? `<p class="hint">Gustare la ${p.snackTime}, cam ${p.snackC} g carbo.</p>` : ''}
    <p class="hint">Apă: ${waterBefore(latestKg()).map((x) => n0(x)).join('–')} ml în cele 4 ore dinainte (ACSM).</p>
    <div class="btns"><button class="ghost" data-f="topt" data-d="${date}" data-v="pre">Variante de masă</button><button class="ghost" data-f="topt" data-d="${date}" data-v="snack">Variantă ușoară</button></div></li>`;
}

function intraCard(t: Timing) {
  const i = t.intra;
  return `<li class="ts intra"><h3>În timpul efortului</h3><div class="ts-h"><b>${t.start}–${t.end}</b><span>${i.minutes} min solicitante</span></div>
    <p>${esc(i.text)}</p>${i.total ? `<div class="ts-m">Maximum ${i.total} g în total</div><p class="hint">Intră în ținta de carbohidrați a zilei, nu se adaugă.</p>` : ''}
    <p class="hint">Reper: Thomas, Erdman și Burke, 2016 (ACSM, Academy of Nutrition and Dietetics, Dietitians of Canada).</p></li>`;
}

function postCard(t: Timing, date: string) {
  const p = t.post;
  if (!p) return `<li class="ts post"><h3>După</h3><p>Nu mai urmează nicio masă azi. Dacă te-ai antrenat târziu, păstrează o parte din carbohidrați și proteină pentru după sesiune.</p></li>`;
  return `<li class="ts post"><h3>După</h3><div class="ts-h"><b>${p.mealTime}</b><span>${p.afterMin >= 0 ? `la ${p.afterMin} min după final` : 'înainte să termini: mut-o după antrenament'}</span></div>
    <div class="ts-m">${macroLine(p)}</div><p>${esc(p.note)}</p>
    <p class="hint">${p.litres != null ? `La rata ta de transpirație pierzi cam ${comma(p.litres, 1)} L în această sesiune.` : 'Bea după sete. Rata de transpirație, măsurată la Hidratare, îți arată cât pierzi.'} Informativ.</p>
    <div class="btns"><button class="ghost" data-f="topt" data-d="${date}" data-v="post">Variante de masă</button></div></li>`;
}

export function timingView() {
  const s = ctx.get();
  const today = ctx.today();
  const monday = mondayOf(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  if (!dates.includes(cv.tday)) cv.tday = today;
  const date = cv.tday;
  const t = timingFor(date);
  const { days } = fuelWeek(monday);
  const dem = (d: string) => days.find((x) => x.date === d)!.demand;
  const sl = mealSlots(date);
  return `<div class="dayrow">${dates.map((d) => `<button data-f="tday" data-v="${d}" class="${d === date ? 'on' : ''}">${esc(dayShort(d))}<small>${Number(d.slice(8))}</small><i class="dot ${dem(d)}"></i></button>`).join('')}</div>
  <h2 class="sect">Nutrient Timing</h2><p class="hint">${esc(longDay(date))}. Sfaturi generale ale aplicației, nu din carte. Gramele ies din ținta zilei.</p>
  ${t.hasSession && sl.trainingMeal != null ? `<ol class="tline">${preCard(t, date)}${s.fuel.intra ? intraCard(t) : ''}${postCard(t, date)}</ol>`
    : `<section class="card"><h2>Recovery Fueling</h2><p>${dem(date) === 'rest' ? 'Zi de recuperare' : 'Efort ușor'}: nu ai nevoie de o masă specială. Proteina rămâne ca în plan, iar carbohidrații se împart egal pe mese.</p>${t.hasSession ? `<p class="hint">${esc(t.intra.text)}</p>` : ''}</section>`}
  <button class="ghost wide" data-f="sub" data-v="meals">Deschide Meal Planner</button>`;
}

/** Past days, newest week first, from what was saved. */
function pastWeeks(n: number): { monday: string; rows: DayRow[] }[] {
  const s = ctx.get();
  const today = ctx.today();
  const t = training();
  const first = mondayOf(today);
  return Array.from({ length: n }, (_, k) => {
    const monday = addDays(first, -7 * k);
    const { days, plans } = fuelWeek(monday, t);
    const rows = days.filter((d) => d.date < today).map((d) => {
      const p = plans[d.date]!;
      const sum = totals(dayMeals(s, d.date));
      return { date: d.date, demand: d.demand, planned: s.fuel.snap[d.date]?.planned ?? p.plannedRating.demand, targetC: d.c, eatenC: Math.round(sum.c), targetKcal: d.kcal, eatenKcal: Math.round(sum.kcal), sessionsDone: p.done.length, sessionsPlanned: p.planned.filter((x) => x.min > 0).length };
    });
    return { monday, rows };
  });
}

export function insightsView() {
  const s = ctx.get();
  const today = ctx.today();
  const weeks = pastWeeks(9);
  const rows = weeks.flatMap((w) => w.rows);
  const rated: Rated[] = Object.entries(s.fuel.feedback).map(([date, fb]) => ({ date, fb, demand: s.fuel.snap[date]?.demand ?? 'moderate' }));
  const list = insights(rated, s.fuel.factors);
  const need = Math.max(0, MIN_RATINGS - rated.length);
  const candidate = [today, ...rows.map((r) => r.date).reverse()].slice(0, 4).find((d) => !s.fuel.feedback[d] && (fuelWeek(mondayOf(d)).plans[d]?.done.length ?? 0) > 0);
  const pva = plannedVsActual(rows);
  const logged = rows.filter((r) => r.eatenKcal > 0);
  return `<h2 class="sect">Performance Insights</h2>
  ${candidate ? `<button class="adv" data-f="dd" data-v="${candidate}"><b>Cum a mers ${esc(longDay(candidate))}?</b><span>Notează energia și recuperarea, durează 20 de secunde.</span></button>` : ''}
  ${list.map((x) => `<section class="card ins ${x.level}"><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p>${x.action ? `<button class="ghost wide" data-f="acc" data-v="${x.id}">${esc(x.actionLabel ?? '')}</button><p class="hint">Se schimbă doar dacă accepți, și doar pentru zilele următoare.</p>` : ''}</section>`).join('')}
  ${!list.length ? `<section class="card"><p>${need ? `Mai ai nevoie de ${need} ${need === 1 ? 'evaluare' : 'evaluări'} până apar tipare. Una singură nu schimbă nimic.` : 'Niciun tipar clar în evaluările de până acum.'}</p></section>` : ''}
  <p class="hint">Tiparele arată ce se repetă în notele tale, nu ce le provoacă.</p>
  <section class="card"><h2>Carbohidrați pe clase</h2>${logged.length ? `${byClass(rows).filter((c) => c.days).map((c) => `<div class="line"><span>${CARB_LABEL[c.demand]}, ${c.days} ${c.days === 1 ? 'zi' : 'zile'}</span><b>${c.eatenC} / ${c.targetC} g</b><em>${c.fit}%</em></div>`).join('')}<p class="hint">Mâncat față de țintă, în medie. Procentul arată zilele la ±15% de țintă.</p>` : '<p class="hint">Apare după ce notezi mâncarea câteva zile.</p>'}</section>
  <section class="card"><h2>Planificat și realizat</h2>${pva.days ? `<div class="line"><span>Sesiuni făcute din planificate</span><b>${pva.sessionsDone} din ${pva.sessionsPlanned}</b></div><div class="line"><span>Zile care au ieșit în clasa planificată</span><b>${pva.sameClass} din ${pva.days}</b></div><p class="hint">Dacă diferă des, verifică planul sau ajustează pragurile. Clasificarea nu se schimbă singură.</p>` : '<p class="hint">Încă nu există zile încheiate.</p>'}</section>
  <h2 class="sect">Istoric</h2>
  ${weeks.filter((w) => w.rows.some((r) => r.eatenKcal > 0 || r.sessionsDone > 0)).map((w) => { const ate = w.rows.filter((r) => r.eatenKcal > 0); return `<details class="card hist"><summary><b>${shortDate(w.monday)} – ${shortDate(addDays(w.monday, 6))}</b><small>${ate.length} ${ate.length === 1 ? 'zi notată' : 'zile notate'}</small></summary>${w.rows.map((r) => `<button class="line hl ${r.demand}" data-f="dd" data-v="${r.date}"><span class="cap">${esc(dayShort(r.date))} ${Number(r.date.slice(8))}</span><i class="dm ${r.demand}">${SHORT[r.demand]}</i><b>${r.eatenKcal ? `${n0(r.eatenC)} / ` : ''}${r.targetC} g</b></button>`).join('')}</details>`; }).join('') || '<p class="hint pad">Istoricul apare după prima zi încheiată.</p>'}`;
}

export function configView() {
  const s = ctx.get();
  const f = s.fuel;
  const today = ctx.today();
  const monday = mondayOf(today);
  const { days } = fuelWeek(monday);
  const { r } = weekCheck(days);
  const band = dayBand(f.factors);
  const active = Object.entries(f.overrides).filter(([d]) => d >= today).sort();
  const sw = (id: string, on: boolean, label: string, hint = '') => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i><span>${label}</span></label>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  return `<h2 class="sect">Configurare</h2>
  <section class="card">${sw('cyc', f.cycling, 'Folosește distribuția în ținta zilnică', `Pornit, caloriile săptămânii rămân ${n0(r.kcalPlan)} kcal și se mută doar carbohidrații. Nu e o metodă Layne Norton, e un calcul al aplicației peste metoda lui.`)}</section>
  <section class="card"><h2>Clasificare</h2><div class="seg"><button data-f="cmode" data-v="auto" class="${f.mode === 'auto' ? 'on' : ''}">Automată</button><button data-f="cmode" data-v="manual" class="${f.mode === 'manual' ? 'on' : ''}">Manuală</button></div>
    <p class="hint">${f.mode === 'auto' ? 'Din antrenamentele reale. O zi o poți schimba oricând din detaliile ei.' : 'Doar clasele alese de tine. O zi neclasificată rămâne pe MODERATE.'}</p>
    <div class="gap">${sw('csync', f.sync, 'Sincronizare automată cu antrenamentele', 'Oprită, rămâne ultimul plan citit din Inner Beast.')}</div>
    <h3>Sensibilitate</h3><div class="seg small">${[[0.85, 'Scăzută'], [1, 'Normală'], [1.15, 'Ridicată']].map(([v, l]) => `<button data-f="sens" data-v="${v}" class="${f.sensitivity === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="grid2"><label class="field">HIGH de la<input type="number" min="10" max="200" data-limit="high" value="${f.limits.high}"></label><label class="field">MODERATE de la<input type="number" min="5" max="150" data-limit="moderate" value="${f.limits.moderate}"></label></div>
    <div class="gap">${sw('cbox', f.boxStrength, 'Box și forță în aceeași zi înseamnă HIGH')}</div></section>
  <details class="card"><summary><b>Intensități pe tip de sesiune</b></summary><p class="hint">Încărcarea = minute × intensitate. Valorile sunt ale aplicației.</p>
    <div class="grid2">${(Object.keys(WEIGHT_LABEL) as WeightKey[]).map((k) => `<label class="field">${WEIGHT_LABEL[k]}<input type="number" step="0.05" min="0" max="1.5" data-weight="${k}" value="${f.weights[k]}"></label>`).join('')}</div></details>
  <section class="card"><h2>Distribuție</h2>${sw('cpre', f.prefuel, 'Pre-fuel: ziua dinaintea unei zile HIGH', 'O zi LOW sau RECOVERY dinaintea unei zile HIGH primește factorul MODERATE, ca sesiunea grea să nu înceapă cu rezerve mici.')}<p class="hint">Cât primește fiecare tip de zi, înainte de reechilibrarea săptămânii. Nicio zi nu iese din intervalul ${comma(band.lo)}–${comma(band.hi)} × carbohidrații din plan.</p>
    <div class="grid2">${LEVELS.map((k) => `<label class="field">${DEMAND_LABEL[k]}<input type="number" step="0.05" min="0.3" max="2" data-factor="${k}" value="${f.factors[k]}"></label>`).join('')}</div></section>
  <section class="card"><h2>Timing</h2>
    <label class="field">Ora obișnuită de antrenament<input type="time" id="thour" value="${f.trainingHour}"></label>
    <details class="sub"><summary>Altă oră pe zile</summary><div class="grid2">${Array.from({ length: 7 }, (_, i) => { const d = addDays(monday, i); return `<label class="field cap">${esc(dayShort(d))}<input type="time" data-time="${i}" value="${trainingTime(d)}"></label>`; }).join('')}</div></details>
    <h3>Toleranță digestivă</h3><div class="seg small">${(['low', 'normal', 'high'] as Tolerance[]).map((v) => `<button data-f="tol" data-v="${v}" class="${f.tolerance === v ? 'on' : ''}">${TOLERANCE_LABEL[v]}</button>`).join('')}</div>
    <label class="field">Minute între masă și antrenament (0 = după toleranță)<input type="number" id="pregap" min="0" max="300" step="15" value="${f.preGap}"></label>
    <div class="gap">${sw('cintra', f.intra, 'Arată recomandările din timpul efortului')}</div>
    <button class="ghost wide" data-f="sub" data-v="meals">Preferințe de mese în Meal Planner</button></section>
  <section class="card"><h2>Zile schimbate manual</h2>${active.length ? active.map(([d, v]) => `<div class="line"><span class="cap">${esc(longDay(d))}</span><b>${CARB_LABEL[v]}</b><button class="xs" data-f="ov" data-d="${d}" data-v="" aria-label="Revino la automat">×</button></div>`).join('') : '<p class="hint">Niciuna. O zi se schimbă din detaliile ei, în calendar.</p>'}</section>
  <section class="card"><h2>Verificare</h2>
    <div class="line"><span>Calorii plan / distribuție</span><b>${n0(r.kcalPlan)} / ${n0(r.kcalFuel)}</b></div>
    <div class="line"><span>Carbo plan / distribuție</span><b>${n0(r.carbsPlan)} / ${n0(r.carbsFuel)} g</b></div>
    <div class="line"><span>Proteină și grăsimi</span><b>${r.proteinSame && r.fatSame ? 'neschimbate' : 'diferă'}</b></div></section>
  <button class="ghost wide" data-f="crst">Revino la regulile inițiale</button>
  <p class="hint pad">Regulile de aici sunt ale aplicației. Metoda de calcul a caloriilor și proteinei rămâne cea din Fat Loss Forever. Implicit: HIGH de la ${DEFAULT_RULES.limits.high}, MODERATE de la ${DEFAULT_RULES.limits.moderate}.</p>`;
}
