/* The Cookbook tab (2026-11-15, the user: "un tab care să se numească Cookbook", the recipes of the two books with
   their preparation and macros, each once, and a button that adds the meal to Azi so it counts in the macros). */
import { ctx, esc, n0, n1, nb } from '../app.ts';
import { COOK_CAT, RECIPES, type CookCat, type Recipe } from '../data/cookbook.ts';
import { portionOf, shareLabel } from '../logic/cook.ts';
import { dayMeals, MEALS, totals } from '../logic/store.ts';
import { head, heroBand } from './parts.ts';
import { dayFuel, mealSlots } from './state.ts';

const SHORT_CAT: Record<CookCat, string> = { dejun: 'Dejun', pranz: 'Prânz', gustare: 'Gustări', desert: 'Dulci' };
let cat: CookCat | 'all' = 'all';
let sort: 'az' | 'prot' | 'kcal' = 'az';
let query = '';

/** Without diacritics and case, so "salata" finds "Salată". */
const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Protein per 100 kcal: how much of the day's protein a recipe brings for its calories. */
const density = (r: Recipe) => (r.p * 100) / r.kcal;

function listed(): Recipe[] {
  const q = fold(query.trim());
  const list = RECIPES.filter((r) => (cat === 'all' || r.cat === cat) && (!q || fold(`${r.name} ${r.ing.join(' ')}`).includes(q)));
  if (sort === 'prot') return list.sort((a, b) => density(b) - density(a));
  if (sort === 'kcal') return list.sort((a, b) => a.kcal / Math.max(1, a.pieces) - b.kcal / Math.max(1, b.pieces));
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

const per = (r: Recipe) => (r.pieces > 1 ? `${r.pieces} buc. · ${n0(r.kcal / r.pieces)} kcal bucata` : 'o rețetă');

function rowsHtml() {
  const list = listed();
  return list.length
    ? list.map((r) => `<button class="row" data-cook="${r.id}"><span><b>${esc(r.name)}</b><small>${COOK_CAT[r.cat]} · ${per(r)}</small></span><em>${nb(n0(r.kcal), 'kcal')}<small>${nb(n0(r.p), 'g')} proteine</small></em></button>`).join('')
    : '<p class="hint pad">Nicio rețetă găsită. Caută după nume sau după un ingredient: ton, ovăz, cottage.</p>';
}

export function cookHtml(): string {
  const chip = (k: string, label: string, on: boolean, attr: string) => `<button ${attr}="${k}" class="${on ? 'on' : ''}">${label}</button>`;
  return `${head('book', 'Cookbook', `${RECIPES.length} rețete din Cookbook 1.0 și 2.0, fiecare o singură dată, cu preparare și macronutrienți.`)}
  ${heroBand('cook')}
  <label class="sr" for="cq">Caută o rețetă</label><input id="cq" type="search" placeholder="Caută: pui, ton, ovăz, clătite" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
  <div class="seg cook-cat">${chip('all', 'Toate', cat === 'all', 'data-ccat')}${(Object.keys(COOK_CAT) as CookCat[]).map((k) => chip(k, SHORT_CAT[k], cat === k, 'data-ccat')).join('')}</div>
  <div class="chips cook-sort">${chip('az', 'A–Z', sort === 'az', 'data-csort')}${chip('prot', 'Cele mai proteice', sort === 'prot', 'data-csort')}${chip('kcal', 'Cele mai ușoare', sort === 'kcal', 'data-csort')}</div>
  <section class="card list" id="cook-list">${rowsHtml()}</section>
  <p class="hint">Macronutrienții sunt cei din cărți, pentru toată rețeta, verificați cu 4/4/9 kcal pe gram. Rețetele marcate „estimat” aveau cifrele ilizibile în PDF și sunt calculate din ingrediente. Produsele de marcă diferă: pentru precizie, cântărește ingredientele crude și loghează-le separat.</p>`;
}

/* ---------- One recipe ---------- */

let open: Recipe | null = null;
let share = 1;
let slot = 0;

/** The meal slots Azi shows today, so the recipe lands where the user expects it. */
function slotsToday() {
  const n = Math.max(1, Math.min(MEALS.length, mealSlots(ctx.today()).times.length || 4));
  return MEALS.slice(0, n);
}

function nowSlot() {
  const times = mealSlots(ctx.today()).times;
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let at = 0;
  times.forEach((t, i) => { if (t && t <= hm) at = i; });
  return Math.min(at, slotsToday().length - 1);
}

function preview() {
  const r = open!;
  const e = portionOf(r, share);
  const t = dayFuel(ctx.today());
  const sum = totals(dayMeals(ctx.get(), ctx.today()));
  const left = t.kcal - sum.kcal - e.kcal;
  return `<b>${n0(e.kcal)}</b><span>kcal</span><span>${nb(n1(e.p), 'g')} proteine</span><span>${nb(n1(e.c), 'g')} carbo</span><span>${nb(n1(e.f), 'g')} grăsimi</span>
    <p>${esc(shareLabel(r, share))}. ${left >= 0 ? `După ea mai ai ${nb(n0(left), 'kcal')} azi.` : `Cu ea treci ${nb(n0(-left), 'kcal')} peste ținta de azi.`}</p>`;
}

function amountHtml(r: Recipe) {
  if (r.pieces > 1) {
    const n = Math.round(share * r.pieces * 100) / 100;
    return `<div class="amount"><button class="step" data-cstep="-1" aria-label="O bucată mai puțin">−</button><label><span class="sr">Bucăți</span><input id="cn" type="text" inputmode="decimal" value="${String(n).replace('.', ',')}" autocomplete="off"></label><span class="unit">din ${r.pieces} buc.</span><button class="step" data-cstep="1" aria-label="O bucată în plus">+</button></div>`;
  }
  const opts: [string, number][] = [['¼', 0.25], ['⅓', 1 / 3], ['½', 0.5], ['¾', 0.75], ['Toată', 1]];
  return `<div class="chips cook-share">${opts.map(([l, v]) => `<button data-cshare="${v}" class="${Math.abs(v - share) < 0.01 ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

function addBox() {
  const r = open!;
  const slots = slotsToday();
  return `${amountHtml(r)}
    <div class="seg cook-slot">${slots.map((m, i) => `<button data-cslot="${i}" class="${i === slot ? 'on' : ''}">${esc(m.replace('Masa ', 'M'))}</button>`).join('')}</div>
    <div id="cpv" class="preview">${preview()}</div>
    <button class="primary wide" data-cadd>Adaugă la ${esc(slots[slot] ?? MEALS[0]!)}</button>`;
}

/** Only the part that changed is redrawn, so the sheet does not jump back to the top. */
function paintBox() {
  const box = document.querySelector('#cbox');
  if (!box) return;
  box.innerHTML = addBox();
  const r = open!;
  const input = box.querySelector<HTMLInputElement>('#cn');
  input?.addEventListener('input', () => {
    const v = Number(input.value.replace(',', '.'));
    if (v > 0) { share = Math.min(r.pieces * 4, v) / r.pieces; box.querySelector('#cpv')!.innerHTML = preview(); }
  });
}

function recipeSheet() {
  const r = open!;
  ctx.open(`<h2>${esc(r.name)}</h2>
    <p class="hint">${COOK_CAT[r.cat]} · Cookbook ${r.book}, Nicolas Aesthetics${r.est ? ' · macronutrienți estimați' : ''}</p>
    <div class="cook-mac"><span><b>${n0(r.kcal)}</b>kcal</span><span><b>${n0(r.p)}</b>g proteine</span><span><b>${n0(r.c)}</b>g carbo</span><span><b>${n0(r.f)}</b>g grăsimi</span></div>
    <p class="hint">${r.pieces > 1 ? `Toată rețeta, ${r.pieces} bucăți. O bucată: ${nb(n0(r.kcal / r.pieces), 'kcal')}, ${nb(n1(r.p / r.pieces), 'g')} proteine.` : 'Toată rețeta.'}</p>
    <h3 class="cook-h">Ingrediente</h3><ul class="cook-ing">${r.ing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3 class="cook-h">Mod de preparare</h3><ol class="cook-steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <h3 class="cook-h">Adaugă în Azi</h3>
    <p class="hint">Cât ai mâncat${r.pieces > 1 ? ', în bucăți' : ' din rețetă'}:</p>
    <div id="cbox"></div>`, esc(r.name));
  paintBox();
}

function addToday() {
  const r = open!;
  if (!(share > 0)) { ctx.toast('Alege cât ai mâncat.'); return; }
  const s = ctx.get(), d = ctx.today();
  const before = s.days[d];
  const days = dayMeals(s, d).map((m) => [...m]);
  const e = portionOf(r, share);
  days[slot]!.push(e);
  s.days[d] = days;
  ctx.commit(); ctx.close(); ctx.render();
  ctx.toast(`${r.name} adăugat la ${MEALS[slot]}, ${n0(e.kcal)} kcal.`, () => { if (before) s.days[d] = before; else delete s.days[d]; ctx.commit(); ctx.render(); });
}

function refreshList() {
  const el = document.querySelector('#cook-list');
  if (el) el.innerHTML = rowsHtml();
}

export function cookAction(el: HTMLElement): boolean {
  const d = el.dataset;
  if (d['cook']) {
    open = RECIPES.find((r) => r.id === d['cook']) ?? null;
    if (!open) return true;
    share = open.pieces > 1 ? 1 / open.pieces : 1;
    slot = nowSlot();
    recipeSheet();
    return true;
  }
  if (d['ccat']) { cat = d['ccat'] as typeof cat; document.querySelectorAll('[data-ccat]').forEach((b) => b.classList.toggle('on', b === el)); refreshList(); return true; }
  if (d['csort']) { sort = d['csort'] as typeof sort; document.querySelectorAll('[data-csort]').forEach((b) => b.classList.toggle('on', b === el)); refreshList(); return true; }
  if (!open) return false;
  if (d['cshare']) { share = Number(d['cshare']); paintBox(); return true; }
  if (d['cstep']) { const n = Math.round(share * open.pieces) + Number(d['cstep']); share = Math.max(1, Math.min(open.pieces * 4, n)) / open.pieces; paintBox(); return true; }
  if (d['cslot']) { slot = Number(d['cslot']); paintBox(); return true; }
  if (d['cadd'] != null) { addToday(); return true; }
  return false;
}

export function cookInput(t: HTMLInputElement) {
  if (t.id !== 'cq') return;
  query = t.value;
  refreshList();
}
