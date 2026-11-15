/* Show pieces (2026-11-16, the user: "adaugă tot"): the perfect day, the weighing as a reveal, a trophy every 5 kg
   with a poster, the body's transformation, and a title card when the diet enters a new chapter (deficit, diet
   break, maintenance, reverse). Decoration over facts the app already has; with reduced motion the entrances are
   short and the sound stays off. Nothing here changes a number of the plan. */
import { ctx, esc, n0, n1 } from '../app.ts';
import { isBreakWeek, type DayTarget } from '../logic/calc.ts';
import { addDays } from '../logic/review.ts';
import { dayMeals, totals } from '../logic/store.ts';
import { trendAlpha, weightTrend } from '../logic/trend.ts';
import { savePoster, type PosterData } from './poster.ts';
import { dayFuel } from './state.ts';

const BASE = import.meta.env.BASE_URL;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const kg1 = (v: number) => n1(v).replace(/,0$/, '');

function store(key: string): string { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } }
function keep(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }

/* ---------- sound: a drum roll and a hit, made on the spot ---------- */

let ac: AudioContext | null = null;
/** Must run inside the tap (iOS opens audio only there). */
export function audioOn() {
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ac.resume();
  } catch { ac = null; }
}
function hit(at: number, gain: number, freq = 0) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const len = 0.12;
  const buf = ac.createBuffer(1, Math.round(ac.sampleRate * len), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = gain;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
  if (freq) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq / 2.5, t + 0.5);
    og.gain.setValueAtTime(gain * 0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(og).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.65);
  }
}
function drumRoll(sec: number) {
  if (!ac) return;
  let t = 0, gap = 0.11;
  while (t < sec) { hit(t, 0.06 + (t / sec) * 0.18); t += gap; gap = Math.max(0.035, gap * 0.93); }
  hit(sec, 0.5, 150);
}
function chime() {
  if (!ac) return;
  [0, 0.12, 0.24].forEach((at, i) => {
    const o = ac!.createOscillator(), g = ac!.createGain(), t = ac!.currentTime + at;
    o.type = 'triangle';
    o.frequency.value = [784, 988, 1319][i]!;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(ac!.destination);
    o.start(t);
    o.stop(t + 1);
  });
}

/* ---------- the ceremony overlay ---------- */

function sparks(c: HTMLCanvasElement, host: HTMLElement, gold: boolean) {
  const x = c.getContext('2d');
  if (!x) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = (c.width = Math.round(innerWidth * dpr)), H = (c.height = Math.round(innerHeight * dpr));
  const COL = gold ? ['#f5d690', '#dcb35e', '#fff3d6', '#2f8cff', '#ffffff'] : ['#2f8cff', '#6cc0ff', '#ffffff', '#f5d690', '#0b6fd6'];
  const ps = Array.from({ length: 130 }, () => {
    const a = Math.random() * Math.PI * 2, v = (220 + Math.random() * 760) * dpr;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260 * dpr, r: (1 + Math.random() * 2.6) * dpr, c: COL[Math.floor(Math.random() * COL.length)]!, life: 0.7 + Math.random() * 0.9 };
  });
  const G = 900 * dpr, cx = W / 2, cy = H * 0.36;
  let t0 = 0;
  const draw = (t: number) => {
    if (!t0) t0 = t;
    const s = (t - t0) / 1000;
    x.clearRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter';
    let alive = 0;
    for (const p of ps) {
      const k = s / p.life;
      if (k >= 1) continue;
      alive++;
      const d = (1 - Math.exp(-3 * s)) / 3;
      x.globalAlpha = 1 - k * k;
      x.fillStyle = p.c;
      x.beginPath();
      x.arc(cx + p.vx * d, cy + p.vy * d + 0.5 * G * s * s, p.r * (1 - k * 0.6), 0, 6.283);
      x.fill();
    }
    if (alive && host.isConnected) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

export function ceremony(o: { kicker: string; title: string; word: string; mark: string; gold?: boolean; poster?: PosterData; ms?: number }) {
  const el = document.createElement('div');
  el.className = `bn-cel${o.gold ? ' gold' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<canvas class="bn-cel-fx" aria-hidden="true"></canvas><i class="bn-cel-rays" aria-hidden="true"></i>
    <div class="bn-cel-core"><div class="bn-cel-mark" aria-hidden="true">${o.mark}</div>
      <p class="bn-cel-k">${esc(o.kicker)}</p><h2 class="bn-cel-t">${esc(o.title)}</h2><p class="bn-cel-w">${esc(o.word)}</p>
      ${o.poster ? '<button class="primary bn-cel-p" data-cel-poster>Salvează posterul</button>' : ''}</div>
    <p class="bn-cel-tap">Atinge ca să închizi</p>`;
  document.body.appendChild(el);
  let timer = 0;
  const close = () => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    clearTimeout(timer);
    window.setTimeout(() => el.remove(), 480);
    // the dock turns gold for a while (main.ts)
    dispatchEvent(new Event('bn:gold'));
  };
  el.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-cel-poster]');
    if (!b) { close(); return; }
    clearTimeout(timer);
    b.disabled = true;
    b.textContent = 'Pregătesc posterul…';
    void savePoster(o.poster!).finally(() => { b.disabled = false; b.textContent = 'Salvează posterul'; });
  });
  timer = window.setTimeout(close, o.ms ?? (o.poster ? 12000 : 5200));
  chime();
  if (!calm()) window.setTimeout(() => sparks(el.querySelector('canvas')!, el, !!o.gold), 420);
}

/* ---------- the perfect day ---------- */

/** Calories within 5 % of the day's target and protein at 95 % of it or more. */
export const isPerfect = (sum: { kcal: number; p: number }, t: Pick<DayTarget, 'kcal' | 'p'>) => sum.kcal > 0 && Math.abs(sum.kcal - t.kcal) <= t.kcal * 0.05 && sum.p >= t.p * 0.95;

/** Perfect days in a row, up to today (today counts only once it is perfect). */
export function perfectStreak(): number {
  const s = ctx.get();
  let d = ctx.today();
  if (!isPerfect(totals(dayMeals(s, d)), dayFuel(d))) d = addDays(d, -1);
  let n = 0;
  while (n < 400 && isPerfect(totals(dayMeals(s, d)), dayFuel(d))) { n++; d = addDays(d, -1); }
  return n;
}

const PLATE = `<svg viewBox="0 0 120 120" class="bn-plate"><circle cx="60" cy="60" r="50" class="pl-o"/><circle cx="60" cy="60" r="36" class="pl-i"/><path d="M42 61l12 12 25-27" class="pl-ck"/></svg>`;

/** Called with the day's numbers on each render of Azi: the first time today becomes perfect, the stamp. */
export function perfectCheck(d: string, sum: { kcal: number; p: number }, t: DayTarget) {
  if (d !== ctx.today() || !isPerfect(sum, t) || store('bn:perfect') === d) return;
  keep('bn:perfect', d);
  window.setTimeout(() => {
    const n = perfectStreak();
    ceremony({ kicker: n > 1 ? `${n} zile perfecte la rând` : 'Ziua e închisă', title: 'Macro perfect', word: `${n0(sum.kcal)} din ${n0(t.kcal)} kcal, proteinele atinse. Exact cum cere planul.`, mark: PLATE });
  }, 700);
}

/* ---------- the trophies: every 5 kg off the start ---------- */

/** Where the kilos are counted from: the first weighing in the app. */
export function startKg(): number | null {
  const s = ctx.get();
  const first = Object.keys(s.weights).sort()[0];
  return first ? s.weights[first]! : null;
}
export const trendNow = () => {
  const s = ctx.get();
  return weightTrend(s.weights, trendAlpha(s.plan!.phase)).at(-1)?.trend ?? null;
};
/** Kilos off the start, by the trend (the scale's water does not hand out trophies). */
export function lostKg(): number {
  const a = startKg(), b = trendNow();
  return a != null && b != null ? Math.max(0, a - b) : 0;
}

export const TROPHY = (label: string, cls = '') => `<svg viewBox="0 0 100 110" class="bn-tr ${cls}"><path class="tr-c" d="M24 10h52v22c0 17-11 30-26 30S24 49 24 32Z"/><path class="tr-h" d="M24 18H10c0 14 6 22 16 23M76 18h14c0 14-6 22-16 23"/><path class="tr-s" d="M44 62h12v14H44z"/><path class="tr-b" d="M30 78h40l4 14H26Z"/><text x="50" y="40">${label}</text></svg>`;

/** The shelf on Azi: the trophies won and the next one filling up, up to the goal. */
export function trophyShelf(): string {
  const s = ctx.get();
  const start = startKg();
  if (start == null) return '';
  const lost = lostKg();
  const toGoal = s.goal ? Math.max(5, start - s.goal.kg) : 30;
  const n = Math.min(10, Math.max(1, Math.ceil(toGoal / 5)));
  const won = Math.floor(lost / 5);
  const items = Array.from({ length: n }, (_, i) => {
    const k = (i + 1) * 5;
    const f = i < won ? 1 : i === won ? (lost - won * 5) / 5 : 0;
    return `<li class="${i < won ? 'won' : i === won ? 'next' : ''}" style="--f:${f.toFixed(3)}">${TROPHY(`-${k}`)}<span>${i < won ? 'Câștigat' : i === won ? `${kg1(Math.max(0, k - lost))} kg` : `-${k} kg`}</span></li>`;
  }).join('');
  return `<section class="shelf" aria-label="Trofee: ${won} din ${n}"><div class="shelf-h"><b>Trofee</b><span>${kg1(lost)} kg de la start · unul la fiecare 5 kg</span></div><ol>${items}</ol></section>`;
}

function trophyPoster(k: number): PosterData {
  const start = startKg()!, now = trendNow()!;
  return { kicker: 'Trofeu', title: `-${k} kg`, by: 'Prin disciplină', name: 'Beast Nutrition', stats: [{ v: kg1(start), label: 'Start', unit: 'kg' }, { v: kg1(now), label: 'Acum', unit: 'kg' }, { v: kg1(start - now), label: 'Pierdute', unit: 'kg' }], date: new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) };
}

/** After a weighing: a ceremony for each trophy the trend has just passed. The first run only records them. */
export function trophyCheck(delay: number) {
  const won = Math.floor(lostKg() / 5);
  const had = store('bn:trophies');
  keep('bn:trophies', String(won));
  if (had === '' || won <= Number(had)) return;
  const k = won * 5;
  window.setTimeout(() => ceremony({ kicker: 'Trofeu nou', title: `-${k} kg`, word: `${k} kilograme jos de la prima cântărire. Următorul la -${k + 5}.`, mark: TROPHY(`-${k}`, 'big'), gold: true, poster: trophyPoster(k) }), delay);
}

/** Records the trophies already won, so updating the app does not hand them out again. */
export function trophyInit() { if (store('bn:trophies') === '' && startKg() != null) keep('bn:trophies', String(Math.floor(lostKg() / 5))); }

/* ---------- the weighing as a reveal ---------- */

/** After "Salvează" on the weighing: a drum roll, the number lands, then what it means. */
export function weighReveal(kg: number, beforeTrend: number | null) {
  const s = ctx.get();
  const start = startKg();
  const points = weightTrend(s.weights, trendAlpha(s.plan!.phase));
  const now = points.at(-1)?.trend ?? kg;
  const weekAgo = points.filter((p) => p.date <= addDays(ctx.today(), -7)).at(-1)?.trend ?? null;
  const week = weekAgo != null ? now - weekAgo : beforeTrend != null ? now - beforeTrend : null;
  const lost = start != null ? Math.max(0, start - now) : 0;
  const down = week != null && week < -0.05;
  const el = document.createElement('div');
  el.className = 'weigh';
  el.setAttribute('role', 'status');
  el.innerHTML = `<i class="weigh-glow" aria-hidden="true"></i>
    <div class="weigh-core"><p class="weigh-k">Cântărirea de azi</p>
      <b class="weigh-n"><span id="wn">${calm() ? kg1(kg) : '000,0'}</span><small>kg</small></b>
      <div class="weigh-l">
        ${lost > 0.05 ? `<p class="weigh-a"><b>−<span id="wl">${kg1(lost)}</span> kg</b> de la start</p>` : ''}
        ${week != null ? `<p class="weigh-w ${down ? 'down' : 'up'}"><i aria-hidden="true">${down ? '▼' : '▲'}</i>${down ? `${kg1(Math.abs(week))} kg în ultima săptămână` : Math.abs(week) < 0.05 ? 'Stabil față de săptămâna trecută' : `+${kg1(week)} kg pe tendință: apa și sarea mișcă cântarul, contează media.`}</p>` : ''}
        <p class="weigh-t">Tendința: ${kg1(now)} kg</p>
      </div></div>
    <p class="bn-cel-tap">Atinge ca să închizi</p>`;
  document.body.appendChild(el);
  const close = () => { if (el.classList.contains('out')) return; el.classList.add('out'); window.setTimeout(() => el.remove(), 480); dispatchEvent(new Event('bn:weigh')); };
  el.addEventListener('click', close);
  window.setTimeout(close, 6500);
  if (calm()) { el.classList.add('shown'); return; }
  drumRoll(1.3);
  const n = el.querySelector('#wn')!;
  const t0 = performance.now();
  const spin = (t: number) => {
    const k = (t - t0) / 1300;
    if (k < 1) {
      n.textContent = n1(30 + Math.random() * 170);
      requestAnimationFrame(spin);
    } else {
      n.textContent = kg1(kg);
      el.classList.add('shown');
    }
  };
  requestAnimationFrame(spin);
}

/* ---------- the body's transformation (Corp) ---------- */

/** A front silhouette: the shoulders stay, the belly, the waist and the limbs slim as `b` (1 at the start, 0 at the
 *  goal) falls. */
function figure(b: number, cls: string): string {
  const sh = 27, chest = 22 + 6 * b, waist = 13 + 15 * b, hip = 17 + 10 * b, arm = 5 + 3 * b, leg = 7.5 + 4 * b;
  const torso = `M${50 - sh} 42 Q50 34 ${50 + sh} 42 Q${50 + chest + 2} 60 ${50 + waist} 84 Q${50 + hip + 3} 100 ${50 + hip} 112 L${50 - hip} 112 Q${50 - hip - 3} 100 ${50 - waist} 84 Q${50 - chest - 2} 60 ${50 - sh} 42 Z`;
  const armL = `M${50 - sh} 44 q${-arm - 2} 22 ${-arm + 1} 58`, armR = `M${50 + sh} 44 q${arm + 2} 22 ${arm - 1} 58`;
  const legX = Math.max(leg / 2 + 1, hip - leg / 2 - 1);
  return `<svg viewBox="0 0 100 184" class="fig ${cls}" aria-hidden="true">
    <circle cx="50" cy="20" r="11"/><path d="M45 30h10v8H45z"/><path d="${torso}"/>
    <path class="limb" d="${armL}" stroke-width="${(arm * 2).toFixed(1)}"/><path class="limb" d="${armR}" stroke-width="${(arm * 2).toFixed(1)}"/>
    <path class="limb" d="M${50 - legX} 110 L${50 - legX - 1} 176" stroke-width="${(leg * 2).toFixed(1)}"/><path class="limb" d="M${50 + legX} 110 L${50 + legX + 1} 176" stroke-width="${(leg * 2).toFixed(1)}"/>
  </svg>`;
}

export function transformCard(): string {
  const s = ctx.get();
  const start = startKg(), now = trendNow();
  if (start == null || now == null) return '';
  const goal = s.goal?.kg ?? Math.min(start - 10, now - 5);
  const span = Math.max(1, start - goal);
  const b = Math.max(0, Math.min(1, (now - goal) / span));
  // the monthly averages of the weighings
  const months = new Map<string, number[]>();
  for (const [d, v] of Object.entries(s.weights).sort()) months.set(d.slice(0, 7), [...(months.get(d.slice(0, 7)) ?? []), v]);
  const avg = [...months.entries()].slice(-8).map(([m, v]) => ({ m, kg: v.reduce((a, x) => a + x, 0) / v.length }));
  const hi = Math.max(start, ...avg.map((x) => x.kg)), lo = Math.min(goal, ...avg.map((x) => x.kg));
  const name = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
  return `<section class="card trans"><h2>Transformarea</h2>
    <div class="trans-figs">
      <div>${figure(1, 'was')}<b>${kg1(start)}</b><span>Start</span></div>
      <div class="now">${figure(b, 'is')}<b>${kg1(now)}</b><span>Acum</span></div>
      <div>${figure(0, 'goal')}<b>${kg1(goal)}</b><span>Ținta</span></div>
    </div>
    <div class="trans-bar"><i style="--f:${(1 - b).toFixed(3)}"></i></div>
    <p class="hint">${n0((1 - b) * 100)}% din drum. Silueta urmează tendința greutății, nu cântarul unei singure dimineți.</p>
    ${avg.length > 1 ? `<div class="trans-m">${avg.map((x) => `<div><i style="--h:${((x.kg - lo) / Math.max(1, hi - lo)).toFixed(3)}"></i><b>${kg1(x.kg)}</b><span>${name(x.m)}</span></div>`).join('')}</div><p class="hint">Media fiecărei luni.</p>` : ''}
  </section>`;
}

/* ---------- the diet's chapters ---------- */

const CHAPTER: Record<string, [string, string]> = {
  cut: ['Deficit', 'Slăbești: caloriile sub menținere, proteinele sus, cântarul în fiecare dimineață.'],
  break: ['Pauză de dietă', 'O săptămână la menținere: refaci energia și hormonii, apoi deficitul continuă mai ușor.'],
  maintain: ['Menținere', 'Ții greutatea câștigată: aceleași obiceiuri, calorii la nivelul consumului.'],
  reverse: ['Reverse diet', 'Urci caloriile treptat, săptămână de săptămână, fără să pui grăsime înapoi.'],
};

/** Once per chapter: when the diet's phase changes, or a diet break starts or ends, a title card. */
let waiting = false;
export function chapterCheck() {
  // while the opening plays, the card waits for it to go
  if (document.getElementById('splash')) { if (!waiting) { waiting = true; window.setTimeout(() => { waiting = false; chapterCheck(); }, 800); } return; }
  const s = ctx.get();
  if (!s.plan) return;
  const today = ctx.today();
  const k = s.plan.phase === 'cut' && isBreakWeek(s.plan, today) ? 'break' : s.plan.phase;
  const key = `${s.plan.startDate}:${k}`;
  if (store('bn:chapter') === key) return;
  keep('bn:chapter', key);
  const [title, what] = CHAPTER[k] ?? ['', ''];
  if (!title) return;
  const el = document.createElement('div');
  el.className = `bn-chap ch-${k}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<i class="bn-chap-flood" aria-hidden="true"></i><i class="bn-cel-rays" aria-hidden="true"></i>
    <div class="bn-chap-core"><img src="${BASE}splash/umbra.webp" alt="" width="680" height="801"><p class="bn-cel-k">Capitol nou</p><h2 class="bn-chap-t">${esc(title)}</h2><p class="bn-cel-w">${esc(what)}</p></div>
    <p class="bn-cel-tap">Atinge ca să începi</p>`;
  document.body.appendChild(el);
  const close = () => { if (el.classList.contains('out')) return; el.classList.add('out'); window.setTimeout(() => el.remove(), 480); };
  el.addEventListener('click', close);
  window.setTimeout(close, 6500);
}
