import './styles.css';
import { afterRender, ctx, type Tab } from './app.ts';
import { load, save, type State } from './logic/store.ts';
import { bodyAction, bodyBind, bodyHtml } from './screens/body.ts';
import { fastAction, fastBind, fastHtml } from './screens/fast.ts';
import { fuelAction, fuelBind, fuelHome, fuelSub, fuelHtml, mealsTab } from './screens/fuel.ts';
import { glp1Action, glp1Html } from './screens/glp1.ts';
import { back } from './screens/parts.ts';
import { logAction, logInput } from './screens/log.ts';
import { mineAction } from './screens/mine.ts';
import { importBackup, importMfp, isEditing, mindHtml, planAction, planHtml, setupBind, setupHtml } from './screens/plan.ts';
import { freshFuel, kitchen, syncFuel } from './screens/state.ts';
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
  azi: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  mese: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2.2 1.4-3 4-3 7 0 1.6.9 2.8 3 3"/>',
  corp: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9.500a5.500 5.500 0 0 1 8 0l-2.500 2h-3Z"/>',
  fuel: '<path d="M12 3c.6 3.2 5.5 5.9 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.3-5 .3 1.3 1 2.2 1.900 2.600C10.400 9 10.800 6 12 3Z"/>',
};
type Main = keyof typeof ICONS;
// 2026-11-12, fewer places: Azi, the meal plan, the body, and everything else under "Mai mult" (Fuel's tools and the plan)
const TAB_NAME: Record<Main, string> = { azi: 'Azi', mese: 'Mese', corp: 'Corp', fuel: 'Mai mult' };
const home = (t: Tab): Main => (t === 'post' || t === 'minte' || t === 'plan' || t === 'glp1' ? 'fuel' : t);

function render() {
  if (!s.profile || !s.plan || isEditing()) { app.innerHTML = setupHtml(); setupBind(); return; }
  freshFuel();
  syncFuel();
  kitchen();
  const views: Record<Tab, () => string> = { azi: todayHtml, mese: mealsTab, fuel: fuelHtml, post: fastHtml, corp: bodyHtml, plan: () => `${back('Mai mult', 'data-tab="fuel"')}${planHtml()}`, minte: mindHtml, glp1: glp1Html };
  app.innerHTML = `<main>${views[tab]()}</main>
    <nav class="tabs" aria-label="Navigare" style="--i:${(Object.keys(ICONS) as Main[]).indexOf(home(tab))}"><i class="tabs-plate" aria-hidden="true"></i><i class="tabs-blade" aria-hidden="true"></i>${(Object.keys(ICONS) as Main[]).map((t) =>
      `<button data-tab="${t}" class="${home(tab) === t ? 'on' : ''}" ${home(tab) === t ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t]}</svg>${TAB_NAME[t]}</button>`).join('')}</nav>`;
  afterRender(app);
  if (tab === 'azi') todayBind();
  if (tab === 'corp') bodyBind();
  fuelBind(); fastBind();
  ctx.fresh = false;
}

document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('button, [data-close]');
  if (!el) { if (ev.target === sheet) close(); return; }
  if (el.closest('#toast')) return;
  if (el.dataset['close'] != null) { close(); return; }
  if (el.dataset['tab']) {
    // A tab always leads to its first screen, also from deep inside it.
    if (el.dataset['tab'] === 'fuel') { fuelHome(); if (el.dataset['sub']) fuelSub(el.dataset['sub']); }
    tab = el.dataset['tab'] as Tab; ctx.fresh = true; render(); scrollTo(0, 0);
    return;
  }
  if (glp1Action(el) || fuelAction(el) || fastAction(el) || bodyAction(el) || planAction(el) || todayAction(el) || mineAction(el)) return;
  logAction(el);
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  logInput(t);
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
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  // A new version took over while the app is open: it says so instead of waiting for a second launch.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Versiune nouă instalată.', () => location.reload(), 'Reîncarcă'); });
}

followToday();
render();
