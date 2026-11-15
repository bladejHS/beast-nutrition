/* The dock (2026-11-15, reworked 2026-11-16). The user, three times: the tab bar must be spectacular; then "nu-mi
   place bila aia", so no orb. Built once, outside #app, so it lives across screens and can move:
   - a glass bar drawn on a canvas; its top edge is a neon line with two comets of light running along it;
   - over the open tab the neon flares and a beam of light falls from the edge onto it, like a spotlight on a stage;
   - changing tab, the flare and the beam sweep to the new tab, the edge bends toward it like a plucked string and
     settles, sparks fly where the beam lands, and the light takes the tab's own colour on the way;
   - each icon has its own small act when its tab opens (the clock's hands turn to the real hour, the fork and the
     knife clink, the book's page turns, the scale's needle swings, the flame catches);
   - the bar shows the day without opening anything (2026-11-16): a ring of the calories eaten round Azi (gold on a
     perfect day), the weight's trend on Corp, a dot on Mese when a meal is due;
   - it answers what happens: food added sends a wave along the edge into Azi, a perfect day or a trophy turns the
     neon gold for a while, a weighing flashes Corp;
   - optional (Mai mult): a sheen on the glass that follows the phone's tilt.
   Reduced motion: the bar and the beam, still; no comets, no acts, the beam moves at once. */

export interface DockItem { key: string; label: string; icon: string }
export interface DockLive { kcal: number; perfect: boolean; trend: -1 | 0 | 1 | null; soon: boolean }

const TOP = 14, BAR = 62, H = TOP + BAR, R = 24;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** Each tab's light: [base, hot]. */
const COLOR: Record<string, [number[], number[]]> = {
  azi: [[22, 119, 255], [150, 228, 255]],
  mese: [[40, 170, 255], [160, 236, 255]],
  cicl: [[255, 120, 30], [255, 205, 140]],
  cook: [[230, 165, 50], [255, 228, 160]],
  corp: [[20, 200, 185], [150, 255, 236]],
  fuel: [[110, 120, 255], [205, 210, 255]],
};
const GOLD: [number[], number[]] = [[230, 165, 50], [255, 236, 180]];
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * k));
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export function makeDock(items: DockItem[]) {
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.setAttribute('aria-label', 'Navigare');
  nav.innerHTML = `<canvas class="dock-cv" aria-hidden="true"></canvas>
    ${items.map((it) => `<button class="dock-b" data-tab="${it.key}"><span class="dk-ic">${it.key === 'azi' ? '<svg class="dk-ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="dk-rt" cx="20" cy="20" r="17"/><circle class="dk-rv" cx="20" cy="20" r="17" pathLength="100"/></svg>' : ''}<svg viewBox="0 0 24 24" aria-hidden="true">${it.icon}</svg>${it.key === 'corp' ? '<i class="dk-badge" aria-hidden="true"></i>' : ''}${it.key === 'mese' ? '<i class="dk-dot" aria-hidden="true"></i>' : ''}</span><span class="dk-l">${it.label}</span></button>`).join('')}`;
  nav.style.setProperty('--n', String(items.length));
  document.body.appendChild(nav);
  const cv = nav.querySelector('canvas')!, c = cv.getContext('2d')!;
  const buttons = [...nav.querySelectorAll<HTMLButtonElement>('.dock-b')];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, dpr = 1, at = -1, from = 0, to = 0, t0 = 0, raf = 0, last = 0, clock = 0, flash = 0, landed = -1;
  let colFrom = COLOR['azi']!, colTo = COLOR['azi']!;
  let gold = 0, wave = -1, weighFlash = 0, tilt: number | null = null;
  const sparks: { x: number; y: number; vx: number; vy: number; t: number; life: number }[] = [];
  let vis = items.map((x) => x.key);
  const slot = (i: number) => (W / vis.length) * (i + 0.5);
  const slotOf = (key: string) => { const i = vis.indexOf(key); return i < 0 ? -1 : slot(i); };

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
    const eu = ease(u);
    const x = from + (to - from) * eu;
    if (u >= 1 && landed !== t0) {
      landed = t0;
      if (!calm() && from !== to) {
        flash = 1;
        for (let i = 0; i < 30; i++) { const a = -Math.PI * Math.random(), v = 60 + Math.random() * 200; sparks.push({ x: to, y: TOP, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: 0.3 + Math.random() * 0.4 }); }
      }
    }
    flash = Math.max(0, flash - dt * 2.2);
    gold = Math.max(0, gold - dt / 8);
    weighFlash = Math.max(0, weighFlash - dt * 1.1);
    const breathe = calm() ? 1 : 0.85 + 0.15 * Math.sin(clock * 2.4);
    // the light of the tab, on its way from the last one, turned gold for a while after a win
    const gk = Math.min(1, gold * 2);
    const base = mix(mix(colFrom[0], colTo[0], eu), GOLD[0], gk), hot = mix(mix(colFrom[1], colTo[1], eu), GOLD[1], gk);
    nav.style.setProperty('--dc', `${hot[0]}, ${hot[1]}, ${hot[2]}`);
    nav.style.setProperty('--db', `${base[0]}, ${base[1]}, ${base[2]}`);

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
    // the sheen that follows the phone's tilt
    if (tilt != null) {
      const sx = W / 2 + (tilt / 40) * (W / 2);
      const sh = c.createLinearGradient(sx - 90, 0, sx + 90, H);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(210,235,255,.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sh; c.fillRect(0, TOP, W, BAR);
    }
    // the beam: from a narrow slit in the edge, widening onto the open tab
    const bw = 22, fw = Math.min(W / vis.length * 0.92, 110);
    const beam = c.createLinearGradient(0, TOP, 0, H);
    beam.addColorStop(0, rgba(hot, 0.55 * breathe + 0.3 * flash));
    beam.addColorStop(0.5, rgba(base, 0.24 * breathe));
    beam.addColorStop(1, rgba(base, 0.04));
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(x - bw / 2, TOP); c.lineTo(x + bw / 2, TOP); c.lineTo(x + fw / 2, H); c.lineTo(x - fw / 2, H); c.closePath(); c.fill();
    const pool = c.createRadialGradient(x, H - 4, 0, x, H - 4, fw * 0.7);
    pool.addColorStop(0, rgba(base, 0.3 * breathe)); pool.addColorStop(1, rgba(base, 0));
    c.fillStyle = pool; c.fillRect(0, TOP, W, BAR);
    // a weighing: Corp flashes
    const cx = slotOf('corp');
    if (weighFlash > 0 && cx >= 0) {
      const wf = c.createRadialGradient(cx, TOP + 8, 0, cx, TOP + 8, 70);
      wf.addColorStop(0, rgba(COLOR['corp']![1], 0.8 * weighFlash)); wf.addColorStop(1, rgba(COLOR['corp']![0], 0));
      c.fillStyle = wf; c.fillRect(0, TOP, W, BAR);
    }
    // the streak the beam leaves while it sweeps
    if (u < 1 && from !== to) {
      const sg = c.createLinearGradient(from, 0, x, 0);
      sg.addColorStop(0, rgba(base, 0)); sg.addColorStop(1, rgba(hot, 0.9));
      c.fillStyle = sg; c.fillRect(Math.min(from, x), TOP, Math.abs(x - from), 5);
    }
    c.restore();

    // the neon edge: it bends toward the new tab like a plucked string, then settles
    const ts = (now - t0) / 1000;
    const amp = calm() || from === to ? 0 : 7 * Math.exp(-4.5 * ts) * Math.sin(13 * ts);
    const yAt = (px: number) => TOP + amp * Math.exp(-(((px - x) / 56) ** 2));
    const ng = c.createLinearGradient(0, 0, W, 0);
    const k = Math.max(0.001, Math.min(0.999, x / W)), spread = 0.16;
    ng.addColorStop(0, rgba(base, 0.3));
    ng.addColorStop(Math.max(0, k - spread), rgba(base, 0.5));
    ng.addColorStop(k, rgba(mix(hot, [255, 255, 255], 0.6), 1));
    ng.addColorStop(Math.min(1, k + spread), rgba(base, 0.5));
    ng.addColorStop(1, rgba(base, 0.3));
    c.beginPath();
    for (let px = R; px <= W - R; px += 5) { if (px === R) c.moveTo(px, yAt(px)); else c.lineTo(px, yAt(px)); }
    c.strokeStyle = ng; c.lineWidth = 2 + gk; c.lineCap = 'round'; c.shadowColor = rgba(hot, 1); c.shadowBlur = 14 + 10 * flash + 10 * gk; c.stroke();
    // the flare: a bright slit where the beam leaves the edge
    c.globalCompositeOperation = 'lighter';
    const fy = yAt(x);
    const fl = c.createRadialGradient(x, fy, 0, x, fy, 34 + 26 * flash);
    fl.addColorStop(0, rgba(mix(hot, [255, 255, 255], 0.5), 0.9 * breathe)); fl.addColorStop(0.3, rgba(hot, 0.45)); fl.addColorStop(1, rgba(base, 0));
    c.shadowBlur = 0; c.fillStyle = fl;
    c.save(); c.translate(x, fy); c.scale(1, 0.32); c.beginPath(); c.arc(0, 0, 34 + 26 * flash, 0, Math.PI * 2); c.restore(); c.fill();
    if (!calm()) {
      // comets along the edge; gold and more of them after a win
      const comets: Array<[number, number]> = gk > 0.05 ? [[0.32, 0], [-0.28, 0.33], [0.24, 0.66], [-0.2, 0.15]] : [[0.2, 0], [-0.15, 0.5]];
      for (const [speed, phase] of comets) {
        const head = (((clock * speed + phase) % 1) + 1) % 1;
        for (let j = 0; j < 16; j++) {
          const uu = head - Math.sign(speed) * j * 0.007;
          if (uu < 0 || uu > 1) continue;
          const px = R + uu * (W - 2 * R);
          c.fillStyle = rgba(mix(hot, [255, 255, 255], 0.4), 0.85 * (1 - j / 16));
          c.beginPath(); c.arc(px, yAt(px), 2.2 * (1 - j / 20), 0, Math.PI * 2); c.fill();
        }
      }
      // food added: a wave of light runs along the edge into Azi
      const ax = slotOf('azi');
      if (wave >= 0 && ax >= 0) {
        wave += dt / 0.75;
        if (wave >= 1) {
          wave = -1;
          const b = buttons.find((x) => x.dataset['tab'] === 'azi');
          if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
          for (let i = 0; i < 18; i++) { const a = -Math.PI * Math.random(), v = 50 + Math.random() * 150; sparks.push({ x: ax, y: TOP, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.25 + Math.random() * 0.3 }); }
        } else {
          const start = W - 28, wx = start + (ax - start) * ease(wave);
          for (let j = 0; j < 22; j++) {
            const px = wx + (start > ax ? 1 : -1) * j * 4;
            c.fillStyle = rgba([180, 240, 255], 0.9 * (1 - j / 22));
            c.beginPath(); c.arc(px, TOP - 1, 3 * (1 - j / 26), 0, Math.PI * 2); c.fill();
          }
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!;
        p.t += dt; if (p.t > p.life) { sparks.splice(i, 1); continue; }
        p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.strokeStyle = rgba(mix(hot, [255, 255, 255], 0.3), 1 - p.t / p.life); c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    if (!document.hidden && !calm()) raf = requestAnimationFrame(frame);
    else raf = 0;
  }
  function kick() { if (!raf && !calm()) { last = 0; raf = requestAnimationFrame(frame); } else if (calm()) frame(performance.now()); }
  addEventListener('resize', () => { size(); from = to = slot(Math.max(0, at)); kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  /** The clock's hands at the real hour (the act turns them there). */
  function hands() {
    const d = new Date();
    const b = buttons.find((x) => x.dataset['tab'] === 'azi');
    b?.style.setProperty('--ma', `${d.getMinutes() * 6}deg`);
    b?.style.setProperty('--ha', `${(d.getHours() % 12) * 30 + d.getMinutes() / 2}deg`);
  }
  hands();
  window.setInterval(hands, 60000);

  return {
    /** Shows tab i as open: the beam sweeps there from where it was. */
    set(i: number) {
      nav.classList.add('ready');
      if (!W) size();
      if (i === at) { kick(); return; }
      const first = at < 0;
      const key = vis[i] ?? 'azi';
      colFrom = first ? COLOR[key] ?? COLOR['azi']! : colTo;
      colTo = COLOR[key] ?? COLOR['azi']!;
      at = i;
      from = first ? slot(i) : to; to = slot(i);
      t0 = performance.now();
      hands();
      buttons.forEach((b) => {
        const on = b.dataset['tab'] === key;
        b.classList.toggle('on', on);
        if (on) { b.setAttribute('aria-current', 'page'); if (!first) { b.classList.remove('lit'); void b.offsetWidth; b.classList.add('lit'); } }
        else b.removeAttribute('aria-current');
      });
      kick();
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
    /** The day in the bar: calories round Azi, the trend on Corp, a meal due on Mese. */
    live(d: DockLive) {
      const rv = nav.querySelector<SVGCircleElement>('.dk-rv');
      if (rv) rv.style.strokeDashoffset = String(100 - Math.min(1, Math.max(0, d.kcal)) * 100);
      nav.classList.toggle('perfect', d.perfect);
      nav.classList.toggle('over', d.kcal > 1.05);
      const badge = nav.querySelector<HTMLElement>('.dk-badge');
      if (badge) { badge.className = `dk-badge${d.trend == null ? '' : d.trend < 0 ? ' down' : d.trend > 0 ? ' up' : ' flat'}`; }
      nav.querySelector('.dk-dot')?.classList.toggle('on', d.soon);
    },
    /** The bar answers: food added, a win, a weighing. */
    pulse(kind: 'add' | 'gold' | 'weigh') {
      if (calm()) return;
      if (kind === 'add') wave = 0;
      if (kind === 'gold') gold = 1;
      if (kind === 'weigh') weighFlash = 1;
      kick();
    },
    /** The tilt sheen (on in Mai mult): the side-to-side angle of the phone, null to stop. */
    tilt(v: number | null) { tilt = v; kick(); },
  };
}
