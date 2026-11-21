/* The pictures of Peptide and Semaglutidă (2026-11-21, the user: "mai animată și mult mai interesantă"): a peptide
   chain that floats, the week as a countdown ring to the next injection, the injection sites on a body, the dose ladder
   as a staircase, the weight-loss pace on a gauge and the blood sugar as a line through its zones. Pictures only: every
   number comes from the same logic the screens already use, and none of them proposes a dose. The entrance plays only
   when the screen is opened (class "in"), not on every tap. */
import { ctx } from '../app.ts';

const f1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** The wrapper's classes: "in" plays the entrance once, when the tab is opened. */
export const pepIn = () => (ctx.fresh ? ' in' : '');

/** A peptide: a chain of amino acids, beads joined by bonds, floating in a slow wave. */
export function peptideHero(title: string, sub: string, stats: Array<[string, string]>): string {
  const n = 11;
  const pts = Array.from({ length: n }, (_, i) => ({ x: 18 + i * 32.4, y: 70 + Math.sin(i * 0.95) * 26 }));
  const bonds = pts.slice(1).map((p, i) => `<line x1="${pts[i]!.x.toFixed(1)}" y1="${pts[i]!.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" style="--i:${i}"/>`).join('');
  const side = pts.map((p, i) => (i % 2 ? '' : `<line class="sd" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x + 8).toFixed(1)}" y2="${(p.y + (i % 4 ? 22 : -22)).toFixed(1)}" style="--i:${i}"/><circle class="sa" cx="${(p.x + 8).toFixed(1)}" cy="${(p.y + (i % 4 ? 22 : -22)).toFixed(1)}" r="4" style="--i:${i}"/>`)).join('');
  const beads = pts.map((p, i) => `<g class="bd" style="--i:${i}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i % 3 ? 8 : 10.5}"/></g>`).join('');
  return `<section class="pep-hero" aria-label="${title}">
    <svg class="pep-chain" viewBox="0 0 360 140" aria-hidden="true">
      <defs><radialGradient id="pb" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#c4a8ff"/><stop offset="1" stop-color="#5017ca"/></radialGradient>
        <radialGradient id="pp" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#f9a8d4"/><stop offset="1" stop-color="#be185d"/></radialGradient></defs>
      <g class="pc-w"><g class="bonds">${bonds}</g>${side}${beads}</g>
    </svg>
    <i class="pep-scan" aria-hidden="true"></i>
    <div class="ph-txt"><p class="ph-k">${title}</p><p class="ph-s">${sub}</p></div>
    ${stats.length ? `<div class="ph-stats">${stats.map(([b, s], i) => `<div style="--i:${i}"><b>${b}</b><span>${s}</span></div>`).join('')}</div>` : ''}
  </section>`;
}

/**
 * The week as a ring: seven ticks, the days gone since the last injection lit, the days left in the middle.
 * `left`: days to the next injection (0 = today, negative = late); `null` before the first one.
 */
export function countdownRing(left: number | null, label: string): string {
  const gone = left == null ? 0 : Math.max(0, Math.min(7, 7 - left));
  const ticks = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * 2 * Math.PI - Math.PI / 2;
    const x1 = 60 + Math.cos(a) * 49, y1 = 60 + Math.sin(a) * 49, x2 = 60 + Math.cos(a) * 56, y2 = 60 + Math.sin(a) * 56;
    return `<line class="${i < gone ? 'on' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="--i:${i}"/>`;
  }).join('');
  const now = left != null && left <= 0;
  const big = left == null ? '–' : left <= 0 ? 'AZI' : String(left);
  const small = left == null ? 'prima doză' : left < 0 ? 'întârziată' : left === 0 ? 'injecția' : left === 1 ? 'zi rămasă' : 'zile rămase';
  return `<div class="cd${now ? ' now' : ''}" role="img" aria-label="${label}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="cd-bg" cx="60" cy="60" r="42"/>
      <circle class="cd-fg" cx="60" cy="60" r="42" pathLength="100" style="--to:${(100 - (gone / 7) * 100).toFixed(1)}"/>
      ${ticks}
    </svg>
    ${now ? '<i class="cd-ripple"></i><i class="cd-ripple r2"></i>' : ''}
    <div class="cd-c"><b>${big}</b><span>${small}</span></div>
  </div>`;
}

/** Where the six sites sit on a body seen from the front (the person's left is on the right of the picture). */
const SITE_XY: Array<[number, number]> = [[58, 66], [42, 66], [58, 104], [42, 104], [75, 50], [25, 50]];

/** The body with the six injection sites: the next one pulsing, the last one marked, the rest by how recently used. */
export function siteMap(names: readonly string[], next: number, history: number[]): string {
  const last = history.at(-1);
  const recent = history.slice(-6);
  const dots = SITE_XY.map(([x, y], i) => {
    const used = recent.lastIndexOf(i);
    const age = used < 0 ? 6 : recent.length - 1 - used;
    const cls = i === next ? 'next' : i === last ? 'last' : used < 0 ? 'free' : 'used';
    return `<g class="sm-d ${cls}" style="--a:${(1 - age / 7).toFixed(2)};--i:${i}">${i === next ? `<circle class="sm-p" cx="${x}" cy="${y}" r="6"/>` : ''}<circle cx="${x}" cy="${y}" r="${i === next ? 5.5 : 4}"/></g>`;
  }).join('');
  return `<div class="sm">
    <svg viewBox="0 0 100 160" aria-hidden="true">
      <g class="sm-body"><circle cx="50" cy="15" r="10"/><path d="M34 30 Q50 25 66 30 L68 82 Q50 88 32 82 Z"/><path d="M30 31 Q22 34 21 46 L18 86 L25 87 L29 52 L33 40 Z"/><path d="M70 31 Q78 34 79 46 L82 86 L75 87 L71 52 L67 40 Z"/><path d="M33 82 L49 86 L47 152 L37 152 Z"/><path d="M67 82 L51 86 L53 152 L63 152 Z"/></g>
      ${dots}
      <text x="8" y="158">D</text><text x="92" y="158" text-anchor="end">S</text>
    </svg>
    <div class="sm-l"><p class="sm-k">Locul următor</p><p class="sm-n">${names[next] ?? ''}</p>${last != null ? `<p class="hint">Ultima dată: ${names[last] ?? ''}</p>` : ''}<p class="sm-key"><i class="k-next"></i>următorul <i class="k-last"></i>ultimul <i class="k-used"></i>folosit recent</p></div>
  </div>`;
}

/** The dose ladder as a staircase: the steps done, the one now lit and filling over its 4 weeks, the ones ahead. */
export function doseStairs(ladder: readonly number[], now: number, weeks: number): string {
  const i = ladder.findIndex((x) => x === now);
  const steps = ladder.map((x, k) => {
    const cls = k < i ? 'past' : k === i ? 'now' : '';
    const fill = k < i ? 1 : k === i ? Math.min(1, weeks / 4) : 0;
    return `<li class="${cls}" style="--h:${(0.32 + (k / (ladder.length - 1)) * 0.68).toFixed(2)};--f:${fill.toFixed(2)};--i:${k}">
      ${k === i ? '<em>Ești aici</em>' : ''}<div class="st-bar"><i></i></div><b>${String(x).replace('.', ',')}</b><small>${k === ladder.length - 1 ? 'întreținere' : `săpt. ${k * 4 + 1}–${k * 4 + 4}`}</small></li>`;
  }).join('');
  return `<ol class="stairs">${steps}</ol>`;
}

/** The pace of weight loss, % of body weight per week, on a half dial from 0 to 2, the target 0.5–1 lit. */
export function paceGauge(loss: number): string {
  const v = Math.max(-0.2, Math.min(2, loss));
  const ang = (x: number) => Math.PI + (Math.max(0, Math.min(2, x)) / 2) * Math.PI;
  const pt = (x: number, r: number) => `${(70 + Math.cos(ang(x)) * r).toFixed(1)} ${(74 + Math.sin(ang(x)) * r).toFixed(1)}`;
  const arc = (a: number, b: number, r: number) => `M ${pt(a, r)} A ${r} ${r} 0 0 1 ${pt(b, r)}`;
  const zone = loss > 1.5 ? 'fast' : loss >= 0.5 ? 'good' : 'slow';
  const word = zone === 'fast' ? 'prea repede' : zone === 'good' ? 'în țintă' : 'lent';
  return `<div class="gauge ${zone}">
    <svg viewBox="0 0 140 84" aria-hidden="true">
      <path class="g-bg" d="${arc(0, 2, 56)}"/>
      <path class="g-ok" d="${arc(0.5, 1, 56)}"/>
      <path class="g-hi" d="${arc(1.5, 2, 56)}"/>
      <g class="g-nd" style="--deg:${((Math.max(0, v) / 2) * 180 - 90).toFixed(1)}deg"><line x1="70" y1="74" x2="70" y2="26"/><circle cx="70" cy="74" r="5"/></g>
      <text x="14" y="83">0</text><text x="70" y="12" text-anchor="middle">1%</text><text x="126" y="83" text-anchor="end">2%</text>
    </svg>
    <div class="g-v"><b>${loss >= 0 ? '−' : '+'}${f1(Math.abs(loss))}%</b><span>pe săptămână · ${word}</span></div>
  </div>`;
}

/** The blood sugar as a line through its zones, the newest reading last, each point coloured by its level. */
export function glucoseChart(list: Array<{ mg: number; level: string }>): string {
  if (list.length < 2) return '';
  const W = 300, H = 120, lo = 50, hi = Math.max(160, ...list.map((p) => p.mg + 20));
  const y = (v: number) => H - 10 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - 20);
  const x = (i: number) => 14 + (i / (list.length - 1)) * (W - 28);
  const d = list.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.mg).toFixed(1)}`).join(' ');
  const area = `${d} L${x(list.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  return `<svg class="gc" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><linearGradient id="gca" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a07bf0" stop-opacity=".35"/><stop offset="1" stop-color="#a07bf0" stop-opacity="0"/></linearGradient></defs>
    <rect class="z-ok" x="0" y="${y(140).toFixed(1)}" width="${W}" height="${(y(70) - y(140)).toFixed(1)}"/>
    <line class="z-l" x1="0" x2="${W}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}"/><line class="z-l low" x1="0" x2="${W}" y1="${y(70).toFixed(1)}" y2="${y(70).toFixed(1)}"/>
    <text x="2" y="${(y(100) - 3).toFixed(1)}">100</text><text x="2" y="${(y(70) + 10).toFixed(1)}">70</text>
    <path class="gc-a" d="${area}"/>
    <path class="gc-l" d="${d}" pathLength="100"/>
    ${list.map((p, i) => `<circle class="gc-p ${p.level}" cx="${x(i).toFixed(1)}" cy="${y(p.mg).toFixed(1)}" r="${i === list.length - 1 ? 5 : 3.5}" style="--i:${i}"/>`).join('')}
  </svg>`;
}
