import './styles.css';
import { cycleAction, cycleTabHtml } from './screens/cycletab.ts';
import { cookAction, cookHtml, cookInput } from './screens/cook.ts';
import { chapterCheck, isPerfect, trophyInit } from './screens/show.ts';
import { photosAction, photosInput } from './screens/photos.ts';
import { forceUpdate } from './screens/update.ts';
import { makeDock } from './screens/dock.ts';
import { afterRender, ctx, type Tab } from './app.ts';
import { load, save, type State } from './logic/store.ts';
import { bodyAction, bodyBind, bodyHtml } from './screens/body.ts';
import { fastAction, fastBind, fastHtml } from './screens/fast.ts';
import { fuelAction, fuelBind, fuelHome, fuelSub, fuelHtml, mealsTab } from './screens/fuel.ts';
import { glp1Action, glp1Html } from './screens/glp1.ts';
import { goalAction, goalBind, labsAction, labsBind, stackAction } from './screens/extra.ts';
import { back } from './screens/parts.ts';
import { logAction, logInput } from './screens/log.ts';
import { mineAction } from './screens/mine.ts';
import { importBackup, importMfp, isEditing, mindHtml, planAction, planHtml, setupBind, setupHtml } from './screens/plan.ts';
import { dayFuel, freshFuel, kitchen, mealSlots, syncFuel } from './screens/state.ts';
import { dayMeals, totals } from './logic/store.ts';
import { trendAlpha, weightTrend } from './logic/trend.ts';
import { addDays } from './logic/review.ts';
import { followToday, todayAction, todayBind, todayHtml } from './screens/today.ts';

const app = document.querySelector<HTMLElement>('#app')!;
const sheet = document.querySelector<HTMLElement>('#sheet')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;

let s: State = load();
let tab: Tab = 'azi';
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let toastTimer = 0;
function toast(msg: string, undo?: () => void, label = 'Anulează') {
  clearTimeout(toastTimer);
  toastEl.innerHTML = '';
  toastEl.append(msg);
  if (undo) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => { toastEl.classList.remove('on'); undo(); });
    toastEl.append(b);
  }
  toastEl.classList.add('on');
  toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), undo ? 6000 : 2800);
}

function commit() {
  freshFuel();
  if (!save(s)) toast('Browserul nu a putut salva. Fă un backup din Mai mult → Planul meu.');
}

let opener: HTMLElement | null = null;
function close() {
  if (!sheet.classList.contains('on')) return;
  sheet.innerHTML = ''; sheet.className = '';
  app.inert = false;
  sheet.removeAttribute('role'); sheet.removeAttribute('aria-modal'); sheet.removeAttribute('aria-label');
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}
function open(html: string, label = 'Fereastră') {
  if (!sheet.classList.contains('on')) opener = document.activeElement as HTMLElement | null;
  sheet.className = 'on';
  app.inert = true;
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', label.replace(/&#\d+;/g, ''));
  sheet.innerHTML = `<div class="sh" tabindex="-1"><button class="x" data-close aria-label="Închide">×</button>${html}</div>`;
  sheet.querySelector<HTMLElement>('.sh')!.focus({ preventScroll: true });
}

ctx.get = () => s; ctx.commit = commit; ctx.toast = toast; ctx.render = () => render(); ctx.open = open; ctx.close = close; ctx.today = () => localDate();
ctx.go = (t) => { tab = t; render(); };

const ICONS = {
  // 2026-11-16: each icon in parts, so it can act when its tab opens (styles.css, "the dock's acts")
  azi: '<circle cx="12" cy="12" r="8.5"/><g class="hh"><path d="M12 12V8.4"/></g><g class="hm"><path d="M12 12V6.2"/></g><circle class="ctr" cx="12" cy="12" r=".6"/>',
  mese: '<g class="fk"><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5"/></g><g class="kn"><path d="M17 21V3c-2.2 1.4-3 4-3 7 0 1.6.9 2.8 3 3"/></g><circle class="clk" cx="12" cy="3.4" r="1.3"/>',
  cicl: '<g class="arr"><path d="M20.4 9.2A8.8 8.8 0 0 0 5.4 5.6M5.2 2.6v3.2h3.2M3.6 14.8a8.8 8.8 0 0 0 15 3.6M18.8 21.4v-3.2h-3.2"/></g><path d="M9.2 10a1.9 1.9 0 0 1 .2-3.8h5.2a1.9 1.9 0 0 1 .2 3.8v4.4a.7.7 0 0 1-.7.7H9.9a.7.7 0 0 1-.7-.7Z"/>',
  cook: '<path d="M5 4.6A1.6 1.6 0 0 1 6.6 3H19v14H6.6A1.6 1.6 0 0 0 5 18.6z"/><path d="M5 18.6A1.6 1.6 0 0 0 6.6 20.2H19v-3.2"/><g class="cvr"><path d="M10 6.5v4.2M12 6.5v4.2M11 10.7v3.3M15.4 6.5c-1 .6-1.4 1.8-1.4 3.2 0 .8.5 1.3 1.4 1.4v2.9"/></g><path class="pg" d="M6.6 3H19v14H6.6"/>',
  corp: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M7.6 10.4a6 6 0 0 1 8.8 0"/><g class="nd"><path d="M12 13.2V8.6"/></g><circle cx="12" cy="13.4" r="1"/>',
  fuel: '<g class="fl"><path d="M12 3c.6 3.2 5.5 5.9 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.3-5 .3 1.3 1 2.2 1.900 2.600C10.400 9 10.800 6 12 3Z"/></g>',
};
type Main = keyof typeof ICONS;
// 2026-11-12, fewer places: Azi, the meal plan, the body, and everything else under "Mai mult" (Fuel's tools and the plan)
const TAB_NAME: Record<Main, string> = { azi: 'Azi', mese: 'Mese', cicl: 'Carb', cook: 'Cookbook', corp: 'Corp', fuel: 'Mai mult' };
const home = (t: Tab): Main => (t === 'post' || t === 'minte' || t === 'plan' || t === 'glp1' ? 'fuel' : t);

/** The living pictures (heroBand in parts.ts), drawn by the arena engine the opening loads. */
function mountHero(root: HTMLElement) {
  const arena = (window as unknown as { BeastArena?: { hero: (c: HTMLCanvasElement, o: object) => unknown } }).BeastArena;
  if (!arena) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll<HTMLCanvasElement>('canvas.hero-cv').forEach((cv) => {
    let journey: unknown = null;
    try { journey = cv.dataset['j'] ? JSON.parse(cv.dataset['j']) : null; } catch { journey = null; }
    try { arena.hero(cv, { kind: cv.dataset['kind'], color: [135, 89, 232], hot: [164, 122, 255], still, journey }); } catch { /* the screen stands without it */ }
  });
}

/** The dock (screens/dock.ts): built once, outside #app, so the orb can leap from tab to tab. */
const dock = makeDock((Object.keys(ICONS) as Main[]).map((k) => ({ key: k, label: TAB_NAME[k], icon: ICONS[k] })));
/** The tabs in the bar: Carb only while carb cycling is on (2026-11-15). */
const shown = (): Main[] => (Object.keys(ICONS) as Main[]).filter((k) => k !== 'cicl' || s.fuel.cycling);
const tabAt = () => shown().indexOf(home(tab));

/** The day in the dock (2026-11-16): calories round Azi, the weight's trend on Corp, a meal due on Mese. Food added
 *  since the last render sends a wave into Azi. */
let dockKcal = { d: '', k: -1 };
function dockLive() {
  if (!s.profile || !s.plan) return;
  const today = localDate();
  const t = dayFuel(today), sum = totals(dayMeals(s, today));
  const pts = weightTrend(s.weights, trendAlpha(s.plan.phase));
  const lastP = pts.at(-1), weekP = lastP ? [...pts].reverse().find((p) => p.date <= addDays(lastP.date, -7)) : undefined;
  const diff = lastP && weekP ? lastP.trend - weekP.trend : null;
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  const sl = mealSlots(today), eaten = dayMeals(s, today);
  const soon = sl.times.some((tm, i) => { const [h, m] = tm.split(':').map(Number); const d = (h ?? 0) * 60 + (m ?? 0) - mins; return !eaten[i]?.length && d <= 30 && d >= -20; });
  dock.live({ kcal: sum.kcal / (t.kcal || 1), perfect: isPerfect(sum, t), trend: diff == null ? null : diff < -0.1 ? -1 : diff > 0.1 ? 1 : 0, soon });
  if (dockKcal.d === today && sum.kcal > dockKcal.k + 1) dock.pulse('add');
  dockKcal = { d: today, k: sum.kcal };
}
addEventListener('bn:gold', () => dock.pulse('gold'));
addEventListener('bn:weigh', () => dock.pulse('weigh'));
setInterval(() => { if (!document.hidden) dockLive(); }, 60000);

/** The tilt sheen on the dock: off by default; on from Mai mult, where iOS asks for the motion permission. */
let tiltOn = false;
try { tiltOn = localStorage.getItem('bn:tilt') === '1'; } catch { /* storage blocked */ }
const onTilt = (e: DeviceOrientationEvent) => dock.tilt(e.gamma ?? 0);
function tiltStart() { addEventListener('deviceorientation', onTilt); }
function tiltStop() { removeEventListener('deviceorientation', onTilt); dock.tilt(null); }
if (tiltOn) tiltStart();
async function tiltToggle() {
  if (tiltOn) { tiltOn = false; tiltStop(); try { localStorage.setItem('bn:tilt', '0'); } catch { /* */ } render(); return; }
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  try { if (D.requestPermission && (await D.requestPermission()) !== 'granted') { toast('Fără acces la mișcare: Setări → Safari → Mișcare și orientare.'); return; } } catch { toast('Telefonul nu a dat acces la mișcare.'); return; }
  tiltOn = true; tiltStart();
  try { localStorage.setItem('bn:tilt', '1'); } catch { /* */ }
  render();
  toast('Înclină telefonul: lumina de pe bară te urmează.');
}

function render() {
  if (!s.profile || !s.plan || isEditing()) { dock.hide(); app.innerHTML = setupHtml(); setupBind(); return; }
  freshFuel();
  syncFuel();
  kitchen();
  if (tab === 'cicl' && !s.fuel.cycling) tab = 'azi';
  const views: Record<Tab, () => string> = { cicl: cycleTabHtml, cook: cookHtml, azi: todayHtml, mese: mealsTab, fuel: fuelHtml, post: fastHtml, corp: bodyHtml, plan: () => `${back('Mai mult', 'data-tab="fuel"')}${planHtml()}`, minte: mindHtml, glp1: glp1Html };
  // the light of the hour on the living pictures: cold in the morning, warm in the evening, darker at night
  const hr = new Date().getHours();
  document.documentElement.dataset.tod = hr >= 5 && hr < 10 ? 'morning' : hr >= 10 && hr < 17 ? 'day' : hr >= 17 && hr < 22 ? 'evening' : 'night';
  app.innerHTML = `<main>${views[tab]()}</main>`;
  dock.show(shown());
  dock.set(tabAt());
  dockLive();
  afterRender(app);
  mountHero(app);
  if (tab === 'azi') chapterCheck();
  if (tab === 'azi') todayBind();
  if (tab === 'corp') { bodyBind(); goalBind(); }
  fuelBind(); fastBind(); labsBind();
  ctx.fresh = false;
}

document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('button, [data-close]');
  if (!el) { if (ev.target === sheet) close(); return; }
  if (el.closest('#toast')) return;
  if (el.dataset['close'] != null) { close(); return; }
  if (el.dataset['dockTilt'] != null) { void tiltToggle(); return; }
  if (el.dataset['forceUpdate'] != null) { void forceUpdate(['branded-data']); return; }
  if (el.dataset['tab']) {
    // A tab always leads to its first screen, also from deep inside it.
    if (el.dataset['tab'] === 'fuel') { fuelHome(); if (el.dataset['sub']) fuelSub(el.dataset['sub']); }
    tab = el.dataset['tab'] as Tab; ctx.fresh = true; render(); scrollTo(0, 0);
    return;
  }
  if (photosAction(el) || cookAction(el) || cycleAction(el) || goalAction(el) || labsAction(el) || stackAction(el) || glp1Action(el) || fuelAction(el) || fastAction(el) || bodyAction(el) || planAction(el) || todayAction(el) || mineAction(el)) return;
  logAction(el);
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  logInput(t);
  cookInput(t);
  if (photosInput(t)) return;
  if (t.type === 'range' && t.nextElementSibling && !t.closest('#ci')) t.nextElementSibling.textContent = t.value;
});

document.addEventListener('change', async (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'mfp' && t.files?.length) { await importMfp([...t.files]); t.value = ''; return; }
  if (t.id !== 'imp' || !t.files?.[0]) return;
  importBackup(await t.files[0].text(), (next) => { s = next; });
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });

// An app left open overnight must not keep logging on yesterday.
const wake = () => { if (document.visibilityState === 'visible' && followToday()) render(); };
document.addEventListener('visibilitychange', wake);
addEventListener('focus', wake);

// No zoom: iOS ignores user-scalable=no, so pinch is blocked here as well.
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (ev) => ev.preventDefault(), { passive: false });
document.addEventListener('touchmove', (ev) => { if (ev.touches.length > 1) ev.preventDefault(); }, { passive: false });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  const reg = navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  // 2026-11-15: an iPhone home-screen app is resumed from memory, not launched again, so it never looked for a new
  // version (the user kept the old Carb tab). It now asks each time it comes back to the screen…
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void reg.then((r) => r.update()).catch(() => {}); });
  // …and when the new version has taken over, it reloads by itself, unless something is being typed or a sheet is open.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    const busy = !!document.getElementById('sheet')?.innerHTML || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
    if (busy) toast('Versiune nouă instalată.', () => location.reload(), 'Reîncarcă');
    else location.reload();
  });
}

followToday();
if (s.profile && s.plan) trophyInit();
render();
