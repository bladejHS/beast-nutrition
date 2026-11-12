/* Plan: the numbers and where they came from, the phases, the setup form and the app's own settings. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { dayTarget, exactCarbs } from '../logic/carbs.ts';
import {
  bmrMuller, buildPlan, cutSetup, deficitFactor, dietBlocked, isBreakWeek, kcalFloor, lbmKg, macrosFor, predictedMaintenance, shiftCarbsFat,
  type Pace, type Phase, type Plan, type Profile, type Sex,
} from '../logic/calc.ts';
import { addDays, finishedWeeks, maintenanceFromData, mondayOf } from '../logic/review.ts';
import { dayMeals, hasDamagedSave, parseBackup, totals } from '../logic/store.ts';
import { exportFiles, isMfp, mergeMfp, readMfp } from '../logic/mfp.ts';
import { dayFuel, fx, latestKg, training } from './state.ts';
import { classify } from '../logic/training.ts';
import { fatFloorShare, minusMinutes, nextBreak, proteinPerMeal, sleepAverage } from '../logic/perf.ts';
import { waterTarget } from '../logic/wellness.ts';
import { banner, back } from './parts.ts';
import { PRINCIPLES } from '../content.ts';

declare const __BUILD__: string;

export const phaseName = (p: Phase) => ({ cut: 'Slăbire', maintain: 'Menținere', reverse: 'Reverse diet' }[p]);
const editing = { on: false };
export const isEditing = () => editing.on;

const latestWeight = () => {
  const s = ctx.get();
  const last = Object.keys(s.weights).sort().at(-1);
  return last ? s.weights[last]! : s.profile?.weightKg ?? 0;
};

function dataMaintenance(): number | null {
  const s = ctx.get();
  const weeks = finishedWeeks(s.weights, ctx.today()).slice(-5);
  if (weeks.length < 3) return null;
  const first = weeks[0]!, last = weeks.at(-1)!;
  const span = (Date.parse(last.start) - Date.parse(first.start)) / (7 * 864e5);
  let sum = 0, n = 0;
  for (let i = 0; i < span * 7 + 7; i++) {
    const k = totals(dayMeals(s, addDays(first.start, i))).kcal;
    if (k > 0) { sum += k; n++; }
  }
  if (n < 14) return null;
  return maintenanceFromData(sum / n, (first.avg - last.avg) / span, deficitFactor(s.profile!));
}

function openingMode() {
  try { return localStorage.getItem('beast-nutrition:opening') || 'daily'; } catch { return 'daily'; }
}

const daysSince = (d: string, today: string) => Math.round((Date.parse(today) - Date.parse(d)) / 864e5);

export function planHtml() {
  const s = ctx.get();
  const plan = s.plan!, p = s.profile!;
  const today = ctx.today();
  const m = plan.macros;
  const fromData = dataMaintenance();
  const lbm = lbmKg(p);
  const blocked = plan.phase === 'cut' ? dietBlocked(p, plan.maintenance) : null;
  const floor = kcalFloor(p.sex);
  const week = Array.from({ length: 7 }, (_, i) => dayTarget(plan, addDays(mondayOf(today), i)).kcal);
  const fatKg = m.f / p.weightKg;
  const backup = s.backedUp ? `Ultimul backup: acum ${daysSince(s.backedUp, today)} zile.` : 'Niciun backup până acum.';
  return `${banner('settings', 'Plan', phaseName(plan.phase))}
  <section class="card">
    <div class="stats"><div><b>${n0(m.kcal)}</b><span>kcal pe zi</span></div><div><b>${m.p}</b><span>g proteine</span></div><div><b>${exactCarbs(m)}</b><span>g carbo</span></div><div><b>${m.f}</b><span>g grăsimi</span></div></div>
    <div class="line"><span>Mențineri folosite</span><b>${nb(n0(plan.maintenance), 'kcal')}</b></div>
    ${fromData ? `<div class="line"><span>Mențineri din datele tale</span><b>${nb(n0(fromData), 'kcal')}</b></div>` : ''}
    <div class="line"><span>Metabolism bazal (Müller), estimat</span><b>${nb(n0(bmrMuller(p)), 'kcal')}</b></div>
    <div class="line"><span>Masă slabă, estimată</span><b>${nb(n0(lbm), 'kg')}</b></div>
    ${plan.phase === 'cut' ? `<div class="line"><span>Ritm țintă</span><b>${n1(plan.ratePct)}% pe săptămână</b></div>` : ''}
    ${plan.breaks ? `<div class="line"><span>Pauze de dietă</span><b>${plan.breaks.on} săpt. deficit, ${plan.breaks.off} la mențineri</b></div>` : ''}
    ${blocked ? `<p class="warn">${esc(blocked)} Cartea recomandă întâi un reverse diet.</p>` : ''}
    ${plan.phase === 'cut' && cutSetup(p, plan.maintenance, plan.ratePct).floored ? `<p class="warn">Ținta a ajuns la limita minimă a aplicației: ritmul de ${n1(plan.ratePct)}% e prea mare pentru menținerile de ${nb(n0(plan.maintenance), 'kcal')}. Alege un ritm mai mic sau corectează menținerile.</p>` : ''}
    ${plan.phase === 'cut' && m.kcal < floor ? `<p class="warn">Ținta de ${nb(n0(m.kcal), 'kcal')} e sub limita minimă a aplicației, de ${nb(n0(floor), 'kcal')}. Ia în calcul o pauză de dietă sau reverse.</p>` : ''}
    ${plan.highDays.length && Math.min(...week) < floor ? '<p class="warn">Zilele cu calorii mici coboară sub limita minimă a aplicației. Alege o singură zi mare sau un ritm mai mic.</p>' : ''}
    ${fatKg < 0.5 ? `<p class="warn">Grăsimile sunt ${fatKg.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} g/kg, sub reperul de 0,5 g/kg. Un ritm mai mic sau o împărțire 60/40 le ridică.</p>` : ''}
    ${plan.phase === 'cut' && isBreakWeek(plan, today) ? '<p class="coach">Săptămâna asta e pauză: mănânci la mențineri.</p>' : ''}
    <button class="ghost wide" data-edit>Schimbă datele și planul</button></section>
  ${perfHtml()}
  <section class="card"><h2>Faza următoare</h2><p class="hint">Dieta nu se termină, se schimbă faza. Reverse pornește de la caloriile de acum și urcă săptămânal, menținerea pornește de la menținerile tale.</p>
    <div class="seg">${(['cut', 'maintain', 'reverse'] as Phase[]).filter((x) => x !== plan.phase).map((x) => `<button data-phase="${x}">${phaseName(x)}</button>`).join('')}</div></section>
  ${plan.adjustments.length ? `<details class="card"><summary><b>Ajustări</b> <span class="hint">${plan.adjustments.length}</span></summary>${[...plan.adjustments].reverse().map((a) => `<div class="line"><span>${esc(new Date(`${a.date}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }))}, ${esc(a.note)}</span><b>${a.pct > 0 ? '+' : ''}${String(a.pct).replace('.', ',')}%</b><em>${nb(n0(a.to), 'kcal')}</em></div>`).join('')}</details>` : ''}
  ${mfpHtml(fromData)}
  <section class="card"><h2>Datele tale</h2><p class="hint">Totul stă doar în acest browser, fără cont și fără server. ${backup}</p>
    ${hasDamagedSave() ? '<p class="warn">Un salvat deteriorat a fost pus deoparte. Încarcă un backup dacă lipsesc date.</p>' : ''}
    <div class="btns"><button class="${s.backedUp && daysSince(s.backedUp, today) < 14 ? 'ghost' : 'primary'}" data-export>Descarcă backup</button><label class="ghost file">Încarcă backup<input type="file" id="imp" accept="application/json"></label></div></section>
  <section class="card"><h2>Intro la pornire</h2><p class="hint">Zilnic înseamnă doar la prima deschidere din zi.</p><div class="seg small">${[['daily', 'Zilnic'], ['full', 'Mereu'], ['short', 'Scurt'], ['off', 'Oprit']].map(([v, l]) => `<button data-opening="${v}" class="${openingMode() === v ? 'on' : ''}">${l}</button>`).join('')}</div></section>
  <section class="card src"><h2>Surse</h2><p>Metoda: <i>Fat Loss Forever</i>, Layne Norton și Peter Baker. Aplicația nu este afiliată autorilor.</p>
    <p>Alimente: USDA FoodData Central (domeniu public). Produse de marcă: USDA și Open Food Facts (ODbL). Meniul Splendid Chicken: declarația nutrițională SC Danadi SRL.</p>
    <p>Doar calculul caloriilor și al proteinei vine din carte. Carb Cycling, timing-ul, hidratarea, suplimentele, micronutrienții și planul de mese sunt ale aplicației, după ACSM, ISSN, EFSA și NIH.</p>
    <p>Limita minimă de calorii (1.200 sau 1.500 kcal) e o protecție a aplicației. Nu înlocuiește un medic sau un dietetician.</p>
    <p>Versiunea ${esc(__BUILD__)}</p></section>`;
}

export const mindHtml = () => `${back('Mai mult', 'data-tab="fuel"')}<h1 class="title">Mentalitate</h1><p class="hint">Cele 12 principii din <i>Fat Loss Forever</i>, de Layne Norton.</p>
  ${PRINCIPLES.map((x, i) => `<section class="card pr"><span>${i + 1}</span><div><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p><small>${esc(x.ch)}</small></div></section>`).join('')}`;

const RO_DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
const andList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} și ${xs.at(-1)}` : xs[0] ?? '');
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
const g1 = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
/** The diet breaks the plan recommends: four weeks of deficit and one at maintenance, the shortest of the book's options. */
const BREAKS = { on: 4, off: 1 } as const;

interface PerfItem { ok: boolean | null; title: string; body: string; src: string; act?: string }

/** The performance plan: what the consensus positions in sports nutrition ask of a fat-loss phase that keeps
 *  strength and fuels kickboxing, on the user's own numbers. Each item shows whether the app already does it and,
 *  where it can, the tap that applies it. Nothing changes until the user taps. */
function perfItems(): PerfItem[] {
  const s = ctx.get();
  const plan = s.plan!, p = s.profile!;
  const today = ctx.today();
  const m = plan.macros;
  const kg = latestKg();
  const lbm = lbmKg(p);
  const meals = s.fuel.prefs.meals || 4;
  const per = proteinPerMeal(m.p, meals);
  const share = plan.phase === 'cut' || plan.phase === 'maintain' ? fatFloorShare(m, plan.carbShare, kg) : null;
  const fatAfter = share != null ? macrosFor(m.kcal, m.p, share).f : m.f;
  // the planned class of each weekday, from the training week and the user's rules (this week's past days are rated
  // on what was done, so they would hide the plan)
  const t = training();
  const rules = { limits: s.fuel.limits, weights: s.fuel.weights, boxStrength: s.fuel.boxStrength };
  const highs = RO_DAYS.filter((_, i) => classify(t.week[i] ?? [], rules).demand === 'high');
  const hour = s.fuel.trainingHour || '17:00';
  const water = waterTarget(kg, s.waterMlKg) / 1000;
  const creatine = s.supps.some((x) => /creatin/i.test(`${x.ingredient} ${x.product}`));
  const sleep = sleepAverage(t.sleep, today);
  const brk = nextBreak(plan, today);
  return [
    { ok: s.fuel.cycling, title: 'Carbohidrații urmează antrenamentul',
      body: s.fuel.cycling
        ? `Pornit: ${highs.length ? `${andList(highs)}, zilele HIGH,` : 'zilele grele'} primesc mai mulți carbohidrați, iar ziua dinaintea uneia HIGH își face rezerva. Proteinele, grăsimile și caloriile săptămânii rămân aceleași.`
        : `Acum fiecare zi are aceeași țintă. Pornit, ${highs.length ? `${andList(highs)}, zilele cele mai grele din antrenamentul tău,` : 'zilele grele'} primesc mai mulți carbohidrați, iar caloriile săptămânii rămân aceleași.`,
      src: 'Burke și Impey, „fuel for the work required”; consensul IOC, 2018', act: s.fuel.cycling ? undefined : 'cyc' },
    { ok: share == null, title: 'Grăsimi de cel puțin 0,5 g/kg',
      body: share == null
        ? `${m.f} g pe zi, adică ${g1(m.f / kg)} g/kg: destul pentru hormoni și pentru vitaminele A, D, E și K.`
        : `Acum ${m.f} g, adică ${g1(m.f / kg)} g/kg. Sub 0,5 g/kg au de suferit hormonii și vitaminele A, D, E și K. Le ridici la ${fatAfter} g, luate din carbohidrați: caloriile și proteinele rămân.`,
      src: 'ACSM, AND și DC, 2016; Helms și colab., 2014', act: share == null ? undefined : 'fat' },
    { ok: true, title: `Proteine ${m.p} g, în ${meals} mese`,
      body: `${g1(m.p / lbm)} g/kg de masă slabă, cât cere un deficit cu antrenament de forță. Câte ~${per} g la fiecare masă, din surse complete; ultima poate fi brânză de vaci sau iaurt grecesc, care se digeră lent peste noapte.`,
      src: 'Helms și colab., 2014; ISSN, 2017; Schoenfeld și Aragon, 2018' },
    { ok: true, title: 'Masa dinainte și cea de după',
      body: `Pentru antrenamentul de la ${esc(hour)}: masa cu 2–3 ore înainte, pe la ${minusMinutes(hour, 150)}, cu carbohidrați și puține grăsimi și fibre. După, în primele 2 ore, ~${per} g proteine și carbohidrați. Azi le arată la fiecare masă.`,
      src: 'ISSN, timingul nutrienților, 2017; ACSM, AND și DC, 2016' },
    { ok: s.sweat.length > 0, title: 'Apă și sare',
      body: `${n1(water)} L pe zi, plus ce pierzi la antrenament. ${s.sweat.length ? 'Ai făcut testul de transpirație: Hidratare îți arată cât să bei la fiecare sesiune.' : 'Cântărește-te o dată înainte și după un antrenament (testul de transpirație): bei 1,25–1,5 L pentru fiecare kg pierdut, cu sare dacă transpiri mult.'}`,
      src: 'ACSM, înlocuirea lichidelor, 2007', act: s.sweat.length ? undefined : 'water' },
    { ok: creatine, title: 'Creatină, 3–5 g pe zi',
      body: `${creatine ? 'E în suplimentele tale.' : 'Cel mai bine susținut supliment pentru forță și putere; ajută și la păstrarea mușchilor în deficit.'} Oricând, cu o masă, fără încărcare. Cofeina e opțională: cel mult 200 mg, cu 45–60 de minute înainte, doar dacă nu-ți strică somnul.`,
      src: 'ISSN, creatina, 2017; consensul IOC, 2018; EFSA', act: creatine ? undefined : 'crea' },
    { ok: sleep == null ? null : sleep >= 7, title: 'Somn de cel puțin 7 ore',
      body: `${sleep == null ? '' : `Media ta pe 7 zile: ${n1(sleep)} h. `}Într-un deficit, 5,5 ore de somn în loc de 8,5 au înjumătățit grăsimea pierdută și au crescut pierderea de mușchi. Sub 7 ore, nu tăia mai mult din calorii.`,
      src: 'Nedeltcheva și colab., 2010' },
    { ok: plan.phase !== 'cut' || !!plan.breaks, title: 'Ajustări și pauze de dietă',
      body: `Te cântărești dimineața, iar media săptămânii decide. Două check-in-uri la rând sub jumătate din ritm: caloriile scad cu 5%. Dacă forța scade două săptămâni la rând, nu tăia mai mult. ${plan.breaks ? `Pauze: ${plan.breaks.on} săptămâni deficit + ${plan.breaks.off} la mențineri${brk ? `, următoarea din ${shortDay(brk)}` : ''}.` : `Pauze de dietă: ${BREAKS.on} săptămâni de deficit și ${BREAKS.off} la mențineri, pentru antrenament și pentru metabolism.`}`,
      src: 'Fat Loss Forever, Norton și Baker; Byrne și colab., 2018 (MATADOR)', act: plan.phase === 'cut' && !plan.breaks ? 'breaks' : undefined },
  ];
}

function perfHtml() {
  const items = perfItems();
  const todo = items.filter((x) => x.act && x.act !== 'water').length;
  const mark = (ok: boolean | null) => (ok == null ? 'na' : ok ? 'ok' : 'todo');
  const btn: Record<string, string> = {
    cyc: '<button class="ghost" data-perf="cyc">Pornește</button>',
    fat: '<button class="ghost" data-perf="fat">Ridică grăsimile</button>',
    water: '<button class="ghost" data-tab="fuel" data-sub="water">Fă testul</button>',
    crea: '<button class="ghost" data-perf="crea">Adaug-o la suplimente</button>',
    breaks: `<button class="ghost" data-perf="breaks">Programează ${BREAKS.on} + ${BREAKS.off}</button>`,
  };
  return `<section class="card perf"><h2>Planul de performanță</h2>
    <p class="hint">Ce cer pozițiile de consens din nutriția sportivă pentru o slăbire care păstrează forța și alimentează kickboxing-ul, pe cifrele tale. Auriu: aplicat. Albastru: de făcut. Nimic nu se schimbă până nu apeși.</p>
    ${items.map((x, i) => `<div class="pf ${mark(x.ok)}"><i class="pf-s" aria-hidden="true"></i><b><span>${i + 1}</span>${esc(x.title)}</b><p>${esc(x.body)}</p><small>${esc(x.src)}</small>${x.act ? `<div class="btns">${btn[x.act]}</div>` : ''}</div>`).join('')}
    ${todo > 1 ? '<button class="primary wide" data-perf="all">Aplică tot ce lipsește</button>' : ''}
  </section>`;
}

/** Applies one item of the performance plan, or all of them; the toast puts everything back as it was. */
function applyPerf(what: string) {
  const s = ctx.get();
  const before = { plan: s.plan, cycling: s.fuel.cycling, sig: s.fuel.sig, supps: [...s.supps] };
  const kg = latestKg();
  const done: string[] = [];
  const all = what === 'all';
  if ((all || what === 'cyc') && !s.fuel.cycling) { s.fuel.cycling = true; s.fuel.sig = ''; fx.recalc = true; done.push('carb cycling pornit'); }
  if (all || what === 'fat') {
    const share = fatFloorShare(s.plan!.macros, s.plan!.carbShare, kg);
    if (share != null) { s.plan = buildPlan(s.profile!, { ...s.plan!, carbShare: share, adjustments: s.plan!.adjustments }); done.push(`grăsimi ${s.plan.macros.f} g`); }
  }
  if ((all || what === 'crea') && !s.supps.some((x) => /creatin/i.test(`${x.ingredient} ${x.product}`))) {
    s.supps.push({ id: crypto.randomUUID(), product: 'Creatină monohidrat', brand: '', ingredient: 'Creatină', serving: '5 g', mgPerDay: 5000, time: 'Cu o masă', freq: 'Zilnic', start: ctx.today(), notes: 'Din planul de performanță' });
    done.push('creatină la suplimente');
  }
  if ((all || what === 'breaks') && s.plan!.phase === 'cut' && !s.plan!.breaks) {
    s.plan = buildPlan(s.profile!, { ...s.plan!, breaks: { ...BREAKS }, adjustments: s.plan!.adjustments });
    const brk = nextBreak(s.plan, ctx.today());
    done.push(`pauze ${BREAKS.on} + ${BREAKS.off}${brk ? `, prima din ${shortDay(brk)}` : ''}`);
  }
  if (!done.length) return;
  ctx.commit(); ctx.render();
  ctx.toast(`Aplicat: ${done.join(', ')}.`, () => { s.plan = before.plan; s.fuel.cycling = before.cycling; s.fuel.sig = before.sig; s.supps = before.supps; fx.recalc = true; ctx.commit(); ctx.render(); });
}

const dayLong = (d: string) => { const w = new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long' }); return w.charAt(0).toUpperCase() + w.slice(1); };

/** This week's targets, one line per day, as MyFitnessPal Premium's goals by day take them. */
function mfpWeek(): { date: string; line: string; kcal: number; p: number; c: number; f: number }[] {
  const mon = mondayOf(ctx.today());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mon, i);
    const t = dayFuel(date);
    return { date, kcal: t.kcal, p: t.p, c: t.c, f: t.f, line: `${dayLong(date)}: ${Math.round(t.kcal)} kcal, proteine ${t.p} g, carbohidrați ${t.c} g, grăsimi ${t.f} g` };
  });
}

/** MyFitnessPal both ways (logic/mfp.ts): the targets to type in, and the export brought back. */
function mfpHtml(fromData: number | null) {
  const s = ctx.get();
  const plan = s.plan!;
  const week = mfpWeek();
  const imported = Object.keys(s.days).filter((d) => s.days[d]!.some((m) => m.some(isMfp))).sort();
  const last = imported.at(-1);
  const useData = fromData && Math.abs(fromData - plan.maintenance) >= 50;
  return `<section class="card"><h2>MyFitnessPal</h2>
    <p class="hint">Țintele săptămânii pentru Obiective în MyFitnessPal Premium, unde le setezi pe zile, în grame. Le actualizezi lunea sau când se schimbă planul.</p>
    ${week.map((x) => `<div class="line"><span>${esc(dayLong(x.date))}</span><b>${nb(n0(x.kcal), 'kcal')} · P ${x.p} · C ${x.c} · G ${x.f}</b></div>`).join('')}
    <div class="btns"><button class="ghost" data-mfp-copy>Copiază țintele</button></div>
    <h3>Ce mănânci în MyFitnessPal</h3>
    <p class="hint">În MyFitnessPal Premium: Reports → Export Data sau Export în ecranele Progress și Nutrition. Primești pe e-mail un ZIP; îl încarci aici întreg sau alegi fișierele CSV din el. Mesele intră în jurnal, iar cântăririle la greutate. Un import nou înlocuiește doar ce a pus importul de dinainte.</p>
    <div class="btns"><label class="primary file">Încarcă exportul<input type="file" id="mfp" accept=".zip,.csv,application/zip,text/csv" multiple></label></div>
    ${last ? `<div class="line"><span>Zile aduse din MyFitnessPal</span><b>${imported.length}, ultima ${esc(new Date(`${last}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }))}</b></div>` : ''}
    <p class="hint">După trei săptămâni cu mâncare și cântăriri, aplicația îți calculează menținerile din datele tale (cartea, capitolul 11).</p>
    ${useData ? `<div class="line"><span>Mențineri din datele tale</span><b>${nb(n0(fromData), 'kcal')}</b></div><div class="btns"><button class="primary" data-mfp-use>Folosește-le pentru plan</button></div>` : ''}
  </section>`;
}

/** Rebuilds the plan on the maintenance the user's own data shows, keeping the phase and its settings. */
function useDataMaintenance() {
  const s = ctx.get();
  const fromData = dataMaintenance();
  if (!fromData) return;
  const before = { profile: s.profile, plan: s.plan };
  const profile = { ...s.profile!, weightKg: latestWeight() };
  s.profile = profile;
  s.plan = buildPlan(profile, { ...s.plan!, maintenance: fromData, adjustments: s.plan!.adjustments });
  ctx.commit(); ctx.render();
  ctx.toast(`Menținerile tale: ${n0(fromData)} kcal. Țintele s-au recalculat.`, () => { s.profile = before.profile; s.plan = before.plan; ctx.commit(); ctx.render(); });
}

/** A picked export (the ZIP from the e-mail, or its CSV files) into the journal and the weights; undo puts them back. */
export async function importMfp(files: File[]) {
  const s = ctx.get();
  try {
    const data = readMfp(await exportFiles(files), latestWeight());
    if (!data.read) { ctx.toast('Nu găsesc datele MyFitnessPal. Alege ZIP-ul din e-mail sau fișierele CSV din el.'); return; }
    const before = JSON.stringify({ days: s.days, weights: s.weights });
    const r = mergeMfp(s, data);
    ctx.commit(); ctx.render();
    ctx.toast(`Din MyFitnessPal: ${r.days} zile de mâncare, ${r.weighIns} cântăriri.`, () => { const b = JSON.parse(before) as { days: typeof s.days; weights: typeof s.weights }; s.days = b.days; s.weights = b.weights; ctx.commit(); ctx.render(); });
  } catch (e) {
    ctx.toast(e instanceof Error && /ZIP/.test(e.message) ? e.message : 'Fișierul nu a putut fi citit. Dezarhivează ZIP-ul și alege fișierele CSV.');
  }
}

const ACT: [number, string][] = [[1.2, 'Sedentar: birou, fără sport'], [1.375, 'Ușor: birou și puțin sport'], [1.55, 'Moderat: birou și antrenament serios'], [1.725, 'Foarte activ: antrenament și mers mult'], [1.9, 'Extrem: muncă fizică și sală']];

export function setupHtml() {
  const s = ctx.get();
  const p = s.profile, pl = s.plan;
  const opt = (v: unknown, cur: unknown) => (v === cur ? 'selected' : '');
  return `<div class="setup"><span class="wolf" aria-hidden="true"></span><h1>BEAST NUTRITION</h1><p class="sub">Calculăm punctul de start. Îl corectează apoi datele tale.</p>
  <form id="sf">
    <div class="grid2"><label class="field">Sex<select name="sex"><option value="m" ${opt('m', p?.sex)}>Bărbat</option><option value="f" ${opt('f', p?.sex)}>Femeie</option></select></label>
    <label class="field">Vârstă<input name="age" type="number" inputmode="numeric" min="14" max="90" required value="${p?.age ?? ''}"></label>
    <label class="field">Înălțime, cm<input name="heightCm" type="number" inputmode="numeric" min="120" max="230" required value="${p?.heightCm ?? ''}"></label>
    <label class="field">Greutate, kg<input name="weightKg" type="text" inputmode="decimal" required value="${p ? n1(latestWeight()) : ''}"></label></div>
    <label class="field">Grăsime corporală, %. O estimare e suficientă.<input name="bf" type="text" inputmode="decimal" required value="${p?.bf != null ? String(p.bf).replace('.', ',') : ''}"></label>
    <label class="field">Activitate<select name="activity">${ACT.map(([v, l]) => `<option value="${v}" ${opt(v, p?.activity ?? 1.55)}>${l}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" name="lifts" ${p?.lifts === false ? '' : 'checked'}> Fac antrenament cu greutăți, minimum 2 ore pe săptămână</label>
    <label class="field">Faza<select name="phase" id="ph"><option value="cut" ${opt('cut', pl?.phase)}>Slăbire</option><option value="maintain" ${opt('maintain', pl?.phase)}>Menținere</option><option value="reverse" ${opt('reverse', pl?.phase)}>Reverse diet</option></select></label>
    <label class="field">Calorii de menținere știute din experiență, opțional<input name="maint" type="text" inputmode="numeric" value="${pl?.maintenance ?? ''}" placeholder="gol = calculate"></label>
    <div id="cutbox">
      <label class="field">Ritm pe săptămână<select name="rate">${[0.4, 0.5, 0.6, 0.7, 0.8, 1].map((r) => `<option value="${r}" ${opt(r, pl?.ratePct ?? 0.6)}>${String(r).replace('.', ',')}% din greutate${r === 1 ? ' (maxim)' : ''}</option>`).join('')}</select></label>
      <label class="field">Pauze de dietă<select name="breaks"><option value="">Fără pauze planificate</option>${[[2, 1], [2, 2], [3, 1], [4, 1]].map(([a, b]) => `<option value="${a}+${b}" ${pl?.breaks?.on === a && pl.breaks.off === b ? 'selected' : ''}>${a} săptămâni deficit + ${b} la mențineri</option>`).join('')}</select></label>
      <label class="field">Zile cu calorii mari<select name="high"><option value="">Fără, aceleași calorii zilnic</option><option value="5" ${pl?.highDays.length === 1 ? 'selected' : ''}>Una: sâmbătă</option><option value="5,6" ${pl?.highDays.length === 2 ? 'selected' : ''}>Două: sâmbătă și duminică</option></select></label>
    </div>
    <div id="revbox"><label class="field">Ritm reverse<select name="pace"><option value="c" ${opt('c', pl?.pace)}>Conservator: 2–5% pe săptămână</option><option value="m" ${opt('m', pl?.pace)}>Moderat: 5–8%</option><option value="a" ${opt('a', pl?.pace)}>Agresiv: peste 8%</option></select></label></div>
    <label class="field">Calorii rămase după proteine: carbohidrați și grăsimi<select name="share">${[[0.7, '70 și 30 (grăsimi puține, limita din carte)'], [0.6, '60 și 40'], [0.55, '55 și 45'], [0.5, '50 și 50']].map(([v, l]) => `<option value="${v}" ${opt(v, pl?.carbShare ?? 0.7)}>${l}</option>`).join('')}</select></label>
    <div id="pv" class="preview big"></div>
    <button class="primary wide">${pl ? 'Salvează planul' : 'Creează planul'}</button>
    ${pl ? '<button type="button" class="ghost wide" data-cancel>Renunță</button>' : ''}
  </form></div>`;
}

/** A re-saved profile keeps the steps already applied: they came from the scale, not from the form. */
function keepAdjustments(plan: Plan): Plan {
  return { ...plan, macros: plan.adjustments.reduce((m, a) => shiftCarbsFat(m, a.pct), plan.macros) };
}

function readSetup(form: HTMLFormElement) {
  const s = ctx.get();
  const d = new FormData(form);
  const n = (k: string) => parseNum(d.get(k));
  const phase = d.get('phase') as Phase;
  const profile: Profile = { sex: d.get('sex') as Sex, age: n('age'), heightCm: n('heightCm'), weightKg: n('weightKg'), bf: n('bf'), activity: n('activity'), lifts: d.get('lifts') === 'on' };
  const b = String(d.get('breaks') ?? '');
  const h = String(d.get('high') ?? '');
  const maintenance = n('maint') || predictedMaintenance(profile);
  const plan = buildPlan(profile, {
    phase, startDate: s.plan?.startDate && s.plan.phase === phase ? s.plan.startDate : ctx.today(),
    ratePct: n('rate'), carbShare: n('share'), maintenance,
    highDays: h ? h.split(',').map(Number) : [], breaks: b ? { on: Number(b[0]), off: Number(b[2]) } : null, pace: d.get('pace') as Pace,
    adjustments: s.plan?.phase === phase ? s.plan.adjustments : [],
  });
  return { profile, plan: keepAdjustments(plan) };
}

const valid = (form: HTMLFormElement) => {
  const d = new FormData(form);
  const kg = parseNum(d.get('weightKg')), bf = parseNum(d.get('bf'));
  return form.checkValidity() && kg >= 35 && kg <= 300 && bf >= 5 && bf <= 60;
};

export function setupBind() {
  const form = document.querySelector<HTMLFormElement>('#sf')!;
  const paint = () => {
    const phase = (form.elements.namedItem('phase') as HTMLSelectElement).value;
    document.querySelector<HTMLElement>('#cutbox')!.hidden = phase !== 'cut';
    document.querySelector<HTMLElement>('#revbox')!.hidden = phase !== 'reverse';
    const box = document.querySelector('#pv')!;
    if (!valid(form)) { box.innerHTML = 'Completează datele ca să vezi cifrele.'; return; }
    const { profile, plan } = readSetup(form);
    const m = plan.macros;
    const setup = cutSetup(profile, plan.maintenance, plan.ratePct);
    const block = phase === 'cut' ? dietBlocked(profile, plan.maintenance) : null;
    box.innerHTML = `<b>${n0(m.kcal)}</b><span>kcal</span><span>${nb(m.p, 'g')} proteine</span><span>${nb(exactCarbs(m), 'g')} carbo</span><span>${nb(m.f, 'g')} grăsimi</span>
      <p>Mențineri: ${nb(n0(plan.maintenance), 'kcal')}${phase === 'cut' ? `, deficit ${nb(n0(setup.deficit), 'kcal')} pe zi, −${nb(setup.weeklyKg.toLocaleString('ro-RO', { maximumFractionDigits: 2 }), 'kg')} pe săptămână` : ''}${plan.adjustments.length ? `, cu ${plan.adjustments.length} ajustări păstrate` : ''}.</p>
      ${setup.floored && phase === 'cut' ? '<p class="warn">Ritmul cerut ar coborî sub limita minimă de calorii, așa că ținta a fost ridicată. Alege un ritm mai mic.</p>' : ''}
      ${block ? `<p class="warn">${esc(block)} Cartea recomandă întâi un reverse diet.</p>` : ''}`;
  };
  form.addEventListener('input', paint);
  paint();
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!valid(form)) { ctx.toast('Verifică greutatea și grăsimea corporală.'); return; }
    const s = ctx.get();
    const { profile, plan } = readSetup(form);
    s.profile = profile; s.plan = plan;
    if (!s.weights[ctx.today()]) s.weights[ctx.today()] = profile.weightKg;
    editing.on = false; ctx.commit(); ctx.render();
    void navigator.storage?.persist?.();
  });
}

function changePhase(phase: Phase) {
  const s = ctx.get();
  const p = s.profile!, old = s.plan!;
  const profile = { ...p, weightKg: latestWeight() };
  const before = { profile: s.profile, plan: s.plan };
  const maintenance = dataMaintenance() ?? old.maintenance;
  const built = buildPlan(profile, { ...old, phase, startDate: ctx.today(), maintenance, adjustments: [] });
  s.profile = profile;
  // Reverse climbs from where the diet stopped; the weekly steps do the rest.
  s.plan = phase === 'reverse' && old.phase === 'cut' ? { ...built, macros: macrosFor(Math.min(old.macros.kcal, built.macros.kcal), built.macros.p, old.carbShare) } : built;
  ctx.commit(); ctx.render();
  ctx.toast(`Faza nouă: ${phaseName(phase)}.`, () => { s.profile = before.profile; s.plan = before.plan; ctx.commit(); ctx.render(); });
}

export function planAction(el: HTMLElement): boolean {
  const s = ctx.get();
  const d = el.dataset;
  if (d['phase']) { changePhase(d['phase'] as Phase); return true; }
  if (d['perf']) { applyPerf(d['perf']); return true; }
  if (d['mfpUse'] != null) { useDataMaintenance(); return true; }
  if (d['mfpCopy'] != null) {
    const text = mfpWeek().map((x) => x.line).join('\n');
    navigator.clipboard?.writeText(text).then(() => ctx.toast('Țintele săptămânii sunt copiate.'), () => ctx.toast('Copierea nu a mers; le găsești pe ecran.'));
    return true;
  }
  if (d['opening']) { try { localStorage.setItem('beast-nutrition:opening', d['opening']); } catch { /* storage blocked: the intro stays as it was */ } ctx.render(); return true; }
  if (d['edit'] != null) { editing.on = true; ctx.render(); scrollTo(0, 0); return true; }
  if (d['cancel'] != null) { editing.on = false; ctx.render(); return true; }
  if (d['export'] != null) {
    s.backedUp = ctx.today(); ctx.commit();
    const url = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `beast-nutrition-${ctx.today()}.json`; a.click();
    URL.revokeObjectURL(url);
    ctx.render();
    return true;
  }
  return false;
}

export function importBackup(text: string, replace: (next: ReturnType<typeof parseBackup>) => void) {
  try { replace(parseBackup(text)); ctx.commit(); ctx.render(); ctx.toast('Backup încărcat.'); } catch (e) { ctx.toast(e instanceof Error ? e.message : 'Fișier invalid.'); }
}
