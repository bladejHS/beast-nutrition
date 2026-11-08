// The Beast mark for Beast Nutrition: Inner Beast's "Umbra" (2026-11-08), the same dark faceted wolf's head with
// its rim lit, in the family's nutrition colour: blue eyes and a blue light behind the head (Inner Beast's are red).
// Vector geometry on a 240 grid, symmetric (the right half is drawn, the left is its mirror), in three optical sizes:
// large for the opening, medium for the app icons, small for the browser tab and the header; the smaller it is, the
// lighter the head, the thicker the rim and the bigger the eyes, so the wolf still reads at 16 px.

/** The light of this app: the eyes, their core, the halo behind the head and the field's glow. */
const P = { eye: '#2f8cff', core: '#cfe6ff', halo: '#0b6fd6', glow: '#0b6fd6', deep: '#0a2f5c' };

const C = 120;
const mir = ([x, y]) => [2 * C - x, y];
const d = (a) => 'M' + a.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L') + 'Z';

// the silhouette, clockwise from the dip between the ears to the chin. A wolf, not a fox: ears wide at the base,
// a mane that flares under them, a long muzzle ending in a real nose.
const R = [
  [120, 66], [140, 62], [174, 26], [190, 86], [210, 108], [197, 118], [214, 146], [186, 156], [160, 190], [146, 212], [132, 226], [120, 230],
];
const OUTLINE = [...R, ...R.slice(1, -1).reverse().map(mir)];
const [S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11] = R;
const F1 = [120, 102], F2 = [154, 90], EI = [126, 122], EO = [168, 100], C1 = [176, 124], M1 = [140, 152], M2 = [120, 160];
const N0 = [120, 192], N1 = [138, 194], N2 = [130, 211], N3 = [120, 213];

// facets and their tone (0 lightest), painted like a grey wolf's face: dark saddle and brow, lighter cheeks and
// muzzle, dark nose; the left half one tone darker, lit from the upper right
const FACETS = [
  [[S0, S1, F2, F1], 2], [[S1, S2, S3, F2], 2], [[F1, F2, EO, EI], 3], [[S3, S4, S5, C1, EO, F2], 1], [[S5, S6, S7, C1], 0],
  [[EI, EO, C1, M1], 0], [[C1, S7, S8, M1], 1], [[F1, EI, M1, M2], 1], [[M2, M1, S8, S9, N2, N1, N0], 0], [[N0, N1, N2, N3], 4],
  [[N3, N2, S9, S10, S11], 2],
];
const DIAMOND = [[120, 72], [131, 87], [120, 101]];
const EYE = [EI, EO, [158, 114]];
const EAR_IN = [[151, 61], [172, 38], [182, 75]];

const pair = (poly) => [poly, poly.map(mir).reverse()];
const centre = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
const grow = (poly, k) => { const [cx, cy] = centre(poly); return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };

export const OUTLINE_D = d(OUTLINE);

const SIZES = {
  // tones from the lit side, rim width and strength, eye scale and glow, the red halo behind the head
  large: { tones: ['#2a303d', '#212632', '#191d27', '#12151d', '#0b0d12'], gap: 1.6, rim: 2.4, rimA: 0.75, eye: 1, glow: 8, halo: 0.5 },
  medium: { tones: ['#363d4c', '#2b313e', '#222733', '#1a1e28', '#12151c'], gap: 0, rim: 4.6, rimA: 0.9, eye: 1.08, glow: 7, halo: 0.75 },
  small: { tones: null, fill: '#232835', gap: 0, rim: 9, rimA: 1, eye: 1.3, glow: 5, halo: 0.9 },
};

let n = 0;
/** The mark's body on the 240 grid; `id` keeps the gradient and filter names apart when several sit in one page. */
export function umbra(size = 'medium', id = `u${++n}`) {
  const o = SIZES[size];
  const face = o.tones
    ? FACETS.flatMap(([poly, t]) => pair(poly).map((p, side) => {
        const c = o.tones[Math.min(t + side, o.tones.length - 1)];
        return `<path d="${d(p)}" fill="${c}"${o.gap ? '' : ` stroke="${c}" stroke-width=".7" stroke-linejoin="round"`}/>`;
      })).join('') +
      (o.gap ? FACETS.flatMap(([poly]) => pair(poly)).map((p) => `<path d="${d(p)}" fill="none" stroke="#05060a" stroke-width="${o.gap}" stroke-linejoin="round"/>`).join('') : '') +
      pair(DIAMOND).map((p, i) => `<path d="${d(p)}" fill="${o.tones[i]}"/>`).join('') +
      pair(EAR_IN).map((p) => `<path d="${d(p)}" fill="${o.tones[4]}"/>`).join('')
    : `<path d="${OUTLINE_D}" fill="${o.fill}"/>` + pair(EAR_IN).map((p) => `<path d="${d(p)}" fill="#11141b"/>`).join('');
  const eyes = pair(EYE).map((e) => grow(e, o.eye));
  return `<defs>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe4ee"/><stop offset=".55" stop-color="#8d97aa"/><stop offset="1" stop-color="#4a5266"/></linearGradient>
    <filter id="${id}h" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${id}g" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${o.glow}"/></filter>
  </defs>
  <path d="${OUTLINE_D}" fill="${P.halo}" opacity="${o.halo}" filter="url(#${id}h)"/>
  ${face}
  <path d="${OUTLINE_D}" fill="none" stroke="url(#${id}r)" stroke-opacity="${o.rimA}" stroke-width="${o.rim}" stroke-linejoin="round"/>
  <g filter="url(#${id}g)">${eyes.map((e) => `<path d="${d(e)}" fill="${P.eye}"/>`).join('')}</g>
  ${eyes.map((e) => `<path d="${d(e)}" fill="${P.eye}"/>`).join('')}
  ${eyes.map((e) => `<path d="${d(grow(e, 0.42))}" fill="${P.core}" opacity=".85"/>`).join('')}`;
}

/** The icon's field: steel black under a cold spotlight, a blue light behind the head, darker at the bottom. */
export function field(id = `f${++n}`) {
  return `<defs><radialGradient id="${id}s" cx=".5" cy=".02" r=".85"><stop offset="0" stop-color="#9fb0cf" stop-opacity=".36"/><stop offset=".55" stop-color="#1b2130" stop-opacity=".45"/><stop offset="1" stop-color="#05060a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.glow}" stop-opacity=".5"/><stop offset=".6" stop-color="${P.deep}" stop-opacity=".3"/><stop offset="1" stop-color="#05060a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>
    <rect width="240" height="240" fill="#05060a"/><rect width="240" height="240" fill="url(#${id}s)"/><circle cx="120" cy="132" r="112" fill="url(#${id}r)"/><rect width="240" height="240" fill="url(#${id}v)"/>`;
}

/** A whole SVG: the field (or none) and the head at `k` of the canvas, nudged down a little. */
export function svg({ px, size = 'medium', bg = true, k = 0.76, rx = 0, w = px, h = px }) {
  const body = `<g transform="translate(120 ${122 + (h / w - 1) * 120}) scale(${k}) translate(-120 -128)">${umbra(size)}</g>`;
  const vb = `0 0 240 ${(240 * h) / w}`;
  const clip = rx ? `<clipPath id="cl"><rect width="240" height="${(240 * h) / w}" rx="${rx}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${clip}<g${rx ? ' clip-path="url(#cl)"' : ''}>${bg ? field() : ''}${body}</g></svg>`;
}
