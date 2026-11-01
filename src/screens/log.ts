/* Logging food: search, amount, and back to the search for the next food, so a meal is one sheet, not four. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { byBarcode, loadFoods, search, searchBranded, searchUsdaBrands, type Food } from '../logic/foods.ts';
import { dayMeals, entryFrom, MEALS, totals, type Entry } from '../logic/store.ts';
import { dayFuel } from './state.ts';

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
  res.innerHTML = list.length ? `<h3>Recente</h3>${list.map(foodRow).join('')}` : '<p class="hint pad">Peste 13.000 de alimente și 400.000 de produse de marcă. Poți căuta în română.</p>';
}

/** USDA answers from the app's own files; Open Food Facts is slower, can fail and only adds to the list. */
async function runBrandSearch(q: string, res: Element, run: number) {
  res.innerHTML = '<p class="hint pad">Caut în produsele de marcă…</p>';
  const usda = await searchUsdaBrands(q).catch(() => null);
  if (run !== searchRun) return;
  const more = usda && usda.total > usda.foods.length ? `<p class="hint pad">${usda.total.toLocaleString('ro-RO')} produse găsite. Adaugă marca sau tipul ca să restrângi.</p>` : '';
  const local = usda?.foods.length ? `${more}${usda.foods.map(foodRow).join('')}` : '';
  res.innerHTML = `${local}<p class="hint pad">Caut și în Open Food Facts…</p>`;
  const off = await searchBranded(q).catch(() => null);
  if (run !== searchRun) return;
  const extra = off?.length ? `<h3>Open Food Facts</h3>${off.map(foodRow).join('')}` : '';
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
    <div class="btns"><button class="ghost" data-scan>Cod de bare</button><button class="ghost" data-manual>Introdu manual</button></div>
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

function openManual() {
  ctx.open(`<h2>Aliment propriu</h2><p class="hint">Valorile de pe etichetă, la 100 g. Rămâne salvat la Recente.</p>
    <form id="mf"><label class="field">Nume<input name="name" required autocomplete="off"></label>
    <div class="grid2">${[['kcal', 'Calorii'], ['p', 'Proteine, g'], ['c', 'Carbohidrați, g'], ['f', 'Grăsimi, g'], ['fiber', 'Fibre, g (opțional)']].map(([k, l]) => `<label class="field">${l}<input name="${k}" type="text" inputmode="decimal" ${k === 'fiber' ? '' : 'required'} autocomplete="off"></label>`).join('')}</div>
    <button class="primary wide">Salvează</button></form>`, 'Aliment propriu');
  document.querySelector<HTMLFormElement>('#mf')!.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(ev.target as HTMLFormElement);
    const num = (k: string) => parseNum(d.get(k)) || 0;
    const f: Food = { id: `m${crypto.randomUUID()}`, name: String(d.get('name')), cat: 'Alimentele mele', kcal: num('kcal'), p: num('p'), c: num('c'), f: num('f'), fiber: num('fiber'), sugar: 0, sat: 0, sodium: 0, portions: [], source: 'mine' };
    ctx.get().custom.unshift(f); ctx.commit(); openQuantity(f);
  });
}

function openBarcode() {
  const hasCam = 'BarcodeDetector' in window;
  ctx.open(`<h2>Cod de bare</h2>${hasCam ? '<video id="cam" playsinline muted></video>' : '<p class="hint">Browserul nu poate citi codul cu camera. Scrie cifrele de sub cod.</p>'}
    <label class="field">Cifrele codului<input id="code" type="text" inputmode="numeric" autocomplete="off"></label><button class="primary wide" id="find">Caută</button>`, 'Cod de bare');
  let stream: MediaStream | null = null;
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  const lookup = async (code: string) => {
    stop();
    try {
      const f = await byBarcode(code);
      if (f) openQuantity(f); else ctx.toast('Codul nu este în USDA sau Open Food Facts.');
    } catch { ctx.toast('Căutarea are nevoie de internet.'); }
  };
  document.querySelector('#find')!.addEventListener('click', () => {
    const v = document.querySelector<HTMLInputElement>('#code')!.value.trim();
    if (/^\d{8,14}$/.test(v)) void lookup(v); else ctx.toast('Codul are 8–14 cifre.');
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
    } catch { ctx.toast('Nu am acces la cameră. Scrie cifrele.'); }
  })();
}

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
  if (d['scan'] != null) { openBarcode(); return true; }
  if (d['backSearch'] != null) { searchSheet(); return true; }
  return false;
}

export function logInput(t: HTMLInputElement) {
  if (t.id !== 'q') return;
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void runSearch(t.value), mode === 'brand' ? 500 : 120);
}
