/* The dock (2026-11-15). The user, three times: the tab bar must be spectacular; then "nu-mi place bila aia", so no orb.
   Built once, outside #app, so it lives across screens and can move:
   - a glass bar drawn on a canvas; its top edge is a neon line with two comets of light running along it;
   - over the open tab the neon flares and a beam of light falls from the edge onto it, like a spotlight on a stage;
     the icon there burns white-blue and lifts, its name lit;
   - changing tab, the flare and the beam sweep along the edge to the new tab, leaving a streak, and where they stop the
     edge flashes and throws sparks;
   - the other tabs are quiet icons that dip when pressed.
   Reduced motion: the bar and the beam, still, no comets, the beam moves at once. */

export interface DockItem { key: string; label: string; icon: string }

const TOP = 14, BAR = 62, H = TOP + BAR, R = 24;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function makeDock(items: DockItem[]) {
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.setAttribute('aria-label', 'Navigare');
  nav.innerHTML = `<canvas class="dock-cv" aria-hidden="true"></canvas>
    ${items.map((it) => `<button class="dock-b" data-tab="${it.key}"><svg viewBox="0 0 24 24" aria-hidden="true">${it.icon}</svg><span>${it.label}</span></button>`).join('')}`;
  nav.style.setProperty('--n', String(items.length));
  document.body.appendChild(nav);
  const cv = nav.querySelector('canvas')!, c = cv.getContext('2d')!;
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>('.dock-b')];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, dpr = 1, at = -1, from = 0, to = 0, t0 = 0, raf = 0, last = 0, clock = 0, flash = 0, landed = -1;
  const sparks: { x: number; y: number; vx: number; vy: number; t: number; life: number }[] = [];
  let vis = items.map((x) => x.key);
  const slot = (i: number) => (W / vis.length) * (i + 0.5);

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = nav.clientWidth;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function bar() {
    c.beginPath();
    c.moveTo(R, TOP); c.lineTo(W - R, TOP); c.quadraticCurveTo(W, TOP, W, TOP + R); c.lineTo(W, H - R); c.quadraticCurveTo(W, H, W - R, H);
    c.lineTo(R, H); c.quadraticCurveTo(0, H, 0, H - R); c.lineTo(0, TOP + R); c.quadraticCurveTo(0, TOP, R, TOP); c.closePath();
  }

  function frame(now: number) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; clock += dt;
    if (!W) size();
    const u = calm() ? 1 : Math.min(1, (now - t0) / 480);
    const x = from + (to - from) * ease(u);
    if (u >= 1 && landed !== t0) {
      landed = t0;
      if (!calm() && from !== to) {
        flash = 1;
        for (let i = 0; i < 30; i++) { const a = -Math.PI * Math.random(), v = 60 + Math.random() * 200; sparks.push({ x: to, y: TOP, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: 0.3 + Math.random() * 0.4 }); }
      }
    }
    flash = Math.max(0, flash - dt * 2.2);
    const breathe = calm() ? 1 : 0.85 + 0.15 * Math.sin(clock * 2.4);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // the glass
    bar();
    const g = c.createLinearGradient(0, TOP, 0, H);
    g.addColorStop(0, 'rgba(24, 33, 52, .97)'); g.addColorStop(1, 'rgba(5, 8, 14, .98)');
    c.fillStyle = g; c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 26; c.shadowOffsetY = 10; c.fill();
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.save(); bar(); c.clip();
    c.globalCompositeOperation = 'lighter';
    // the beam: from a narrow slit in the edge, widening onto the open tab
    const bw = 22, fw = Math.min(W / vis.length * 0.92, 110);
    const beam = c.createLinearGradient(0, TOP, 0, H);
    beam.addColorStop(0, `rgba(170, 235, 255, ${(0.55 * breathe + 0.3 * flash).toFixed(3)})`);
    beam.addColorStop(0.5, `rgba(72, 207, 255, ${(0.2 * breathe).toFixed(3)})`);
    beam.addColorStop(1, 'rgba(22, 119, 255, 0.04)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(x - bw / 2, TOP); c.lineTo(x + bw / 2, TOP); c.lineTo(x + fw / 2, H); c.lineTo(x - fw / 2, H); c.closePath(); c.fill();
    // the pool of light at the foot of the beam
    const pool = c.createRadialGradient(x, H - 4, 0, x, H - 4, fw * 0.7);
    pool.addColorStop(0, `rgba(72, 207, 255, ${(0.28 * breathe).toFixed(3)})`); pool.addColorStop(1, 'rgba(22, 119, 255, 0)');
    c.fillStyle = pool; c.fillRect(0, TOP, W, BAR);
    // the streak the beam leaves while it sweeps
    if (u < 1 && from !== to) {
      const sg = c.createLinearGradient(from, 0, x, 0);
      sg.addColorStop(0, 'rgba(72, 207, 255, 0)'); sg.addColorStop(1, 'rgba(200, 242, 255, .9)');
      c.fillStyle = sg; c.fillRect(Math.min(from, x), TOP, Math.abs(x - from), 5);
    }
    c.restore();
    // the neon edge, flaring over the open tab
    const ng = c.createLinearGradient(0, 0, W, 0);
    const k = Math.max(0.001, Math.min(0.999, x / W)), spread = 0.16;
    ng.addColorStop(0, 'rgba(22,119,255,.3)');
    ng.addColorStop(Math.max(0, k - spread), 'rgba(40,140,255,.45)');
    ng.addColorStop(k, '#e8f8ff');
    ng.addColorStop(Math.min(1, k + spread), 'rgba(40,140,255,.45)');
    ng.addColorStop(1, 'rgba(22,119,255,.3)');
    c.beginPath(); c.moveTo(R, TOP); c.lineTo(W - R, TOP);
    c.strokeStyle = ng; c.lineWidth = 2; c.lineCap = 'round'; c.shadowColor = 'rgba(72,207,255,1)'; c.shadowBlur = 14 + 10 * flash; c.stroke();
    // the flare itself: a bright slit where the beam leaves the edge
    c.globalCompositeOperation = 'lighter';
    const fl = c.createRadialGradient(x, TOP, 0, x, TOP, 34 + 26 * flash);
    fl.addColorStop(0, `rgba(230, 248, 255, ${(0.9 * breathe).toFixed(3)})`); fl.addColorStop(0.3, 'rgba(72, 207, 255, .45)'); fl.addColorStop(1, 'rgba(22, 119, 255, 0)');
    c.shadowBlur = 0; c.fillStyle = fl;
    c.save(); c.translate(x, TOP); c.scale(1, 0.32); c.beginPath(); c.arc(0, 0, 34 + 26 * flash, 0, Math.PI * 2); c.restore(); c.fill();
    if (!calm()) {
      // two comets along the edge
      for (const [speed, phase] of [[0.2, 0], [-0.15, 0.5]] as const) {
        const head = (((clock * speed + phase) % 1) + 1) % 1;
        for (let j = 0; j < 16; j++) {
          const uu = head - Math.sign(speed) * j * 0.007;
          if (uu < 0 || uu > 1) continue;
          c.fillStyle = `rgba(200,242,255,${(0.85 * (1 - j / 16)).toFixed(3)})`;
          c.beginPath(); c.arc(R + uu * (W - 2 * R), TOP, 2.2 * (1 - j / 20), 0, Math.PI * 2); c.fill();
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!;
        p.t += dt; if (p.t > p.life) { sparks.splice(i, 1); continue; }
        p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.strokeStyle = `rgba(190,240,255,${(1 - p.t / p.life).toFixed(3)})`; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    if (!document.hidden && !calm()) raf = requestAnimationFrame(frame);
    else raf = 0;
  }
  function kick() { if (!raf && !calm()) { last = 0; raf = requestAnimationFrame(frame); } }
  addEventListener('resize', () => { size(); from = to = slot(Math.max(0, at)); if (calm()) frame(performance.now()); else kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  return {
    /** Shows tab i as open: the beam sweeps there from where it was. */
    set(i: number) {
      nav.classList.add('ready');
      if (!W) size();
      if (i === at) { kick(); return; }
      const first = at < 0;
      at = i;
      from = first ? slot(i) : to; to = slot(i);
      t0 = performance.now();
      const key = vis[i];
      buttons.forEach((b) => {
        const on = b.dataset['tab'] === key;
        b.classList.toggle('on', on);
        if (on) { b.setAttribute('aria-current', 'page'); if (!first) { b.classList.remove('lit'); void b.offsetWidth; b.classList.add('lit'); } }
        else b.removeAttribute('aria-current');
      });
      if (calm()) frame(performance.now()); else kick();
    },
    /** Which tabs are in the bar, in order (the Carb tab comes and goes with carb cycling). */
    show(keys: string[]) {
      if (keys.join() === vis.join()) return;
      vis = keys;
      buttons.forEach((b) => { b.hidden = !keys.includes(b.dataset['tab'] ?? ''); });
      nav.style.setProperty('--n', String(keys.length));
      at = -1;
    },
    /** Away while the profile is being set up. */
    hide() { nav.classList.remove('ready'); },
  };
}
