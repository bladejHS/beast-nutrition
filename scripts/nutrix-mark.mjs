// The NUTRIX mark (2026-11-20, the user: "o iconiță nouă, spectaculoasă, pentru specificul Beast Nutrition").
// The X of the name is a fork and a chef's knife crossed like blades, inside a ring cut into the three macros
// (protein blue, carbs amber, fat lilac, in a plan's proportions), on black with a violet core; behind it, three claw
// marks: the beast that eats with a plan. The same geometry is drawn by the opening (public/splash/nutrix.js).

/** Fork and knife, pointing up, centred on 0,0, 128 units long. Shared with public/splash/nutrix.js (copy). */
export const FORK = [
  'M-11.75 -36V-61.5a2 2 0 0 1 4 0V-36Z', 'M-5.25 -36V-61.5a2 2 0 0 1 4 0V-36Z', 'M1.25 -36V-61.5a2 2 0 0 1 4 0V-36Z', 'M7.75 -36V-61.5a2 2 0 0 1 4 0V-36Z',
  'M-11.75 -38H11.75V-32Q11.75 -22 4 -17L3.6 -6H-3.6L-4 -17Q-11.75 -22 -11.75 -32Z',
  'M-4.6 -8H4.6V59.5a4.6 4.6 0 0 1 -9.2 0Z',
].join('');
export const BLADE = 'M-6 8V-44Q-6 -60 5 -66Q7.5 -50 7.5 -30V8Z';
export const KNIFE_HANDLE = 'M-7 8H8.5V14H-7Z M-5.5 14H7V59a6.25 5 0 0 1 -12.5 0Z';
export const RIVETS = [26, 40, 52];
/** The macro ring: share of the circle per macro (P, C, F) and the gap between arcs, in degrees. */
export const ARCS = [['#5b9bff', 0.3], ['#f0ad57', 0.43], ['#c084fc', 0.27]];
export const GAP = 11;

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function ring(cx, cy, r, w, glow) {
  let a = -90 - 28, out = '';
  for (const [col, share] of ARCS) {
    const span = share * 360 - GAP;
    const d = arc(cx, cy, r, a + GAP / 2, a + GAP / 2 + span);
    if (glow) out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w * 2.2}" stroke-linecap="round" opacity=".35" filter="url(#nxb)"/>`;
    out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w * 0.22}" stroke-linecap="round" opacity=".45" transform="translate(0 ${-w * 0.18})"/>`;
    a += share * 360;
  }
  return out;
}

function utensils(small) {
  const metal = 'url(#nxm)', edge = '#c1a8ff';
  const fork = `<g transform="rotate(-38)"><path d="${FORK}" fill="${metal}" stroke="${edge}" stroke-width="${small ? 0 : 0.9}"/></g>`;
  const knife = `<g transform="rotate(38)"><path d="${BLADE}" fill="${metal}" stroke="${edge}" stroke-width="${small ? 0 : 0.9}"/>${small ? '' : '<path d="M7.5 -30Q7.5 -50 5 -66" fill="none" stroke="#fff" stroke-width="1.4" opacity=".9"/>'}<path d="${KNIFE_HANDLE}" fill="#1c1230" stroke="${edge}" stroke-width="${small ? 1.2 : 1.1}"/>${small ? '' : RIVETS.map((y) => `<circle cx=".75" cy="${y}" r="1.9" fill="#a47aff"/>`).join('')}</g>`;
  // the knife crosses over the fork, as a blade would
  return fork + knife;
}

const CLAWS = [-30, 0, 30].map((o) => `<path d="M${-70 + o} -96Q${-4 + o} -18 ${62 + o} 100Q${-22 + o} 4 ${-70 + o} -96Z" />`).join('');

/** A whole SVG. `small` drops the details that turn to mud under 48 px. */
export function svg({ px, k = 1, bg = true, rx = 0, small = px <= 64 }) {
  const defs = `<defs>
    <radialGradient id="nxg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8759e8" stop-opacity=".55"/><stop offset=".45" stop-color="#321d5c" stop-opacity=".55"/><stop offset="1" stop-color="#050505" stop-opacity="0"/></radialGradient>
    <radialGradient id="nxs" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#c1a8ff" stop-opacity=".16"/><stop offset="1" stop-color="#050505" stop-opacity="0"/></radialGradient>
    <linearGradient id="nxm" x1="0" y1="-64" x2="0" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e6dcff"/><stop offset="1" stop-color="#8f84a8"/></linearGradient>
    <linearGradient id="nxc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a47aff" stop-opacity=".0"/><stop offset=".5" stop-color="#8759e8" stop-opacity=".8"/><stop offset="1" stop-color="#6840c5" stop-opacity="0"/></linearGradient>
    <filter id="nxb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="nxx" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>`;
  const field = bg ? `<rect width="240" height="240" fill="#050505"/><rect width="240" height="240" fill="url(#nxs)"/><circle cx="120" cy="120" r="118" fill="url(#nxg)"/>` : '';
  const claws = small ? '' : `<g transform="translate(120 120)" fill="url(#nxc)" opacity="1">${CLAWS}</g>`;
  const core = `<g transform="translate(120 120) scale(${k}) translate(-120 -120)">
    ${claws}
    <circle cx="120" cy="120" r="${small ? 74 : 72}" fill="none" stroke="#222" stroke-width="${small ? 0 : 1.5}"/>
    ${ring(120, 120, small ? 88 : 86, small ? 20 : 13, !small)}
    <g transform="translate(120 121) scale(${small ? 1.08 : 0.98})">
      ${small ? '' : `<g filter="url(#nxx)" opacity=".85"><g transform="rotate(-38)"><path d="${FORK}" fill="#8759e8"/></g><g transform="rotate(38)"><path d="${BLADE}${KNIFE_HANDLE}" fill="#8759e8"/></g></g>`}
      ${utensils(small)}
    </g>
  </g>`;
  const clip = rx ? `<clipPath id="cl"><rect width="240" height="240" rx="${rx}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 240 240">${defs}${clip}<g${rx ? ' clip-path="url(#cl)"' : ''}>${field}${core}</g></svg>`;
}
