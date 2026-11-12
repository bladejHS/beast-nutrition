/* What the screens share: state access, number formats, and the one motion applied after each render. */
import type { State } from './logic/store.ts';

export type Tab = 'azi' | 'fuel' | 'corp' | 'plan' | 'post' | 'minte';

export const ctx = {
  get: (): State => { throw new Error('not ready'); },
  commit: () => {},
  /** With an action, the toast stays longer and offers it: by default, to take back what was just done. */
  toast: (_: string, _undo?: () => void, _label?: string) => {},
  render: () => {},
  open: (_: string, _label?: string) => {},
  close: () => {},
  today: () => '',
  go: (_: Tab) => {},
  /** True on the first render after a tab or day change: the screen plays its entrance once, never on a redraw. */
  fresh: true,
};

export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const n0 = (v: number) => Math.round(v).toLocaleString('ro-RO');
export const n1 = (v: number) => v.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Value and unit never split across lines. */
export const nb = (v: string | number, unit: string) => `${v}&nbsp;${unit}`;
/** Reads what a person typed: Romanian phones offer a comma, other keyboards a dot. NaN when it is not a number. */
export const parseNum = (v: unknown) => {
  const t = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
};
export const dayShort = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'short' }).replace('.', '');
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
export const dayLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });

const bars = new Map<string, number>();
const counts = new Map<string, number>();

/** A number that runs from its last value to the new one (data-count, data-to; data-fmt="1" keeps one decimal). */
function countUp(el: HTMLElement, calm: boolean) {
  const key = el.dataset['count']!, to = Number(el.dataset['to']), dec = el.dataset['fmt'] === '1';
  const from = ctx.fresh ? 0 : counts.get(key) ?? to;
  counts.set(key, to);
  const show = (v: number) => { el.textContent = dec ? n1(v) : n0(v); };
  if (calm || from === to) { show(to); return; }
  const t0 = performance.now(), dur = 700;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    show(from + (to - from) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** A bar moves from its last value, so logging food shows what changed. Nothing else animates on a render. */
export function afterRender(root: HTMLElement) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => countUp(el, calm));
  // rings: a circle with pathLength 100, drawn from its last value (data-ring, data-to 0–1)
  root.querySelectorAll<SVGCircleElement>('[data-ring]').forEach((el) => {
    const key = `ring:${el.dataset['ring']!}`, to = Number(el.dataset['to']);
    const from = ctx.fresh ? 0 : bars.get(key) ?? to;
    bars.set(key, to);
    const off = (v: number) => `${(100 - v * 100).toFixed(2)}`;
    if (calm || from === to) { el.style.strokeDashoffset = off(to); return; }
    el.style.transition = 'none';
    el.style.strokeDashoffset = off(from);
    void el.getBoundingClientRect();
    el.style.transition = '';
    el.style.strokeDashoffset = off(to);
  });
  root.querySelectorAll<HTMLElement>('[data-bar]').forEach((el) => {
    const key = el.dataset['bar']!, to = Number(el.dataset['to']);
    const scale = el.dataset['axis'] === 'y' ? 'scaleY' : 'scaleX';
    const from = ctx.fresh ? 0 : bars.get(key);
    bars.set(key, to);
    if (calm || from == null || from === to) { el.style.transform = `${scale}(${to})`; return; }
    el.style.transition = 'none';
    el.style.transform = `${scale}(${from})`;
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = `${scale}(${to})`;
  });
}
