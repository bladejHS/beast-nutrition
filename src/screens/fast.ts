import { ctx, esc, hm, nowMinutes } from '../app.ts';
import { back, head } from './parts.ts';
import { weekday } from '../logic/calc.ts';
import {
  activate, adherence, advice, assessmentDue, currentRatio, dayInPhase, daysLeft, decide, FIXED, fastHours, pause, PHASES, phaseLength,
  PROGRAM_DAYS, programPct, resume, status, windowFor, type Decision, type Fixed, type Ratings,
} from '../logic/fasting.ts';
import { mealSlots, timingFor, trainingTime } from './state.ts';

const DAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
/** The phases keep their names in the saved program; on screen they are Romanian. */
const PHASE_NAME: Record<string, string> = { FOUNDATION: 'Fundație', ADAPTATION: 'Adaptare', CONSISTENCY: 'Consecvență' };
const phaseName = (name: string) => PHASE_NAME[name] ?? name;
const QUESTIONS: [keyof Ratings, string][] = [['energy', 'Energie'], ['hunger', 'Foame (10 = deloc)'], ['sleep', 'Somn'], ['training', 'Antrenamente'], ['wellbeing', 'Stare generală'], ['nutrition', 'Calorii și proteine atinse']];

export function fastChip(date: string): string {
  const s = ctx.get();
  const w = windowFor(s.fast, weekday(date));
  if (!w) return '';
  if (date !== ctx.today()) return `<p class="chip-fast">Fereastră ${w.start}–${w.end}</p>`;
  const st = status(w, nowMinutes());
  return `<p class="chip-fast ${st.eating ? 'eat' : ''}">${st.eating ? `Fereastră deschisă, încă ${hm(st.minutesLeft)}` : `Post ${w.ratio}, mai sunt ${hm(st.minutesLeft)}`}</p>`;
}

function science() {
  return `<section class="card note"><h2>Ce știm și ce nu știm</h2>
    <p>12:12, 14:10 și 16:8 au fost studiate fiecare separat. Progresia de 8 săptămâni e o strategie practică de aderență, nu un tratament metabolic dovedit superior.</p>
    <p>Un post mai lung nu e automat mai bun. Prioritare rămân caloriile, proteina, hidratarea și recuperarea. Cel mai bun program e cel pe care îl poți ține fără să-ți afecteze starea sau performanța.</p>
    <p class="hint">În sarcină, la tulburări alimentare, diabet sau tratamente, discută cu medicul înainte. Această secțiune nu vine din <i>Fat Loss Forever</i>.</p></section>`;
}

/** Training has to fit the window, and so does the meal after it. */
function trainingClash() {
  const s = ctx.get();
  const today = ctx.today();
  const w = windowFor(s.fast, weekday(today));
  if (!w) return '';
  const sl = mealSlots(today);
  if (sl.demand === 'rest' || sl.demand === 'low') return '';
  const start = trainingTime(today);
  const [h = 0, m = 0] = start.split(':').map(Number);
  const open = status(w, h * 60 + m).eating;
  if (open && !sl.outside) return '';
  const t = timingFor(today);
  return `<p class="warn">${open ? `Antrenamentul de azi se termină la ${t.end}, iar fereastra se închide la ${esc(w.end)}, așa că masa de după pică în afara ei.` : `Antrenamentul de azi, de la ${esc(start)}, cade în afara ferestrei.`} Mută fereastra pe această zi: mâncarea de care ai nevoie e mai importantă decât timerul.</p>`;
}

function windowCard() {
  const s = ctx.get();
  const w = windowFor(s.fast, weekday(ctx.today()));
  const st = w ? status(w, nowMinutes()) : null;
  return `<section class="card">
    ${w && st ? `<div class="clock ${st.eating ? 'eat' : ''}"><span>${st.eating ? 'Fereastră deschisă' : 'În post'}</span><b id="fast-left">${hm(st.minutesLeft)}</b><small>Azi ${w.start}–${w.end}, ${w.ratio}</small></div>` : ''}
    ${trainingClash()}
    <label class="field">Începutul ferestrei de mâncat<input id="eat-start" type="time" value="${s.fast.eatStart}"></label>
    <h3>Program diferit pe zile</h3>
    <div class="dayset">${DAYS.map((d, i) => `<label>${d}<input type="time" data-daystart="${i}" value="${s.fast.dayStart[i] ?? ''}"></label>`).join('')}</div>
    <p class="hint">Lasă gol pentru ora de mai sus. Folosește asta pentru zilele cu antrenament.</p>
  </section>`;
}

function adherenceCard() {
  const s = ctx.get();
  const today = ctx.today();
  const a = adherence(s.fast, today, 14);
  const v = s.fast.log[today];
  return `<section class="card"><h2>Aderență</h2><p class="hint">Ultimele 14 zile: ${a.kept} din ${a.known} zile notate respectate.</p>
    <div class="seg"><button data-fast="log" data-v="1" class="${v === true ? 'on' : ''}">Am respectat azi</button><button data-fast="log" data-v="0" class="${v === false ? 'on' : ''}">Nu azi</button></div></section>`;
}

function timeline(phase: number) {
  return `<ol class="tl">${PHASES.map((p, i) => `<li class="${i < phase ? 'past' : i === phase ? 'now' : ''}"><span>Faza ${i + 1}</span><b>${phaseName(p.name)}</b><em>${p.ratio}</em><small>${i === 0 ? 'Zilele 1–7' : i === 1 ? 'Zilele 8–14' : 'Săpt. 3–8, opțional'}</small></li>`).join('')}</ol>`;
}

function progDash() {
  const s = ctx.get();
  const p = s.fast.prog!;
  const today = ctx.today();
  const ph = PHASES[p.phase]!;
  const next = PHASES[p.phase + 1];
  const due = assessmentDue(p, today);
  const done = Math.min(dayInPhase(p, today) - 1, phaseLength(p));
  const last = p.assessments.at(-1);
  return `<section class="card prog"><p class="hint">Post progresiv, 8 săptămâni</p>
    <h2>Faza ${p.phase + 1}, ${phaseName(ph.name)}</h2>
    <div class="stats three"><div><b>${ph.ratio}</b><span>raport actual</span></div><div><b>${done}</b><span>zile făcute</span></div><div><b>${daysLeft(p, today)}</b><span>zile planificate rămase</span></div></div>
    ${timeline(p.phase)}
    <div class="track big"><div data-bar="prog8" data-to="${programPct(p, today) / 100}"></div></div>
    <p class="hint">${Math.round(programPct(p, today) * PROGRAM_DAYS / 100)} din ${PROGRAM_DAYS} zile. ${esc(ph.focus)}</p>
    <p class="coach">${p.pausedSince ? 'Program pus pe pauză. Nu se aplică nicio fereastră.' : p.stay ? `Ai ales să rămâi pe ${ph.ratio}. E perfect în regulă, oricât de mult.` : next ? `Urmează, doar dacă alegi: ${phaseName(next.name)}, ${next.ratio}. ${next.focus}` : 'Aceasta e ultima fază.'}</p>
    ${last ? `<p class="hint">Ultima evaluare: ${esc(last.date)}.</p>` : ''}
  </section>
  ${due ? assessment(p.phase) : '<button class="ghost wide" data-fast="assess">Fă evaluarea acum</button>'}
  ${windowCard()}${adherenceCard()}
  <section class="card"><h2>Controlul programului</h2><div class="btns">
    ${p.pausedSince ? '<button class="ghost" data-fast="resume">Reia</button>' : '<button class="ghost" data-fast="pause">Pauză</button>'}
    <button class="ghost" data-fast="do" data-v="repeat">Reia faza</button>
    <button class="ghost" data-fast="do" data-v="extend">Prelungește 7 zile</button>
    ${next ? '<button class="ghost" data-fast="do" data-v="skip">Sari faza</button>' : ''}
    ${p.phase ? '<button class="ghost" data-fast="do" data-v="back">Faza anterioară</button>' : ''}
    <button class="ghost" data-fast="do" data-v="stay">Rămân pe ${ph.ratio}</button>
    <button class="ghost danger" data-fast="stop">Oprește programul</button></div></section>`;
}

function assessment(phase: number) {
  const next = PHASES[phase + 1];
  return `<section class="card review" id="assess"><h2>Evaluare</h2><p>Programul nu avansează singur. Cum te-ai simțit în această fază? (10 = cel mai bine)</p>
    <form id="af">${QUESTIONS.map(([k, l]) => `<label class="range"><span>${l}</span><input type="range" name="${k}" min="1" max="10" value="7"><output>7</output></label>`).join('')}
    <label class="check"><input type="checkbox" name="dizzy"> Am avut amețeli sau oboseală persistentă</label>
    <p id="adv" class="coach"></p>
    <div class="btns">${next ? `<button name="a" value="advance" class="primary">Avansez la ${next.ratio}</button>` : ''}<button name="a" value="repeat" class="ghost">Repet faza</button><button name="a" value="${phase ? 'back' : 'stop'}" class="ghost">${phase ? 'Revin la faza anterioară' : 'Opresc programul'}</button></div></form></section>`;
}

function chooser() {
  const s = ctx.get();
  const cur = s.fast.active;
  return `${FIXED.map((p) => `<button class="card pick ${cur?.type === 'fixed' && cur.protocol === p ? 'sel' : ''}" data-fast="fixed" data-v="${p}"><b>${p}</b><span>${fastHours(p)} ore post, ${24 - fastHours(p)} ore fereastră</span></button>`).join('')}
  <button class="card pick" data-fast="prog"><b>Progresiv</b><span>8 săptămâni ghidate, de la 12:12 spre 14:10 și, dacă te simți bine, 16:8.</span></button>
  ${cur ? `<button class="ghost wide danger" data-fast="off">Oprește postul</button>` : ''}
  ${cur ? windowCard() + adherenceCard() : ''}
  ${s.fast.history.length ? `<section class="card"><h2>Istoric</h2>${[...s.fast.history].reverse().slice(0, 8).map((h) => `<div class="line"><span>${esc(h.from)} → ${esc(h.to)}</span><b>${esc(h.label)}</b></div>`).join('')}</section>` : ''}`;
}

let view: 'dash' | 'pick' = 'dash';

export function fastHtml() {
  const s = ctx.get();
  const onProg = s.fast.active?.type === 'prog' && view === 'dash';
  return `${back('Mai mult', 'data-tab="fuel"')}${head('advanced', 'Post', 'Un singur program activ. Istoricul rămâne salvat când schimbi.')}${onProg ? `${progDash()}<button class="ghost wide" data-fast="pick">Alte protocoale</button>` : chooser()}${science()}`;
}

function switchTo(next: Parameters<typeof activate>[1]) {
  const s = ctx.get();
  const before = s.fast;
  s.fast = activate(s.fast, next, ctx.today());
  view = 'dash';
  ctx.commit(); ctx.render();
  if (before.active) ctx.toast('Programul s-a schimbat. Istoricul rămâne.', () => { s.fast = before; ctx.commit(); ctx.render(); });
}

export function fastAction(el: HTMLElement): boolean {
  const a = el.dataset['fast'];
  if (!a) return false;
  if (el.tagName === 'BUTTON' && (el as HTMLButtonElement).form) return false;
  const s = ctx.get();
  const today = ctx.today();
  const v = el.dataset['v'] ?? '';
  if (a === 'fixed') switchTo({ type: 'fixed', protocol: v as Fixed, since: today });
  if (a === 'prog') { if (s.fast.active?.type === 'prog') { view = 'dash'; ctx.render(); } else switchTo({ type: 'prog' }); }
  if (a === 'off' || a === 'stop') {
    const before = s.fast;
    s.fast = activate(s.fast, null, today);
    if (a === 'stop') s.fast.prog = null;
    view = 'dash';
    ctx.toast('Post oprit. Istoricul rămâne.', () => { s.fast = before; ctx.commit(); ctx.render(); });
  }
  if (a === 'pick') view = 'pick';
  if (a === 'log') s.fast.log[today] = v === '1';
  if (a === 'pause') s.fast.prog = pause(s.fast.prog!, today);
  if (a === 'resume') s.fast.prog = resume(s.fast.prog!, today);
  if (a === 'do') s.fast.prog = decide(s.fast.prog!, v as Decision, today);
  if (a === 'assess') {
    ctx.open(assessment(s.fast.prog!.phase));
    bindAssess();
    return true;
  }
  if (currentRatio(s.fast)) s.fast.ratioLog[today] = currentRatio(s.fast)!;
  ctx.commit(); ctx.render();
  return true;
}

function bindAssess() {
  const form = document.querySelector<HTMLFormElement>('#af');
  if (!form) return;
  const read = () => {
    const d = new FormData(form);
    const r = Object.fromEntries(QUESTIONS.map(([k]) => [k, Number(d.get(k))])) as unknown as Ratings;
    return { r, dizzy: d.get('dizzy') === 'on' };
  };
  const paint = () => {
    const { r, dizzy } = read();
    const out = advice(r, dizzy);
    const box = form.querySelector<HTMLElement>('#adv')!;
    box.textContent = out.text;
    box.classList.toggle('warn', out.level === 'reduce');
  };
  form.addEventListener('input', paint);
  paint();
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = ctx.get();
    const { r, dizzy } = read();
    const action = (ev.submitter as HTMLButtonElement).value as Decision;
    const today = ctx.today();
    if (action === 'stop') { s.fast = activate({ ...s.fast, prog: decide(s.fast.prog!, 'stop', today, r, dizzy) }, null, today); s.fast.prog = null; }
    else s.fast.prog = decide(s.fast.prog!, action, today, r, dizzy);
    ctx.close(); ctx.commit(); ctx.render();
  });
}

let ticker = 0;

export function fastBind() {
  bindAssess();
  const s = ctx.get();
  const start = document.querySelector<HTMLInputElement>('#eat-start');
  start?.addEventListener('change', () => { s.fast.eatStart = start.value || '10:00'; ctx.commit(); ctx.render(); });
  document.querySelectorAll<HTMLInputElement>('[data-daystart]').forEach((i) => i.addEventListener('change', () => {
    const k = Number(i.dataset['daystart']);
    if (i.value) s.fast.dayStart[k] = i.value; else delete s.fast.dayStart[k];
    ctx.commit(); ctx.render();
  }));
  clearInterval(ticker);
  if (document.querySelector('#fast-left')) {
    // Text only, computed from the clock, so it stays right after the phone sleeps.
    ticker = window.setInterval(() => {
      const el = document.querySelector('#fast-left');
      const w = windowFor(s.fast, weekday(ctx.today()));
      if (el && w && !document.hidden) el.textContent = hm(status(w, nowMinutes()).minutesLeft);
    }, 30000);
  }
}
