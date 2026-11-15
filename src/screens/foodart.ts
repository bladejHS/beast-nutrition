/* Food illustrations (2026-11-16, the user picked "ilustrații pentru mâncare"): every planned meal and every Cookbook
   recipe gets a small drawing of its plate, composed from what is in it. Flat, top-down, warm food colours on a
   cool porcelain plate, so the meals read like a menu. Drawn as SVG from the names: no pictures to download.
   The protein sits bottom-left, the side top-right, the vegetables bottom-right, a garnish on top; a shake is a glass,
   oats a bowl, pancakes a stack, a cake a slice, a wrap a roll, a burger a burger. */

type Part = 'protein' | 'carb' | 'veg' | 'fat';
interface Piece { part: Part; draw: (x: number, y: number, s: number, seed: number) => string }

const R = (seed: number, i: number) => { const v = Math.sin(seed * 9301 + i * 49297) * 233280; return v - Math.floor(v); };
const hash = (t: string) => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 100000; return h; };

/* ---------- the pieces, each in a box of size s around (x, y) ---------- */
const blobs = (x: number, y: number, s: number, seed: number, n: number, r: number, fill: string, stroke = 'none') =>
  Array.from({ length: n }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 50)) * s * 0.42; return `<circle cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" r="${(r * (0.75 + R(seed, i + 9) * 0.5)).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`; }).join('');

const P: Record<string, Piece> = {
  chicken: { part: 'protein', draw: (x, y, s) => `<path d="M${x - s * .45} ${y}c0-${s * .3} ${s * .25}-${s * .42} ${s * .5}-${s * .38}s${s * .42} ${s * .2} ${s * .4} ${s * .45}-${s * .3} ${s * .38}-${s * .5} ${s * .3}-${s * .4}-${s * .12}-${s * .4}-${s * .37}Z" fill="#dca468" stroke="#a96a33" stroke-width="1.2"/><path d="M${x - s * .25} ${y - s * .12}l${s * .4} ${s * .22}M${x - s * .3} ${y + s * .05}l${s * .4} ${s * .22}M${x - s * .12} ${y - s * .25}l${s * .38} ${s * .22}" stroke="#9b5b26" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>` },
  steak: { part: 'protein', draw: (x, y, s) => `<path d="M${x - s * .45} ${y - s * .05}c${s * .05}-${s * .32} ${s * .5}-${s * .4} ${s * .75}-${s * .22}s${s * .2} ${s * .5}-${s * .15} ${s * .55}-${s * .62} ${s * .02}-${s * .6}-${s * .33}Z" fill="#8a3f22" stroke="#5a2412" stroke-width="1.2"/><path d="M${x - s * .3} ${y}q${s * .2}-${s * .1} ${s * .35} ${s * .02}t${s * .3}-${s * .05}" fill="none" stroke="#e8b9a0" stroke-width="1.6" opacity=".8"/>` },
  mince: { part: 'protein', draw: (x, y, s, seed) => blobs(x, y, s, seed, 22, s * .07, '#7a3a1e', '#4e2210') },
  pork: { part: 'protein', draw: (x, y, s) => `<ellipse cx="${x}" cy="${y}" rx="${s * .45}" ry="${s * .3}" fill="#d9a07e" stroke="#9c6040" stroke-width="1.2"/><ellipse cx="${x - s * .05}" cy="${y - s * .03}" rx="${s * .28}" ry="${s * .16}" fill="#efc3a6"/>` },
  salmon: { part: 'protein', draw: (x, y, s) => `<path d="M${x - s * .48} ${y + s * .1}q${s * .1}-${s * .45} ${s * .55}-${s * .38}t${s * .4} ${s * .3}q-${s * .15} ${s * .3}-${s * .5} ${s * .25}t-${s * .45}-${s * .17}Z" fill="#f2875a" stroke="#c45c32" stroke-width="1.2"/>${[0, 1, 2, 3].map((i) => `<path d="M${x - s * .3 + i * s * .18} ${y - s * .18}q${s * .06} ${s * .15} 0 ${s * .32}" fill="none" stroke="#ffd2bd" stroke-width="1.6" opacity=".85"/>`).join('')}` },
  whitefish: { part: 'protein', draw: (x, y, s) => `<path d="M${x - s * .48} ${y + s * .08}q${s * .1}-${s * .4} ${s * .55}-${s * .34}t${s * .42} ${s * .28}q-${s * .16} ${s * .3}-${s * .52} ${s * .24}t-${s * .45}-${s * .18}Z" fill="#f4ecdc" stroke="#cdbb98" stroke-width="1.2"/><path d="M${x + s * .2} ${y - s * .2}l${s * .14} ${s * .1}" stroke="#f6d34a" stroke-width="3" stroke-linecap="round"/><circle cx="${x + s * .32}" cy="${y - s * .26}" r="${s * .08}" fill="#f6e27a" stroke="#c9a92a" stroke-width=".8"/>` },
  shrimp: { part: 'protein', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => { const a = R(seed, i) * 6.283, cx = x + Math.cos(a) * s * .25, cy = y + Math.sin(a) * s * .22; return `<path d="M${cx - s * .12} ${cy}a${s * .12} ${s * .12} 0 1 1 ${s * .14} ${s * .1}" fill="none" stroke="#f57d48" stroke-width="${s * .08}" stroke-linecap="round"/>`; }).join('') },
  egg: { part: 'protein', draw: (x, y, s) => `<path d="M${x - s * .45} ${y}c0-${s * .3} ${s * .3}-${s * .42} ${s * .5}-${s * .3}s${s * .45} ${s * .05} ${s * .35} ${s * .35}-${s * .4} ${s * .35}-${s * .55} ${s * .25}-${s * .3}-${s * .1}-${s * .3}-${s * .3}Z" fill="#fbfaf5" stroke="#d9d3c2" stroke-width="1.2"/><circle cx="${x + s * .02}" cy="${y - s * .02}" r="${s * .17}" fill="#f6b21a" stroke="#d48a07" stroke-width="1"/><circle cx="${x - s * .03}" cy="${y - s * .07}" r="${s * .05}" fill="#ffe08a"/>` },
  tofu: { part: 'protein', draw: (x, y, s, seed) => Array.from({ length: 6 }, (_, i) => { const cx = x + (i % 3 - 1) * s * .26 + R(seed, i) * 3, cy = y + (Math.floor(i / 3) - .5) * s * .26; return `<rect x="${cx - s * .1}" y="${cy - s * .1}" width="${s * .2}" height="${s * .2}" rx="2" fill="#efdcab" stroke="#c9a55e" stroke-width="1"/>`; }).join('') },
  tuna: { part: 'protein', draw: (x, y, s, seed) => blobs(x, y, s, seed, 16, s * .08, '#d9a291', '#a86a58') },
  dairy: { part: 'protein', draw: (x, y, s, seed) => `<path d="M${x - s * .42} ${y + s * .05}c-${s * .05}-${s * .3} ${s * .2}-${s * .45} ${s * .45}-${s * .4}s${s * .45} ${s * .1} ${s * .4} ${s * .4}-${s * .3} ${s * .3}-${s * .45} ${s * .28}-${s * .38}-${s * .05}-${s * .4}-${s * .28}Z" fill="#fbfbf8" stroke="#dadce2" stroke-width="1.2"/>${blobs(x, y, s * .7, seed, 6, s * .04, '#eceef2')}` },
  rice: { part: 'carb', draw: (x, y, s, seed) => `<circle cx="${x}" cy="${y}" r="${s * .42}" fill="#f7f5ee" stroke="#d6d1c2" stroke-width="1.2"/>${Array.from({ length: 26 }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 3)) * s * .36; return `<ellipse cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" rx="${s * .05}" ry="${s * .022}" transform="rotate(${Math.round(R(seed, i + 7) * 180)} ${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)})" fill="#e6e1d2"/>`; }).join('')}` },
  grain: { part: 'carb', draw: (x, y, s, seed) => `<circle cx="${x}" cy="${y}" r="${s * .42}" fill="#d7b77d" stroke="#a9874a" stroke-width="1.2"/>${blobs(x, y, s, seed, 34, s * .028, '#b8955a')}` },
  pasta: { part: 'carb', draw: (x, y, s, seed) => `<circle cx="${x}" cy="${y}" r="${s * .42}" fill="#f2cf6e" stroke="#c9a03a" stroke-width="1.2"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${x - s * .32 + R(seed, i) * s * .2} ${y - s * .3 + i * s * .09}q${s * .15} -${s * .08} ${s * .3} 0t${s * .3} 0" fill="none" stroke="#dcae3e" stroke-width="2.2" stroke-linecap="round"/>`).join('')}` },
  potato: { part: 'carb', draw: (x, y, s, seed) => Array.from({ length: 7 }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 5)) * s * .3, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; return `<rect x="${(cx - s * .12).toFixed(1)}" y="${(cy - s * .1).toFixed(1)}" width="${s * .24}" height="${s * .2}" rx="3" transform="rotate(${Math.round(R(seed, i + 2) * 60 - 30)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="#e9b450" stroke="#b77a1e" stroke-width="1"/>`; }).join('') },
  sweetpotato: { part: 'carb', draw: (x, y, s, seed) => Array.from({ length: 7 }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 5)) * s * .3, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; return `<rect x="${(cx - s * .12).toFixed(1)}" y="${(cy - s * .1).toFixed(1)}" width="${s * .24}" height="${s * .2}" rx="3" transform="rotate(${Math.round(R(seed, i + 2) * 60 - 30)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="#f08a3a" stroke="#b9561a" stroke-width="1"/>`; }).join('') },
  bread: { part: 'carb', draw: (x, y, s) => `<path d="M${x - s * .4} ${y + s * .38}V${y - s * .05}a${s * .2} ${s * .2} 0 0 1 ${s * .05}-${s * .38}a${s * .22} ${s * .22} 0 0 1 ${s * .7} 0a${s * .2} ${s * .2} 0 0 1 ${s * .05} ${s * .38}V${y + s * .38}Z" fill="#c98a42" stroke="#8f5a22" stroke-width="1.3"/><path d="M${x - s * .32} ${y + s * .3}V${y - s * .02}a${s * .14} ${s * .14} 0 0 1 ${s * .04}-${s * .3}a${s * .17} ${s * .17} 0 0 1 ${s * .56} 0a${s * .14} ${s * .14} 0 0 1 ${s * .04} ${s * .3}V${y + s * .3}Z" fill="#f2dcb0"/>` },
  tortilla: { part: 'carb', draw: (x, y, s, seed) => `<circle cx="${x}" cy="${y}" r="${s * .44}" fill="#efd9a6" stroke="#c9a868" stroke-width="1.2"/>${blobs(x, y, s, seed, 8, s * .035, '#d7b46e')}` },
  polenta: { part: 'carb', draw: (x, y, s) => `<circle cx="${x}" cy="${y}" r="${s * .42}" fill="#f6c935" stroke="#c99a10" stroke-width="1.2"/><ellipse cx="${x - s * .12}" cy="${y - s * .14}" rx="${s * .14}" ry="${s * .07}" fill="#ffe27a" opacity=".8"/>` },
  legumes: { part: 'carb', draw: (x, y, s, seed) => Array.from({ length: 20 }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 3)) * s * .36; return `<ellipse cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" rx="${s * .07}" ry="${s * .05}" fill="#c99a5b" stroke="#8c6430" stroke-width=".8"/>`; }).join('') },
  blackbeans: { part: 'carb', draw: (x, y, s, seed) => Array.from({ length: 20 }, (_, i) => { const a = R(seed, i) * 6.283, d = Math.sqrt(R(seed, i + 3)) * s * .36; return `<ellipse cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" rx="${s * .065}" ry="${s * .045}" fill="#2b2230" stroke="#120d16" stroke-width=".8"/>`; }).join('') },
  corn: { part: 'carb', draw: (x, y, s, seed) => blobs(x, y, s, seed, 18, s * .05, '#f7cf3a', '#c99d10') },
  broccoli: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 4 }, (_, i) => { const a = i * 1.6 + R(seed, i), cx = x + Math.cos(a) * s * .22, cy = y + Math.sin(a) * s * .2; return `<path d="M${cx} ${cy + s * .16}v-${s * .1}" stroke="#6f9b3a" stroke-width="${s * .07}" stroke-linecap="round"/>${[[-1, 0], [1, 0], [0, -1], [0, 0]].map(([dx, dy]) => `<circle cx="${cx + dx! * s * .07}" cy="${cy + dy! * s * .07}" r="${s * .09}" fill="#3f8a32" stroke="#25611c" stroke-width=".8"/>`).join('')}`; }).join('') },
  salad: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 6 }, (_, i) => { const a = R(seed, i) * 6.283, cx = x + Math.cos(a) * s * .18, cy = y + Math.sin(a) * s * .16; return `<path d="M${cx} ${cy}q${s * .18}-${s * .2} ${s * .3} 0q-${s * .12} ${s * .2}-${s * .3} 0Z" transform="rotate(${Math.round(R(seed, i + 4) * 360)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="#8fd156" stroke="#5e9b2c" stroke-width="1"/>`; }).join('') },
  tomato: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 4 }, (_, i) => { const a = i * 1.57 + R(seed, i), cx = x + Math.cos(a) * s * .2, cy = y + Math.sin(a) * s * .18; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .14}" fill="#e8402e" stroke="#a8241a" stroke-width="1"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .07}" fill="#f7806c"/>`; }).join('') },
  cucumber: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => { const a = i * 1.25 + R(seed, i), cx = x + Math.cos(a) * s * .22, cy = y + Math.sin(a) * s * .2; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .12}" fill="#cfe9a8" stroke="#3f7d2a" stroke-width="2"/>`; }).join('') },
  pepper: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => `<path d="M${x - s * .3 + i * s * .14} ${y - s * .25 + R(seed, i) * 6}q${s * .1} ${s * .25} 0 ${s * .5}" fill="none" stroke="${i % 2 ? '#f2b42a' : '#e2352a'}" stroke-width="${s * .09}" stroke-linecap="round"/>`).join('') },
  carrot: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 6 }, (_, i) => { const a = i * 1.05 + R(seed, i), cx = x + Math.cos(a) * s * .22, cy = y + Math.sin(a) * s * .2; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .1}" fill="#f2862e" stroke="#c45a10" stroke-width="1"/>`; }).join('') },
  greens: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 7 }, (_, i) => { const a = R(seed, i) * 6.283, cx = x + Math.cos(a) * s * .2, cy = y + Math.sin(a) * s * .18; return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${s * .16}" ry="${s * .08}" transform="rotate(${Math.round(R(seed, i + 3) * 180)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="#2f7a34" stroke="#1d5222" stroke-width=".8"/>`; }).join('') },
  beans: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 7 }, (_, i) => `<path d="M${x - s * .3 + R(seed, i) * 4} ${y - s * .28 + i * s * .09}l${s * .55} ${R(seed, i + 2) * 8 - 4}" stroke="#4f9a3a" stroke-width="${s * .07}" stroke-linecap="round"/>`).join('') },
  mushroom: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => { const a = i * 1.25 + R(seed, i), cx = x + Math.cos(a) * s * .2, cy = y + Math.sin(a) * s * .18; return `<path d="M${cx - s * .12} ${cy}a${s * .12} ${s * .1} 0 0 1 ${s * .24} 0Z" fill="#a3764b" stroke="#6e4a26" stroke-width="1"/><rect x="${cx - s * .03}" y="${cy}" width="${s * .06}" height="${s * .08}" fill="#e9d8bd"/>`; }).join('') },
  zucchini: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => { const a = i * 1.25 + R(seed, i), cx = x + Math.cos(a) * s * .22, cy = y + Math.sin(a) * s * .2; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .12}" fill="#e7efc2" stroke="#4f7d2a" stroke-width="2.4"/>`; }).join('') },
  cabbage: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 9 }, (_, i) => `<path d="M${x - s * .3 + R(seed, i) * s * .2} ${y - s * .25 + i * s * .06}q${s * .2} ${R(seed, i + 1) * 6 - 3} ${s * .45} 0" fill="none" stroke="${i % 3 ? '#b7d9a0' : '#8a4fa8'}" stroke-width="2.2" stroke-linecap="round"/>`).join('') },
  berries: { part: 'veg', draw: (x, y, s, seed) => blobs(x, y, s, seed, 12, s * .08, '#4a5ec2', '#2a3680') + blobs(x + 2, y - 2, s * .7, seed + 3, 4, s * .09, '#e2354a', '#a01d2c') },
  banana: { part: 'veg', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => { const a = i * 1.25 + R(seed, i), cx = x + Math.cos(a) * s * .2, cy = y + Math.sin(a) * s * .18; return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .11}" fill="#fbeaa4" stroke="#d9b84a" stroke-width="1"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${s * .025}" fill="#9a7a2a"/>`; }).join('') },
  fruit: { part: 'veg', draw: (x, y, s, seed) => blobs(x, y, s, seed, 6, s * .12, '#f29b3a', '#b9601a') + blobs(x, y, s * .8, seed + 2, 5, s * .08, '#e2354a', '#a01d2c') },
  avocado: { part: 'fat', draw: (x, y, s) => `<path d="M${x} ${y - s * .3}c${s * .18} 0 ${s * .26} ${s * .25} ${s * .26} ${s * .4}a${s * .26} ${s * .22} 0 0 1-${s * .52} 0c0-${s * .15} ${s * .08}-${s * .4} ${s * .26}-${s * .4}Z" fill="#c9e07a" stroke="#4f6e1e" stroke-width="2"/><circle cx="${x}" cy="${y + s * .12}" r="${s * .1}" fill="#8a5a2a"/>` },
  nuts: { part: 'fat', draw: (x, y, s, seed) => blobs(x, y, s * .8, seed, 7, s * .07, '#b07a3c', '#6e4a1e') },
  oil: { part: 'fat', draw: (x, y, s) => `<path d="M${x - s * .4} ${y}q${s * .2}-${s * .18} ${s * .4} 0t${s * .4} 0" fill="none" stroke="#f2d04a" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>` },
  cheese: { part: 'fat', draw: (x, y, s, seed) => Array.from({ length: 5 }, (_, i) => `<path d="M${x - s * .3 + R(seed, i) * s * .6} ${y - s * .15 + R(seed, i + 1) * s * .3}l${s * .14} -${s * .04}l-${s * .02} ${s * .1}Z" fill="#fbe9a6" stroke="#d9b54a" stroke-width=".8"/>`).join('') },
};

/** Name → piece, the specific before the general. */
const MATCH: Array<[RegExp, string]> = [
  [/piept de pui|pulp[ăe] de pui|\bpui\b|chicken|curcan|turkey/i, 'chicken'],
  [/carne tocat|tocat|mince|bolognese|chiftel|meatball/i, 'mince'],
  [/vit[ăa]|vițel|beef|steak|mușchi de vit/i, 'steak'],
  [/porc|pork|bacon|șunc/i, 'pork'],
  [/somon|salmon|ton proaspăt|macrou/i, 'salmon'],
  [/cod|păstrăv|șalău|tilapia|fish|pește/i, 'whitefish'],
  [/crevet|shrimp/i, 'shrimp'],
  [/tofu/i, 'tofu'],
  [/ton\b|tuna/i, 'tuna'],
  [/\bou\b|ouă|albuș|egg|omlet/i, 'egg'],
  [/iaurt|skyr|brânz[ăa] de vaci|cottage|ricotta|telemea|feta|halloumi|mozzarella/i, 'dairy'],
  [/orez|rice/i, 'rice'],
  [/paste|spaghet|penne|noodles|macaroane|gnocchi/i, 'pasta'],
  [/cartofi dulci|cartof dulce|sweet potato/i, 'sweetpotato'],
  [/cartof|potato|fries/i, 'potato'],
  [/pâine|toast|bagel|chiflă|bun\b|brioche/i, 'bread'],
  [/lipie|tortilla|wrap/i, 'tortilla'],
  [/mălai|mămălig|polent/i, 'polenta'],
  [/fasole neagr/i, 'blackbeans'],
  [/linte|năut|fasole|leguminoase|hummus|falafel/i, 'legumes'],
  [/quinoa|bulgur|cuscus|hrișc|mei\b|orz|ovăz|oats/i, 'grain'],
  [/porumb|corn/i, 'corn'],
  [/broccoli|conopid/i, 'broccoli'],
  [/salat|rucola|lettuce|iceberg/i, 'salad'],
  [/roși|tomat|cherry/i, 'tomato'],
  [/castrave|cucumber/i, 'cucumber'],
  [/ardei|gogoșar|pepper/i, 'pepper'],
  [/morcov|carrot/i, 'carrot'],
  [/spanac|kale|spinach/i, 'greens'],
  [/fasole verde|mazăre/i, 'beans'],
  [/ciuperc|mushroom/i, 'mushroom'],
  [/dovlec|zucchini|vinete|sparanghel/i, 'zucchini'],
  [/varz|cabbage|praz|ceap/i, 'cabbage'],
  [/afine|zmeur|căpșun|mure|cireș|berries|fructe de pădure/i, 'berries'],
  [/banan/i, 'banana'],
  [/măr|pere|piersic|mango|ananas|kiwi|portocal|caise|fruct/i, 'fruit'],
  [/avocado|guacamole/i, 'avocado'],
  [/nuci|migdale|arahide|caju|alune|semințe|susan|chia|fistic/i, 'nuts'],
  [/parmezan|cașcaval|cheddar/i, 'cheese'],
  [/ulei|unt\b/i, 'oil'],
];

function pieces(names: string[]): Record<Part, string[]> {
  const out: Record<Part, string[]> = { protein: [], carb: [], veg: [], fat: [] };
  for (const n of names) {
    // "fasole verde" before "fasole": the green beans are a vegetable
    const key = /fasole verde/i.test(n) ? 'beans' : MATCH.find(([re]) => re.test(n))?.[1];
    if (!key) continue;
    const part = P[key]!.part;
    if (!out[part].includes(key)) out[part].push(key);
  }
  return out;
}

/* ---------- whole dishes that are not a plate ---------- */
const DISH: Array<[RegExp, (seed: number) => string]> = [
  [/shake|smoothie/i, () => `<ellipse cx="60" cy="104" rx="30" ry="6" fill="rgba(0,0,0,.35)"/><path d="M38 28h44l-6 74a6 6 0 0 1-6 5H50a6 6 0 0 1-6-5Z" fill="rgba(220,235,255,.22)" stroke="#cfe0f4" stroke-width="2"/><path d="M41 46h38l-4.4 54a5 5 0 0 1-5 4.5H50.4a5 5 0 0 1-5-4.5Z" fill="#e8a7b8"/><path d="M41 46h38" stroke="#f7d3dc" stroke-width="3"/><path d="M66 12l-8 44" stroke="#2f8cff" stroke-width="5" stroke-linecap="round"/><circle cx="52" cy="40" r="5" fill="#e2354a"/><circle cx="64" cy="38" r="4" fill="#4a5ec2"/>`],
  [/ovăz|oats|porridge|budinc|pudding|iaurt grecesc cu|mousse/i, (s) => `<ellipse cx="60" cy="68" rx="50" ry="44" fill="rgba(0,0,0,.35)"/><circle cx="60" cy="60" r="48" fill="#2f8cff"/><circle cx="60" cy="60" r="48" fill="url(#bw)"/><circle cx="60" cy="60" r="38" fill="#e9d6b0"/>${blobs(60, 60, 60, s, 16, 2.4, '#d4bb8a')}${P['berries']!.draw(70, 52, 34, s)}${P['banana']!.draw(48, 66, 30, s + 1)}<path d="M40 44q8-6 16 0" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none"/>`],
  [/pancake|clătit|crepe|french toast/i, () => `<ellipse cx="60" cy="98" rx="44" ry="10" fill="rgba(0,0,0,.35)"/>${[0, 1, 2, 3].map((i) => `<ellipse cx="60" cy="${88 - i * 11}" rx="40" ry="12" fill="#d9a35a" stroke="#9c6828" stroke-width="1.4"/><ellipse cx="60" cy="${85 - i * 11}" rx="38" ry="9" fill="#efc77e"/>`).join('')}<path d="M44 50q16-8 32 0q-4 10-16 10t-16-10Z" fill="#9b5a1a" opacity=".9"/>${P['berries']!.draw(60, 44, 30, 5)}`],
  [/cake|tort|prăjitur|cheesecake|brownie|lava|tiramisu|pie\b/i, () => `<ellipse cx="60" cy="98" rx="42" ry="9" fill="rgba(0,0,0,.35)"/><path d="M22 84L60 36l38 48Z" fill="#f2dcb0" stroke="#b98a4a" stroke-width="1.5"/><path d="M22 84h76v12H22Z" fill="#7a4a2a" stroke="#4e2c14" stroke-width="1.5"/><path d="M30 74l30-38 30 38" fill="none" stroke="#fff" stroke-width="5" opacity=".8"/><circle cx="60" cy="40" r="6" fill="#e2354a"/>`],
  [/ice ?cream|înghețat|maxibon|sandwich ice/i, () => `<path d="M42 58l18 50 18-50Z" fill="#e1a85c" stroke="#a36a24" stroke-width="1.5"/><path d="M46 62l28 0M48 72l24 0M51 82l18 0" stroke="#b98034" stroke-width="1.2"/><circle cx="52" cy="50" r="15" fill="#fbe3ec"/><circle cx="68" cy="48" r="15" fill="#8a5a3a"/><circle cx="60" cy="36" r="14" fill="#fff6dd"/>`],
  [/doughnut|donut|gogo/i, () => `<ellipse cx="60" cy="96" rx="42" ry="9" fill="rgba(0,0,0,.35)"/><circle cx="60" cy="62" r="38" fill="#d9a35a" stroke="#9c6828" stroke-width="1.5"/><circle cx="60" cy="60" r="33" fill="#6b3a1e"/><circle cx="60" cy="60" r="12" fill="#0b0d12" stroke="#9c6828" stroke-width="1.5"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${60 + Math.cos(i * .8) * 22}" y="${60 + Math.sin(i * .8) * 22}" width="6" height="2" rx="1" transform="rotate(${i * 40} ${60 + Math.cos(i * .8) * 22} ${60 + Math.sin(i * .8) * 22})" fill="${['#f2b42a', '#e2354a', '#4a8ad8', '#fff'][i % 4]}"/>`).join('')}`],
  [/cookie|biscuit/i, (s) => [[44, 60], [74, 50], [64, 80]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="20" fill="#d9a35a" stroke="#9c6828" stroke-width="1.5"/>${blobs(x!, y!, 30, s + i, 6, 2.6, '#4e2c14')}`).join('')],
  [/balls|bile|bites|truffle|trufe|reeses|raffaello/i, (s) => `<ellipse cx="60" cy="96" rx="42" ry="9" fill="rgba(0,0,0,.35)"/>${[[42, 66], [62, 58], [80, 70], [52, 84], [72, 86]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="13" fill="${i % 2 ? '#6b3a1e' : '#f4ead6'}" stroke="${i % 2 ? '#3e1f0c' : '#cdbb98'}" stroke-width="1.2"/>${blobs(x!, y!, 18, s + i, 4, 1.2, i % 2 ? '#a3764b' : '#e2354a')}`).join('')}`],
  [/wrap|burrito|taquito|roll|rulou|crunch/i, () => `<ellipse cx="60" cy="96" rx="44" ry="9" fill="rgba(0,0,0,.35)"/><rect x="20" y="52" width="80" height="34" rx="17" transform="rotate(-14 60 69)" fill="#efd9a6" stroke="#b98a4a" stroke-width="1.5"/><ellipse cx="93" cy="58" rx="9" ry="15" transform="rotate(-14 93 58)" fill="#8fd156" stroke="#b98a4a" stroke-width="1.5"/><circle cx="92" cy="54" r="3" fill="#e8402e"/><circle cx="95" cy="62" r="3" fill="#dca468"/>`],
  [/burger|sandwich|sub\b|hot dog|bagel/i, () => `<ellipse cx="60" cy="100" rx="42" ry="8" fill="rgba(0,0,0,.35)"/><path d="M24 58a36 26 0 0 1 72 0Z" fill="#d38a3a" stroke="#8f5a22" stroke-width="1.5"/><circle cx="48" cy="44" r="1.6" fill="#fff3d6"/><circle cx="62" cy="40" r="1.6" fill="#fff3d6"/><circle cx="74" cy="46" r="1.6" fill="#fff3d6"/><path d="M22 60q38 10 76 0" stroke="#7fc64a" stroke-width="7" stroke-linecap="round" fill="none"/><rect x="24" y="64" width="72" height="11" rx="5" fill="#6e3518"/><path d="M26 76h68" stroke="#f6c935" stroke-width="5" stroke-linecap="round"/><path d="M26 80h68v6a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8Z" fill="#d38a3a" stroke="#8f5a22" stroke-width="1.5"/>`],
  [/pizza|calzone|lahmacun|pizzadilla/i, (s) => `<ellipse cx="60" cy="98" rx="42" ry="9" fill="rgba(0,0,0,.35)"/><path d="M60 20L100 92Q60 104 20 92Z" fill="#f2c45a" stroke="#c48a2a" stroke-width="1.5"/><path d="M60 30L92 88Q60 98 28 88Z" fill="#e8402e"/>${blobs(60, 70, 40, s, 7, 4.5, '#fbeaa4')}${blobs(60, 74, 34, s + 3, 4, 3.5, '#7a3a1e')}`],
];

const cache = new Map<string, string>();

/**
 * The drawing for a dish: `name` decides the whole dish (a shake, a cake), else the plate is composed from `parts`,
 * the names of the foods or the ingredients. `cls` sizes it (CSS).
 */
export function foodArt(name: string, parts: string[], cls = ''): string {
  const key = `${name}|${parts.join(',')}`;
  let inner = cache.get(key);
  if (!inner) {
    const seed = hash(key);
    const dish = DISH.find(([re]) => re.test(name));
    if (dish) inner = dish[1](seed);
    else {
      const p = pieces([name, ...parts]);
      const slot = (k: string | undefined, x: number, y: number, s: number, i: number) => (k ? P[k]!.draw(x, y, s, seed + i) : '');
      const veg = p.veg.slice(0, 2);
      inner = `<ellipse cx="60" cy="66" rx="54" ry="50" fill="rgba(0,0,0,.4)"/><circle cx="60" cy="60" r="54" fill="#dfe6f0"/><circle cx="60" cy="60" r="54" fill="url(#pl)"/><circle cx="60" cy="60" r="42" fill="#eef2f8" stroke="#c9d3e0" stroke-width="1"/>
        ${slot(p.carb[0], 74, 42, 40, 1)}
        ${slot(veg[0], 78, 78, 34, 2)}${slot(veg[1], 58, 30, 26, 3)}
        ${slot(p.protein[0], 44, 70, 44, 4)}
        ${slot(p.fat[0], 50, 42, 22, 5)}`;
    }
    cache.set(key, inner);
  }
  return `<svg class="fart ${cls}" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="pl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="bw" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9fd0ff"/><stop offset="1" stop-color="#0b4fa6"/></radialGradient></defs>${inner}</svg>`;
}
