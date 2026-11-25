/* Flat bus drawings for the Bengaluru live map (MTC's buses.js): top-down at city zoom, side views, card badges.
   The same livery keys and colours as coaches.js (the 3D buses), from BMTC's fleet: Bengaluru Sarige white over
   blue, metro feeder on the Sarige livery, Vegadootha Express light blue-and-white, Vajra light-blue Volvo, Vayu
   Vajra blue Volvo, Astra electric turquoise. */
'use strict';
const BUSART = (() => {
  const L = {
    sarige:  { name: 'Bengaluru Sarige', roof: '#e9ecee', body: '#f5f6f4', skirt: '#2a62b8', glass: '#26303a', stripe: '#2a62b8', bolt: null, mask: '#2a62b8', key: '#2a62b8', ev: 0, ac: 0, panel: 0 },
    feeder:  { name: 'Metro feeder', roof: '#e9ecee', body: '#f5f6f4', skirt: '#2a62b8', glass: '#26303a', stripe: '#2a62b8', bolt: null, mask: '#2a62b8', key: '#2a62b8', ev: 0, ac: 0, panel: 0 },
    express: { name: 'Vegadootha Express', roof: '#e8eef2', body: '#f6f8f9', skirt: '#6fb3e6', glass: '#1d2733', stripe: '#2f7cc0', bolt: null, mask: '#2f7cc0', key: '#4a9ad8', ev: 0, ac: 0, panel: 0 },
    vajra:   { name: 'Vajra', roof: '#d6ecf8', body: '#8fcbef', skirt: '#4c9bd6', glass: '#121a22', stripe: '#ffffff', bolt: null, mask: '#121a22', key: '#5aaee6', ev: 0, ac: 1, panel: 1 },
    vayu:    { name: 'Vayu Vajra', roof: '#cfe6f6', body: '#4f9fdc', skirt: '#2a6fb0', glass: '#10171f', stripe: '#ffffff', bolt: null, mask: '#10171f', key: '#2f86d0', ev: 0, ac: 1, panel: 1 },
    astra:   { name: 'Astra electric', roof: '#e2f1f0', body: '#1bb3ae', skirt: '#0f8f8b', glass: '#141a1f', stripe: '#ffffff', bolt: '#ffffff', mask: '#16191d', key: '#12a4a0', ev: 1, ac: 0, panel: 1 },
  };
  const of = fl => fl.includes('e') ? 'astra' : fl.includes('K') ? 'vayu' : fl.includes('a') ? 'vajra' : 'sarige';

  function rr(g, x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + tl, y); g.lineTo(x + w - tr, y); g.quadraticCurveTo(x + w, y, x + w, y + tr);
    g.lineTo(x + w, y + h - br); g.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    g.lineTo(x + bl, y + h); g.quadraticCurveTo(x, y + h, x, y + h - bl);
    g.lineTo(x, y + tl); g.quadraticCurveTo(x, y, x + tl, y); g.closePath();
  }

  /* side view, facing right, on a 100 x 44 grid */
  function side(g, v) {
    const B = { x: 3, y: 7, w: 92, h: 29 };
    // ground shadow
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(50, 39.5, 46, 2.6, 0, 0, 2 * Math.PI); g.fill();
    // roof equipment: battery housing on electrics, AC pod on AC buses
    g.fillStyle = v.roof;
    if (v.ev) { rr(g, 30, 3.2, 34, 4.6, [2.5, 2.5, 0, 0]); g.fill(); }
    if (v.ac) { rr(g, v.ev ? 66 : 42, 3.6, 16, 4.2, [2, 2, 0, 0]); g.fill(); }
    // body
    rr(g, B.x, B.y, B.w, B.h, [6, 7, 2, 2]); g.fillStyle = v.body; g.fill();
    // roof band
    g.save(); rr(g, B.x, B.y, B.w, B.h, [6, 7, 2, 2]); g.clip();
    g.fillStyle = v.roof; g.fillRect(B.x, B.y, B.w, 3.2);
    if (v.panel) {
      // one long black glass band, as on the EiV12
      g.fillStyle = v.glass; g.fillRect(B.x, B.y + 3.2, B.w, 13.5);
      g.fillStyle = 'rgba(255,255,255,.16)';
      for (const x of [16, 33, 50, 63]) g.fillRect(x, B.y + 4.5, 0.7, 11);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(B.x, B.y + 3.6, B.w, 2.2);
    } else {
      // separate windows in a pale body, as on the standard-floor Leyland
      g.fillStyle = v.glass;
      for (let x = 6; x < 66; x += 11.5) { rr(g, x, B.y + 4.6, 9.8, 10, 1.2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 6; x < 66; x += 11.5) g.fillRect(x + 1, B.y + 5.4, 3, 8.4);
    }
    // livery below the glass
    g.fillStyle = v.stripe; g.fillRect(B.x, B.y + 17, B.w, 1.5);
    g.fillStyle = v.skirt; g.fillRect(B.x, B.y + 24.5, B.w, 4.5);
    if (v.panel && v.skirt !== v.body) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(B.x, B.y + 23.6, B.w, 0.9); }
    if (v.bolt) {
      g.fillStyle = v.bolt; g.beginPath();
      g.moveTo(15, 19.5); g.lineTo(10, 27.5); g.lineTo(13.5, 27.5); g.lineTo(11.5, 33); g.lineTo(18, 24.5); g.lineTo(14.2, 24.5); g.lineTo(17, 19.5); g.closePath(); g.fill();
    }
    // doors: middle and front
    g.fillStyle = v.panel ? '#22262b' : '#4a5864';
    rr(g, 40, B.y + 4.5, 7, 23.5, 1); g.fill();
    rr(g, 76.5, B.y + 4.5, 7, 23.5, 1); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(43.2, B.y + 5.5, 0.6, 21.5); g.fillRect(79.7, B.y + 5.5, 0.6, 21.5);
    // the nose: black mask on the electrics, pale front on the diesel
    g.fillStyle = v.mask; g.beginPath();
    g.moveTo(86, B.y); g.lineTo(B.x + B.w, B.y); g.lineTo(B.x + B.w, B.y + B.h - 6); g.lineTo(86, B.y + B.h - 6); g.closePath(); g.fill();
    g.fillStyle = v.body; g.fillRect(86, B.y + B.h - 6, B.x + B.w - 86, 6);
    // windscreen and destination board
    g.fillStyle = '#1b2026'; rr(g, 88, B.y + 2.2, 6.4, 15, [1, 4, 1, 1]); g.fill();
    g.fillStyle = '#ffb42e'; for (let x = 88.8; x < 93.8; x += 1.25) g.fillRect(x, B.y + 3.2, 0.7, 1.4);
    // lamps
    g.fillStyle = '#fff6d6'; g.fillRect(93.2, B.y + 19, 1.2, 5);
    g.fillStyle = '#ff5a4a'; g.fillRect(B.x, B.y + 19, 1.1, 3);
    g.restore();
    // mirror
    g.strokeStyle = '#1b2026'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(94, B.y + 4); g.lineTo(97.2, B.y + 5); g.lineTo(97.2, B.y + 9); g.stroke();
    // wheels and arches
    for (const cx of [22, 72]) {
      g.fillStyle = '#16191d'; g.beginPath(); g.arc(cx, 36, 7.4, Math.PI, 0); g.fill();
      g.fillStyle = '#23272c'; g.beginPath(); g.arc(cx, 36, 5.6, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#b9bec4'; g.beginPath(); g.arc(cx, 36, 2.8, 0, 2 * Math.PI); g.fill();
      g.fillStyle = '#6f757b'; g.beginPath(); g.arc(cx, 36, 1.1, 0, 2 * Math.PI); g.fill();
    }
    // outline so a pale bus still reads on the cream map
    g.strokeStyle = 'rgba(20,24,28,.55)'; g.lineWidth = 0.8;
    rr(g, B.x, B.y, B.w, B.h, [6, 7, 2, 2]); g.stroke();
  }

  /* top-down, nose up, on a 20 x 48 grid */
  function top(g, v) {
    g.fillStyle = 'rgba(0,0,0,.22)'; rr(g, 3.4, 3.4, 15, 43, 4); g.fill();
    rr(g, 2.5, 2, 15, 43, [5, 5, 3, 3]); g.fillStyle = v.body; g.fill();
    g.save(); rr(g, 2.5, 2, 15, 43, [5, 5, 3, 3]); g.clip();
    g.fillStyle = v.roof; g.fillRect(4, 7.5, 12, 35.5);
    g.fillStyle = v.glass; g.fillRect(2.5, 2, 15, 5.2);                  // windscreen
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(4, 3, 5, 1.4);
    g.fillStyle = v.glass; g.fillRect(4, 42.2, 12, 2);                    // rear glass
    if (v.ev) { g.fillStyle = 'rgba(0,0,0,.18)'; rr(g, 5.5, 14, 9, 15, 1.6); g.fill(); g.fillStyle = v.roof; rr(g, 6, 14.4, 8, 14, 1.4); g.fill(); }
    if (v.ac) { g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, 6, v.ev ? 31 : 20, 8, 7, 1.4); g.fill(); g.fillStyle = '#f4f6f8'; rr(g, 6.5, v.ev ? 31.4 : 20.4, 7, 6, 1.2); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(20,24,28,.7)'; g.lineWidth = 0.9; rr(g, 2.5, 2, 15, 43, [5, 5, 3, 3]); g.stroke();
  }

  function canvas(w, h, scale, draw, flip) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d');
    if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.scale(scale, scale); draw(g);
    return c;
  }

  // register map sprites: top-<lv>, side-<lv>-r, side-<lv>-l
  function register(map) {
    for (const [k, v] of Object.entries(L)) {
      if (map.hasImage('top-' + k)) continue;
      const t = canvas(20, 48, 4, g => top(g, v));
      map.addImage('top-' + k, t.getContext('2d').getImageData(0, 0, t.width, t.height), { pixelRatio: 4 });
      for (const [dir, flip] of [['r', false], ['l', true]]) {
        const s = canvas(100, 44, 3, g => side(g, v), flip);
        map.addImage(`side-${k}-${dir}`, s.getContext('2d').getImageData(0, 0, s.width, s.height), { pixelRatio: 3 });
      }
    }
  }
  // a large side view for the bus card
  function portrait(k, flip) {
    return canvas(100, 44, 6, g => side(g, L[k]), flip).toDataURL('image/png');
  }
  const topView = k => canvas(20, 48, 6, g => top(g, L[k])).toDataURL('image/png');

  /* One texture for the WebGL bus layer: every livery top-down and side-on in
     both directions, a soft round glow (tinted per bus in the shader) and the
     AC snowflake. Returns the canvas and each sprite's UV rectangle. */
  function snowflake(g, cx, cy, r) {
    g.save(); g.translate(cx, cy); g.lineCap = 'round';
    for (const [w, col] of [[r * 0.34, '#ffffff'], [r * 0.16, '#2f86d6']]) {   // white halo, then the flake
      g.strokeStyle = col; g.lineWidth = w;
      for (let k = 0; k < 6; k++) {
        g.save(); g.rotate(k * Math.PI / 3);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r);
        g.moveTo(0, -r * 0.55); g.lineTo(-r * 0.28, -r * 0.78);
        g.moveTo(0, -r * 0.55); g.lineTo(r * 0.28, -r * 0.78);
        g.stroke(); g.restore();
      }
    }
    g.fillStyle = '#2f86d6'; g.beginPath(); g.arc(0, 0, r * 0.14, 0, 2 * Math.PI); g.fill();
    g.restore();
  }
  function atlas() {
    const S = 3, keys = Object.keys(L);
    const W = 1024, rowH = 48 * S + 4, H = 64 + keys.length * rowH + 8;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), uv = {};
    const put = (key, x, y, w, h, draw, flip) => {
      g.save(); g.translate(x, y);
      if (flip) { g.translate(w, 0); g.scale(-1, 1); }
      draw(g); g.restore();
      uv[key] = [x / W, y / H, (x + w) / W, (y + h) / H];
    };
    // glow: a radial falloff in white, coloured per bus by the shader
    put('glow', 0, 0, 64, 64, gg => {
      const r = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      gg.fillStyle = r; gg.fillRect(0, 0, 64, 64);
    });
    put('snow', 68, 0, 56, 56, gg => snowflake(gg, 28, 28, 22));
    keys.forEach((k, i) => {
      const y = 64 + i * rowH;
      put('top-' + k, 0, y, 20 * S, 48 * S, gg => { gg.scale(S, S); top(gg, L[k]); });
      put(`side-${k}-r`, 70, y, 100 * S, 44 * S, gg => { gg.scale(S, S); side(gg, L[k]); });
      put(`side-${k}-l`, 380, y, 100 * S, 44 * S, gg => { gg.scale(S, S); side(gg, L[k]); }, true);
    });
    return { canvas: c, uv };
  }
  return { L, of, register, portrait, topView, atlas };
})();
