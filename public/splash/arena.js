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

  // ---- the kitchen, the scale, the pen, the bag (2026-11-15, the user: for Beast Nutrition "siluete care gătesc, se
  //      cântăresc, își fac injecție"; and more living pictures like the one on Azi) ----

  /** Food tossed from the pan: each toss is [launch, landing, height in units, spins]. */
  function tossAt(tosses, T) {
    for (var i = 0; i < tosses.length; i++) { var k = tosses[i]; if (T >= k[0] && T < k[1]) return { u: (T - k[0]) / (k[1] - k[0]), h: k[2], spins: k[3] || 1 }; }
    return null;
  }
  /** How hard the wrist flicks: a snap at each launch, a small catch at each landing. */
  function flipOf(tosses, T) {
    var f = 0;
    for (var i = 0; i < tosses.length; i++) {
      var k = tosses[i];
      f = Math.max(f, Math.exp(-Math.pow((T - k[0] - 0.03) / 0.07, 2)), 0.4 * Math.exp(-Math.pow((T - k[1]) / 0.06, 2)));
    }
    return f;
  }
  /** The cook, facing right, a chef's toque on the head, the pan in the lead hand, a spatula in the other. */
  function cookJ(T, tosses) {
    var f = flipOf(tosses, T), sway = Math.sin(T * 2.6) * 1.2;
    var J = joints({ x: 0, y: 0.4 * Math.sin(T * 5.2), t: 178 + sway, a: [[55 - 18 * f, 96 + 38 * f], [24 + sway * 2, 140]], l: [[7, 0], [-7, 0]] });
    var top = [J.Hd[0], J.Hd[1] - HEAD + 0.8];
    J.X = [[top, [top[0] + 0.5, top[1] - 5.5], 9.5], [[top[0] - 2.6, top[1] - 7.5], [top[0] + 3.4, top[1] - 7.5], 8.5]];
    J.fore = 96 + 38 * f;
    return J;
  }

  /** Thick round strokes in two passes, the rim of light first, then the black, as figure() does for bodies. */
  function rimmed(c, segs, o, s) {
    c.save(); c.globalAlpha = o.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = o.rim; c.shadowColor = o.glow; c.shadowBlur = o.blur;
    segs.forEach(function (g) { c.lineWidth = (g[2] + 1.1) * s; c.beginPath(); c.moveTo(g[0][0], g[0][1] - 0.65 * s); c.lineTo(g[1][0], g[1][1] - 0.65 * s); c.stroke(); });
    c.shadowBlur = 0; c.strokeStyle = '#040508';
    segs.forEach(function (g) { c.lineWidth = g[2] * s; c.beginPath(); c.moveTo(g[0][0], g[0][1]); c.lineTo(g[1][0], g[1][1]); c.stroke(); });
    c.restore();
  }

  /** The stove, its flame, the cook, the pan and whatever is in the air. Returns where the pan is, on screen. */
  function kitchen(c, T, tosses, bx, by, s, o, hot, pale) {
    function P(p) { return [bx + p[0] * s, by + p[1] * s]; }
    var a0 = P([17, -9]), a1 = P([47, 31]);
    c.save(); c.globalAlpha = o.alpha;
    c.fillStyle = o.rim; c.shadowColor = o.glow; c.shadowBlur = o.blur;
    c.fillRect(a0[0] - 1, a0[1] - 1.6, a1[0] - a0[0] + 2, a1[1] - a0[1] + 1.6);
    c.shadowBlur = 0; c.fillStyle = '#040508'; c.globalAlpha = 1;
    c.fillRect(a0[0], a0[1], a1[0] - a0[0], a1[1] - a0[1]);
    c.globalAlpha = o.alpha;
    var d0 = P([21, -2]);
    c.strokeStyle = rgba(hot, 0.4); c.lineWidth = Math.max(1, 0.5 * s);
    c.strokeRect(d0[0], d0[1], 22 * s, 18 * s);
    c.fillStyle = rgba(hot, 0.25); c.fillRect(P([24, 1])[0], P([24, 1])[1], 16 * s, 1.2 * s);
    c.restore();
    // the flame on the burner
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 4; i++) {
      var x = 27 + i * 3.4, h = 4.5 + 2.2 * Math.sin(T * 23 + i * 2.1) + 1.3 * Math.sin(T * 37 + i);
      var b0 = P([x - 1.7, -9.2]), b1 = P([x + 1.7, -9.2]), tip = P([x + 0.6 * Math.sin(T * 19 + i), -9.2 - h]);
      var g = c.createLinearGradient(0, b0[1], 0, tip[1]);
      g.addColorStop(0, rgba(pale, 0.95 * o.alpha)); g.addColorStop(0.45, rgba(hot, 0.7 * o.alpha)); g.addColorStop(1, rgba(hot, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(b0[0], b0[1]); c.quadraticCurveTo(b0[0], tip[1] + (b0[1] - tip[1]) * 0.4, tip[0], tip[1]); c.quadraticCurveTo(b1[0], tip[1] + (b1[1] - tip[1]) * 0.4, b1[0], b1[1]); c.closePath(); c.fill();
    }
    c.restore();
    var J = cookJ(T, tosses);
    figure(c, J, bx, by, s, 1, o);
    // the pan, held level, flicked up on a toss
    var hand = J.P[0], a = J.fore;
    var p0 = st(hand, a, 8), p1 = st(hand, a, 23), lip = st(p1, a + 90, 3.4), mid = st(hand, a, 15.5);
    rimmed(c, [[P(st(hand, a, 1)), P(p0), 1.7], [P(p0), P(p1), 3], [P(p1), P(lip), 2.2]], o, s);
    // the food: on the pan, or in the air, spinning
    var rest = st(mid, a + 90, 2.6), tz = tossAt(tosses, T), fp, rot;
    if (tz) { fp = [rest[0], rest[1] - tz.h * 4 * tz.u * (1 - tz.u)]; rot = tz.u * Math.PI * 2 * tz.spins; }
    else { fp = rest; rot = (a - 90) * -R; }
    var q = P(fp);
    c.save(); c.translate(q[0], q[1]); c.rotate(rot); c.globalAlpha = o.alpha;
    c.shadowColor = o.glow; c.shadowBlur = o.blur;
    c.fillStyle = rgba(hot, 1); c.beginPath(); c.ellipse(0, 0, 5.6 * s, 1.7 * s, 0, 0, 2 * Math.PI); c.fill();
    c.shadowBlur = 0; c.fillStyle = rgba(pale, 0.85); c.beginPath(); c.ellipse(-1 * s, -0.5 * s, 3 * s, 0.6 * s, 0, 0, 2 * Math.PI); c.fill();
    c.restore();
    return { pan: P(mid), food: q, airborne: !!tz };
  }

  /** Someone on the bathroom scale, looking down at it. */
  function weighJ(T) {
    return joints({ x: 0, y: -2.5, t: 173 + Math.sin(T * 1.7) * 1.2, a: [[10, 8], [-8, -6]], l: [[3, 1], [-3, -1]] });
  }
  /** The scale under the feet, its display lit, and the reading that floats up out of it now and then. */
  function scaleProp(c, T, bx, by, s, o, hot, pale, dir, alpha) {
    function P(p) { return [bx + dir * p[0] * s, by + p[1] * s]; }
    var a0 = P([-12, 29]), a1 = P([16, 31.6]);
    var x0 = Math.min(a0[0], a1[0]), w = Math.abs(a1[0] - a0[0]);
    c.save(); c.globalAlpha = o.alpha;
    c.fillStyle = o.rim; c.shadowColor = o.glow; c.shadowBlur = o.blur;
    c.fillRect(x0 - 1, a0[1] - 1.2, w + 2, a1[1] - a0[1] + 1.2);
    c.shadowBlur = 0; c.fillStyle = '#040508'; c.globalAlpha = 1; c.fillRect(x0, a0[1], w, a1[1] - a0[1]); c.globalAlpha = o.alpha;
    var d = P([10, 29.6]);
    c.fillStyle = rgba(pale, 0.95); c.shadowColor = rgba(hot, 1); c.shadowBlur = 8;
    c.fillRect(d[0] - 2.2 * s, d[1], 4.4 * s, 1.1 * s);
    c.restore();
    var k = (T % 2.6) / 2.6;
    if (k < 0.75 && T > 0.6) {
      var u = k / 0.75, top = P([2, -48 - 10 * u]);
      c.save(); c.globalAlpha = alpha * Math.sin(u * Math.PI);
      c.font = '800 ' + (6 * s).toFixed(1) + 'px Saira, "Arial Narrow", sans-serif'; c.textAlign = 'center';
      c.fillStyle = rgba(pale, 1); c.shadowColor = rgba(hot, 1); c.shadowBlur = 10;
      c.fillText('−0,4 kg', top[0], top[1]);
      c.restore();
    }
  }

  /** The weekly pen: one hand pinches the belly, the other brings the pen in and presses; a ring at the click. */
  function injectJ(T) {
    var k = T % 2.4, push = k < 0.35 ? k / 0.35 : k < 1.25 ? 1 : k < 1.55 ? 1 - (k - 1.25) / 0.3 : 0;
    var J = joints({ x: 0, y: 0, t: 172, a: [[0, 0], [0, 0]], l: [[5, 0], [-5, 0]] });
    var N = J.N, P0 = [13 - 4.5 * ease(push), -10], P1 = [7.4, -4.5];
    var fwd = function (e1, e2) { return e1[0] > e2[0]; };
    J.E = [ik(N, P0, UP, FORE, fwd), ik(N, P1, UP, FORE, fwd)];
    J.P = [P0, P1];
    J.T = [st(J.F[0], 90, 4.5), st(J.F[1], 90, 4.5)];
    J.push = push; J.click = k >= 0.35 && k < 0.95 ? (k - 0.35) / 0.6 : -1;
    return J;
  }
  function pen(c, J, bx, by, s, dir, o, hot, pale) {
    function P(p) { return [bx + dir * p[0] * s, by + p[1] * s]; }
    var h = J.P[0], tip = [h[0] - 4.6, h[1] + 0.3], end = [h[0] + 6.5, h[1] - 0.9];
    c.save(); c.globalAlpha = o.alpha; c.lineCap = 'round';
    c.strokeStyle = rgba(pale, 0.95); c.shadowColor = rgba(hot, 1); c.shadowBlur = o.blur;
    c.lineWidth = 2.6 * s; c.beginPath(); c.moveTo(P(tip)[0], P(tip)[1]); c.lineTo(P(end)[0], P(end)[1]); c.stroke();
    var cap = [end[0] - 2.4, end[1] + 0.2];
    c.strokeStyle = rgba(hot, 1); c.lineWidth = 2.9 * s; c.beginPath(); c.moveTo(P(cap)[0], P(cap)[1]); c.lineTo(P(end)[0], P(end)[1]); c.stroke();
    c.restore();
    if (J.click >= 0) {
      var t = P(tip), v = J.click;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(pale, (1 - v) * 0.9); c.lineWidth = 1.5;
      c.beginPath(); c.arc(t[0], t[1], (2 + v * 9) * s, 0, 2 * Math.PI); c.stroke();
      c.restore();
    }
  }

  /** The heavy bag: a boxer works it, jab, cross, hook; the bag swings on its chain. */
  var HOOK = W(G(2, 0, 178), { a: [[100, 62], [15, 165]] });
  var BAG_TRACK = [[0, GA], [0.1, JAB], [0.24, GA], [0.38, CROSS], [0.54, GA], [0.68, HOOK], [0.84, GA], [1.5, GA]];
  var BAG_HITS = [0.1, 0.38, 0.68];

  // ---------------------------------------------------------------------------------------------------------------

  function create(o) {
    var cv = o.canvas, c = cv.getContext('2d');
    var col = o.color || [229, 16, 44], hot = o.hot || [255, 41, 68];
    var pale = hot.map(function (v) { return Math.round(mix(v, 255, 0.72)); }), rimc = hot.map(function (v) { return Math.round(mix(v, 255, 0.3)); });
    // 'fight' (Inner Beast) or 'kitchen' (Beast Nutrition): the cook's big toss lands in the pan at IMPACT
    var scene = o.scene || 'fight', TOSS = [[1.02, 1.4, 16, 1], [1.5, IMPACT, 46, 2]], panAt = null, steam = [];
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
      var L = layout(), F = scene === 'fight' ? fighters(L) : null;
      function scr(bx, p, dir) { return [bx + dir * p[0] * L.s, F.by + p[1] * L.s]; }
      if (!F) {
        // the kitchen: a small toss lands, then the big one, at IMPACT
        if (!fired.k && T >= 1.4 && panAt) { fired.k = true; burstAt(panAt[0], panAt[1] - 4, 24, 280, 0); }
        if (!impacted && T >= IMPACT) {
          impacted = true; hitAt = real; slow = 0.36; shake = 8;
          var q = panAt || [L.cx, L.gy - 40 * L.s];
          burstAt(q[0], q[1] - 6, 130, 640, 0.3);
          rings.push({ x: q[0], y: q[1] - 4, t: 0 });
          for (var b = 0; b < 16; b++) steam.push({ x: q[0] + (Math.random() - 0.5) * 30, y: q[1] - 6, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 60, r: 6 + Math.random() * 10, t: 0, life: 0.9 + Math.random() * 0.8 });
          if (o.root) { o.root.style.setProperty('--ix', q[0].toFixed(0) + 'px'); o.root.style.setProperty('--iy', q[1].toFixed(0) + 'px'); }
          if (o.onImpact) try { o.onImpact(); } catch (e) { /* the page's part */ }
        }
        if (panAt && T > 0.5 && Math.random() < dt * 7) steam.push({ x: panAt[0] + (Math.random() - 0.5) * 16, y: panAt[1] - 4, vx: (Math.random() - 0.5) * 12, vy: -24 - Math.random() * 20, r: 4 + Math.random() * 6, t: 0, life: 1.2 + Math.random() * 0.8 });
      }
      for (var sm = steam.length - 1; sm >= 0; sm--) { var e2 = steam[sm]; e2.t += dt; if (e2.t > e2.life) { steam.splice(sm, 1); continue; } e2.x += e2.vx * dt; e2.y += e2.vy * dt; e2.r += 10 * dt; }
      if (F) {
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
      }
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
      if (!F) {
        // the kitchen's arena: someone on the scale on the left, the weekly pen on the right
        var wx = L.cx - Wd * 0.36;
        scaleProp(c, T, wx, byF, L.sf, far, hot, pale, 1, fa);
        figure(c, weighJ(T), wx, byF, L.sf, 1, far);
        var jx = L.cx + Wd * 0.36, J2 = injectJ(T);
        figure(c, J2, jx, byF, L.sf, -1, far);
        pen(c, J2, jx, byF, L.sf, -1, far, hot, pale);
      }
      // the pull-up rig and its athlete
      var rx = L.cx - Wd * 0.385;
      if (F) {
      c.save(); c.globalAlpha = 0.85 * fa; c.lineCap = 'round';
      c.strokeStyle = rgba(hot, 0.8); c.shadowColor = rgba(hot, 0.9); c.shadowBlur = 6; c.lineWidth = 2.2 * L.sf;
      [[-17, 31, -17, -63], [17, 31, 17, -63], [-22, -60, 22, -60]].forEach(function (b) { c.beginPath(); c.moveTo(rx + b[0] * L.sf, byF + b[1] * L.sf - 1); c.lineTo(rx + b[2] * L.sf, byF + b[3] * L.sf - 1); c.stroke(); });
      c.shadowBlur = 0; c.strokeStyle = '#040508'; c.lineWidth = 1.6 * L.sf;
      [[-17, 31, -17, -63], [17, 31, 17, -63], [-22, -60, 22, -60]].forEach(function (b) { c.beginPath(); c.moveTo(rx + b[0] * L.sf, byF + b[1] * L.sf); c.lineTo(rx + b[2] * L.sf, byF + b[3] * L.sf); c.stroke(); });
      c.restore();
      figure(c, pullup(T), rx, byF, L.sf, 1, far);
      // push-ups, head towards the middle
      figure(c, pushup(T), L.cx + Wd * 0.335, byF, L.sf, -1, far);
      }
      // the runner crosses behind the fight
      var rt = clamp((T - 0.35) / 2.9, 0, 1);
      figure(c, runner(T), mix(Wd + 30, -30, rt), byF, L.sf, -1, far);

      if (F) {
        // the fighters' shadows, then the fight
        c.save(); c.globalAlpha = fa * 0.8; c.fillStyle = '#000';
        [F.ax, F.bx].forEach(function (x) { c.beginPath(); c.ellipse(x, L.gy + 1, 15 * L.s, 2.4 * L.s, 0, 0, 2 * Math.PI); c.fill(); });
        c.restore();
        figure(c, F.B, F.bx, F.by, L.s, -1, near);
        figure(c, F.A, F.ax, F.by, L.s, 1, near);
      } else {
        near.gloves = null;
        c.save(); c.globalAlpha = fa * 0.8; c.fillStyle = '#000';
        c.beginPath(); c.ellipse(L.cx - 2 * L.s, L.gy + 1, 30 * L.s, 2.6 * L.s, 0, 0, 2 * Math.PI); c.fill();
        c.restore();
        panAt = kitchen(c, T, TOSS, L.cx - 16 * L.s, L.gy - HIPY * L.s, L.s, near, hot, pale).pan;
      }

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
      // steam off the pan
      for (var sm = 0; sm < steam.length; sm++) {
        var e3 = steam[sm], v3 = e3.t / e3.life, gs = c.createRadialGradient(e3.x, e3.y, 0, e3.x, e3.y, e3.r);
        gs.addColorStop(0, rgba(pale, 0.16 * Math.sin(v3 * Math.PI))); gs.addColorStop(1, rgba(pale, 0));
        c.fillStyle = gs; c.beginPath(); c.arc(e3.x, e3.y, e3.r, 0, 2 * Math.PI); c.fill();
      }
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
    var near = function () { return { alpha: 1, body: 1, rim: rgba(rimc, 1), glow: rgba(hot, 1), blur: 11 * Math.min(dpr, 1.5), gloves: kind === 'fight' || kind === 'bag' ? rgba(col, 1) : null }; };
    var th = 0, om = 0, bagHit = -1, steam = [];
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
      } else if (kind === 'bag') {
        // the heavy bag on its chain, worked jab, cross, hook
        s = Math.min(Ht * 0.84 / 112, Wd / 80); by = gy - HIPY * s;
        var Tb = t % 1.5, bxr = cx - 22 * s, bgx = cx + 12 * s, Jb = joints(poseAt(BAG_TRACK, Tb));
        var cyc = Math.floor(t / 1.5) * 10;
        BAG_HITS.forEach(function (h, i2) {
          if (Tb >= h && bagHit < cyc + i2 && Tb < h + 0.2) {
            bagHit = cyc + i2; om += 1.5 + i2 * 0.3; shake = 2.5;
            var hy = by - 24 * s, hx = bgx - 7 * s;
            for (var k2 = 0; k2 < 26; k2++) { var a2 = (180 + (Math.random() - 0.5) * 120) * R, v2 = 260 * (0.3 + Math.random()); sparks.push({ x: hx, y: hy, px: hx, py: hy, vx: Math.cos(a2) * v2, vy: Math.sin(a2) * v2, t: 0, life: 0.25 + Math.random() * 0.3, w: 1 + Math.random() }); }
          }
        });
        om += (-28 * th - 2.4 * om) * dt; th += om * dt;
        var piv = [bgx, by - 80 * s];
        function rotp(x, y) { return [piv[0] + Math.cos(th) * x * s + Math.sin(th) * y * s, piv[1] - Math.sin(th) * x * s + Math.cos(th) * y * s]; }
        c.save(); c.lineCap = 'round';
        c.strokeStyle = rgba(hot, 0.7); c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(piv[0] - 20 * s, piv[1]); c.lineTo(piv[0] + 20 * s, piv[1]); c.stroke();
        c.restore();
        rimmed(c, [[rotp(0, 0), rotp(0, 30), 1.2], [rotp(0, 34), rotp(0, 68), 14]], o2, s);
        c.save(); c.strokeStyle = rgba(hot, 0.35); c.lineWidth = 1;
        [44, 58].forEach(function (yy) { var l0 = rotp(-6.5, yy), l1 = rotp(6.5, yy); c.beginPath(); c.moveTo(l0[0], l0[1]); c.lineTo(l1[0], l1[1]); c.stroke(); });
        c.restore();
        c.save(); c.globalAlpha = 0.8; c.fillStyle = '#000'; c.beginPath(); c.ellipse(bxr, gy + 1, 15 * s, 2.4 * s, 0, 0, 2 * Math.PI); c.fill(); c.restore();
        figure(c, Jb, bxr, by, s, 1, o2);
      } else if (kind === 'cook') {
        s = Math.min(Ht / 102, Wd / 80); by = gy - HIPY * s;
        var base = Math.floor(t / 1.9) * 1.9, pn = kitchen(c, t, [[base + 0.3, base + 1.0, 28, 1]], cx - 16 * s, by, s, o2, hot, pale).pan;
        if (Math.random() < dt * 7) steam.push({ x: pn[0] + (Math.random() - 0.5) * 14, y: pn[1] - 4, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 18, r: 4 + Math.random() * 5, t: 0, life: 1.2 + Math.random() * 0.8 });
      } else if (kind === 'weigh') {
        s = Math.min(Ht / 98, Wd / 60); by = gy - HIPY * s;
        scaleProp(c, t, cx, by, s, o2, hot, pale, 1, 1);
        figure(c, weighJ(t), cx, by, s, 1, o2);
      } else if (kind === 'inject') {
        s = Math.min(Ht / 94, Wd / 60); by = gy - HIPY * s;
        var Ji = injectJ(t);
        figure(c, Ji, cx - 4 * s, by, s, 1, o2);
        pen(c, Ji, cx - 4 * s, by, s, 1, o2, hot, pale);
      } else if (kind === 'journey') {
        // the road to the goal (Beast Nutrition, Azi): a gate at every stretch, the runner where the scale says he is,
        // the road behind him lit; on the first look of the visit he runs there from the start and each gate he
        // passes lights up with sparks; the finish flag waves over the goal
        var jy = o.journey || { p: 0, n: 5, marks: [] }, x0 = Wd * 0.07, x1 = Wd * 0.9, ty = Ht * 0.8;
        s = Ht / 250;
        var q = jy.intro ? jy.p * ease(clamp((t - 0.25) / 1.8, 0, 1)) : jy.p, xq = x0 + (x1 - x0) * q;
        // the spotlight follows the runner
        c.save(); c.globalCompositeOperation = 'lighter';
        var sp = c.createRadialGradient(xq, ty, 0, xq, ty, Ht * 0.7);
        sp.addColorStop(0, rgba(hot, 0.22)); sp.addColorStop(1, rgba(col, 0));
        c.fillStyle = sp; c.fillRect(0, 0, Wd, Ht);
        c.restore();
        // the road: dim ahead, lit behind
        c.save(); c.lineCap = 'round';
        c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 3; c.setLineDash([6, 7]);
        c.beginPath(); c.moveTo(xq, ty); c.lineTo(x1, ty); c.stroke(); c.setLineDash([]);
        var lg = c.createLinearGradient(x0, 0, xq, 0); lg.addColorStop(0, rgba(col, 0.5)); lg.addColorStop(1, rgba(pale, 1));
        c.strokeStyle = lg; c.lineWidth = 4; c.shadowColor = rgba(hot, 1); c.shadowBlur = 14;
        c.beginPath(); c.moveTo(x0, ty); c.lineTo(xq, ty); c.stroke();
        c.restore();
        // the gates and their kilos
        c.save(); c.font = '700 ' + Math.max(9, Ht * 0.042).toFixed(0) + 'px Saira, "Arial Narrow", sans-serif'; c.textAlign = 'center';
        for (var gi = 0; gi <= jy.n; gi++) {
          var gx = x0 + (x1 - x0) * (gi / jy.n), lit = gx <= xq + 0.5, last = gi === jy.n, gh = last ? Ht * 0.42 : Ht * 0.2;
          if (jy.intro && lit && jy._lit !== undefined && gi > jy._lit && gi > 0) {
            for (var k3 = 0; k3 < 34; k3++) { var a3 = (-90 + (Math.random() - 0.5) * 160) * R, v3 = 300 * (0.3 + Math.random()); sparks.push({ x: gx, y: ty - gh, px: gx, py: ty - gh, vx: Math.cos(a3) * v3, vy: Math.sin(a3) * v3, t: 0, life: 0.35 + Math.random() * 0.4, w: 1 + Math.random() * 1.3 }); }
          }
          if (lit && (jy._lit === undefined || gi > jy._lit)) jy._lit = gi;
          c.lineCap = 'round';
          c.strokeStyle = lit ? rgba(hot, 1) : 'rgba(255,255,255,.18)'; c.shadowColor = rgba(hot, 1); c.shadowBlur = lit ? 12 : 0;
          c.lineWidth = last ? 3 : 2;
          if (gi > 0 && !last) { c.beginPath(); c.moveTo(gx - 7, ty); c.lineTo(gx - 7, ty - gh); c.quadraticCurveTo(gx, ty - gh - 8, gx + 7, ty - gh); c.lineTo(gx + 7, ty); c.stroke(); }
          if (gi === 0) { c.beginPath(); c.moveTo(gx, ty); c.lineTo(gx, ty - gh * 0.6); c.stroke(); }
          if (last) {
            c.beginPath(); c.moveTo(gx, ty); c.lineTo(gx, ty - gh); c.stroke();
            // the flag
            c.fillStyle = lit ? rgba(pale, 1) : rgba(hot, 0.9); c.beginPath(); c.moveTo(gx, ty - gh);
            for (var fxw = 0; fxw <= 10; fxw++) c.lineTo(gx + fxw * 3, ty - gh + Math.sin(t * 6 + fxw * 0.7) * 2.2 + fxw * 0.15);
            for (var fxb = 10; fxb >= 0; fxb--) c.lineTo(gx + fxb * 3, ty - gh + 16 + Math.sin(t * 6 + fxb * 0.7) * 2.2 + fxb * 0.15);
            c.closePath(); c.fill();
          }
          c.shadowBlur = 0;
          var mk = jy.marks[gi];
          if (mk != null && (gi === 0 || last || jy.n <= 6 || gi % 2 === 0)) { c.fillStyle = lit ? rgba(pale, 0.95) : 'rgba(255,255,255,.4)'; c.fillText(mk, gx, ty + Ht * 0.1); }
        }
        c.restore();
        // the runner, running in place where he is, the road sliding under him
        c.save(); c.strokeStyle = rgba(pale, 0.35); c.lineWidth = 1.4;
        for (var dl = 0; dl < 4; dl++) { var dx = xq - 10 - ((t * 120 + dl * 22) % 88); c.beginPath(); c.moveTo(dx, ty - 9 * s - dl * 5 * s); c.lineTo(dx - 14, ty - 9 * s - dl * 5 * s); c.stroke(); }
        c.restore();
        by = ty - HIPY * s;
        figure(c, runner(t), xq - 2 * s, by, s, 1, o2);
      } else if (kind === 'push') {
        s = Math.min(Wd / 100, Ht / 42); by = gy - HIPY * s;
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
      for (var sm = steam.length - 1; sm >= 0; sm--) {
        var e = steam[sm]; e.t += dt; if (e.t > e.life) { steam.splice(sm, 1); continue; }
        e.x += e.vx * dt; e.y += e.vy * dt; e.r += 8 * dt;
        var gs = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
        gs.addColorStop(0, rgba(pale, 0.16 * Math.sin((e.t / e.life) * Math.PI))); gs.addColorStop(1, rgba(pale, 0));
        c.fillStyle = gs; c.beginPath(); c.arc(e.x, e.y, e.r, 0, 2 * Math.PI); c.fill();
      }
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
