/* What the screens share: state access, helpers, and the motion applied after each render. */
import type { State } from './logic/store.ts';

export type Tab = 'azi' | 'fuel' | 'post' | 'cantar' | 'plan' | 'minte';

export const ctx = {
  get: (): State => { throw new Error('not ready'); },
  commit: () => {},
  toast: (_: string) => {},
  render: () => {},
  open: (_: string) => {},
  close: () => {},
  today: () => '',
};

export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const n0 = (v: number) => Math.round(v).toLocaleString('ro-RO');
export const dayShort = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'short' }).replace('.', '');
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const bars = new Map<string, number>();
const counts = new Map<string, number>();

/** Bars and counters move from their last value, so logging food never makes them jump. */
export function afterRender(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-bar]').forEach((el) => {
    const key = el.dataset['bar']!, to = Number(el.dataset['to']);
    const scale = el.dataset['axis'] === 'y' ? 'scaleY' : 'scaleX';
    if (calm()) { el.style.transform = `${scale}(${to})`; bars.set(key, to); return; }
    el.style.transition = 'none';
    el.style.transform = `${scale}(${bars.get(key) ?? 0})`;
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = `${scale}(${to})`;
    bars.set(key, to);
  });
  root.querySelectorAll<HTMLElement>('[data-level]').forEach((el) => {
    const key = `lvl-${el.dataset['level']}`, to = Number(el.dataset['to']);
    el.style.transition = 'none';
    el.style.transform = `translateY(${(1 - (bars.get(key) ?? 0)) * 100}%)`;
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = `translateY(${(1 - to) * 100}%)`;
    bars.set(key, to);
  });
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const key = el.dataset['count']!, to = Number(el.dataset['to']);
    const from = counts.get(key) ?? 0;
    counts.set(key, to);
    if (calm() || from === to) { el.textContent = n0(to); return; }
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 420);
      el.textContent = n0(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
