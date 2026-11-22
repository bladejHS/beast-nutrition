/* The premium look of Peptide, Carb cycling, Suplimente and Corp (2026-11-22, the user: "mai spectaculoase și mai
   premium ... o experiență uimitoare"). One kit, four screens, so they read as the same app: a hero with a living
   picture behind the title, a rail of big numbers, and section titles with a hairline. Pictures only — every number
   comes from the logic the screens already use. The entrance plays once per opening (class "in"), and every loop
   stops under prefers-reduced-motion (styles.css). */
import { ctx, esc } from '../app.ts';

const f1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** The wrapper's classes: "in" plays the entrance once, when the screen is opened. */
export const pmIn = () => (ctx.fresh ? ' in' : '');

/** The hero: an aurora behind the art, the screen's name in small caps, the title and one line under it. */
export function pmHero(o: { eyebrow: string; title: string; sub?: string; art: string; tone?: string }): string {
  return `<section class="pm-hero${o.tone ? ` t-${o.tone}` : ''}" aria-label="${esc(o.title)}">
    <div class="pm-aura" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="pm-art" aria-hidden="true">${o.art}</div>
    <div class="pm-h"><small>${esc(o.eyebrow)}</small><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>
  </section>`;
}

/** A rail of big numbers under the hero. */
export function pmStats(stats: Array<[string, string]>): string {
  return `<div class="pm-st">${stats.map(([v, l], i) => `<div style="--i:${i}"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>`;
}

/** A section title with a hairline, so the long screens break into chapters. */
export const pmSect = (t: string, note = '') => `<div class="pm-sec"><h2>${esc(t)}</h2>${note ? `<small>${esc(note)}</small>` : ''}<i aria-hidden="true"></i></div>`;

/* ---------- the four signature pictures ---------- */

/** A ring that fills with how much of today is done, with a soft pulse while anything is left. */
export function pmRing(done: number, total: number, big: string, small: string): string {
  const pct = total ? Math.max(0, Math.min(1, done / total)) : 0;
  const full = total > 0 && done >= total;
  return `<div class="pm-ring${full ? ' full' : ''}" role="img" aria-label="${big} ${small}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="r-bg" cx="60" cy="60" r="46"/>
      <circle class="r-fg" cx="60" cy="60" r="46" pathLength="100" style="--to:${(100 - pct * 100).toFixed(1)}"/>
    </svg>
    <div class="r-c"><b>${esc(big)}</b><span>${esc(small)}</span></div>
  </div>`;
}

/** The week of carbohydrate as a wave: the area under the days, each day's column and today lit up. */
export function carbWave(days: Array<{ label: string; c: number; kind: string; today: boolean }>): string {
  if (days.length < 2) return '';
  const W = 340, H = 150, L = 10, R = 10, T = 16, B = 26;
  const max = Math.max(...days.map((d) => d.c)) * 1.12 || 1;
  const min = Math.min(...days.map((d) => d.c)) * 0.72;
  const x = (i: number) => L + (i / (days.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const pts = days.map((d, i) => [x(i), y(d.c)] as const);
  // a smooth line through the points, so the week reads as one wave
  let path = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!, q = pts[i]!;
    const cx = (p[0] + q[0]) / 2;
    path += ` C${cx.toFixed(1)},${p[1].toFixed(1)} ${cx.toFixed(1)},${q[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  }
  const area = `${path} L${pts.at(-1)![0].toFixed(1)},${H - B} L${pts[0]![0].toFixed(1)},${H - B} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" class="wave" role="img" aria-label="Carbohidrații din următoarele zile">
    <defs><linearGradient id="wv" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--act-hot)" stop-opacity=".55"/><stop offset="1" stop-color="var(--act-hot)" stop-opacity="0"/>
    </linearGradient></defs>
    <path class="wv-a" d="${area}" fill="url(#wv)"/>
    <path class="wv-l" d="${path}"/>
    ${days.map((d, i) => `<g class="wv-d k-${d.kind}${d.today ? ' now' : ''}" style="--i:${i}">
      <line x1="${x(i).toFixed(1)}" y1="${y(d.c).toFixed(1)}" x2="${x(i).toFixed(1)}" y2="${H - B}"/>
      <circle cx="${x(i).toFixed(1)}" cy="${y(d.c).toFixed(1)}" r="${d.today ? 5 : 3.4}"/>
      <text x="${x(i).toFixed(1)}" y="${(y(d.c) - 9).toFixed(1)}" text-anchor="middle">${d.c}</text>
      <text class="wv-x" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>
    </g>`).join('')}
  </svg>`;
}

/** The three kinds of day as bars: how much carbohydrate each one carries next to the biggest. */
export function fuelBars(levels: Array<{ name: string; kind: string; c: number; kcal: number; used: boolean }>): string {
  const max = Math.max(...levels.map((l) => l.c)) || 1;
  // the tag only makes sense once the week uses at least one kind of day
  const some = levels.some((l) => l.used);
  return `<div class="fuelb">${levels.map((l, i) => `<div class="fb k-${l.kind}${l.used || !some ? '' : ' off'}" style="--i:${i};--p:${((l.c / max) * 100).toFixed(1)}%">
    <div class="fb-h"><b>${esc(l.name)}</b><span>${l.c} g carbo</span><small>${l.kcal} kcal</small>${l.used || !some ? '' : '<em>nefolosită</em>'}</div>
    <div class="fb-tr"><i></i></div>
  </div>`).join('')}</div>`;
}

/** The scale as a summit: the trend line, where it started and how far the goal still is. */
export function summit(points: Array<{ date: string; kg: number; trend: number }>, goal: number | null): string {
  if (points.length < 2) return '<div class="smt empty"></div>';
  const W = 320, H = 110;
  const vals = points.map((p) => p.trend);
  // the scale comes from the trend alone: a goal far below would flatten the line into a slab
  const a = Math.min(...vals), b = Math.max(...vals), pad = (b - a || 1) * 0.35;
  const lo = a - pad, hi = b + pad;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => 12 + (1 - (v - lo) / (hi - lo || 1)) * (H - 28);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const end = points.at(-1)!;
  return `<svg viewBox="0 0 ${W} ${H}" class="smt" role="img" aria-label="Tendința greutății">
    <defs><linearGradient id="smg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky)" stop-opacity=".5"/><stop offset="1" stop-color="var(--sky)" stop-opacity="0"/></linearGradient></defs>
    <polygon class="sm-a" points="${line} ${W},${H - 14} 0,${H - 14}" fill="url(#smg)"/>
    <polyline class="sm-l" points="${line}"/>
    ${goal != null && goal >= lo && goal <= hi ? `<line class="sm-g" x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/>` : ''}
    <circle class="sm-p" cx="${x(points.length - 1).toFixed(1)}" cy="${y(end.trend).toFixed(1)}" r="4.5"/>
    <text class="sm-t" x="2" y="${(y(points[0]!.trend) - 8).toFixed(1)}">${f1(points[0]!.trend)}</text>
    <text class="sm-t now" x="${W - 2}" y="${(y(end.trend) - 10).toFixed(1)}" text-anchor="end">${f1(end.trend)}</text>
  </svg>`;
}

/** A capsule, drawn, for the supplement cards. */
export const capsule = (on: boolean) => `<svg class="caps${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10 8.8l4.1 5.9"/></svg>`;

/** A floating chain of amino acids: the picture of a peptide. */
export function chainArt(): string {
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => ({ x: 20 + i * 37, y: 42 + Math.sin(i * 0.9) * 17 }));
  return `<svg viewBox="0 0 340 110" class="chain" aria-hidden="true">
    ${pts.slice(1).map((p, i) => `<line class="cb" x1="${pts[i]!.x.toFixed(1)}" y1="${pts[i]!.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" style="--i:${i}"/>`).join('')}
    ${pts.map((p, i) => `<circle class="cd" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i % 3 ? 6 : 8}" style="--i:${i}"/>`).join('')}
  </svg>`;
}

/** Grains of carbohydrate drifting up, for the Carb cycling hero. */
export function grainArt(): string {
  const g = Array.from({ length: 16 }, (_, i) => `<circle cx="${12 + ((i * 53) % 320)}" cy="${20 + ((i * 37) % 70)}" r="${1.6 + (i % 3)}" style="--i:${i}"/>`).join('');
  return `<svg viewBox="0 0 340 110" class="grains" aria-hidden="true">${g}</svg>`;
}

/** Capsules drifting, for Suplimente. */
export function pillArt(): string {
  const p = Array.from({ length: 7 }, (_, i) => `<g class="pl" style="--i:${i}" transform="translate(${18 + i * 46} ${26 + ((i * 29) % 46)}) rotate(${-35 + ((i * 47) % 70)})">
    <rect x="-13" y="-5" width="26" height="10" rx="5"/><path d="M0 -5v10"/></g>`).join('');
  return `<svg viewBox="0 0 340 110" class="pills" aria-hidden="true">${p}</svg>`;
}

/** A slow ribbon, for Corp. */
export const ribbonArt = () => `<svg viewBox="0 0 340 110" class="ribbon" aria-hidden="true">
  <path d="M-10 78 C60 30 110 96 170 60 C230 24 280 80 350 38" /><path class="r2" d="M-10 92 C70 52 120 104 180 74 C240 44 290 92 350 56"/></svg>`;

export { f1 };
