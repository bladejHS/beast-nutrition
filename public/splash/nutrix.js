/* NUTRIX, the opening (2026-11-20, the user: "o animație nouă, spectaculoasă, pentru specificul Beast Nutrition").
   About 3.3 s on one canvas, in the app's palette:
   0.0  the dark; nutrients stream in from every edge in the macro colours (protein blue, carbs amber, fat lilac)
        and spiral towards the centre;
   0.55 the three arcs of the macro ring draw themselves, each led by a comet, and swallow the stream;
   1.45 a fork and a chef's knife fly in from below, turning, and cross into the X;
   2.0  IMPACT: white flash, a shockwave, three claw marks torn behind the X, sparks, a short shake; the page stamps
        NUTRIX (onImpact);
   then the ring turns slowly, the core breathes, embers rise. burst() throws everything outwards on exit.
   API as splash/arena.js: NutrixIntro.create({ canvas, root, bg, onImpact }) -> { start(), still(T), burst(), destroy() }; still(T) draws one frame (T in s, 2.7 by default).
   The fork and knife geometry is a copy of scripts/nutrix-mark.mjs. */
(function () {
  'use strict';
  var FORK = 'M-11.75 -36V-61.5a2 2 0 0 1 4 0V-36Z M-5.25 -36V-61.5a2 2 0 0 1 4 0V-36Z M1.25 -36V-61.5a2 2 0 0 1 4 0V-36Z M7.75 -36V-61.5a2 2 0 0 1 4 0V-36Z' +
    'M-11.75 -38H11.75V-32Q11.75 -22 4 -17L3.6 -6H-3.6L-4 -17Q-11.75 -22 -11.75 -32Z M-4.6 -8H4.6V59.5a4.6 4.6 0 0 1 -9.2 0Z';
  var BLADE = 'M-6 8V-44Q-6 -60 5 -66Q7.5 -50 7.5 -30V8Z';
  var HANDLE = 'M-7 8H8.5V14H-7Z M-5.5 14H7V59a6.25 5 0 0 1 -12.5 0Z';
  var ARCS = [[[91, 155, 255], 0.3], [[240, 173, 87], 0.43], [[192, 132, 252], 0.27]];
  var GAP = 11 * Math.PI / 180, START = (-90 - 28) * Math.PI / 180;
  var VIOLET = [135, 89, 232], BRIGHT = [164, 122, 255], SOFT = [193, 168, 255];
  var IMPACT = 2.0, FLY = 0.55;

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)) + ')'; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(u) { return 1 - Math.pow(1 - u, 3); }
  function easeIn(u) { return u * u * u; }
  function easeInOut(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  // a fixed seed, so every launch is the same film
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  function create(o) {
    var cv = o.canvas, c = cv.getContext('2d'), root = o.root || document.body;
    var fork = new Path2D(FORK), blade = new Path2D(BLADE), handle = new Path2D(HANDLE);
    var w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 0, k = 1, raf = 0, t0 = 0, hit = false, out = -1, alive = true;
    var flow = [], sparks = [], embers = [];
    var rand = rng(20261120);

    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth || innerWidth; h = cv.clientHeight || innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cx = w / 2; cy = h * 0.4; R = Math.min(w * 0.34, h * 0.2, 190); k = (R / 86) * 0.98;
      root.style.setProperty('--ix', '50%'); root.style.setProperty('--iy', (cy / h * 100).toFixed(1) + '%');
    }
    size();

    // the stream: each nutrient leaves an edge, spirals in and lands on its own arc of the ring
    var n = Math.round(Math.min(360, Math.max(180, w * h / 2600)));
    for (var i = 0; i < n; i++) {
      var m = rand() < 0.3 ? 0 : rand() < 0.62 ? 1 : 2;
      var a0 = START, j;
      for (j = 0; j < m; j++) a0 += ARCS[j][1] * Math.PI * 2;
      var land = a0 + GAP / 2 + rand() * (ARCS[m][1] * Math.PI * 2 - GAP);
      flow.push({ m: m, land: land, spin: 1.8 + rand() * 2.4, d: rand() * 0.5, dur: 0.75 + rand() * 0.55, far: 0.75 + rand() * 0.45, s: 0.8 + rand() * 1.8 });
    }
    for (i = 0; i < 46; i++) embers.push({ x: rand(), y: rand(), v: 0.04 + rand() * 0.09, s: 0.6 + rand() * 1.6, p: rand() * 6.28 });

    function flowAt(p, t) {
      var u = clamp((t - p.d) / p.dur);
      var e = 1 - (1 - u) * (1 - u);
      var r = R + (Math.hypot(w, h) * 0.55 * p.far - R) * (1 - e);
      var a = p.land + p.spin * (1 - e);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, u: u };
    }

    function arcProgress(i, t) { return easeOut(clamp((t - 0.55 - i * 0.16) / 0.62)); }

    function drawRing(t, spin, fade) {
      var a = START + spin;
      c.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        var col = ARCS[i][0], span = ARCS[i][1] * Math.PI * 2 - GAP, p = arcProgress(i, t);
        var s0 = a + GAP / 2, s1 = s0 + span * p;
        if (p > 0.001) {
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = rgba(col, 0.18 * fade); c.lineWidth = R * 0.34; c.beginPath(); c.arc(cx, cy, R, s0, s1); c.stroke();
          c.globalCompositeOperation = 'source-over';
          c.strokeStyle = rgba(col, fade); c.lineWidth = R * 0.15; c.beginPath(); c.arc(cx, cy, R, s0, s1); c.stroke();
          c.strokeStyle = rgba([255, 255, 255], 0.5 * fade); c.lineWidth = R * 0.035; c.beginPath(); c.arc(cx, cy, R - R * 0.03, s0, s1); c.stroke();
          if (p < 1) { // the comet at the head of the arc
            var hx = cx + Math.cos(s1) * R, hy = cy + Math.sin(s1) * R;
            var g = c.createRadialGradient(hx, hy, 0, hx, hy, R * 0.42);
            g.addColorStop(0, 'rgba(255,255,255,' + fade + ')'); g.addColorStop(0.2, rgba(col, 0.9 * fade)); g.addColorStop(1, rgba(col, 0));
            c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(hx, hy, R * 0.42, 0, 6.29); c.fill();
            c.globalCompositeOperation = 'source-over';
          }
        }
        a += ARCS[i][1] * Math.PI * 2;
      }
    }

    function drawUtensils(t, fade) {
      // they arrive together at IMPACT, from below the screen, turning into place; a ghost trail behind each
      var u = clamp((t - (IMPACT - FLY)) / FLY), e = easeIn(u);
      if (u <= 0) return;
      var ghosts = u < 1 ? 4 : 1;
      for (var gI = ghosts - 1; gI >= 0; gI--) {
        var eg = u < 1 ? easeIn(clamp(u - gI * 0.06)) : 1, alpha = (gI ? 0.16 / gI : 1) * fade;
        piece(fork, null, -1, eg, alpha);
        piece(blade, handle, 1, eg, alpha);
      }
      function piece(main, extra, side, eg, alpha) {
        var fromX = cx + side * w * 0.75, fromY = h + R * 1.6;
        var x = fromX + (cx - fromX) * eg, y = fromY + (cy + R * 0.01 - fromY) * eg;
        var rot = side * 38 * Math.PI / 180 + side * (1 - eg) * 2.6;
        c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.globalAlpha = alpha;
        var mg = c.createLinearGradient(0, -64, 0, 64);
        mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.45, '#e6dcff'); mg.addColorStop(1, '#8f84a8');
        c.shadowColor = rgba(VIOLET, 0.9); c.shadowBlur = 18 * k * dpr / dpr;
        c.fillStyle = mg; c.fill(main);
        c.shadowBlur = 0;
        c.strokeStyle = '#c1a8ff'; c.lineWidth = 0.9; c.stroke(main);
        if (extra) {
          c.strokeStyle = '#ffffff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(7.5, -30); c.quadraticCurveTo(7.5, -50, 5, -66); c.stroke();
          c.fillStyle = '#1c1230'; c.fill(extra); c.strokeStyle = '#c1a8ff'; c.lineWidth = 1.1; c.stroke(extra);
          c.fillStyle = '#a47aff'; [26, 40, 52].forEach(function (yy) { c.beginPath(); c.arc(0.75, yy, 1.9, 0, 6.29); c.fill(); });
        }
        c.restore();
      }
    }

    function drawClaws(t, fade) {
      // three slashes torn behind the X in the first 0.18 s after the impact, then they stay, glowing
      var u = clamp((t - IMPACT) / 0.18);
      if (u <= 0) return;
      c.save(); c.translate(cx, cy); c.scale(k, k); c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 3; i++) {
        var o = (i - 1) * 30, ui = clamp(u * 1.5 - i * 0.25);
        if (ui <= 0) continue;
        var x0 = -70 + o, y0 = -96, x1 = 62 + o, y1 = 100;
        var xe = x0 + (x1 - x0) * ui, ye = y0 + (y1 - y0) * ui;
        var g = c.createLinearGradient(x0, y0, x1, y1);
        var glow = 0.55 + 0.45 * Math.max(0, 1 - (t - IMPACT) / 0.6);
        g.addColorStop(0, rgba(BRIGHT, 0)); g.addColorStop(0.5, rgba(VIOLET, 0.85 * glow * fade)); g.addColorStop(1, rgba([104, 64, 197], 0));
        c.fillStyle = g;
        c.beginPath(); c.moveTo(x0, y0);
        c.quadraticCurveTo(-4 + o, -18, xe, ye);
        c.quadraticCurveTo(-22 + o, 4, x0, y0); c.fill();
      }
      c.restore();
    }

    function core(t, fade) {
      var on = clamp((t - 0.2) / 1.2), breathe = 1 + 0.06 * Math.sin(t * 3.1);
      var boost = t > IMPACT ? 1 + 1.2 * Math.max(0, 1 - (t - IMPACT) / 0.5) : 1;
      var r = R * 1.25 * breathe * (0.6 + 0.4 * on);
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(VIOLET, 0.55 * on * boost * fade)); g.addColorStop(0.45, rgba([50, 29, 92], 0.5 * on * fade)); g.addColorStop(1, 'rgba(5,5,5,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 6.29); c.fill();
      // the inner hairline, the plate
      c.strokeStyle = rgba([40, 40, 40], on * fade); c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R * 0.84, 0, 6.29); c.stroke();
    }

    function shockwave(t) {
      var u = (t - IMPACT) / 0.75;
      if (u < 0 || u > 1) return;
      var r = R + (Math.hypot(w, h) - R) * easeOut(u);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(SOFT, 0.7 * (1 - u)); c.lineWidth = 2 + 14 * (1 - u); c.beginPath(); c.arc(cx, cy, r, 0, 6.29); c.stroke();
      c.strokeStyle = rgba(VIOLET, 0.35 * (1 - u)); c.lineWidth = 30 * (1 - u); c.beginPath(); c.arc(cx, cy, r * 0.92, 0, 6.29); c.stroke();
      c.globalCompositeOperation = 'source-over';
    }

    function spray(count, speed) {
      for (var i = 0; i < count; i++) {
        var a = rand() * 6.283, v = speed * (0.35 + rand());
        var pick = rand(), col = pick < 0.25 ? ARCS[0][0] : pick < 0.5 ? ARCS[1][0] : pick < 0.7 ? ARCS[2][0] : pick < 0.9 ? BRIGHT : [255, 255, 255];
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rand() * 0.7, age: 0, col: col, s: 1 + rand() * 2.2 });
      }
    }

    var last = 0;
    function frame(t, dt) {
      var shake = t > IMPACT ? Math.max(0, 1 - (t - IMPACT) / 0.3) : 0;
      var exitU = out < 0 ? 0 : clamp((t - out) / 0.45), fade = 1 - exitU;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (shake) c.translate((rand() - 0.5) * 14 * shake, (rand() - 0.5) * 14 * shake);
      if (exitU) { c.translate(cx, cy); c.scale(1 + exitU * 0.5, 1 + exitU * 0.5); c.translate(-cx, -cy); }

      core(t, fade);
      // the stream
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < flow.length; i++) {
        var p = flow[i];
        if (t < p.d || t > p.d + p.dur + 0.15) continue;
        var now = flowAt(p, t), prev = flowAt(p, t - 0.05), col = ARCS[p.m][0];
        var a = now.u < 1 ? Math.min(1, now.u * 4) : Math.max(0, 1 - (t - p.d - p.dur) / 0.15);
        c.strokeStyle = rgba(col, 0.75 * a); c.lineWidth = p.s; c.lineCap = 'round';
        c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(now.x, now.y); c.stroke();
        c.fillStyle = rgba([255, 255, 255], 0.8 * a); c.beginPath(); c.arc(now.x, now.y, p.s * 0.6, 0, 6.29); c.fill();
      }
      c.globalCompositeOperation = 'source-over';

      var spin = t > IMPACT ? (t - IMPACT) * 0.22 : 0;
      drawClaws(t, fade);
      drawRing(t, spin, fade);
      drawUtensils(t, fade);
      shockwave(t);

      // embers rise after the impact
      if (t > IMPACT) {
        var e = clamp((t - IMPACT) / 0.6);
        c.globalCompositeOperation = 'lighter';
        for (i = 0; i < embers.length; i++) {
          var em = embers[i], yy = ((em.y - (t - IMPACT) * em.v) % 1 + 1) % 1;
          c.fillStyle = rgba(i % 3 ? BRIGHT : ARCS[i % 3 === 0 ? 1 : 0][0], 0.5 * e * fade * (0.5 + 0.5 * Math.sin(t * 4 + em.p)));
          c.beginPath(); c.arc(em.x * w, yy * h, em.s, 0, 6.29); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
      // sparks
      c.globalCompositeOperation = 'lighter';
      for (i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i]; s.age += dt;
        if (s.age > s.life) { sparks.splice(i, 1); continue; }
        var px = s.x, py = s.y; s.vx *= 0.985; s.vy = s.vy * 0.985 + 60 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        c.strokeStyle = rgba(s.col, 1 - s.age / s.life); c.lineWidth = s.s;
        c.beginPath(); c.moveTo(px, py); c.lineTo(s.x, s.y); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      if (!alive) return;
      var t = (now - t0) / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t;
      if (o.bg) o.bg.style.opacity = String(clamp(t / 0.8) * 0.85);
      if (!hit && t >= IMPACT) {
        hit = true; spray(110, Math.max(w, h) * 0.9);
        if (o.onImpact) try { o.onImpact(); } catch (e) { /* the page's part */ }
      }
      frame(t, dt);
      raf = requestAnimationFrame(loop);
    }

    function onResize() { size(); }
    addEventListener('resize', onResize);

    return {
      start: function () { t0 = performance.now(); last = 0; raf = requestAnimationFrame(loop); },
      // the poster for reduced motion and the short intro: the finished emblem, no motion
      still: function (T) {
        if (o.bg) o.bg.style.opacity = '0.85';
        frame(T == null ? 2.7 : T, 0); sparks.length = 0;
      },
      burst: function () { if (out >= 0 || !t0) return; out = (performance.now() - t0) / 1000; spray(140, Math.max(w, h) * 1.2); },
      destroy: function () { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); }
    };
  }

  window.NutrixIntro = { create: create };
})();
