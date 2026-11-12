/* Small pieces the screens share. */
import { esc, n1 } from '../app.ts';
import { CARB_LABEL, sessionStatus, STATUS_LABEL, type DayPlan, type Demand, type Session } from '../logic/training.ts';

export const cardSrc = (k: string) => `${import.meta.env.BASE_URL}cards/${k}.webp`;

export const back = (label = 'Fuel', attr = 'data-f="sub" data-v="home"') => `<button class="backbtn" ${attr}>‹ ${label}</button>`;

/** A band across the middle of a card's picture, under the screen's title: it leaves out the icon above and the English printed below. */
export const banner = (k: string, title: string, sub = '') => `<header class="banner"><img src="${cardSrc(k)}" alt="" width="580" height="480" style="object-position:50% ${k === 'nutrition' ? 24 : 42}%;view-transition-name:card-${k}"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;

/** Line icons for Fuel (24 × 24, currentColor): one per destination, so the tiles read without pictures. */
export const ICON: Record<string, string> = {
  nutrition: '<path d="M12 3c1.2 3.2 4.6 5.1 4.6 9.4A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-4.6-4.6c0-2 .9-3.3 1.9-4.4.2 1.4.9 2.3 1.9 2.6-.3-3 .4-5.6 1.8-7.6z"/><path d="M6 21h12"/>',
  carbs: '<path d="M4 20h16"/><path d="M6 16v2M10 12v6M14 9v9M18 5v13" stroke-width="2.6"/>',
  meals: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2.2 1.4-3 4-3 7 0 1.6.9 2.8 3 3"/>',
  water: '<path d="M12 3.5c3 4 6 7.1 6 10.6a6 6 0 0 1-12 0c0-3.5 3-6.6 6-10.6z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
  supp: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10 8.8l4.1 5.9"/>',
  recovery: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/><path d="M15 4h3l-3 3h3"/>',
  analytics: '<path d="M4 20h16"/><path d="M5 16l4.5-5 3.5 3 6-7"/><path d="M15 7h4v4"/>',
  advanced: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 2.8h5"/>',
  engine: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  food: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 21l-2.2-6.8L3.5 12l6.3-2.7z"/>',
  mind: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
};
export const icon = (k: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] ?? ''}</svg>`;

/** The head of a Fuel screen (2026-11-12: the photo banners left Fuel): the icon on a plate, the title, one line. */
export const head = (k: string, title: string, sub = '') => `<header class="fhead"><span class="fh-ic">${icon(k)}</span><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;

/** One destination in a list: what it is, and its state today. */
export const listRow = (attr: string, title: string, sub = '') => `<button class="row" ${attr}><span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><i class="chev" aria-hidden="true"></i></button>`;

export const LEVELS: Demand[] = ['high', 'moderate', 'low', 'rest'];
export const SHORT: Record<Demand, string> = { high: 'High', moderate: 'Mod', low: 'Low', rest: 'Rest' };
const LEVEL: Record<Demand, number> = { high: 4, moderate: 3, low: 2, rest: 1 };

/** Four rising bars: the same class reads the same without colour. */
export const lvl = (d: Demand) => `<span class="lvl ${d}" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= LEVEL[d] ? 'on' : ''}"></i>`).join('')}</span>`;
export const demandTag = (d: Demand) => `<span class="dm ${d}">${lvl(d)}${CARB_LABEL[d]}</span>`;

export const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }).replace('.', '');
export const comma = (v: number, digits = 2) => (digits === 1 ? n1(v) : v.toFixed(digits).replace('.', ','));

/** One planned session, its status, and how it went when the log knows. */
export function sessionRow(x: Session, p: DayPlan, date: string, today: string, next: Session | null, cancelled: string[]) {
  const status = sessionStatus(x, p.done, date, today, cancelled);
  const log = p.done.find((d) => d.block === x.id);
  const on = next?.id === x.id;
  const canCancel = date >= today && (status === 'planned' || status === 'cancelled');
  const detail = [`${x.min} min`, x.alt?.detail, log ? `făcut ${log.min || x.min} min${log.detail ? `, ${log.detail}` : ''}` : ''].filter(Boolean).join(', ');
  return `<li class="${status} ${on ? 'next' : ''}"><span><b>${esc(x.name)}</b><small>${esc(detail)}</small></span><em>${on ? 'Urmează' : STATUS_LABEL[status]}</em>${canCancel ? `<button class="xs" data-f="cancel" data-d="${date}" data-v="${esc(x.id)}" aria-label="${status === 'cancelled' ? 'Repune' : 'Anulează'} ${esc(x.name)}">${status === 'cancelled' ? '↺' : '×'}</button>` : ''}</li>`;
}
