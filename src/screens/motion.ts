/* Motion (2026-11-28, the user's "Premium Animation Guidelines"): calm, quick, Apple-Health-like. Pages slide in by
   300–450 ms, cards rise once, sheets grow out of what was tapped, a tick and a tap of haptics confirm what was saved.
   Only transform and opacity move, so it holds 60 fps. Nothing loops, nothing pulses, and Reduce Motion turns all of it
   off (styles-motion.css and `still()` here). */

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

// ---- haptics --------------------------------------------------------------------------------------------------
// Android has navigator.vibrate. iOS Safari (18+) has no API, but toggling a native switch gives its own tick, so a
// hidden one is flipped.
let tick: HTMLLabelElement | null = null;
export function haptic(kind: 'light' | 'success' = 'light') {
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(kind === 'success' ? [10, 60, 16] : 8); return; }
    if (!tick) {
      const input = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'hx-switch', tabIndex: -1 });
      input.setAttribute('switch', '');
      input.setAttribute('aria-hidden', 'true');
      tick = Object.assign(document.createElement('label'), { htmlFor: 'hx-switch' });
      tick.setAttribute('aria-hidden', 'true');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:-9px';
      box.append(input, tick);
      document.body.append(box);
    }
    tick.click();
    if (kind === 'success') window.setTimeout(() => tick?.click(), 90);
  } catch { /* no haptics on this device */ }
}

// ---- pages ----------------------------------------------------------------------------------------------------
/** A tab opens: the page fades in with a short slide from the side it comes from; its cards rise one after another. */
export function pageIn(main: HTMLElement | null, dir: number) {
  if (!main || still()) return;
  main.style.setProperty('--dx', `${dir * 18}px`);
  main.classList.add('mv-page');
  stagger(main);
}

/** The same page with other content (another day, another week): a short crossfade, no slide. */
export function swapIn(main: HTMLElement | null) {
  if (!main || still()) return;
  main.classList.add('mv-swap');
}

/** The first cards of a page rise in order, 40 ms apart; the rest arrive with the last of them. */
function stagger(main: HTMLElement) {
  const cards = [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > .pm > *')].filter((el) => !el.classList.contains('pm') && !el.classList.contains('fab'));
  cards.slice(0, 12).forEach((el, i) => { el.style.setProperty('--i', String(i)); el.classList.add('mv-rise'); });
}

// ---- sheets ---------------------------------------------------------------------------------------------------
/** What was last pressed: the sheet that opens next grows out of it (a food, a recipe, a meal). */
let pressed: HTMLElement | null = null;
document.addEventListener('pointerdown', (ev) => {
  pressed = (ev.target as HTMLElement).closest<HTMLElement>('.row, .cook-row, .mealc, [data-food], [data-cook], .fab, .card, button');
}, { capture: true, passive: true });

/** The sheet's panel starts at the size and place of what was tapped, then opens to its own (shared element). */
export function sheetIn(panel: HTMLElement | null) {
  if (!panel || still()) return;
  const from = pressed?.isConnected ? pressed.getBoundingClientRect() : null;
  pressed = null;
  const to = panel.getBoundingClientRect();
  const big = !from || from.width > to.width * 0.95 || from.height < 8;
  const frames: Keyframe[] = big
    ? [{ transform: 'translateY(28px)', opacity: 0 }, { transform: 'none', opacity: 1 }]
    : [{ transform: `translate(${(from.left - to.left).toFixed(1)}px, ${(from.top - to.top).toFixed(1)}px) scale(${(from.width / to.width).toFixed(3)}, ${Math.max(0.05, from.height / to.height).toFixed(3)})`, opacity: 0.5, borderRadius: '18px' }, { transform: 'none', opacity: 1 }];
  panel.style.transformOrigin = 'top left';
  panel.animate(frames, { duration: big ? 320 : 380, easing: EASE }).finished.then(() => { panel.style.transformOrigin = ''; }, () => {});
}

// ---- success --------------------------------------------------------------------------------------------------
/** Saved, added, logged: these toasts get the drawn tick and the success haptic. */
const GOOD = /adăugat|notat|salvat|e în planul|copiate|aplicat|noua țintă/i;
export function toastDone(el: HTMLElement, msg: string) {
  el.classList.remove('mv-ok');
  if (!GOOD.test(msg)) return;
  el.insertAdjacentHTML('afterbegin', '<svg class="mv-tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/><path d="M7 12.4l3.2 3.1L17 8.8"/></svg>');
  void el.offsetWidth;
  el.classList.add('mv-ok');
  haptic('success');
}
