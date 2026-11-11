/* BEAST FORGE — the opening shared by the Beast apps, 2026-11-11.
   The mark is forged out of light: embers drift in the dark, then a few thousand sparks stream in from the edges of
   the screen and lock into the wolf; the impact flashes and shakes, the real mark fades in over the sparks; at the
   exit the sparks blow outward. Each app gives its colour, its mark and its stage. One canvas, 2D, additive blending,
   capped at 2× pixels and 60 fps; the whole thing stops on destroy().
   Usage: var f = BeastForge.create({ canvas, mark: 'splash/umbra.webp', stage: element, color: [r,g,b], hot: [r,g,b],
          count: 2400, onImpact: fn, origin: 'ring' | 'left' | 'right', filter: function (u, v) { return bool; } });
          f.start();  f.burst();  f.destroy();  (origin: where the sparks come from; filter: which part of the mark they forge)
   Timeline from start(): 0–0.45 embers; 0.45–1.25 the stream; 1.25 impact (onImpact fires); hold with a slow pulse. */
(function () {
  'use strict';
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  function create(o) {
    var cv = o.canvas, ctx = cv.getContext('2d', { alpha: true });
    var color = o.color || [229, 16, 44], hot = o.hot || [255, 41, 68], white = [255, 244, 236];
    var COUNT = o.count || 2400, EMBERS = 46;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, pts = [], embers = [], ready = false, t0 = 0, raf = 0, live = false, burstAt = 0, impacted = false;
    var stage = { x: 0, y: 0, w: 0, h: 0 };

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var r = o.stage && o.stage.getBoundingClientRect();
      if (r && r.width) stage = { x: r.left, y: r.top, w: r.width, h: r.height };
      else stage = { x: W / 2 - 150, y: H * 0.42 - 176, w: 300, h: 353 };
    }

    // The mark's opaque pixels become the targets; its lit pixels (the rim, the eyes) get the brightest sparks.
    function sample(img) {
      var SW = 136, SH = Math.round(SW * img.height / img.width);
      var c = document.createElement('canvas'); c.width = SW; c.height = SH;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, SW, SH);
      var d = g.getImageData(0, 0, SW, SH).data, all = [], i, x, y, a, l;
      for (y = 0; y < SH; y++) for (x = 0; x < SW; x++) {
        i = (y * SW + x) * 4; a = d[i + 3];
        if (a < 120) continue;
        if (o.filter && !o.filter((x + 0.5) / SW, (y + 0.5) / SH)) continue;
        l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        all.push({ u: (x + 0.5) / SW, v: (y + 0.5) / SH, lit: l > 40 ? Math.min(1, l / 150) : 0 });
      }
      // keep every lit pixel, then fill up with dark ones at random
      var litOnes = all.filter(function (p) { return p.lit > 0; }), dark = all.filter(function (p) { return !p.lit; });
      var out = litOnes.slice(0, COUNT);
      while (out.length < COUNT && dark.length) out.push(dark.splice(Math.floor(Math.random() * dark.length), 1)[0]);
      var R = Math.hypot(W, H) * 0.62;
      var origin = o.origin || 'ring';
      pts = out.map(function (p) {
        var ang = rnd(0, Math.PI * 2), dist = R * rnd(0.55, 1.05), sx, sy;
        if (origin === 'left') { sx = -W * rnd(0.05, 0.6); sy = rnd(-0.1, 1.1) * H; }
        else if (origin === 'right') { sx = W + W * rnd(0.05, 0.6); sy = rnd(-0.1, 1.1) * H; }
        else { sx = W / 2 + Math.cos(ang) * dist; sy = H * 0.42 + Math.sin(ang) * dist; }
        return {
          u: p.u, v: p.v, lit: p.lit,
          sx: sx, sy: sy,
          d: rnd(0, 0.34) + (p.lit ? 0.08 : 0), curl: rnd(-1, 1) * 90, s: p.lit ? rnd(1.4, 2.6) : rnd(0.9, 1.6),
          px: 0, py: 0, vx: 0, vy: 0, ph: rnd(0, Math.PI * 2)
        };
      });
      for (i = 0; i < EMBERS; i++) embers.push({ x: rnd(0, 1), y: rnd(0.3, 1.2), s: rnd(1, 2.6), v: rnd(0.025, 0.07), ph: rnd(0, 6.3), a: rnd(0.25, 0.7) });
      ready = true;
    }

    function target(p) { return [stage.x + p.u * stage.w, stage.y + p.v * stage.h]; }

    function frame(now) {
      if (!live) return;
      raf = requestAnimationFrame(frame);
      var t = (now - t0) / 1000, i, p, k, tx, ty, a, x, y, since;
      ctx.clearRect(0, 0, W, H);
      if (!ready) return;
      var shake = 0;
      if (impacted) { since = t - 1.25; if (since < 0.3) shake = (1 - since / 0.3) * 9; }
      ctx.save();
      if (shake) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
      ctx.globalCompositeOperation = 'lighter';

      // embers: slow, rising, always there until the exit
      var eA = burstAt ? Math.max(0, 1 - (t - burstAt) / 0.4) : Math.min(1, t / 0.5);
      for (i = 0; i < embers.length; i++) {
        p = embers[i];
        y = (p.y - t * p.v) % 1.15; if (y < 0) y += 1.15;
        x = p.x + Math.sin(t * 0.7 + p.ph) * 0.012;
        ctx.fillStyle = rgba(color, p.a * eA * (0.5 + 0.5 * Math.sin(t * 2 + p.ph)));
        ctx.fillRect(x * W, y * H - 0.1 * H, p.s, p.s);
      }

      if (burstAt) {
        // the exit: every spark flies out from the mark, fading
        since = t - burstAt;
        a = Math.max(0, 1 - since / 0.5);
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          x = p.px + p.vx * since + p.vx * since * since * 1.6; y = p.py + p.vy * since + p.vy * since * since * 1.6;
          ctx.fillStyle = rgba(p.lit ? white : hot, a * (p.lit ? 0.9 : 0.55));
          ctx.fillRect(x, y, p.s, p.s);
        }
        ctx.restore();
        if (a <= 0) { live = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); }
        return;
      }

      var STREAM = 0.45, DUR = 0.72;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        k = ease((t - STREAM - p.d) / DUR);
        if (k <= 0) continue;
        tx = stage.x + p.u * stage.w; ty = stage.y + p.v * stage.h;
        if (k < 1) {
          // a curved approach, then straight home; a trail behind each spark
          var cx = (p.sx + tx) / 2 - (ty - p.sy) * 0.001 * p.curl, cy = (p.sy + ty) / 2 + (tx - p.sx) * 0.001 * p.curl;
          var m = 1 - k;
          x = m * m * p.sx + 2 * m * k * cx + k * k * tx; y = m * m * p.sy + 2 * m * k * cy + k * k * ty;
          ctx.strokeStyle = rgba(p.lit ? white : color, 0.35 * (1 - k) + 0.1);
          ctx.lineWidth = p.s * 0.8;
          ctx.beginPath(); ctx.moveTo(p.px || x, p.py || y); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = rgba(p.lit ? white : hot, p.lit ? 0.95 : 0.7);
          ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
        } else {
          // locked in: a slow breath, and a dim after the real mark is in
          var dimmed = impacted ? Math.max(0.28, 1 - (t - 1.25) * 1.4) : 1;
          var j = Math.sin(t * 5 + p.ph) * 0.4;
          x = tx + j; y = ty - j;
          a = (p.lit ? 0.95 : 0.4) * dimmed * (0.85 + 0.15 * Math.sin(t * 2.4 + p.ph));
          ctx.fillStyle = rgba(p.lit ? white : hot, a);
          ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
        }
        p.px = x; p.py = y;
      }

      if (!impacted && t >= 1.25) {
        impacted = true;
        for (i = 0; i < pts.length; i++) { p = pts[i]; if (!p.px) { var tt = target(p); p.px = tt[0]; p.py = tt[1]; } }
        if (o.onImpact) o.onImpact();
      }
      if (impacted) {
        // the shock ring
        since = t - 1.25;
        if (since < 0.7) {
          var r = 40 + ease(since / 0.7) * Math.max(W, H) * 0.7;
          ctx.strokeStyle = rgba(hot, (1 - since / 0.7) * 0.9); ctx.lineWidth = 3 - since * 3;
          ctx.beginPath(); ctx.arc(stage.x + stage.w / 2, stage.y + stage.h * 0.46, r, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    }

    var img = new Image();
    img.onload = function () { try { size(); sample(img); } catch (e) { ready = false; } };
    img.onerror = function () { ready = false; };
    img.src = o.mark;
    addEventListener('resize', size);

    return {
      start: function () { size(); live = true; t0 = performance.now(); raf = requestAnimationFrame(frame); },
      /** The sparks blow outward from where they sit. */
      burst: function () {
        if (!live || burstAt) return;
        var now = (performance.now() - t0) / 1000, cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.46, i, p, dx, dy, l;
        for (i = 0; i < pts.length; i++) {
          p = pts[i]; if (!p.px) { var tt = target(p); p.px = tt[0]; p.py = tt[1]; }
          dx = p.px - cx; dy = p.py - cy; l = Math.hypot(dx, dy) || 1;
          var sp = rnd(260, 820);
          p.vx = dx / l * sp + rnd(-60, 60); p.vy = dy / l * sp + rnd(-60, 60);
        }
        burstAt = now;
      },
      /** Still picture for the calm mode: the sparks sit on the mark, no motion. */
      still: function () { size(); live = true; t0 = performance.now() - 1300; impacted = true; raf = requestAnimationFrame(frame); },
      destroy: function () { live = false; cancelAnimationFrame(raf); removeEventListener('resize', size); ctx.clearRect(0, 0, W, H); }
    };
  }
  window.BeastForge = { create: create };
})();
