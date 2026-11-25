/* RTC coaches in 3D, for the live map (after delhi/iso.js).

   Each livery in COACH.L (coaches.js) is modelled as a real coach — 12 m long
   (x len), 2.6 m wide, 3.15 m tall (3.45 m for sleepers, 3.0 m low-floor) —
   under a fixed camera tilted 50° from overhead, at 16 headings. Faces are
   textured from the livery fields:

     sides   body, stripes, swoosh, skirt; separate framed windows, a single glass
             band (panel) or two rows (sleeper); doors on the kerb (left) side —
             behind the front axle on RTC coaches, ahead of it on low-floor and
             electric city buses, plus a middle door on city buses; 2 or 3 axles;
             the RTC roundel; a bolt on electrics
     front   windscreen with the driver on the right, amber destination board,
             lamps, the black mask of the electrics
     rear    rear window, tail lamps
     roof    roof colour, AC pod, battery housing, luggage carrier

   lit from the north-west, with a soft ground shadow. Sprites are drawn on
   demand: COACH3D.attach(map) answers MapLibre's styleimagemissing for
   `iso-<livery>-<dir>` (dir 0..15 = heading dir*22.5° clockwise from screen-up).
   Same {atlas, portrait} shape as BUSISO. No image files. */
'use strict';
const COACH3D = (() => {
  const WID = 2.6;
  const PX = 9, TILT = 50 * Math.PI / 180;         // sprite px per metre; camera tilt from overhead
  const CW = 156, CH = 116, AX = 78, AY = 68;      // sprite cell (logical px) and ground anchor
  const COS = Math.cos(TILT), SIN = Math.sin(TILT);
  const TOCAM = [0, -SIN, COS];
  const LIGHT = (() => { const v = [-0.45, 0.55, 0.8], n = Math.hypot(...v); return v.map(x => x / n); })();
  const U = 10;                                    // texture units per metre
  const SKIN = ['#b98463', '#8d5a3b', '#c99872', '#a0694a', '#7a4a2e'];
  const CLOTH = ['#e9e4d8', '#3b5b8c', '#c0392b', '#2e7d5b', '#f0c419', '#7d3c98', '#ffffff', '#d35400', '#34495e', '#e84393'];

  const geo = v => ({ len: 12 * (v.len || 1), hgt: v.sleeper ? 3.45 : v.low ? 3.0 : 3.15 });
  const front = v => !!(v.low || v.ev);            // low-floor / electric: door ahead of the front axle
  const wheelsAt = v => (v.axles || 2) === 3 ? [.17, .27, .84] : front(v) ? [.2, .78] : [.2, .84];

  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function tex(w, h, k, draw) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const g = c.getContext('2d'); g.scale(k, k); draw(g); return c;
  }

  /* a few passengers behind glass between u0..u1, glass from v0 to v1 */
  function people(g, r, u0, u1, v0, v1, skip) {
    const seats = [];
    for (let u = u0 + 2.5; u < u1 - 2; u += 4.2) if (!skip.some(([a, b]) => u > a - 1.5 && u < b + 1.5)) seats.push(u);
    g.save(); g.globalAlpha = 0.7;
    for (const u of seats) {
      if (r() > 0.5) continue;
      const headV = v0 + 6.6, w = 3.3, x = u + (r() - .5);
      g.fillStyle = CLOTH[(r() * CLOTH.length) | 0]; rr(g, x - w / 2, headV + 1.5, w, v1 - headV, 1.2); g.fill();
      g.fillStyle = SKIN[(r() * SKIN.length) | 0]; g.beginPath(); g.arc(x, headV, 1.35, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#1d1b1a'; g.beginPath(); g.arc(x, headV - 0.45, 1.25, Math.PI, 2 * Math.PI); g.fill();
    }
    g.restore();
  }

  /* side texture: rear at u=0, front at u=W; roof edge at v=0, ground at v=H.
     Livery y values are on coaches.js's 29-unit body and are scaled to BOT. */
  function sideTex(v, doors, seed) {
    const G = geo(v), W = G.len * U, H = G.hgt * U, BOT = H - 2.5, k = BOT / 29;
    return tex(W, H, 4, g => {
      const r = rnd(seed), X = f => f * W;
      const body = () => rr(g, 0.3, 0.3, W - 0.6, BOT - 0.3, 2.2);
      body(); g.fillStyle = v.body; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = v.roof; g.fillRect(0, 0, W, 2.4);
      for (const [y, h, c] of v.stripes || []) { g.fillStyle = c; g.fillRect(0, y * k, W, h * k); }
      g.fillStyle = v.skirt; g.fillRect(0, 25 * k, W, BOT - 25 * k);
      // swoosh: bands sweeping up from the rear wheel towards the front
      (v.swoosh || []).forEach((c, i) => {
        const o = i * 3.2; g.fillStyle = c; g.beginPath();
        g.moveTo(0, (21 - o) * k); g.bezierCurveTo(X(.25), (27 - o) * k, X(.45), (20 - o) * k, X(.8), (16.5 - o * .6) * k);
        g.lineTo(X(.82), (18.6 - o * .6) * k); g.bezierCurveTo(X(.47), (23 - o) * k, X(.25), (30.5 - o) * k, 0, (24.5 - o) * k);
        g.closePath(); g.fill();
      });
      const wb = wheelsAt(v), fd = front(v) ? [X(.865), X(.94)] : [X(.715), X(.785)];
      const doorAt = doors ? [fd, ...(v.mid || v.low ? [[X(.44), X(.505)]] : [])] : [];
      const wEnd = W - 4.5, gTop = 3.2, gBot = 15.2 * Math.min(k, 1.04);
      if (v.sleeper) {                             // two rows: lower seats, upper berths
        for (const [y0, h] of [[3.0, 7.4 * k], [3.0 + 8.6 * k, 6.6 * k]])
          for (let u = 3; u < wEnd - 8; u += 10.6) {
            if (doorAt.some(([a, b]) => u + 9.4 > a && u < b)) continue;
            g.fillStyle = v.glass; rr(g, u, y0, 9.4, h, 1); g.fill();
          }
        g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(3, 3.6, wEnd - 3, .7);
      } else if (v.panel) {
        g.fillStyle = v.glass; rr(g, 2.5, gTop, wEnd - 2.5, gBot - gTop, 1.4); g.fill();
        people(g, r, 3, wEnd, gTop, gBot, doorAt);
        g.fillStyle = 'rgba(255,255,255,.13)';
        for (let u = 16; u < wEnd - 4; u += 15) g.fillRect(u, gTop + .6, 0.6, gBot - gTop - 1.2);
      } else {
        g.fillStyle = v.frame || '#555'; g.fillRect(2, gTop - .8, wEnd - 2, gBot - gTop + 1.6);
        for (let u = 3.2; u < wEnd - 8; u += 11.2) {
          if (doorAt.some(([a, b]) => u + 9.6 > a && u < b)) continue;
          g.fillStyle = v.glass; rr(g, u, gTop, 9.6, gBot - gTop, 1); g.fill();
          g.save(); rr(g, u, gTop, 9.6, gBot - gTop, 1); g.clip(); people(g, r, u - 2, u + 12, gTop, gBot, []); g.restore();
          g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(u + 1, gTop + .8, 2.4, gBot - gTop - 1.6);
        }
      }
      const sh = g.createLinearGradient(0, gTop, 0, gBot); sh.addColorStop(0, 'rgba(255,255,255,.22)'); sh.addColorStop(.35, 'rgba(255,255,255,0)');
      g.fillStyle = sh; g.fillRect(0, gTop, wEnd, gBot - gTop);
      if (v.ev) {                                    // the bolt
        const bx = X(.3), by = 16 * k;
        g.fillStyle = v.bolt || '#9be22b'; g.beginPath();
        g.moveTo(bx + 4, by); g.lineTo(bx - 1, by + 6.5); g.lineTo(bx + 2.5, by + 6.5); g.lineTo(bx + .5, by + 11);
        g.lineTo(bx + 7, by + 4.5); g.lineTo(bx + 3.2, by + 4.5); g.lineTo(bx + 6, by); g.closePath(); g.fill();
      }
      // RTC roundel
      g.fillStyle = '#f2b705'; g.beginPath(); g.arc(X(.6), 20.5 * k, 2.1, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = '#c62f2f'; g.lineWidth = .55; g.stroke();
      for (const [a, b] of doorAt) {
        g.fillStyle = v.panel || v.sleeper ? '#22262b' : '#46525d'; rr(g, a, 2.8, b - a, BOT - 3.8, 0.8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect((a + b) / 2 - 0.3, 3.4, 0.6, BOT - 5);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(a + .6, 3.4, b - a - 1.2, 6);
      }
      if (v.mask) { g.fillStyle = v.mask; g.fillRect(W - 4.5, 0, 4.5, BOT - 6); }
      g.fillStyle = '#ffe9a8'; g.fillRect(W - 1.4, 19 * k, 1.4, 3);
      g.fillStyle = '#e8403a'; g.fillRect(0, 19 * k, 1.2, 3);
      g.restore();
      // wheels with arches
      for (const f of wb) {
        const u = X(f), c = BOT - 2.5;
        g.fillStyle = '#121417'; g.beginPath(); g.arc(u, c, 6.2, Math.PI, 0); g.fill();
        g.fillStyle = '#1e2226'; g.beginPath(); g.arc(u, c, 5, 0, 2 * Math.PI); g.fill();
        g.fillStyle = '#aeb4ba'; g.beginPath(); g.arc(u, c, 2.4, 0, 2 * Math.PI); g.fill();
        g.fillStyle = '#5f656b'; g.beginPath(); g.arc(u, c, 0.9, 0, 2 * Math.PI); g.fill();
      }
    });
  }
  const accent = v => (v.swoosh && v.swoosh[0]) || (v.stripes && v.stripes[0] && v.stripes[0][2]) || v.skirt;
  /* front: viewer's left (u=0) is the bus's right side, where the driver sits */
  function frontTex(v) {
    const G = geo(v), W = WID * U, H = G.hgt * U, BOT = H - 2.5;
    return tex(W, H, 6, g => {
      rr(g, 0.3, 0.3, W - 0.6, BOT - 0.3, 2.5); g.fillStyle = v.mask || v.body; g.fill();
      g.fillStyle = '#1a1f25'; rr(g, 1.4, 1, W - 2.8, 3.2, 0.6); g.fill();                  // LED board
      g.fillStyle = '#ffb42e'; for (let u = 2.4; u < W - 2.4; u += 1.15) g.fillRect(u, 1.9, 0.6, 1.4);
      const wsB = BOT - 11.5;
      g.fillStyle = '#20262d'; rr(g, 1.2, 5, W - 2.4, wsB - 5, 1.2); g.fill();                // windscreen
      g.fillStyle = '#c99872'; g.beginPath(); g.arc(6.5, 10.5, 1.5, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#e9e4d8'; rr(g, 4.5, 12, 4, Math.max(2, wsB - 12), 1); g.fill();
      const sh = g.createLinearGradient(0, 5, W, wsB); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(.4, 'rgba(255,255,255,0)');
      g.fillStyle = sh; rr(g, 1.2, 5, W - 2.4, wsB - 5, 1.2); g.fill();
      g.fillStyle = v.mask ? v.mask : v.body; g.fillRect(0.3, wsB + 1, W - 0.6, BOT - wsB - 1);
      g.fillStyle = accent(v); g.fillRect(0.3, wsB + 2, W - 0.6, 1.2);
      g.fillStyle = v.skirt; g.fillRect(0.3, BOT - 4, W - 0.6, 3.7);
      if (v.mask && v.ev) { g.fillStyle = v.skirt; g.fillRect(0.3, wsB + 3.2, W - 0.6, 1); }
      g.fillStyle = '#fff4cf'; rr(g, 1.2, BOT - 7, 3.6, 2, 0.6); g.fill(); rr(g, W - 4.8, BOT - 7, 3.6, 2, 0.6); g.fill();
      g.fillStyle = '#f2d23a'; g.fillRect(W / 2 - 3, BOT - 3.6, 6, 1.8);                     // number plate
      g.fillStyle = '#121417'; g.fillRect(2, BOT, 4.5, 2.5); g.fillRect(W - 6.5, BOT, 4.5, 2.5);
    });
  }
  function rearTex(v) {
    const G = geo(v), W = WID * U, H = G.hgt * U, BOT = H - 2.5;
    return tex(W, H, 6, g => {
      rr(g, 0.3, 0.3, W - 0.6, BOT - 0.3, 2); g.fillStyle = v.body; g.fill();
      g.fillStyle = v.roof; g.fillRect(0.3, 0.3, W - 0.6, 2.2);
      g.fillStyle = v.glass; rr(g, 3, 4, W - 6, 8, 1); g.fill();
      g.fillStyle = accent(v); g.fillRect(0.3, BOT - 11, W - 0.6, 1.4);
      g.fillStyle = v.skirt; g.fillRect(0.3, BOT - 5, W - 0.6, 4.7);
      g.fillStyle = '#e8403a'; rr(g, 1, BOT - 12.5, 2.4, 5, 0.6); g.fill(); rr(g, W - 3.4, BOT - 12.5, 2.4, 5, 0.6); g.fill();
      g.fillStyle = '#f2d23a'; g.fillRect(W / 2 - 3, BOT - 4, 6, 1.8);
      g.fillStyle = '#121417'; g.fillRect(2, BOT, 4.5, 2.5); g.fillRect(W - 6.5, BOT, 4.5, 2.5);
    });
  }

  /* ── projection ── */
  function proj(e, n, z) { return [AX + PX * e, AY - PX * (n * COS + z * SIN)]; }
  function frame(h) {
    const r = h * Math.PI / 180, f = [Math.sin(r), Math.cos(r)], l = [-Math.cos(r), Math.sin(r)];
    return (a, b, z) => proj(a * f[0] + b * l[0], a * f[1] + b * l[1], z);
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function fill(g, poly) { g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
  function shade(g, poly, normal, k = 1) {
    const lit = 0.66 + 0.34 * Math.max(0, dot(normal, LIGHT));
    if (lit < 0.999) { g.fillStyle = `rgba(10,12,20,${((1 - lit) * k).toFixed(3)})`; fill(g, poly); }
  }
  function mapTex(g, base, c, tw, th, O, A, B, poly) {
    g.save();
    g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
    const [s, ox, oy] = base;
    g.setTransform(s * A[0] / tw, s * A[1] / tw, s * B[0] / th, s * B[1] / th, ox + s * O[0], oy + s * O[1]);
    g.drawImage(c, 0, 0, tw, th);
    g.restore();
  }
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];

  function box(g, P, h, a0, a1, b0, b1, z0, z1, col) {
    const r = h * Math.PI / 180, f = [Math.sin(r), Math.cos(r), 0], l = [-Math.cos(r), Math.sin(r), 0];
    const faces = [[[a1, b0], [a1, b1], f], [[a0, b1], [a0, b0], f.map(x => -x)], [[a0, b1], [a1, b1], l], [[a1, b0], [a0, b0], l.map(x => -x)]];
    for (const [[pa, pb], [qa, qb], nrm] of faces) {
      if (dot(nrm, TOCAM) <= 0) continue;
      const poly = [P(pa, pb, z0), P(qa, qb, z0), P(qa, qb, z1), P(pa, pb, z1)];
      g.fillStyle = col; fill(g, poly); shade(g, poly, nrm, 1.1);
    }
    const top = [P(a0, b0, z1), P(a1, b0, z1), P(a1, b1, z1), P(a0, b1, z1)];
    g.fillStyle = col; fill(g, top);
    g.fillStyle = 'rgba(255,255,255,.12)'; fill(g, top);
  }
  // luggage carrier: a rail frame standing on posts over the rear half of the roof
  function rack(g, P, a0, a1, B, z) {
    g.strokeStyle = 'rgba(48,52,58,.85)'; g.lineWidth = 0.45; g.lineJoin = 'round';
    const zt = z + 0.32, b = B - 0.25;
    g.beginPath();
    for (const a of [a0, a1]) for (const bb of [-b, b]) { const p = P(a, bb, z), q = P(a, bb, zt); g.moveTo(...p); g.lineTo(...q); }
    const ring = [P(a0, -b, zt), P(a1, -b, zt), P(a1, b, zt), P(a0, b, zt)];
    ring.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath();
    for (let a = a0 + 0.7; a < a1; a += 0.7) { g.moveTo(...P(a, -b, zt)); g.lineTo(...P(a, b, zt)); }
    g.stroke();
  }

  /* one coach at heading h (degrees clockwise from screen-up) into g, scale s at (ox, oy) */
  function bus(g, base, v, T, h) {
    const G = geo(v), HGT = G.hgt, P = frame(h), r = h * Math.PI / 180;
    const f = [Math.sin(r), Math.cos(r), 0], l = [-Math.cos(r), Math.sin(r), 0];
    const A = G.len / 2, B = WID / 2;
    const [s, ox, oy] = base;
    g.setTransform(s, 0, 0, s, ox, oy);
    const sx = 0.5, sy = -0.4, Psh = (a, b) => { const p = P(a, b, 0); return [p[0] + sx * PX, p[1] - sy * PX * COS]; };
    g.fillStyle = 'rgba(20,20,30,.13)'; fill(g, [Psh(-A - .5, -B - .5), Psh(A + .5, -B - .5), Psh(A + .5, B + .5), Psh(-A - .5, B + .5)]);
    g.fillStyle = 'rgba(20,20,30,.22)'; fill(g, [Psh(-A, -B), Psh(A, -B), Psh(A, B), Psh(-A, B)]);
    const tw = G.len * U, th = HGT * U;
    const faces = [
      { n: l.map(x => -x), tl: P(-A, -B, HGT), tr: P(A, -B, HGT), bl: P(-A, -B, 0), c: T.right, tw, th },
      { n: l, tl: P(-A, B, HGT), tr: P(A, B, HGT), bl: P(-A, B, 0), c: T.left, tw, th },
      { n: f, tl: P(A, -B, HGT), tr: P(A, B, HGT), bl: P(A, -B, 0), c: T.front, tw: WID * U, th },
      { n: f.map(x => -x), tl: P(-A, B, HGT), tr: P(-A, -B, HGT), bl: P(-A, B, 0), c: T.rear, tw: WID * U, th },
    ];
    for (const F of faces) {
      if (dot(F.n, TOCAM) <= 0) continue;
      const br = [F.tr[0] + F.bl[0] - F.tl[0], F.tr[1] + F.bl[1] - F.tl[1]];
      const poly = [F.tl, F.tr, br, F.bl];
      mapTex(g, base, F.c, F.tw, F.th, F.tl, sub(F.tr, F.tl), sub(F.bl, F.tl), poly);
      g.setTransform(s, 0, 0, s, ox, oy);
      shade(g, poly, F.n);
    }
    const roof = [P(-A, -B, HGT), P(A, -B, HGT), P(A, B, HGT), P(-A, B, HGT)];
    g.fillStyle = v.roof; fill(g, roof);
    g.fillStyle = 'rgba(255,255,255,.16)'; fill(g, [P(-A + .4, -B + .5, HGT), P(A - .4, -B + .5, HGT), P(A - .4, B - .5, HGT), P(-A + .4, B - .5, HGT)]);
    // roof edge in the livery's accent, as on the photographs (green on Pallevelugu and the electrics)
    if (v.roofEdge) { g.fillStyle = v.roofEdge; for (const bb of [-B, B - .28]) fill(g, [P(-A, bb, HGT), P(A, bb, HGT), P(A, bb + .28, HGT), P(-A, bb + .28, HGT)]); }
    if (v.mask) { g.fillStyle = v.mask; fill(g, [P(A - .5, -B, HGT), P(A, -B, HGT), P(A, B, HGT), P(A - .5, B, HGT)]); }
    const eq = [];
    if (v.ev) eq.push([-A + 1.2, -A + 4.6, -0.95, 0.95, 0.32, v.roof]);
    if (v.ac) eq.push(v.ev ? [A - 4.4, A - 2.2, -0.85, 0.85, 0.42, '#e9eef3'] : [-1.4, 1.4, -0.85, 0.85, 0.42, '#e9eef3']);
    if (!v.ev && !v.ac) { eq.push([1.6, 2.4, -0.45, 0.45, 0.1, '#cfd8de']); if (!v.carrier) eq.push([-3.2, -2.4, -0.45, 0.45, 0.1, '#cfd8de']); }
    const depth = p => dot([f[0] * (p[0] + p[1]) / 2, f[1] * (p[0] + p[1]) / 2, 0], TOCAM);
    eq.sort((p, q) => depth(p) - depth(q));
    for (const [a0, a1, b0, b1, hh, col] of eq) box(g, P, h, a0, a1, b0, b1, HGT, HGT + hh, col);
    if (v.carrier) rack(g, P, -A + 0.8, A * 0.15, B, HGT);
    g.strokeStyle = 'rgba(18,20,26,.45)'; g.lineWidth = 0.6; g.lineJoin = 'round';
    g.beginPath(); roof.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  }

  const texCache = new Map();
  function textures(lv) {
    if (!texCache.has(lv)) {
      const v = COACH.L[lv], seed = lv.length * 97 + lv.charCodeAt(0) * 13;
      texCache.set(lv, { right: sideTex(v, false, seed), left: sideTex(v, true, seed + 7), front: frontTex(v), rear: rearTex(v) });
    }
    return texCache.get(lv);
  }
  function sprite(lv, dir, scale) {
    const c = document.createElement('canvas'); c.width = Math.round(CW * scale); c.height = Math.round(CH * scale);
    bus(c.getContext('2d'), [scale, 0, 0], COACH.L[lv], textures(lv), dir * 22.5);
    return c;
  }

  /* Atlas of every livery x 16 headings, keyed `${livery}:${dir}`. Same shape as BUSISO.atlas. */
  function atlas(scale = 1.25, maxW = 4096) {
    const keys = Object.keys(COACH.L), cw = Math.round(CW * scale), ch = Math.round(CH * scale);
    const cols = Math.floor(maxW / cw), rows = Math.ceil(keys.length * 16 / cols);
    const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
    const g = c.getContext('2d'), uv = {};
    let i = 0;
    for (const lv of keys) for (let d = 0; d < 16; d++) {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; i++;
      uv[`${lv}:${d}`] = [x / c.width, y / c.height, (x + cw) / c.width, (y + ch) / c.height];
      g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip();
      bus(g, [scale, x, y], COACH.L[lv], textures(lv), d * 22.5);
      g.restore(); g.setTransform(1, 0, 0, 1, 0, 0);
    }
    return { canvas: c, uv, cell: [CW, CH], anchor: [AX, AY] };
  }
  // a single coach for the bus card: three-quarter view of the door side
  const portraits = new Map();
  function portrait(lv, h = 247.5, scale = 2.4) {
    const key = lv + ':' + h;
    if (!portraits.has(key)) {
      const c = document.createElement('canvas'); c.width = CW * scale; c.height = CH * scale;
      bus(c.getContext('2d'), [scale, 0, 0], COACH.L[lv], textures(lv), h);
      portraits.set(key, c.toDataURL('image/png'));
    }
    return portraits.get(key);
  }

  /* map glue: sprites `iso-<livery>-<dir>` are drawn the first time a bus needs one */
  const SCALE = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
  function add(map, id, lv, dir) {
    if (map.hasImage(id)) return;
    const c = sprite(lv, dir % 16, SCALE);
    map.addImage(id, c.getContext('2d').getImageData(0, 0, c.width, c.height), { pixelRatio: SCALE });
  }
  function attach(map) {
    // Eager: register every livery x 16 headings up front. The lazy styleimagemissing
    // path missed the first render (buses loaded invisible), so we pre-build instead.
    const build = () => { for (const lv of Object.keys(COACH.L)) for (let d = 0; d < 16; d++) add(map, `iso-${lv}-${d}`, lv, d); };
    map.on('styleimagemissing', e => {               // fallback for anything unexpected
      const m = /^iso-([a-z0-9_]+)-(\d+)$/.exec(e.id);
      if (m && COACH.L[m[1]]) add(map, e.id, m[1], +m[2]);
    });
    if (map.isStyleLoaded()) build(); else map.once('load', build);
    build();
  }
  // heading bucket for a compass bearing on a map rotated by mapBearing
  const dirOf = (brg, mapBearing = 0) => Math.round(((((brg || 0) - mapBearing) % 360 + 360) % 360) / 22.5) % 16;
  // icon-offset that puts the wheels' ground point on the coordinate (icon-anchor: center)
  const OFFSET = [CW / 2 - AX, CH / 2 - AY];
  return { atlas, portrait, attach, dirOf, sprite, OFFSET, CELL: [CW, CH], ANCHOR: [AX, AY] };
})();
