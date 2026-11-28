/* The streak calendar (2026-11-28, the user: "un calendar cu zile streak sus în dreapta, dar vreau să apăs eu pe
   iconiță ca să văd calendarul"). On Azi only a small flame with the number of days in a row with food written down;
   a tap opens the month: each day logged, perfect (calories within 5 % and protein at 95 %) or missed. */
import { ctx, esc } from '../app.ts';
import { addDays } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { isPerfect } from './show.ts';
import { dayFuel } from './state.ts';

type Mark = 'perfect' | 'logged' | 'missed' | 'future' | 'today';

const logged = (d: string) => dayMeals(ctx.get(), d).some((m) => m.length > 0);
const perfect = (d: string) => isPerfect(totals(dayMeals(ctx.get(), d)), dayFuel(d));

/** Days in a row with food logged, up to today; today only adds once something is written, it never breaks it. */
export function logStreak(): number {
  let d = ctx.today();
  if (!logged(d)) d = addDays(d, -1);
  let n = 0;
  while (n < 1000 && logged(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** The longest run of logged days ever. */
function bestStreak(): number {
  const days = Object.keys(ctx.get().days).filter(logged).sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.7 3.6 6 6.4 6 12a6 6 0 0 1-12 0c0-2.5 1.1-4.2 2.6-5.5.3 1.5 1.1 2.4 2.1 2.9C10.6 9.3 11 5.8 12 2.5Z"/></svg>';

/** The button in the corner of Azi. */
export function streakButton(): string {
  const n = logStreak();
  return `<button class="stk-b${n ? ' on' : ''}" data-stk="open" aria-label="Calendarul zilelor: ${n} ${n === 1 ? 'zi' : 'zile'} la rând">${FLAME}<b>${n}</b></button>`;
}

let month = '';
const monthOf = (d: string) => d.slice(0, 7);
const shiftMonth = (m: string, k: number) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y!, mo! - 1 + k, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };

function sheet() {
  const today = ctx.today();
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days: string[] = [];
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  const mark = (d: string): Mark => d > today ? 'future' : perfect(d) ? 'perfect' : logged(d) ? 'logged' : d === today ? 'today' : 'missed';
  const marks = days.map((d) => [d, mark(d)] as const);
  const count = (k: Mark) => marks.filter(([, m]) => m === k).length;
  const title = new Date(`${first}T12:00:00`).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  const n = logStreak();
  ctx.open(`<h2>Zilele tale</h2>
    <div class="stk-sum"><div><b>${n}</b><span>${n === 1 ? 'zi' : 'zile'} la rând</span></div><div><b>${bestStreak()}</b><span>cea mai lungă serie</span></div><div><b>${count('perfect')}</b><span>perfecte luna asta</span></div></div>
    <div class="stk-nav"><button class="ib" data-stk="prev" aria-label="Luna anterioară">‹</button><b class="cap">${esc(title)}</b><button class="ib" data-stk="next" aria-label="Luna următoare" ${month >= monthOf(today) ? 'disabled' : ''}>›</button></div>
    <div class="stk-cal" role="grid" aria-label="${esc(title)}">
      ${['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map((w) => `<span class="stk-w" aria-hidden="true">${w}</span>`).join('')}
      ${'<span></span>'.repeat(lead)}
      ${marks.map(([d, m]) => `<span class="stk-d ${m}${d === today ? ' is-today' : ''}" role="gridcell" aria-label="${esc(new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }))}: ${m === 'perfect' ? 'zi perfectă' : m === 'logged' ? 'notată' : m === 'future' ? '' : 'nenotată'}">${Number(d.slice(8))}</span>`).join('')}
    </div>
    <p class="stk-leg"><span class="perfect">Perfectă</span><span class="logged">Notată</span><span class="missed">Nenotată</span></p>
    <p class="hint">Seria crește cu fiecare zi în care notezi ce mănânci. Perfectă: caloriile la ±5% din țintă și proteina la cel puțin 95%.</p>`, 'Calendarul zilelor');
}

export function streakAction(el: HTMLElement): boolean {
  const a = el.dataset['stk'];
  if (!a) return false;
  if (a === 'open') month = monthOf(ctx.today());
  if (a === 'prev') month = shiftMonth(month, -1);
  if (a === 'next') month = shiftMonth(month, 1);
  sheet();
  return true;
}
