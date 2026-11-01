import './styles.css';
import { PRINCIPLES } from './content.ts';
import {
  bmrMuller, buildPlan, cutSetup, deficitFactor, dietBlocked, isBreakWeek, kcalFloor, lbmKg, predictedMaintenance, shiftCarbsFat,
  type Pace, type Phase, type Profile, type Sex,
} from './logic/calc.ts';
import { byBarcode, isRomanian, loadFoods, search, searchBranded, searchUsdaBrands, type Food } from './logic/foods.ts';
import { addDays, finishedWeeks, maintenanceFromData, mondayOf, review, type CheckIn } from './logic/review.ts';
import { dayMeals, entryFrom, load, MEALS, parseBackup, save, totals, type Entry, type State } from './logic/store.ts';
import { ctx, afterRender, type Tab } from './app.ts';
import { fuelAction, fuelHtml, fuelBind } from './screens/fuel.ts';
import { dayFuel, freshFuel, syncFuel } from './screens/state.ts';
import { dayTarget, exactCarbs } from './logic/carbs.ts';
import { fastAction, fastChip, fastHtml, fastBind } from './screens/fast.ts';
import { bodyAction, bodyBind, bodyHtml } from './screens/body.ts';

const app = document.querySelector<HTMLElement>('#app')!;
const sheet = document.querySelector<HTMLElement>('#sheet')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;

let s: State = load();
let tab: Tab = 'azi';
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let date = localDate();
let editing = false;
let lastTab: Tab | '' = '';

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const n0 = (v: number) => Math.round(v).toLocaleString('ro-RO');
const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
const wolf = '<span class="wolf" aria-hidden="true"></span>';

function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  setTimeout(() => toastEl.classList.remove('on'), 2600);
}

function commit() {
  freshFuel();
  if (!save(s)) toast('Browserul nu a putut salva. Fă un backup din Plan.');
}
ctx.get = () => s; ctx.commit = commit; ctx.toast = toast; ctx.render = () => render(); ctx.open = (h) => open(h); ctx.close = () => close(); ctx.today = () => localDate();

const latestWeight = () => {
  const keys = Object.keys(s.weights).sort();
  const last = keys.at(-1);
  return last ? s.weights[last]! : s.profile?.weightKg ?? 0;
};

function render() {
  if (!s.profile || !s.plan || editing) { app.innerHTML = setupView(); bindSetup(); return; }
  freshFuel();
  syncFuel();
  const views: Record<Tab, () => string> = { azi: todayView, fuel: fuelHtml, post: fastHtml, cantar: () => scaleView() + bodyHtml(), plan: planView, minte: mindView };
  const enter = tab !== lastTab;
  lastTab = tab;
  app.innerHTML = `
    <header class="top">${wolf}<div><b>BEAST NUTRITION</b><small>${phaseName(s.plan.phase)}</small></div></header>
    <main class="${enter ? 'enter' : ''}">${views[tab]()}</main>
    <nav class="tabs">${(['azi', 'fuel', 'post', 'cantar', 'plan'] as Tab[]).map((t) =>
      `<button data-tab="${t}" class="${t === tab || (t === 'plan' && tab === 'minte') ? 'on' : ''}">${{ azi: 'Azi', fuel: 'Fuel', post: 'Post', cantar: 'Corp', plan: 'Plan', minte: '' }[t]}</button>`).join('')}</nav>`;
  afterRender(app);
  fuelBind(); fastBind(); bodyBind();
}

const phaseName = (p: Phase) => ({ cut: 'Slăbire', maintain: 'Menținere', reverse: 'Reverse diet' }[p]);

// ---- Today -----------------------------------------------------------------
function bar(label: string, rank: number, val: number, min: number, max: number, unit: string, hint = '') {
  const pct = Math.min(1, val / (max || 1));
  const done = val >= min;
  return `<div class="bar ${done ? 'done' : ''}"><div class="bar-h"><span><i>${rank}</i>${label}</span><b>${n0(val)}${min !== max ? ` / ${n0(min)}–${n0(max)}` : ` / ${n0(max)}`} ${unit}</b></div>
    <div class="track"><div data-bar="${label}" data-to="${pct}"></div></div>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

/** Calories of the current week compared to what the plan gave so far. */
function weekBank() {
  const start = mondayOf(date);
  let planned = 0, eaten = 0, logged = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d > localDate()) break;
    const k = totals(dayMeals(s, d)).kcal;
    if (k > 0 || d === localDate()) { planned += dayFuel(d).kcal; eaten += k; logged++; }
  }
  return { planned, eaten, logged, diff: eaten - planned };
}

function coachLine(left: number, proteinLeft: number) {
  if (left < -50) return `Ești cu ${n0(-left)} kcal peste azi. Nu e un eșec și nu trebuie compensat cu foame: contează media săptămânii. Continui normal de la masa următoare.`;
  if (proteinLeft > 0 && left > 0) return `Mai ai ${n0(left)} kcal și ${n0(proteinLeft)} g proteine. Alege ceva slab în grăsimi, ca să le încapi pe amândouă.`;
  if (left > 0) return `Proteina e făcută. Cele ${n0(left)} kcal rămase sunt ale tale: orice aliment încape dacă e numărat.`;
  return 'Ziua e completă. Așa arată aderența.';
}

function todayView() {
  const t = dayFuel(date);
  const meals = dayMeals(s, date).slice(0, Math.max(s.fuel.prefs.meals, ...dayMeals(s, date).map((m, i) => (m.length ? i + 1 : 0))));
  const sum = totals(meals);
  const left = t.kcal - sum.kcal;
  const pct = Math.min(1, sum.kcal / t.kcal);
  const C = 2 * Math.PI * 52;
  const bank = weekBank();
  return `
  <div class="datebar"><button data-day="-1" aria-label="Ziua anterioară">‹</button><span>${date === localDate() ? 'Azi, ' : ''}${esc(dayName(date))}</span><button data-day="1" aria-label="Ziua următoare">›</button></div>
  <section class="hero">
    <svg viewBox="0 0 120 120" class="ring" role="img" aria-label="${n0(sum.kcal)} din ${n0(t.kcal)} kcal"><circle cx="60" cy="60" r="52"/><circle class="v ${left < 0 ? 'over' : ''}" cx="60" cy="60" r="52" stroke-dasharray="${C * pct} ${C}"/></svg>
    <div class="ring-t"><b data-count="left" data-to="${Math.abs(left)}">${n0(Math.abs(left))}</b><span>${left < 0 ? 'kcal peste' : 'kcal rămase'}</span></div>
    <p class="tag ${t.kind}">${esc(t.label)} · ${n0(t.kcal)} kcal</p>${fastChip(date)}
  </section>
  <section class="card">
    ${bar('Calorii', 1, sum.kcal, t.kcal, t.kcal, 'kcal')}
    ${bar('Proteine', 2, sum.p, t.p, t.p, 'g')}
    ${bar('Fibre', 3, sum.fiber, t.fiberMin, t.fiberMax, 'g')}
    <div class="duo">${bar('Carbohidrați', 4, sum.c, t.c, t.c, 'g')}${bar('Grăsimi', 4, sum.f, t.f, t.f, 'g')}</div>
    <p class="coach">${coachLine(left, t.p - sum.p)}</p>
  </section>
  ${bank.logged > 1 ? `<section class="card week"><span>Media săptămânii</span><b>${n0(bank.eaten / bank.logged)} kcal/zi</b><small>${bank.diff > 0 ? `+${n0(bank.diff)}` : n0(bank.diff)} kcal față de plan în ${bank.logged} zile</small></section>` : ''}
  ${meals.map((list, i) => mealCard(i, list)).join('')}
  <button class="ghost wide" data-copy>Copiază mesele de ieri</button>`;
}

function mealCard(i: number, list: Entry[]) {
  const sum = totals([list]);
  return `<section class="card meal"><div class="meal-h"><b>${MEALS[i]}</b><span>${n0(sum.kcal)} kcal · ${n0(sum.p)} P</span><button class="add" data-add="${i}" aria-label="Adaugă la ${MEALS[i]}">+</button></div>
  ${list.map((e) => `<div class="entry"><div><b>${esc(e.name)}</b><small>${n0(e.g)} g · ${n0(e.kcal)} kcal · P ${n0(e.p)} · C ${n0(e.c)} · G ${n0(e.f)}</small></div><button data-del="${i}:${e.id}" aria-label="Șterge">×</button></div>`).join('')}</section>`;
}

// ---- Add food --------------------------------------------------------------
function close() { sheet.innerHTML = ''; sheet.className = ''; }
function open(html: string) { sheet.className = 'on'; sheet.innerHTML = `<div class="sh"><button class="x" data-close aria-label="Închide">×</button>${html}</div>`; }

let meal = 0;
let mode: 'db' | 'brand' = 'db';

function foodRow(f: Food, list: Map<string, Food>) {
  list.set(f.id, f);
  return `<button class="row" data-food="${esc(f.id)}"><span><b>${esc(f.name)}</b><small>${isRomanian(f) || f.source !== 'usda' ? esc(f.cat) : `${esc(f.cat)}`}</small></span><em>${n0(f.kcal)}<small>kcal/100 g</small><br>${f.p} P</em></button>`;
}

const shown = new Map<string, Food>();

function openAdd(i: number) {
  meal = i; mode = 'db';
  open(`<h2>${MEALS[i]}</h2>
    <div class="seg"><button data-mode="db" class="on">Alimente</button><button data-mode="brand">Produse de marcă</button></div>
    <input id="q" type="search" placeholder="Caută: piept de pui, ovăz, Chicken Tenders…" autocomplete="off">
    <div class="tools"><button class="ghost" data-scan>Cod de bare</button><button class="ghost" data-manual>Introdu manual</button></div>
    <div id="res"></div>`);
  showRecent();
  document.querySelector<HTMLInputElement>('#q')?.focus();
}

function showRecent() {
  const res = document.querySelector('#res');
  if (!res) return;
  shown.clear();
  const list = [...s.custom, ...s.recent.filter((r) => !s.custom.some((c) => c.id === r.id))].slice(0, 15);
  res.innerHTML = list.length ? `<h3>Recente</h3>${list.map((f) => foodRow(f, shown)).join('')}` : '<p class="hint pad">Peste 13.000 de alimente și 400.000 de produse de marcă. Poți căuta în română.</p>';
}

let searchTimer = 0;
let searchRun = 0;

/** USDA answers from the app's own files; Open Food Facts is slower, can fail and only adds to the list. */
async function runBrandSearch(q: string, res: Element, run: number) {
  res.innerHTML = '<p class="hint pad">Caut în produsele de marcă…</p>';
  const usda = await searchUsdaBrands(q).catch(() => null);
  if (run !== searchRun) return;
  const more = usda && usda.total > usda.foods.length ? `<p class="hint pad">${usda.total.toLocaleString('ro-RO')} produse găsite. Adaugă marca sau tipul ca să restrângi.</p>` : '';
  const local = usda?.foods.length ? `${more}${usda.foods.map((f) => foodRow(f, shown)).join('')}` : '';
  res.innerHTML = `${local}<p class="hint pad">Caut și în Open Food Facts…</p>`;
  const off = await searchBranded(q).catch(() => null);
  if (run !== searchRun) return;
  const extra = off?.length ? `<h3>Open Food Facts</h3>${off.map((f) => foodRow(f, shown)).join('')}` : '';
  res.innerHTML = local + extra || `<p class="hint pad">${usda || off ? 'Niciun produs găsit.' : 'Produsele de marcă au nevoie de internet. Poți folosi Alimente sau introdu valorile manual.'}</p>`;
}

async function runSearch(q: string) {
  const res = document.querySelector('#res');
  const run = ++searchRun;
  if (!res) return;
  if (q.trim().length < 2) { showRecent(); return; }
  shown.clear();
  try {
    if (mode === 'brand') {
      await runBrandSearch(q, res, run);
    } else {
      const all = [...s.custom, ...await loadFoods()];
      if (run !== searchRun) return;
      res.innerHTML = search(all, q).map((f) => foodRow(f, shown)).join('') || '<p class="hint pad">Nimic găsit. Încearcă și în engleză sau la Produse de marcă.</p>';
    }
  } catch {
    res.innerHTML = '<p class="hint pad">Baza de alimente nu s-a încărcat. Încearcă din nou sau introdu valorile manual.</p>';
  }
}

function openQuantity(f: Food) {
  const chips = [...f.portions, ['100 g', 100] as [string, number]];
  open(`<h2>${esc(f.name)}</h2>${f.en && f.en !== f.name ? `<p class="hint">${esc(f.en)}</p>` : ''}
    <label class="field">Cantitate (g)<input id="g" type="number" inputmode="decimal" value="${f.portions[0]?.[1] ?? 100}" min="1"></label>
    <div class="chips">${chips.map(([l, g]) => `<button data-g="${g}">${esc(l)}</button>`).join('')}</div>
    <div id="pv" class="preview"></div>
    <p class="hint">Pe 100 g: ${n0(f.kcal)} kcal · ${f.source === 'spd' || f.noFiber ? 'fibre nedeclarate' : `fibre ${f.fiber} g`} · zahăr ${f.sugar} g · sare ${(f.sodium * 2.5 / 1000).toFixed(1)} g</p>
    ${f.allergens ? `<p class="warn">Alergeni: ${esc(f.allergens)}</p>` : ''}
    <button class="primary wide" id="addgo">Adaugă la ${MEALS[meal]}</button>`);
  const input = document.querySelector<HTMLInputElement>('#g')!;
  const paint = () => {
    const e = entryFrom(f, Number(input.value) || 0);
    document.querySelector('#pv')!.innerHTML = `<b>${n0(e.kcal)}</b> kcal<span>P ${e.p}</span><span>C ${e.c}</span><span>G ${e.f}</span><span>Fibre ${e.fiber}</span>`;
  };
  paint();
  input.addEventListener('input', paint);
  sheet.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset['g']!; paint(); }));
  document.querySelector('#addgo')!.addEventListener('click', () => {
    const g = Number(input.value);
    if (!(g > 0)) { toast('Scrie cantitatea în grame.'); return; }
    const meals = dayMeals(s, date).map((m) => [...m]);
    meals[meal]!.push(entryFrom(f, g));
    s.days[date] = meals;
    s.recent = [f, ...s.recent.filter((r) => r.id !== f.id)].slice(0, 30);
    commit(); close(); render();
  });
}

function openManual() {
  open(`<h2>Aliment propriu</h2><p class="hint">Valorile de pe etichetă, la 100 g. Rămâne salvat la Recente.</p>
    <form id="mf"><label class="field">Nume<input name="name" required></label>
    <div class="grid2">${[['kcal', 'Calorii'], ['p', 'Proteine g'], ['c', 'Carbohidrați g'], ['f', 'Grăsimi g'], ['fiber', 'Fibre g']].map(([k, l]) => `<label class="field">${l}<input name="${k}" type="number" step="any" inputmode="decimal" required value="${k === 'fiber' ? 0 : ''}"></label>`).join('')}</div>
    <button class="primary wide">Salvează</button></form>`);
  document.querySelector<HTMLFormElement>('#mf')!.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(ev.target as HTMLFormElement);
    const num = (k: string) => Number(d.get(k)) || 0;
    const f: Food = { id: `m${crypto.randomUUID()}`, name: String(d.get('name')), cat: 'Alimentele mele', kcal: num('kcal'), p: num('p'), c: num('c'), f: num('f'), fiber: num('fiber'), sugar: 0, sat: 0, sodium: 0, portions: [], source: 'mine' };
    s.custom.unshift(f); commit(); openQuantity(f);
  });
}

function openBarcode() {
  const hasCam = 'BarcodeDetector' in window;
  open(`<h2>Cod de bare</h2>${hasCam ? '<video id="cam" playsinline muted></video>' : '<p class="hint">Browserul nu poate citi codul cu camera. Scrie cifrele de sub cod.</p>'}
    <label class="field">Cifrele codului<input id="code" inputmode="numeric"></label><button class="primary wide" id="find">Caută</button>`);
  let stream: MediaStream | null = null;
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  const lookup = async (code: string) => {
    stop();
    try {
      const f = await byBarcode(code);
      if (f) openQuantity(f); else toast('Codul nu este în USDA sau Open Food Facts.');
    } catch { toast('Căutarea are nevoie de internet.'); }
  };
  document.querySelector('#find')!.addEventListener('click', () => {
    const v = document.querySelector<HTMLInputElement>('#code')!.value.trim();
    if (/^\d{8,14}$/.test(v)) void lookup(v); else toast('Codul are 8–14 cifre.');
  });
  if (hasCam) void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.querySelector<HTMLVideoElement>('#cam');
      if (!video) { stop(); return; }
      video.srcObject = stream; await video.play();
      const Det = (window as unknown as { BarcodeDetector: new (o: object) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      const det = new Det({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (!video.isConnected) { stop(); return; }
        const hit = (await det.detect(video).catch(() => []))[0];
        if (hit) void lookup(hit.rawValue); else setTimeout(() => void tick(), 300);
      };
      void tick();
    } catch { toast('Nu am acces la cameră. Scrie cifrele.'); }
  })();
}

// ---- Scale -----------------------------------------------------------------
const SCORES: [keyof CheckIn, string][] = [['adherence', 'Aderență la plan'], ['energy', 'Energie'], ['strength', 'Forță'], ['hunger', 'Foame (10 = deloc)'], ['mood', 'Dispoziție'], ['stress', 'Stres (10 = deloc)'], ['sleep', 'Somn']];

function chart() {
  const today = localDate();
  const from = addDays(today, -55);
  const pts = Object.entries(s.weights).filter(([d]) => d >= from).sort();
  if (pts.length < 2) return '<p class="hint pad">Graficul apare după câteva cântăriri.</p>';
  const vals = pts.map((p) => p[1]);
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
  const W = 340, H = 150;
  const x = (d: string) => (((Date.parse(d) - Date.parse(from)) / 864e5) / 55) * (W - 20) + 10;
  const y = (v: number) => H - 12 - ((v - lo) / (hi - lo)) * (H - 24);
  const weeks = new Map<string, number[]>();
  for (const [d, v] of pts) weeks.set(mondayOf(d), [...(weeks.get(mondayOf(d)) ?? []), v]);
  const avg = [...weeks].sort().map(([w, l]) => `${x(addDays(w, 3)).toFixed(1)},${y(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1)}`);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Greutatea în ultimele 8 săptămâni">
    ${pts.map(([d, v]) => `<circle cx="${x(d).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4"/>`).join('')}
    <polyline points="${avg.join(' ')}"/><text x="8" y="12">${hi.toFixed(1)}</text><text x="8" y="${H - 2}">${lo.toFixed(1)}</text></svg>
    <p class="hint">Punctele sunt cântăririle, linia este media pe săptămână.</p>`;
}

function reviewCard() {
  const plan = s.plan!;
  const today = localDate();
  const weeks = finishedWeeks(s.weights, today);
  const r = review(plan, weeks, s.checkins);
  const act = r.pct != null ? `<button class="primary wide" data-apply="${r.pct}" data-note="${esc(r.note ?? '')}">Aplică ${r.pct > 0 ? '+' : '−'}${Math.abs(r.pct)}% la carbohidrați și grăsimi</button>` : '';
  const rev = r.suggestReverse ? '<button class="primary wide" data-phase="reverse">Treci la reverse diet</button>' : '';
  return `<section class="card review ${r.level}"><h2>${esc(r.title)}</h2><p>${esc(r.body)}</p>${act}${rev}</section>`;
}

function scaleView() {
  const today = localDate();
  const week = mondayOf(today);
  const c = s.checkins[week] ?? {};
  const weeks = finishedWeeks(s.weights, today).slice(-5).reverse();
  return `
  ${reviewCard()}
  <section class="card"><h2>Cântărirea de azi</h2><p class="hint">Dimineața, după baie, pe același cântar.</p>
    <div class="inline"><input id="kg" type="number" step="0.1" inputmode="decimal" value="${s.weights[today] ?? ''}" placeholder="kg" aria-label="Greutate în kg"><button class="primary" data-weigh>Salvează</button></div>${chart()}</section>
  ${weeks.length ? `<section class="card"><h2>Mediile pe săptămână</h2>${weeks.map((w, i) => {
    const prev = weeks[i + 1];
    return `<div class="line"><span>${new Date(`${w.start}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</span><b>${w.avg.toFixed(1)} kg</b><em>${prev ? `${w.avg - prev.avg > 0 ? '+' : ''}${(w.avg - prev.avg).toFixed(2)}` : ''}</em></div>`;
  }).join('')}</section>` : ''}
  <section class="card"><h2>Check-in săptămânal</h2><p class="hint">O dată pe săptămână, în aceeași zi.</p><form id="ci">
    <div class="grid3">${[['waist', 'Talie cm'], ['hips', 'Șolduri cm'], ['bf', 'Grăsime %']].map(([k, l]) => `<label class="field">${l}<input name="${k}" type="number" step="0.1" inputmode="decimal" value="${c[k as keyof CheckIn] ?? ''}"></label>`).join('')}</div>
    ${SCORES.map(([k, l]) => `<label class="range"><span>${l}</span><input type="range" name="${k}" min="1" max="10" value="${c[k] ?? 7}"><output>${c[k] ?? 7}</output></label>`).join('')}
    <button class="primary wide">Salvează check-in-ul</button></form></section>`;
}

// ---- Plan ------------------------------------------------------------------
function dataMaintenance(): number | null {
  const today = localDate();
  const weeks = finishedWeeks(s.weights, today).slice(-5);
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
  try { return localStorage.getItem('beast-nutrition:opening') || 'full'; } catch { return 'full'; }
}

function planView() {
  const plan = s.plan!, p = s.profile!;
  const m = plan.macros;
  const fromData = dataMaintenance();
  const lbm = lbmKg(p);
  const blocked = plan.phase === 'cut' ? dietBlocked(p, plan.maintenance) : null;
  return `
  <section class="card"><h2>${phaseName(plan.phase)}</h2>
    <div class="stats"><div><b>${n0(m.kcal)}</b><span>kcal/zi în medie</span></div><div><b>${m.p}</b><span>g proteine</span></div><div><b>${exactCarbs(m)}</b><span>g carbohidrați</span></div><div><b>${m.f}</b><span>g grăsimi</span></div></div>
    <div class="line"><span>Mențineri folosite</span><b>${n0(plan.maintenance)} kcal</b></div>
    <div class="line"><span>BMR (Müller)</span><b>${n0(bmrMuller(p))} kcal</b></div>
    <div class="line"><span>Masă slabă</span><b>${lbm.toFixed(1)} kg</b></div>
    ${fromData ? `<div class="line"><span>Mențineri din datele tale</span><b>${n0(fromData)} kcal</b></div>` : ''}
    ${plan.phase === 'cut' ? `<div class="line"><span>Ritm țintă</span><b>${plan.ratePct}% / săpt.</b></div>` : ''}
    ${plan.breaks ? `<div class="line"><span>Pauze de dietă</span><b>${plan.breaks.on} săpt. deficit + ${plan.breaks.off} mențineri</b></div>` : ''}
    ${blocked ? `<p class="warn">${esc(blocked)} Cartea recomandă întâi un reverse diet.</p>` : ''}
    ${plan.phase === 'cut' && cutSetup(p, plan.maintenance, plan.ratePct).floored ? `<p class="warn">Ținta a ajuns la limita minimă a aplicației: ritmul de ${plan.ratePct}% e prea mare pentru menținerile de ${n0(plan.maintenance)} kcal. Alege un ritm mai mic sau corectează menținerile.</p>` : ''}
    ${plan.highDays.length && Math.min(...Array.from({ length: 7 }, (_, i) => dayTarget(plan, addDays(mondayOf(localDate()), i)).kcal)) < kcalFloor(p.sex) ? '<p class="warn">Zilele cu calorii mici coboară sub limita minimă a aplicației. Alege o singură zi mare sau un ritm mai mic.</p>' : ''}
    ${plan.phase === 'cut' && isBreakWeek(plan, localDate()) ? '<p class="coach">Săptămâna asta e pauză: mănânci la mențineri.</p>' : ''}
    <button class="ghost wide" data-edit>Schimbă datele și planul</button></section>
  <section class="card"><h2>Faza următoare</h2><p class="hint">Dieta nu se termină, se schimbă faza. Caloriile pornesc de la menținerile tale reale.</p>
    <div class="seg">${(['cut', 'maintain', 'reverse'] as Phase[]).filter((x) => x !== plan.phase).map((x) => `<button data-phase="${x}">${phaseName(x)}</button>`).join('')}</div></section>
  ${plan.adjustments.length ? `<section class="card"><h2>Ajustări</h2>${[...plan.adjustments].reverse().map((a) => `<div class="line"><span>${esc(a.date)} · ${esc(a.note)}</span><b>${a.pct > 0 ? '+' : ''}${a.pct}%</b><em>${n0(a.to)} kcal</em></div>`).join('')}</section>` : ''}
  <button class="ghost wide" data-tab="minte">Mentalitate: cele 12 principii</button>
  <section class="card"><h2>Intro la pornire</h2><div class="seg small">${[['full', 'Complet'], ['short', 'Scurt'], ['off', 'Oprit']].map(([v, l]) => `<button data-opening="${v}" class="${openingMode() === v ? 'on' : ''}">${l}</button>`).join('')}</div></section>
  <section class="card"><h2>Datele tale</h2><p class="hint">Totul stă doar în acest browser, fără cont și fără server. Ține un backup.</p>
    <div class="tools"><button class="ghost" data-export>Descarcă backup</button><label class="ghost file">Încarcă backup<input type="file" id="imp" accept="application/json"></label></div></section>
  <section class="card src"><h2>Surse</h2><p>Metoda: <i>Fat Loss Forever</i>, Layne Norton &amp; Peter Baker. Aplicația nu este afiliată autorilor.</p>
    <p>Alimente: USDA FoodData Central, SR Legacy (domeniu public). Produse de marcă: Open Food Facts (ODbL). Meniul Splendid Chicken: declarația nutrițională SC Danadi SRL.</p>
    <p>Limita minimă de calorii (1.200/1.500 kcal) e o protecție a aplicației. Nu înlocuiește un medic sau un dietetician.</p></section>`;
}

const mindView = () => `<section class="lead"><h1>Fat loss, pentru totdeauna.</h1><p>Mentalitatea lui Layne Norton, din <i>Fat Loss Forever</i>.</p></section>
  ${PRINCIPLES.map((x, i) => `<section class="card pr"><span>${String(i + 1).padStart(2, '0')}</span><div><h2>${esc(x.title)}</h2><p>${esc(x.body)}</p><small>${esc(x.ch)}</small></div></section>`).join('')}`;

// ---- Setup -----------------------------------------------------------------
const ACT: [number, string][] = [[1.2, 'Sedentar: birou, fără sport'], [1.375, 'Ușor: birou și puțin sport'], [1.55, 'Moderat: birou și antrenament serios'], [1.725, 'Foarte activ: antrenament și mers mult'], [1.9, 'Extrem: muncă fizică și sală']];

function setupView() {
  const p = s.profile, pl = s.plan;
  const opt = (v: unknown, cur: unknown) => (v === cur ? 'selected' : '');
  return `<div class="setup">${wolf}<h1>BEAST NUTRITION</h1><p class="sub">Calculăm punctul de start. Îl corectează apoi datele tale.</p>
  <form id="sf">
    <div class="grid2"><label class="field">Sex<select name="sex"><option value="m" ${opt('m', p?.sex)}>Bărbat</option><option value="f" ${opt('f', p?.sex)}>Femeie</option></select></label>
    <label class="field">Vârstă<input name="age" type="number" min="14" max="90" required value="${p?.age ?? ''}"></label>
    <label class="field">Înălțime cm<input name="heightCm" type="number" min="120" max="230" required value="${p?.heightCm ?? ''}"></label>
    <label class="field">Greutate kg<input name="weightKg" type="number" step="0.1" min="35" max="300" required value="${p ? latestWeight() : ''}"></label></div>
    <label class="field">Grăsime corporală % (o estimare e suficientă)<input name="bf" type="number" step="0.5" min="5" max="60" required value="${p?.bf ?? ''}"></label>
    <label class="field">Activitate<select name="activity">${ACT.map(([v, l]) => `<option value="${v}" ${opt(v, p?.activity ?? 1.55)}>${l}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" name="lifts" ${p?.lifts === false ? '' : 'checked'}> Fac antrenament cu greutăți, minimum 2 ore pe săptămână</label>
    <label class="field">Faza<select name="phase" id="ph"><option value="cut" ${opt('cut', pl?.phase)}>Slăbire</option><option value="maintain" ${opt('maintain', pl?.phase)}>Menținere</option><option value="reverse" ${opt('reverse', pl?.phase)}>Reverse diet</option></select></label>
    <label class="field">Calorii de menținere știute din experiență (opțional)<input name="maint" type="number" min="1000" max="6000" value="${pl?.maintenance ?? ''}" placeholder="gol = calculate"></label>
    <div id="cutbox">
      <label class="field">Ritm pe săptămână<select name="rate">${[0.4, 0.5, 0.6, 0.7, 0.8, 1].map((r) => `<option value="${r}" ${opt(r, pl?.ratePct ?? 0.6)}>${r}% din greutate${r === 1 ? ' (maxim)' : ''}</option>`).join('')}</select></label>
      <label class="field">Pauze de dietă<select name="breaks"><option value="">Fără pauze planificate</option>${[[2, 1], [2, 2], [3, 1], [4, 1]].map(([a, b]) => `<option value="${a}+${b}" ${pl?.breaks?.on === a && pl.breaks.off === b ? 'selected' : ''}>${a} săptămâni deficit + ${b} la mențineri</option>`).join('')}</select></label>
      <label class="field">Zile cu calorii mari<select name="high"><option value="">Fără, aceleași calorii zilnic</option><option value="5" ${pl?.highDays.length === 1 ? 'selected' : ''}>Una: sâmbătă</option><option value="5,6" ${pl?.highDays.length === 2 ? 'selected' : ''}>Două: sâmbătă și duminică</option></select></label>
    </div>
    <div id="revbox"><label class="field">Ritm reverse<select name="pace"><option value="c" ${opt('c', pl?.pace)}>Conservator: 2–5% pe săptămână</option><option value="m" ${opt('m', pl?.pace)}>Moderat: 5–8%</option><option value="a" ${opt('a', pl?.pace)}>Agresiv: peste 8%</option></select></label></div>
    <label class="field">Calorii rămase după proteine: carbohidrați / grăsimi<select name="share">${[[0.7, '70 / 30 (grăsimi puține, limita din carte)'], [0.6, '60 / 40'], [0.55, '55 / 45'], [0.5, '50 / 50']].map(([v, l]) => `<option value="${v}" ${opt(v, pl?.carbShare ?? 0.7)}>${l}</option>`).join('')}</select></label>
    <div id="pv" class="preview big"></div>
    <button class="primary wide">${pl ? 'Salvează planul' : 'Creează planul'}</button>
    ${pl ? '<button type="button" class="ghost wide" data-cancel>Renunță</button>' : ''}
  </form></div>`;
}

function readSetup(form: HTMLFormElement) {
  const d = new FormData(form);
  const n = (k: string) => Number(d.get(k));
  const profile: Profile = { sex: d.get('sex') as Sex, age: n('age'), heightCm: n('heightCm'), weightKg: n('weightKg'), bf: n('bf'), activity: n('activity'), lifts: d.get('lifts') === 'on' };
  const b = String(d.get('breaks') ?? '');
  const h = String(d.get('high') ?? '');
  const maintenance = n('maint') || predictedMaintenance(profile);
  const plan = buildPlan(profile, {
    phase: d.get('phase') as Phase, startDate: s.plan?.startDate && s.plan.phase === d.get('phase') ? s.plan.startDate : localDate(),
    ratePct: n('rate'), carbShare: n('share'), maintenance,
    highDays: h ? h.split(',').map(Number) : [], breaks: b ? { on: Number(b[0]), off: Number(b[2]) } : null, pace: d.get('pace') as Pace,
    adjustments: s.plan?.phase === d.get('phase') ? s.plan.adjustments : [],
  });
  return { profile, plan };
}

function bindSetup() {
  const form = document.querySelector<HTMLFormElement>('#sf')!;
  const paint = () => {
    const phase = (form.elements.namedItem('phase') as HTMLSelectElement).value;
    document.querySelector<HTMLElement>('#cutbox')!.hidden = phase !== 'cut';
    document.querySelector<HTMLElement>('#revbox')!.hidden = phase !== 'reverse';
    const box = document.querySelector('#pv')!;
    if (!form.checkValidity()) { box.innerHTML = 'Completează datele ca să vezi cifrele.'; return; }
    const { profile, plan } = readSetup(form);
    const m = plan.macros;
    const setup = cutSetup(profile, plan.maintenance, plan.ratePct);
    const block = phase === 'cut' ? dietBlocked(profile, plan.maintenance) : null;
    box.innerHTML = `<b>${n0(m.kcal)}</b> kcal<span>P ${m.p}</span><span>C ${exactCarbs(m)}</span><span>G ${m.f}</span>
      <p>Mențineri: ${n0(plan.maintenance)} kcal${phase === 'cut' ? ` · deficit ${n0(setup.deficit)} kcal/zi · −${setup.weeklyKg.toFixed(2)} kg/săpt.` : ''}</p>
      ${setup.floored && phase === 'cut' ? '<p class="warn">Ritmul cerut ar coborî sub limita minimă de calorii, așa că ținta a fost ridicată. Alege un ritm mai mic.</p>' : ''}
      ${block ? `<p class="warn">${esc(block)} Cartea recomandă întâi un reverse diet.</p>` : ''}`;
  };
  form.addEventListener('input', paint);
  paint();
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const { profile, plan } = readSetup(form);
    s.profile = profile; s.plan = plan;
    if (!s.weights[localDate()]) s.weights[localDate()] = profile.weightKg;
    editing = false; commit(); render();
  });
}

function changePhase(phase: Phase) {
  const p = s.profile!, old = s.plan!;
  const maintenance = dataMaintenance() ?? old.maintenance;
  const profile = { ...p, weightKg: latestWeight() };
  s.profile = profile;
  s.plan = buildPlan(profile, { ...old, phase, startDate: localDate(), maintenance, adjustments: [] });
  commit(); render(); toast(`Faza nouă: ${phaseName(phase)}`);
}

// ---- Events ----------------------------------------------------------------
document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('button, [data-close]');
  if (!el) { if (ev.target === sheet) close(); return; }
  const d = el.dataset;
  if (fuelAction(el) || fastAction(el) || bodyAction(el)) return;
  if (d['tab']) { tab = d['tab'] as Tab; render(); scrollTo(0, 0); }
  else if (d['day']) { date = addDays(date, Number(d['day'])); render(); }
  else if (d['add'] != null) openAdd(Number(d['add']));
  else if (d['close'] != null) close();
  else if (d['del']) {
    const [i, id] = d['del'].split(':');
    s.days[date] = dayMeals(s, date).map((m, k) => (k === Number(i) ? m.filter((e) => e.id !== id) : m));
    commit(); render();
  } else if (d['copy'] != null) {
    const prev = dayMeals(s, addDays(date, -1));
    if (!prev.flat().length) { toast('Ieri nu ai nimic notat.'); return; }
    s.days[date] = dayMeals(s, date).map((m, i) => [...m, ...prev[i]!.map((e) => ({ ...e, id: crypto.randomUUID() }))]);
    commit(); render();
  } else if (d['mode']) {
    mode = d['mode'] as typeof mode;
    sheet.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === el));
    void runSearch(document.querySelector<HTMLInputElement>('#q')?.value ?? '');
  } else if (d['food']) { const f = shown.get(d['food']); if (f) openQuantity(f); }
  else if (d['manual'] != null) openManual();
  else if (d['scan'] != null) openBarcode();
  else if (d['weigh'] != null) {
    const kg = Number(document.querySelector<HTMLInputElement>('#kg')?.value);
    if (!(kg > 30 && kg < 350)) { toast('Scrie greutatea în kg.'); return; }
    s.weights[localDate()] = kg; commit(); render(); toast('Salvat.');
  } else if (d['apply']) {
    const plan = s.plan!, pct = Number(d['apply']);
    const to = shiftCarbsFat(plan.macros, pct);
    plan.adjustments.push({ date: localDate(), pct, note: d['note'] ?? '', from: plan.macros.kcal, to: to.kcal });
    plan.macros = to;
    if (plan.phase !== 'cut') plan.maintenance = to.kcal;
    commit(); render(); toast(`Noua țintă: ${n0(to.kcal)} kcal`);
  } else if (d['phase']) changePhase(d['phase'] as Phase);
  else if (d['opening']) { try { localStorage.setItem('beast-nutrition:opening', d['opening']); } catch { /* storage blocked: the intro stays on */ } render(); }
  else if (d['edit'] != null) { editing = true; render(); scrollTo(0, 0); }
  else if (d['cancel'] != null) { editing = false; render(); }
  else if (d['export'] != null) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `beast-nutrition-${localDate()}.json`; a.click();
    URL.revokeObjectURL(url);
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'q') { clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void runSearch(t.value), mode === 'brand' ? 500 : 120); }
  if (t.type === 'range') t.nextElementSibling!.textContent = t.value;
});

document.addEventListener('submit', (ev) => {
  const form = ev.target as HTMLFormElement;
  if (form.id !== 'ci') return;
  ev.preventDefault();
  const c: CheckIn = {};
  new FormData(form).forEach((v, k) => { if (v !== '') c[k as keyof CheckIn] = Number(v); });
  s.checkins[mondayOf(localDate())] = c;
  commit(); render(); toast('Check-in salvat.');
});

document.addEventListener('change', async (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id !== 'imp' || !t.files?.[0]) return;
  try {
    s = parseBackup(await t.files[0].text()); commit(); render(); toast('Backup încărcat.');
  } catch (e) { toast(e instanceof Error ? e.message : 'Fișier invalid.'); }
});

// No zoom: iOS ignores user-scalable=no, so pinch is blocked here as well.
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (ev) => ev.preventDefault(), { passive: false });
document.addEventListener('touchmove', (ev) => { if (ev.touches.length > 1) ev.preventDefault(); }, { passive: false });
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
render();
