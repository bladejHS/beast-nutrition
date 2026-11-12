/* Logging food: search, amount, and back to the search for the next food, so a meal is one sheet, not four. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { byBarcode, loadFoods, search, searchBranded, searchOffRo, searchUsdaBrands, type Food } from '../logic/foods.ts';
import { dayMeals, entryFrom, MEALS, totals, type Entry } from '../logic/store.ts';
import { dayFuel } from './state.ts';
import { openScanner } from './scanner.ts';
import { openFoodEditor } from './mine.ts';

let meal = 0;
let logDate = '';
let mode: 'db' | 'brand' = 'db';
let added: Entry[] = [];
let searchTimer = 0;
let searchRun = 0;
const shown = new Map<string, Food>();

function foodRow(f: Food) {
  shown.set(f.id, f);
  return `<button class="row" data-food="${esc(f.id)}"><span><b>${esc(f.name)}</b><small>${esc(f.cat)}</small></span><em>${nb(n0(f.kcal), 'kcal')}<small>${nb(n0(f.p), 'g')} proteine</small></em></button>`;
}

/** What is left of the day, in the only two numbers that decide what to pick next. */
function leftLine() {
  const t = dayFuel(logDate);
  const sum = totals(dayMeals(ctx.get(), logDate));
  const kcal = t.kcal - sum.kcal, p = t.p - sum.p;
  return kcal >= 0 ? `Mai ai ${nb(n0(kcal), 'kcal')}${p > 0 ? ` și ${nb(n0(p), 'g')} proteine` : ''} azi.` : `Ești cu ${nb(n0(-kcal), 'kcal')} peste țintă.`;
}

function showRecent() {
  const res = document.querySelector('#res');
  if (!res) return;
  shown.clear();
  const s = ctx.get();
  const list = [...s.custom, ...s.recent.filter((r) => !s.custom.some((c) => c.id === r.id))].slice(0, 15);
  res.innerHTML = list.length ? `<h3>Recente</h3>${list.map(foodRow).join('')}` : '<p class="hint pad">Peste 13.000 de alimente și 400.000 de produse de marcă, cu rafturile din România. Poți căuta în română.</p>';
}

/** The Romanian shelf and USDA answer from the app's own files; Open Food Facts online is slower, can fail and only adds to the list. */
async function runBrandSearch(q: string, res: Element, run: number) {
  res.innerHTML = '<p class="hint pad">Caut în produsele de marcă…</p>';
  const [ro, usda] = await Promise.all([searchOffRo(q, undefined, 25).catch(() => null), searchUsdaBrands(q).catch(() => null)]);
  if (run !== searchRun) return;
  const found = (ro?.total ?? 0) + (usda?.total ?? 0), shown = (ro?.foods.length ?? 0) + (usda?.foods.length ?? 0);
  const more = found > shown ? `<p class="hint pad">${found.toLocaleString('ro-RO')} produse găsite. Adaugă marca sau tipul ca să restrângi.</p>` : '';
  const list = (title: string, foods: Food[] | undefined) => (foods?.length ? `<h3>${title}</h3>${foods.map(foodRow).join('')}` : '');
  const local = `${more}${list('România', ro?.foods)}${list('USDA', usda?.foods)}`;
  res.innerHTML = `${local}<p class="hint pad">Caut și în Open Food Facts…</p>`;
  const off = await searchBranded(q).catch(() => null);
  if (run !== searchRun) return;
  const seen = new Set(ro?.foods.map((f) => f.id));
  const extra = list('Open Food Facts, online', off?.filter((f) => !seen.has(f.id)));
  res.innerHTML = (shown ? local : '') + extra || `<p class="hint pad">${ro || usda || off ? 'Niciun produs găsit.' : 'Produsele de marcă nu s-au încărcat. Încearcă din nou, folosește Alimente sau introdu valorile manual.'}</p>`;
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
      const all = [...ctx.get().custom, ...await loadFoods()];
      if (run !== searchRun) return;
      res.innerHTML = search(all, q).map(foodRow).join('') || '<p class="hint pad">Nimic găsit. Încearcă și în engleză sau la Produse de marcă.</p>';
    }
  } catch {
    res.innerHTML = '<p class="hint pad">Baza de alimente nu s-a încărcat. Încearcă din nou sau introdu valorile manual.</p>';
  }
}

function searchSheet() {
  ctx.open(`<h2>${MEALS[meal]}</h2>
    ${added.length ? `<p class="added"><b>Adăugat:</b> ${added.map((e) => `${esc(e.name)}, ${nb(n0(e.g), 'g')}`).join('; ')}</p>` : ''}
    <p class="hint" id="left">${leftLine()}</p>
    <div class="seg"><button data-mode="db" class="${mode === 'db' ? 'on' : ''}">Alimente</button><button data-mode="brand" class="${mode === 'brand' ? 'on' : ''}">Produse de marcă</button></div>
    <label class="sr" for="q">Caută un aliment</label><input id="q" type="search" placeholder="piept de pui, ovăz, Chicken Tenders" autocomplete="off" enterkeyhint="search">
    <div class="btns"><button class="ghost scanbtn" data-scan><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 8v8M10.5 8v8M13.5 8v8M17 8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Scanează codul</button><button class="ghost" data-manual>Introdu manual</button></div>
    <div id="res"></div>
    ${added.length ? '<button class="primary wide stick" data-close>Gata</button>' : ''}`, MEALS[meal]);
  showRecent();
  if (matchMedia('(hover: hover)').matches) document.querySelector<HTMLInputElement>('#q')?.focus();
}

export function openAdd(date: string, i: number) {
  logDate = date; meal = i; mode = 'db'; added = [];
  searchSheet();
}

function perHundred(f: Food) {
  const fiber = f.source === 'spd' || f.noFiber ? 'fibre nedeclarate' : f.fiber > 0 ? `fibre ${nb(n1(f.fiber), 'g')}` : '';
  const parts = [fiber, f.sugar > 0 ? `zahăr ${nb(n1(f.sugar), 'g')}` : '', f.sodium > 0 ? `sare ${nb(n1((f.sodium * 2.5) / 1000), 'g')}` : ''].filter(Boolean);
  return `Pe 100 g: ${nb(n0(f.kcal), 'kcal')}${parts.length ? `, ${parts.join(', ')}` : ''}.`;
}

function openQuantity(f: Food) {
  const chips = [...f.portions, ['100 g', 100] as [string, number]];
  ctx.open(`<h2>${esc(f.name)}</h2>${f.en && f.en !== f.name ? `<p class="hint">${esc(f.en)}</p>` : ''}
    <div class="amount"><button class="step" data-step="-10" aria-label="Scade 10 grame">−</button><label><span class="sr">Cantitate în grame</span><input id="g" type="text" inputmode="decimal" value="${f.source === 'usda' ? 100 : f.portions[0]?.[1] ?? 100}" autocomplete="off"></label><span class="unit">g</span><button class="step" data-step="10" aria-label="Crește cu 10 grame">+</button></div>
    <div class="chips">${chips.map(([l, g]) => `<button data-g="${g}">${esc(l)}</button>`).join('')}</div>
    <div id="pv" class="preview"></div>
    <p class="hint">${perHundred(f)}</p>
    ${f.allergens ? `<p class="warn">Alergeni: ${esc(f.allergens)}</p>` : ''}
    <button class="primary wide" id="addgo">Adaugă la ${MEALS[meal]}</button>
    <button class="ghost wide" data-back-search>Înapoi la căutare</button>`, esc(f.name));
  const input = document.querySelector<HTMLInputElement>('#g')!;
  const paint = () => {
    const e = entryFrom(f, parseNum(input.value) || 0);
    document.querySelector('#pv')!.innerHTML = `<b>${n0(e.kcal)}</b><span>kcal</span><span>${nb(n1(e.p), 'g')} proteine</span><span>${nb(n1(e.c), 'g')} carbo</span><span>${nb(n1(e.f), 'g')} grăsimi</span>`;
  };
  paint();
  input.addEventListener('input', paint);
  document.querySelectorAll<HTMLButtonElement>('[data-g], [data-step]').forEach((b) => b.addEventListener('click', () => {
    const step = Number(b.dataset['step'] ?? 0);
    input.value = String(b.dataset['g'] ?? Math.max(5, (parseNum(input.value) || 0) + step));
    paint();
  }));
  document.querySelector('#addgo')!.addEventListener('click', () => {
    const g = parseNum(input.value);
    if (!(g > 0)) { ctx.toast('Scrie cantitatea în grame.'); return; }
    const s = ctx.get();
    const days = dayMeals(s, logDate).map((m) => [...m]);
    const entry = entryFrom(f, g);
    days[meal]!.push(entry);
    s.days[logDate] = days;
    s.recent = [f, ...s.recent.filter((r) => r.id !== f.id)].slice(0, 30);
    added.push(entry);
    ctx.commit(); ctx.render();
    searchSheet();
  });
}

/** A food typed in from its label: saved in Alimentele mele (src/screens/mine.ts), then its amount for this meal. */
function openManual(code = '') {
  openFoodEditor({ code, then: openQuantity });
}

/** Scan, then the amount; a product no database knows can be saved once, by hand, under its code. */
function openBarcode() {
  openScanner((code) => void (async () => {
    ctx.open(`<h2>Caut produsul</h2><p class="hint">Cod ${code}</p>`, 'Caut produsul');
    let f: Food | null = null, offline = false;
    try { f = await byBarcode(code, ctx.get().custom); } catch { offline = true; }
    if (f) { openQuantity(f); return; }
    notFoundCode = code;
    ctx.open(`<h2>Produs negăsit</h2><p class="hint">${offline ? 'Căutarea are nevoie de internet.' : `Codul ${code} nu este nici pe rafturile din România, nici în USDA, nici în Open Food Facts.`} Îl poți salva tu o singură dată, cu valorile de pe etichetă.</p>
      <button class="primary wide" data-manual-code>Adaugă-l de pe etichetă</button>
      <div class="btns"><button class="ghost" data-scan>Scanează din nou</button><button class="ghost" data-back-search>Înapoi la căutare</button></div>`, 'Produs negăsit');
  })());
}

let notFoundCode = '';

export function logAction(el: HTMLElement): boolean {
  const d = el.dataset;
  if (d['mode']) {
    mode = d['mode'] as typeof mode;
    document.querySelectorAll('#sheet [data-mode]').forEach((b) => b.classList.toggle('on', b === el));
    void runSearch(document.querySelector<HTMLInputElement>('#q')?.value ?? '');
    return true;
  }
  if (d['food']) { const f = shown.get(d['food']); if (f) openQuantity(f); return true; }
  if (d['manual'] != null) { openManual(); return true; }
  if (d['manualCode'] != null) { openManual(notFoundCode); return true; }
  if (d['scan'] != null) { openBarcode(); return true; }
  if (d['backSearch'] != null) { searchSheet(); return true; }
  return false;
}

export function logInput(t: HTMLInputElement) {
  if (t.id !== 'q') return;
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void runSearch(t.value), mode === 'brand' ? 500 : 120);
}
