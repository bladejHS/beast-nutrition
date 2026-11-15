/* THE ARENA (2026-11-15), the opening the user asked for: "doi luptători care se bat, cineva care aleargă și cineva
   care face tracțiuni, flotări, iar în spate lupul care se uită la ei; ceva spectaculos".
   Shared by Inner Beast (red) and Beast Nutrition (blue); the master copy is inner-beast/public/splash/arena.js.

   One canvas, drawn by hand, no footage: backlit silhouettes with a rim of the app's colour, in the haze of one
   spotlight. The wolf is the page's own image (the .sp-stage element behind the canvas), so at the end it can fly
   home into the tab bar. Scene time T, in seconds:
     0    darkness; the wolf's eyes light up
     .35  the light rises: the wolf watches, the arena fills; pull-ups on the left, push-ups on the right, a runner
          crosses behind
     1.0  the two fighters trade: jab (parried), cross (blocked), a jab back (slipped)
     2.0  the rear high kick lands: flash, sparks, shock ring, the camera shakes, time slows for a moment, the eyes
          flare; the page stamps the name (onImpact)
     2.4  the fighters reset; the page leaves when it wants (about 3.3 s)
   API: BeastArena.create(opts) → { start(), still(T), burst(), destroy() }
   opts: canvas, stage (the wolf element; .sp-emb and .sp-eye inside), bg (the light layer), root (#splash),
         color [r,g,b], hot [r,g,b], onImpact(). */
(function () {
  'use strict';
  var R = Math.PI / 180;
  // body proportions in units, as ui/boxer.ts: angle 0 points down, 90 forward (the way the figure faces), 180 up
  var TORSO = 24, NECK = 6.5, HEAD = 5.4, UP = 12, FORE = 11, TH = 16, SH = 16, HIPY = 31;
  var IMPACT = 2.0;

  function st(p, a, l) { return [p[0] + Math.sin(a * R) * l, p[1] + Math.cos(a * R) * l]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function mix(a, b, u) { return a + (b - a) * u; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }

  // ---- the fighters' poses -------------------------------------------------------------------------------------
  function legs(dy) { return [[25 + dy * 4, -5 - dy * 3.5], [-22 - dy * 4, -32 + dy * 2.5]]; }
  function G(dx, dy, t) { return { x: dx || 0, y: dy || 0, t: t || 172, a: [[40, 150], [15, 165]], l: legs(dy || 0) }; }
  function W(base, o) { var p = { x: base.x, y: base.y, t: base.t, a: base.a, l: base.l }; for (var k in o) p[k] = o[k]; return p; }
  var GA = G(0, 0);
  var JAB = W(G(2, 0), { a: [[88, 90], [15, 165]] });
  var CROSS = W(G(4, 0, 163), { a: [[40, 150], [86, 92]] });
  var SLIP = G(1, 2.5, 152);
  var CHAMBER = W(G(4, -1, 190), { l: [[6, 0], [100, 8]], a: [[48, 155], [-25, -15]] });
  var KICK = W(G(8, -1, 214), { l: [[8, 2], [118, 113]], a: [[58, 162], [-38, -28]] });
  var PARRY = W(G(-1, 0, 182), { a: [[70, 125], [15, 165]] });
  var BLOCK = W(G(-1, 1, 178), { a: [[25, 178], [12, 180]] });
  var LATE = W(G(0, 0, 176), { a: [[35, 168], [20, 172]] });
  var HIT = W(G(-5, 1, 207), { a: [[64, 192], [8, 138]] });
  var STAG = G(-9, 1.5, 194);
  var REST = G(-4, 0);
  var TRACK_A = [[0, GA], [1.0, GA], [1.1, JAB], [1.22, GA], [1.32, CROSS], [1.46, GA], [1.6, GA], [1.67, SLIP], [1.78, GA], [1.87, CHAMBER], [IMPACT, KICK], [2.16, KICK], [2.42, GA], [99, GA]];
  var TRACK_B = [[0, GA], [1.04, GA], [1.11, PARRY], [1.24, GA], [1.31, BLOCK], [1.46, BLOCK], [1.54, GA], [1.65, JAB], [1.77, GA], [1.93, LATE], [2.04, HIT], [2.3, STAG], [2.7, REST], [99, REST]];

  function lerpPose(a, b, u) {
    function L2(x, y) { return [mix(x[0], y[0], u), mix(x[1], y[1], u)]; }
    return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), t: mix(a.t, b.t, u), a: [L2(a.a[0], b.a[0]), L2(a.a[1], b.a[1])], l: [L2(a.l[0], b.l[0]), L2(a.l[1], b.l[1])] };
  }
  function poseAt(track, T) {
    for (var i = 0; i < track.length - 1; i++) {
      if (T < track[i + 1][0]) return lerpPose(track[i][1], track[i + 1][1], ease(clamp((T - track[i][0]) / (track[i + 1][0] - track[i][0]), 0, 1)));
    }
    return track[track.length - 1][1];
  }

  /** Joints of an angle pose, in units, facing right. */
  function joints(p) {
    var H = [p.x, p.y], N = st(H, p.t, TORSO), Hd = st(N, p.t, NECK + HEAD);
    var E0 = st(N, p.a[0][0], UP), E1 = st(N, p.a[1][0], UP);
    var K0 = st(H, p.l[0][0], TH), K1 = st(H, p.l[1][0], TH);
    var F0 = st(K0, p.l[0][1], SH), F1 = st(K1, p.l[1][1], SH);
    return { H: [H, H], N: N, S: [N, N], Hd: Hd, E: [E0, E1], P: [st(E0, p.a[0][1], FORE), st(E1, p.a[1][1], FORE)], K: [K0, K1], F: [F0, F1], T: [st(F0, p.l[0][1] + 90, 4.5), st(F1, p.l[1][1] + 90, 4.5)], X: [] };
  }

  /** Two-bone reach: the elbow (or knee) between a and b; pick chooses between the two answers. */
  function ik(a, b, l1, l2, pick) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01), th = Math.atan2(dy, dx);
    var A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    var e1 = [a[0] + Math.cos(th + A) * l1, a[1] + Math.sin(th + A) * l1], e2 = [a[0] + Math.cos(th - A) * l1, a[1] + Math.sin(th - A) * l1];
    return pick(e1, e2) ? e1 : e2;
  }

  /** Pull-ups, seen from the front, under a bar. */
  function pullup(T) {
    var k = 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, T - 0.2)) / 1.3);
    var ny = -39 - 15 * ease(k), N = [0, ny], H = [0, ny + 24];
    var S0 = [-5, ny + 1.5], S1 = [5, ny + 1.5], P0 = [-10.5, -60], P1 = [10.5, -60];
    var out = function (e1, e2) { return Math.abs(e1[0]) > Math.abs(e2[0]); };
    var Hp0 = [-3, H[1]], Hp1 = [3, H[1]];
    var K0 = [-3.6, H[1] + 16], K1 = [3.6, H[1] + 16], F0 = [-2.4, H[1] + 31.5], F1 = [2.4, H[1] + 31.5];
    return { H: [Hp0, Hp1], N: N, S: [S0, S1], Hd: [0, ny - NECK - HEAD + 1], E: [ik(S0, P0, UP, FORE, out), ik(S1, P1, UP, FORE, out)], P: [P0, P1], K: [K0, K1], F: [F0, F1], T: [[-2.2, F0[1] + 3.5], [2.2, F1[1] + 3.5]], X: [[S0, S1, 6.5], [Hp0, Hp1, 7]] };
  }

  /** Push-ups, from the side: a straight plank from the toes, the elbows folding back. */
  function pushup(T) {
    var k = 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, T - 0.1)) / 1.0);
    var hS = 8.5 + 12.5 * ease(k), e = Math.asin(hS / 56), u = [Math.cos(e), -Math.sin(e)];
    var F = [-26, 29.5];
    function at(d) { return [F[0] + u[0] * d, F[1] + u[1] * d]; }
    var H = at(32), N = at(56), K = at(16), Hd = [N[0] + u[0] * (NECK + HEAD) + 0.5, N[1] + u[1] * (NECK + HEAD) - 1.2];
    var P = [N[0] + 1.5, 30.5];
    var back = function (e1, e2) { return e1[0] < e2[0]; };
    var E = ik(N, P, UP, FORE, back);
    return { H: [H, H], N: N, S: [N, N], Hd: Hd, E: [E, [E[0] - 0.8, E[1]]], P: [P, [P[0] - 0.8, P[1]]], K: [K, K], F: [F, [F[0] - 0.6, F[1]]], T: [[F[0] + 1.5, 31.5], [F[0] + 0.9, 31.5]], X: [] };
  }

  /** The runner's stride, facing right. */
  function runner(T) {
    var ph = (2 * Math.PI * T) / 0.66;
    function leg(o) {
      var th = 34 * Math.sin(ph + o), swing = Math.cos(ph + o);
      return [th, th - (16 + 82 * Math.pow(Math.max(0, swing), 0.8))];
    }
    function arm(o) { var u = -38 * Math.sin(ph + o); return [u, u + 98]; }
    var bob = -1.8 * Math.abs(Math.sin(ph));
    return joints({ x: 0, y: bob, t: 166, a: [arm(Math.PI), arm(0)], l: [leg(0), leg(Math.PI)] });
  }

  // ---- drawing -------------------------------------------------------------------------------------------------
  var SEG = [['H', 1, 'K', 1, 7.4], ['K', 1, 'F', 1, 5.6], ['F', 1, 'T', 1, 3.4], ['S', 1, 'E', 1, 4.6], ['E', 1, 'P', 1, 4],
    ['H', 0, 'N', -1, 11.5], ['N', -1, 'Hd', -1, 4.4],
    ['H', 0, 'K', 0, 7.6], ['K', 0, 'F', 0, 5.8], ['F', 0, 'T', 0, 3.4], ['S', 0, 'E', 0, 4.8], ['E', 0, 'P', 0, 4.2]];
  function pick(J, k, i) { var v = J[k]; return i < 0 ? v : v[i]; }

  /** One silhouette: a rim of light along its top edges, then the black body; gloves in the app's colour. */
  function figure(c, J, bx, by, s, dir, o) {
    function P(p) { return [bx + dir * p[0] * s, by + p[1] * s]; }
    function strokeAll(extra, dy) {
      for (var i = 0; i < SEG.length; i++) {
        var g = SEG[i], a = P(pick(J, g[0], g[1])), b = P(pick(J, g[2], g[3]));
        c.lineWidth = (g[4] + extra) * s;
        c.beginPath(); c.moveTo(a[0], a[1] + dy); c.lineTo(b[0], b[1] + dy); c.stroke();
      }
      for (var j = 0; j < J.X.length; j++) {
        var x = J.X[j], m = P(x[0]), n = P(x[1]);
        c.lineWidth = (x[2] + extra) * s;
        c.beginPath(); c.moveTo(m[0], m[1] + dy); c.lineTo(n[0], n[1] + dy); c.stroke();
      }
      var h = P(J.Hd);
      c.beginPath(); c.arc(h[0], h[1] + dy, (HEAD + extra / 2) * s, 0, 2 * Math.PI); c.fill();
    }
    c.save();
    c.globalAlpha = o.alpha;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // the rim: light from above and behind, so it sits on the upper edges
    c.strokeStyle = c.fillStyle = o.rim;
    c.shadowColor = o.glow; c.shadowBlur = o.blur;
    strokeAll(1.1, -0.65 * s);
    c.shadowBlur = 0;
    c.globalAlpha = o.body == null ? o.alpha : o.body;
    c.strokeStyle = c.fillStyle = '#040508';
    strokeAll(0, 0);
    c.globalAlpha = o.alpha;
    if (o.gloves) {
      for (var g = 0; g < 2; g++) {
        var q = P(J.P[g]);
        c.fillStyle = o.gloves; c.shadowColor = o.glow; c.shadowBlur = o.blur * 0.8;
        c.beginPath(); c.arc(q[0], q[1], 3.9 * s, 0, 2 * Math.PI); c.fill();
        c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.28)';
        c.beginPath(); c.arc(q[0] - 1 * s * dir, q[1] - 1.2 * s, 1.3 * s, 0, 2 * Math.PI); c.fill();
      }
    }
    c.restore();
  }

  function create(o) {
    var cv = o.canvas, c = cv.getContext('2d');
    var col = o.color || [229, 16, 44], hot = o.hot || [255, 41, 68];
    var pale = hot.map(function (v) { return Math.round(mix(v, 255, 0.72)); }), rimc = hot.map(function (v) { return Math.round(mix(v, 255, 0.3)); });
    var emb = o.stage ? o.stage.querySelector('.sp-emb') : null, eyes = o.stage ? o.stage.querySelectorAll('.sp-eye') : [];
    var Wd = 0, Ht = 0, dpr = 1, raf = 0, last = 0, T = 0, real = 0, slow = 0, shake = 0, hitAt = -1, live = true;
    var fired = { 1.1: false, 1.32: false }, impacted = false;
    var sparks = [], rings = [], motes = [], trails = { a0: [], a1: [], af: [], b0: [] };

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      Wd = cv.clientWidth || innerWidth; Ht = cv.clientHeight || innerHeight;
      cv.width = Math.round(Wd * dpr); cv.height = Math.round(Ht * dpr);
    }
    function layout() {
      var s = Math.min(Wd * 0.0079, Ht * 0.0036, 4.2);
      return { s: s, cx: Wd / 2, gy: Ht * 0.72, sf: s * 0.62, gf: Ht * 0.475 };
    }
    function seed() {
      motes = [];
      for (var i = 0; i < 46; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.012 + Math.random() * 0.03, r: 0.6 + Math.random() * 1.6, f: Math.random() * 6 });
    }

    function burstAt(x, y, n, power, dirX) {
      for (var i = 0; i < n; i++) {
        var a = (dirX > 0 ? -70 : -110) * R + (Math.random() - 0.5) * 200 * R, v = power * (0.25 + Math.random());
        sparks.push({ x: x, y: y, px: x, py: y, vx: Math.cos(a) * v + dirX * power * 0.35, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.55, w: 1 + Math.random() * 1.8 });
      }
    }

    function fighters(L) {
      var bob = function (ph) { return 0.9 * Math.sin(T * 2 * Math.PI * 2.1 + ph); };
      var pa = poseAt(TRACK_A, T), pb = poseAt(TRACK_B, T);
      pa = W(pa, { y: pa.y + (T < 1.85 || T > 2.45 ? bob(0) : 0) });
      pb = W(pb, { y: pb.y + (T < 1.9 || T > 2.6 ? bob(1.7) : 0) });
      var by = L.gy - HIPY * L.s;
      return { A: joints(pa), B: joints(pb), ax: L.cx - 19 * L.s, bx: L.cx + 19 * L.s, by: by };
    }

    function update(dt) {
      real += dt;
      var rate = slow > 0 ? 0.16 : 1;
      if (slow > 0) slow -= dt;
      T += dt * rate;
      shake *= Math.pow(0.0025, dt);
      var L = layout(), F = fighters(L);
      function scr(bx, p, dir) { return [bx + dir * p[0] * L.s, F.by + p[1] * L.s]; }
      // the small contacts: the parried jab and the blocked cross
      [1.1, 1.32].forEach(function (k) {
        if (!fired[k] && T >= k) { fired[k] = true; var h = scr(F.ax, F.A.P[k === 1.1 ? 0 : 1], 1); burstAt(h[0] + 4 * L.s, h[1], 18, 260, 1); }
      });
      if (!impacted && T >= IMPACT) {
        impacted = true; hitAt = real; slow = 0.36; shake = 11;
        var f = scr(F.ax, F.A.T[1], 1);
        burstAt(f[0], f[1], 150, 760, 1);
        rings.push({ x: f[0], y: f[1], t: 0 });
        if (o.root) { o.root.style.setProperty('--ix', f[0].toFixed(0) + 'px'); o.root.style.setProperty('--iy', f[1].toFixed(0) + 'px'); }
        if (o.onImpact) try { o.onImpact(); } catch (e) { /* the page's part */ }
      }
      // trails: the fast hands and the kicking foot leave light behind
      var now = [['a0', scr(F.ax, F.A.P[0], 1)], ['a1', scr(F.ax, F.A.P[1], 1)], ['af', scr(F.ax, F.A.T[1], 1)], ['b0', scr(F.bx, F.B.P[0], -1)]];
      now.forEach(function (n) {
        var tr = trails[n[0]];
        tr.push({ x: n[1][0], y: n[1][1], t: real });
        while (tr.length && real - tr[0].t > 0.11) tr.shift();
      });
      for (var i = sparks.length - 1; i >= 0; i--) {
        var p = sparks[i];
        p.t += dt * (slow > 0 ? 0.3 : 1);
        if (p.t > p.life) { sparks.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        var k = dt * (slow > 0 ? 0.3 : 1);
        p.vy += 900 * k; p.vx *= Math.pow(0.18, k); p.vy *= Math.pow(0.4, k);
        p.x += p.vx * k; p.y += p.vy * k;
      }
      for (var j = rings.length - 1; j >= 0; j--) { rings[j].t += dt; if (rings[j].t > 0.6) rings.splice(j, 1); }
      for (var m = 0; m < motes.length; m++) { var q = motes[m]; q.y -= q.v * dt; if (q.y < -0.05) { q.y = 1.02; q.x = Math.random(); } }
      return { L: L, F: F };
    }

    function lit() { return clamp((T - 0.35) / 0.6, 0, 1); }

    function dom() {
      var l = lit(), flare = hitAt >= 0 ? Math.max(0, 1 - (real - hitAt) / 0.7) : 0;
      if (o.bg) o.bg.style.opacity = (l * (0.85 + 0.15 * flare)).toFixed(3);
      if (emb) emb.style.opacity = (0.06 + 0.6 * l + 0.3 * flare).toFixed(3);
      var e = clamp((T - 0.1) / 0.22, 0, 1);
      var flick = T < 0.5 ? (Math.sin(T * 90) > -0.3 ? 1 : 0.35) : 1;
      for (var i = 0; i < eyes.length; i++) {
        eyes[i].style.opacity = (e * flick * (0.75 + 0.25 * Math.sin(real * 5)) + flare * 0.8).toFixed(3);
        eyes[i].style.transform = 'rotate(var(--r)) scale(' + (1 + flare * 0.9).toFixed(3) + ')';
      }
      if (o.stage && live) {
        var sx = (Math.random() - 0.5) * shake * 0.5, sy = (Math.random() - 0.5) * shake * 0.5;
        o.stage.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) scale(' + (1 + 0.035 * Math.min(T, 3) / 3).toFixed(4) + ')';
      }
    }

    function draw(S) {
      var L = S.L, F = S.F, l = lit();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, Wd, Ht);
      if (shake > 0.3) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // the floor: the arena ends in black under the fighters, where the name will stand
      var fl = c.createLinearGradient(0, L.gy - 4, 0, Ht);
      fl.addColorStop(0, 'rgba(4,5,8,0)'); fl.addColorStop(0.12, 'rgba(4,5,8,.82)'); fl.addColorStop(1, 'rgba(4,5,8,.97)');
      c.fillStyle = fl; c.fillRect(-20, L.gy - 4, Wd + 40, Ht - L.gy + 30);

      c.globalCompositeOperation = 'lighter';
      // one spotlight from above, its haze, the pools of light on the two floors
      var cone = c.createLinearGradient(0, 0, 0, L.gy);
      cone.addColorStop(0, rgba(hot, 0)); cone.addColorStop(0.35, rgba(col, 0.06 * l)); cone.addColorStop(1, rgba(col, 0.15 * l));
      c.fillStyle = cone;
      c.beginPath(); c.moveTo(L.cx - Wd * 0.05, -10); c.lineTo(L.cx + Wd * 0.05, -10); c.lineTo(L.cx + Wd * 0.46, L.gy); c.lineTo(L.cx - Wd * 0.46, L.gy); c.closePath(); c.fill();
      function pool(y, rx, a) {
        c.save(); c.translate(L.cx, y); c.scale(1, 0.13);
        var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, rgba(pale, a * 0.55)); g.addColorStop(0.25, rgba(hot, a * 0.6)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 2 * Math.PI); c.fill(); c.restore();
      }
      pool(L.gf, Wd * 0.62, 0.35 * l);
      pool(L.gy, Wd * 0.58, 0.75 * l);
      c.globalCompositeOperation = 'source-over';

      var fa = clamp((T - 0.42) / 0.5, 0, 1);
      var far = { alpha: 0.85 * fa, body: 1, rim: rgba(hot, 0.85), glow: rgba(hot, 0.9), blur: 7 * Math.min(dpr, 1.5) };
      var near = { alpha: fa, body: 1, rim: rgba(rimc, 1), glow: rgba(hot, 1), blur: 12 * Math.min(dpr, 1.5), gloves: rgba(col, 1) };
      var byF = L.gf - HIPY * L.sf;
      // the pull-up rig and its athlete
      var rx = L.cx - Wd * 0.385;
      c.save(); c.globalAlpha = 0.85 * fa; c.lineCap = 'round';
      c.strokeStyle = rgba(hot, 0.8); c.shadowColor = rgba(hot, 0.9); c.shadowBlur = 6; c.lineWidth = 2.2 * L.sf;
      [[-17, 31, -17, -63], [17, 31, 17, -63], [-22, -60, 22, -60]].forEach(function (b) { c.beginPath(); c.moveTo(rx + b[0] * L.sf, byF + b[1] * L.sf - 1); c.lineTo(rx + b[2] * L.sf, byF + b[3] * L.sf - 1); c.stroke(); });
      c.shadowBlur = 0; c.strokeStyle = '#040508'; c.lineWidth = 1.6 * L.sf;
      [[-17, 31, -17, -63], [17, 31, 17, -63], [-22, -60, 22, -60]].forEach(function (b) { c.beginPath(); c.moveTo(rx + b[0] * L.sf, byF + b[1] * L.sf); c.lineTo(rx + b[2] * L.sf, byF + b[3] * L.sf); c.stroke(); });
      c.restore();
      figure(c, pullup(T), rx, byF, L.sf, 1, far);
      // push-ups, head towards the middle
      figure(c, pushup(T), L.cx + Wd * 0.335, byF, L.sf, -1, far);
      // the runner crosses behind the fight
      var rt = clamp((T - 0.35) / 2.9, 0, 1);
      figure(c, runner(T), mix(Wd + 30, -30, rt), byF, L.sf, -1, far);

      // the fighters' shadows, then the fight
      c.save(); c.globalAlpha = fa * 0.8; c.fillStyle = '#000';
      [F.ax, F.bx].forEach(function (x) { c.beginPath(); c.ellipse(x, L.gy + 1, 15 * L.s, 2.4 * L.s, 0, 0, 2 * Math.PI); c.fill(); });
      c.restore();
      figure(c, F.B, F.bx, F.by, L.s, -1, near);
      figure(c, F.A, F.ax, F.by, L.s, 1, near);

      c.globalCompositeOperation = 'lighter';
      // light trails behind fast hands and the kick
      Object.keys(trails).forEach(function (k) {
        var tr = trails[k];
        for (var i = 1; i < tr.length; i++) {
          var a = tr[i - 1], b = tr[i], d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d < 2.5 * L.s * 0.6) continue;
          var age = (real - b.t) / 0.11;
          c.strokeStyle = rgba(k === 'af' ? pale : hot, (1 - age) * (k === 'af' ? 0.9 : 0.55));
          c.lineWidth = (k === 'af' ? 5 : 3) * L.s * 0.45 * (1 - age);
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
      });
      // sparks: streaks from where they were to where they are
      c.lineCap = 'round';
      for (var i = 0; i < sparks.length; i++) {
        var p = sparks[i], u = p.t / p.life;
        c.strokeStyle = u < 0.25 ? 'rgba(255,245,235,' + (1 - u).toFixed(2) + ')' : rgba(hot, 1 - u);
        c.lineWidth = p.w;
        c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x + (p.x - p.px) * 0.8, p.y + (p.y - p.py) * 0.8); c.stroke();
      }
      for (var r = 0; r < rings.length; r++) {
        var g = rings[r], v = g.t / 0.6;
        c.strokeStyle = rgba(pale, (1 - v) * 0.9); c.lineWidth = 3 * (1 - v) + 0.5;
        c.beginPath(); c.ellipse(g.x, g.y, 10 + v * 150, (10 + v * 150) * 0.8, 0, 0, 2 * Math.PI); c.stroke();
      }
      // dust in the light
      for (var m = 0; m < motes.length; m++) {
        var q = motes[m], a2 = l * 0.35 * (0.5 + 0.5 * Math.sin(real * 2 + q.f));
        c.fillStyle = rgba(pale, a2);
        c.beginPath(); c.arc(q.x * Wd, q.y * Ht * 0.75, q.r, 0, 2 * Math.PI); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      if (!live) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var S = update(dt);
      draw(S); dom();
      raf = requestAnimationFrame(frame);
    }

    function onResize() { size(); }
    size(); seed();
    addEventListener('resize', onResize);
    return {
      start: function () { live = true; last = 0; raf = requestAnimationFrame(frame); },
      /** The calm poster: the scene simulated up to T without a sound or a callback, then drawn once. */
      still: function (at) {
        live = false;
        var cb = o.onImpact; o.onImpact = null;
        var S = null;
        while (T < at) S = update(1 / 60);
        o.onImpact = cb; shake = 0; slow = 0;
        if (S) draw(S);
        dom();
      },
      burst: function () { /* the exit is the page's: the canvas fades with it */ },
      destroy: function () { live = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); }
    };
  }

  /** Seated, legs crossed, hands on the knees, seen from the front; the chest rises with the breath. */
  function calm(T) {
    var b = Math.sin((2 * Math.PI * T) / 5.5), ny = 2.5 - 1.1 * b;
    var N = [0, ny], S0 = [-5.5, ny + 1.5], S1 = [5.5, ny + 1.5], Hp0 = [-4.5, 26.5], Hp1 = [4.5, 26.5];
    var K0 = [-16, 27.5], K1 = [16, 27.5], F0 = [5, 29.5], F1 = [-5, 29.5];
    var P0 = [-14.5, 24.5], P1 = [14.5, 24.5];
    var out = function (e1, e2) { return Math.abs(e1[0]) > Math.abs(e2[0]); };
    return { H: [Hp0, Hp1], N: N, S: [S0, S1], Hd: [0, ny - NECK - HEAD + 1], E: [ik(S0, P0, UP, FORE, out), ik(S1, P1, UP, FORE, out)], P: [P0, P1], K: [K0, K1], F: [F0, F1], T: [[7, 30], [-7, 30]], X: [[S0, S1, 7], [Hp0, Hp1, 9]] };
  }

  /**
   * The living picture at the top of Azi (2026-11-15): the day's discipline in the same arena light, looping.
   * kind: 'fight' | 'push' | 'pull' | 'run' | 'calm'. It stops by itself when its canvas leaves the page; `still`
   * draws one frame (reduced motion, "Animații: Reduse").
   */
  function hero(cv, o) {
    var c = cv.getContext('2d'), col = o.color || [229, 16, 44], hot = o.hot || [255, 41, 68], kind = o.kind || 'fight';
    var pale = hot.map(function (v) { return Math.round(mix(v, 255, 0.72)); }), rimc = hot.map(function (v) { return Math.round(mix(v, 255, 0.3)); });
    var Wd = 0, Ht = 0, dpr = 1, raf = 0, last = 0, t = 0, sparks = [], fired = -1, shake = 0, live = true;
    var motes = [];
    for (var i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.04, r: 0.6 + Math.random() * 1.3, f: Math.random() * 6 });
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      Wd = cv.clientWidth; Ht = cv.clientHeight;
      if (!Wd || !Ht) return false;
      cv.width = Math.round(Wd * dpr); cv.height = Math.round(Ht * dpr);
      return true;
    }
    var near = function () { return { alpha: 1, body: 1, rim: rgba(rimc, 1), glow: rgba(hot, 1), blur: 11 * Math.min(dpr, 1.5), gloves: kind === 'fight' ? rgba(col, 1) : null }; };
    function frame(dt) {
      t += dt;
      shake *= Math.pow(0.003, dt);
      var gy = Ht * 0.86, cx = Wd * 0.5;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, Wd, Ht);
      if (shake > 0.3) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      c.globalCompositeOperation = 'lighter';
      var cone = c.createLinearGradient(0, 0, 0, gy);
      cone.addColorStop(0, rgba(hot, 0)); cone.addColorStop(1, rgba(col, 0.16));
      c.fillStyle = cone;
      c.beginPath(); c.moveTo(cx - Wd * 0.06, -6); c.lineTo(cx + Wd * 0.06, -6); c.lineTo(cx + Wd * 0.48, gy); c.lineTo(cx - Wd * 0.48, gy); c.closePath(); c.fill();
      c.save(); c.translate(cx, gy); c.scale(1, 0.14);
      var g = c.createRadialGradient(0, 0, 0, 0, 0, Wd * 0.55);
      g.addColorStop(0, rgba(pale, 0.4)); g.addColorStop(0.3, rgba(hot, 0.45)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, Wd * 0.55, 0, 2 * Math.PI); c.fill(); c.restore();
      c.globalCompositeOperation = 'source-over';
      var o2 = near(), s, by;
      if (kind === 'fight') {
        // the exchange on a loop: jab, cross, the jab back, the kick, then reset
        var T = 0.9 + (t % 2.3);
        s = Math.min(Ht / 92, Wd / 88); by = gy - HIPY * s;
        var pa = poseAt(TRACK_A, T), pb = poseAt(TRACK_B, Math.min(T, 2.69));
        var A = joints(pa), B = joints(pb), ax = cx - 19 * s, bx = cx + 19 * s;
        c.save(); c.globalAlpha = 0.8; c.fillStyle = '#000';
        [ax, bx].forEach(function (x) { c.beginPath(); c.ellipse(x, gy + 1, 15 * s, 2.4 * s, 0, 0, 2 * Math.PI); c.fill(); });
        c.restore();
        figure(c, B, bx, by, s, -1, o2);
        figure(c, A, ax, by, s, 1, o2);
        var loop = Math.floor(t / 2.3);
        if (T >= IMPACT && fired !== loop) {
          fired = loop; shake = 6;
          var f = A.T[1], fx = ax + f[0] * s, fy = by + f[1] * s;
          for (var k = 0; k < 70; k++) {
            var a = -70 * R + (Math.random() - 0.5) * 200 * R, v = 420 * (0.25 + Math.random());
            sparks.push({ x: fx, y: fy, px: fx, py: fy, vx: Math.cos(a) * v + 140, vy: Math.sin(a) * v, t: 0, life: 0.3 + Math.random() * 0.45, w: 1 + Math.random() * 1.4 });
          }
        }
      } else if (kind === 'push') {
        s = Math.min(Wd / 84, Ht / 44); by = gy - HIPY * s;
        figure(c, pushup(t), cx + 4 * s, by, s, -1, o2);
      } else if (kind === 'pull') {
        s = Ht / 118; by = gy - HIPY * s;
        c.save(); c.lineCap = 'round'; c.strokeStyle = rgba(hot, 0.85); c.shadowColor = rgba(hot, 0.9); c.shadowBlur = 8; c.lineWidth = 2.4 * s;
        var rig = [[-17, 31, -17, -63], [17, 31, 17, -63], [-22, -60, 22, -60]];
        rig.forEach(function (b) { c.beginPath(); c.moveTo(cx + b[0] * s, by + b[1] * s - 1); c.lineTo(cx + b[2] * s, by + b[3] * s - 1); c.stroke(); });
        c.shadowBlur = 0; c.strokeStyle = '#040508'; c.lineWidth = 1.7 * s;
        rig.forEach(function (b) { c.beginPath(); c.moveTo(cx + b[0] * s, by + b[1] * s); c.lineTo(cx + b[2] * s, by + b[3] * s); c.stroke(); });
        c.restore();
        figure(c, pullup(t), cx, by, s, 1, o2);
      } else if (kind === 'run') {
        s = Ht / 86; by = gy - HIPY * s;
        // the floor runs under the feet
        c.save(); c.strokeStyle = rgba(hot, 0.35); c.lineWidth = 1.5;
        for (var m = 0; m < 9; m++) { var x = ((m * 0.14 - t * 0.9) % 1.26 + 1.26) % 1.26 * Wd - 0.13 * Wd; c.beginPath(); c.moveTo(x, gy + 3); c.lineTo(x + Wd * 0.06, gy + 3); c.stroke(); }
        c.restore();
        figure(c, runner(t), cx, by, s, 1, o2);
      } else {
        s = Ht / 62; by = gy - HIPY * s;
        var br = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 5.5);
        c.save(); c.globalCompositeOperation = 'lighter';
        var aura = c.createRadialGradient(cx, by + 8 * s, 0, cx, by + 8 * s, 34 * s * (0.9 + 0.2 * br));
        aura.addColorStop(0, rgba(hot, 0.28)); aura.addColorStop(1, rgba(col, 0));
        c.fillStyle = aura; c.beginPath(); c.arc(cx, by + 8 * s, 40 * s, 0, 2 * Math.PI); c.fill(); c.restore();
        figure(c, calm(t), cx, by, s, 1, o2);
      }
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (var j = sparks.length - 1; j >= 0; j--) {
        var p = sparks[j];
        p.t += dt;
        if (p.t > p.life) { sparks.splice(j, 1); continue; }
        p.px = p.x; p.py = p.y; p.vy += 900 * dt; p.vx *= Math.pow(0.18, dt); p.vy *= Math.pow(0.4, dt); p.x += p.vx * dt; p.y += p.vy * dt;
        var u = p.t / p.life;
        c.strokeStyle = u < 0.25 ? 'rgba(255,245,235,' + (1 - u).toFixed(2) + ')' : rgba(hot, 1 - u);
        c.lineWidth = p.w; c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x, p.y); c.stroke();
      }
      for (var q = 0; q < motes.length; q++) {
        var d = motes[q]; d.y -= d.v * dt; if (d.y < -0.05) { d.y = 1.02; d.x = Math.random(); }
        c.fillStyle = rgba(pale, 0.3 * (0.5 + 0.5 * Math.sin(t * 2 + d.f)));
        c.beginPath(); c.arc(d.x * Wd, d.y * gy, d.r, 0, 2 * Math.PI); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      if (!live) return;
      if (!cv.isConnected) { live = false; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!document.hidden) frame(dt);
      raf = requestAnimationFrame(loop);
    }
    if (!size()) return { stop: function () {} };
    if (o.still) { t = kind === 'fight' ? 1.12 : 0.9; frame(0); live = false; }
    else raf = requestAnimationFrame(loop);
    var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { if (size() && !live) frame(0); }) : null;
    if (ro) ro.observe(cv);
    return { stop: function () { live = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); } };
  }

  window.BeastArena = { create: create, hero: hero };
})();
