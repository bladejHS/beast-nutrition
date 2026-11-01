/* Small pieces the Fuel screens share. */
import { esc, n0 } from '../app.ts';
import { sessionStatus, STATUS_LABEL, type DayPlan, type Demand, type Session } from '../logic/training.ts';

export const cardSrc = (k: string) => `${import.meta.env.BASE_URL}cards/${k}.webp`;

export const back = () => `<button class="backbtn" data-f="sub" data-v="home">‹ Fuel</button>`;

/** The top of a card's picture, under the screen's title. */
export const banner = (k: string, title: string, sub = '') => `<header class="banner"><img src="${cardSrc(k)}" alt="" width="580" height="808" decoding="sync" style="view-transition-name:card-${k}"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;

export const LEVELS: Demand[] = ['high', 'moderate', 'low', 'rest'];
export const SHORT: Record<Demand, string> = { high: 'High', moderate: 'Mod', low: 'Low', rest: 'Rest' };
export const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }).replace('.', '');
export const comma = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');

const lit = new Map<string, number>();

/** Ten segments; the ones lit since the last render come on one after another. */
export function segs(key: string, value: number, target: number) {
  const on = Math.min(10, Math.round((value / (target || 1)) * 10));
  const was = lit.get(key) ?? 0;
  lit.set(key, on);
  return `<div class="msegs" role="img" aria-label="${n0(value)} din ${n0(target)} g">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? 'on' : ''} ${i < on && i >= was ? 'new' : ''}" style="--i:${Math.max(0, i - was)}"></i>`).join('')}</div>`;
}

export function macroTile(name: string, key: string, target: number, eaten: number) {
  const left = Math.round(target - eaten);
  return `<div class="mc"><span>${name}</span><b data-count="${key}" data-to="${target}">${n0(target)}</b>${segs(key, eaten, target)}
    <p>${n0(eaten)} mâncat<br><em class="${left < 0 ? 'over' : ''}">${left >= 0 ? `${n0(left)} rămas` : `${n0(-left)} peste`}</em></p></div>`;
}

/** One planned session, its status, and how it went when the log knows. */
export function sessionRow(x: Session, p: DayPlan, date: string, today: string, next: Session | null, cancelled: string[]) {
  const status = sessionStatus(x, p.done, date, today, cancelled);
  const log = p.done.find((d) => d.block === x.id);
  const on = next?.id === x.id;
  const canCancel = date >= today && (status === 'planned' || status === 'cancelled');
  const detail = [`${x.min} min`, x.alt?.detail, log ? `făcut ${log.min || x.min} min${log.detail ? `, ${log.detail}` : ''}` : ''].filter(Boolean).join(' · ');
  return `<li class="${status} ${on ? 'next' : ''}"><span><b>${esc(x.name)}</b><small>${esc(detail)}</small></span><em>${on ? 'Urmează' : STATUS_LABEL[status]}</em>${canCancel ? `<button class="xs" data-f="cancel" data-d="${date}" data-v="${esc(x.id)}" aria-label="${status === 'cancelled' ? 'Repune' : 'Anulează'} ${esc(x.name)}">${status === 'cancelled' ? '↺' : '×'}</button>` : ''}</li>`;
}
