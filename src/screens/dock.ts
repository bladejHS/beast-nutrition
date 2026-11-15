/* The dock (2026-11-15, the user, twice: the tab bar must be spectacular). Built once, outside #app, so it lives across
   screens and can move:
   - a glass bar drawn on a canvas, with a smooth notch cut where the open tab is; its top edge is a neon line, with two
     comets of light running along it, over the notch and back;
   - the open tab is an orb sitting in the notch; changing tab, the orb leaps in an arc to the new place, the notch flows
     after it like liquid, and where it lands: a burst of sparks and a shock ring;
   - the other tabs are quiet icons that dip when pressed.
   Reduced motion: the bar and the orb, still, no comets, the orb moves at once. */

export interface DockItem { key: string; label: string; icon: string }

const TOP = 24, BAR = 56, H = TOP + BAR, ORB = 56;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function makeDock(items: DockItem[]) {
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.setAttribute('aria-label', 'Navigare');
  nav.innerHTML = `<canvas class="dock-cv" aria-hidden="true"></canvas>
    <div class="dock-orb" aria-hidden="true"><i class="dock-ring"></i><svg viewBox="0 0 24 24"></svg></div>
    ${items.map((it) => `<button class="dock-b" data-tab="${it.key}"><svg viewBox="0 0 24 24" aria-hidden="true">${it.icon}</svg><span>${it.label}</span></button>`).join('')}`;
  document.body.appendChild(nav);
  const cv = nav.querySelector('canvas')!, c = cv.getContext('2d')!;
  const orb = nav.querySelector<HTMLElement>('.dock-orb')!, orbSvg = orb.querySelector('svg')!;
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>('.dock-b')];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, dpr = 1, at = -1, from = 0, to = 0, t0 = 0, notch = 0, raf = 0, last = 0, clock = 0;
  const sparks: { x: number; y: number; vx: number; vy: number; t: number; life: number }[] = [];
  const slot = (i: number) => (W / items.length) * (i + 0.5);

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = nav.clientWidth;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  /** The bar's outline with the notch at x, as a path; `edge` only the top line (for the neon). */
  function outline(x: number, edge: boolean) {
    const r = 28, w = 50, depth = 31, k = ORB / 2 + 6;
    c.beginPath();
    if (edge) c.moveTo(r, TOP); else { c.moveTo(0, TOP + r); c.quadraticCurveTo(0, TOP, r, TOP); }
    c.lineTo(Math.max(r, x - w), TOP);
    c.bezierCurveTo(x - w * 0.5, TOP, x - k, TOP + depth, x, TOP + depth);
    c.bezierCurveTo(x + k, TOP + depth, x + w * 0.5, TOP, Math.min(W - r, x + w), TOP);
    c.lineTo(W - r, TOP);
    if (edge) return;
    c.quadraticCurveTo(W, TOP, W, TOP + r); c.lineTo(W, H - r); c.quadraticCurveTo(W, H, W - r, H);
    c.lineTo(r, H); c.quadraticCurveTo(0, H, 0, H - r); c.closePath();
  }

  /** A point on the top edge at fraction u (0 left, 1 right), following the notch. */
  function edgeAt(u: number, x: number): [number, number] {
    const px = 28 + u * (W - 56), w = 50, depth = 31;
    const d = Math.abs(px - x);
    return [px, d < w ? TOP + depth * Math.pow(Math.cos((d / w) * Math.PI / 2), 1.6) : TOP];
  }

  function frame(now: number) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; clock += dt;
    if (!W) size();
    // the orb's leap and the notch flowing after it
    const u = calm() ? 1 : Math.min(1, (now - t0) / 560);
    const ox = from + (to - from) * ease(u);
    const lift = calm() ? 0 : Math.sin(Math.PI * Math.min(1, u)) * 26;
    // the notch flows after the orb (exponential smoothing: steady at any frame rate)
    notch += (ox - notch) * (1 - Math.exp(-dt * 16));
    if (calm() || (Math.abs(ox - notch) < 0.3 && u >= 1)) notch = ox;
    orb.style.transform = `translate(${(ox - ORB / 2).toFixed(1)}px, ${(TOP - ORB / 2 + 3 - lift).toFixed(1)}px)`;
    if (u >= 1 && orb.dataset['landed'] !== String(t0)) {
      orb.dataset['landed'] = String(t0);
      if (!calm() && from !== to) {
        orb.classList.remove('land'); void orb.offsetWidth; orb.classList.add('land');
        for (let i = 0; i < 26; i++) { const a = Math.PI + Math.random() * Math.PI, v = 80 + Math.random() * 220; sparks.push({ x: to, y: TOP, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.35 }); }
      }
    }

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // the glass
    outline(notch, false);
    const g = c.createLinearGradient(0, TOP, 0, H);
    g.addColorStop(0, 'rgba(26, 36, 56, .96)'); g.addColorStop(1, 'rgba(6, 9, 15, .98)');
    c.fillStyle = g; c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 24; c.shadowOffsetY = 10; c.fill();
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    // a pool of light under the open tab
    const pool = c.createRadialGradient(notch, TOP + 30, 0, notch, TOP + 30, 90);
    pool.addColorStop(0, 'rgba(72, 207, 255, .22)'); pool.addColorStop(1, 'rgba(22, 119, 255, 0)');
    c.save(); outline(notch, false); c.clip(); c.fillStyle = pool; c.fillRect(0, 0, W, H); c.restore();
    // the neon edge
    const ng = c.createLinearGradient(0, 0, W, 0);
    ng.addColorStop(0, 'rgba(22,119,255,.25)'); ng.addColorStop(Math.max(0, Math.min(1, notch / W)), 'rgba(160,230,255,1)'); ng.addColorStop(1, 'rgba(22,119,255,.25)');
    outline(notch, true);
    c.strokeStyle = ng; c.lineWidth = 2; c.shadowColor = 'rgba(72,207,255,.9)'; c.shadowBlur = 12; c.stroke();
    c.shadowBlur = 0;
    // two comets running along the edge
    if (!calm()) {
      c.globalCompositeOperation = 'lighter';
      for (const [speed, phase] of [[0.22, 0], [-0.17, 0.5]] as const) {
        const head = (((clock * speed + phase) % 1) + 1) % 1;
        for (let k = 0; k < 14; k++) {
          const uu = head - Math.sign(speed) * k * 0.008;
          if (uu < 0 || uu > 1) continue;
          const [x, y] = edgeAt(uu, notch);
          c.fillStyle = `rgba(190,240,255,${(0.9 * (1 - k / 14)).toFixed(3)})`;
          c.beginPath(); c.arc(x, y, 2.4 * (1 - k / 18), 0, Math.PI * 2); c.fill();
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!;
        p.t += dt; if (p.t > p.life) { sparks.splice(i, 1); continue; }
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.strokeStyle = `rgba(160,230,255,${(1 - p.t / p.life).toFixed(3)})`; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }
    if (!document.hidden && !calm()) raf = requestAnimationFrame(frame);
    else if (!calm()) raf = 0;
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  addEventListener('resize', () => { size(); from = to = slot(at); notch = to; kick(); if (calm()) frame(performance.now()); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  return {
    /** Shows tab i as open: the orb leaps there from where it was. */
    set(i: number) {
      nav.classList.add('ready');
      if (!W) size();
      if (i === at) { kick(); return; }
      const first = at < 0;
      at = i;
      from = first ? slot(i) : to; to = slot(i);
      if (first) notch = to;
      t0 = performance.now();
      orbSvg.innerHTML = items[i]!.icon;
      buttons.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      if (calm()) frame(performance.now()); else kick();
    },
    /** Away while the profile is being set up. */
    hide() { nav.classList.remove('ready'); },
  };
}
