/* Carb Cycling: the week, timing, patterns and rules. Today's numbers live on Azi. */
import { ctx, esc, n0 } from '../app.ts';
import { CARB_LABEL, DEMAND_LABEL, type DayPlan, type Demand } from '../logic/training.ts';
import { configView, insightsView, timingView } from './carbmore.ts';
import { dayDetail, weekView } from './carbweek.ts';
import { back, banner } from './parts.ts';

export type View = 'week' | 'timing' | 'insights' | 'config';
const TABS: [View, string][] = [['week', 'Săptămâna'], ['timing', 'Timing'], ['insights', 'Tipare'], ['config', 'Reguli']];

/** Where the user is inside Carb Cycling. */
export const cv = { view: 'week' as View, detail: '', week: 0, pick: '', tday: '', fromToday: false };

export function openCarbs(view: View) { cv.view = view; cv.detail = ''; cv.fromToday = false; }

/** How the day came to be what it is: training, then its load, then the class, then the numbers. */
export function flow(p: DayPlan, demand: Demand, kcal: number, c: number) {
  const names = p.planned.filter((x) => x.min > 0).map((x) => x.name);
  const work = names.length ? `${names[0]}${names.length > 1 ? ` și încă ${names.length - 1}` : ''}` : 'Odihnă';
  const [level = ''] = DEMAND_LABEL[demand].split(' ');
  return `<ol class="flow" aria-label="De la antrenament la ținte"><li><span>Antrenament</span><b>${esc(work)}</b></li><li><span>Cerere</span><b>${level}${p.rating.load ? `, ${p.rating.load}` : ''}</b></li><li><span>Clasă</span><b>${CARB_LABEL[demand]}</b></li><li><span>Ținte</span><b>${n0(kcal)} kcal, ${c} g</b></li></ol>`;
}

export function carbsHtml() {
  if (cv.detail) return dayDetail(cv.detail);
  const s = ctx.get();
  const views: Record<View, () => string> = { week: weekView, timing: timingView, insights: insightsView, config: configView };
  const top = cv.view === 'config' ? banner('engine', 'Reguli', 'Cum devine antrenamentul țintă de carbohidrați.') : banner('carbs', 'Carb Cycling', 'Carbohidrații urmează antrenamentele, totalul săptămânii rămâne.');
  return `${back()}${top}<nav class="cnav" aria-label="Carb Cycling">${TABS.map(([k, l]) => `<button data-f="cv" data-v="${k}" class="${cv.view === k ? 'on' : ''}" ${cv.view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>
  ${s.fuel.cycling ? '' : `<section class="card"><label class="switch"><input type="checkbox" id="cyc"><i></i><span>Folosește distribuția în ținta zilnică</span></label><p class="hint">Oprit: ținta zilnică rămâne cea din plan, cifrele de aici arată cum ar fi.</p></section>`}
  ${views[cv.view]()}`;
}
