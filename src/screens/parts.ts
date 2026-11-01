/* Small pieces the screens share. */
import { esc, n1 } from '../app.ts';
import { CARB_LABEL, sessionStatus, STATUS_LABEL, type DayPlan, type Demand, type Session } from '../logic/training.ts';

export const cardSrc = (k: string) => `${import.meta.env.BASE_URL}cards/${k}.webp`;

export const back = (label = 'Fuel', attr = 'data-f="sub" data-v="home"') => `<button class="backbtn" ${attr}>‹ ${label}</button>`;

/** A band across the middle of a card's picture, under the screen's title: it leaves out the icon above and the English printed below. */
export const banner = (k: string, title: string, sub = '') => `<header class="banner"><img src="${cardSrc(k)}" alt="" width="580" height="480" style="object-position:50% ${k === 'nutrition' ? 24 : 42}%;view-transition-name:card-${k}"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;

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
