/* BUSISO for the Bengaluru live map, drawn by TGSRTC's 3D bus renderer (coaches3d.js) with BMTC's liveries
   (coaches.js), so live.js (the MTC map's live layer, which expects iso.js) runs unchanged.
   coaches3d draws no passengers, so the three crowd levels share one drawing; the glow, snowflake and the
   parked "z" cells come from the flat set (buses.js) as in iso.js. Loaded after buses.js and coaches3d.js. */
'use strict';
const BUSISO = (() => {
  const [CW, CH] = COACH3D.CELL, [AX, AY] = COACH3D.ANCHOR;
  function atlas(scale = 1.25, maxW = 4096) {
    const A = COACH3D.atlas(scale, maxW), src = A.canvas, cw = Math.round(CW * scale), ch = Math.round(CH * scale);
    // room for 3 more cells (glow, snow, zzz) below the coach sheet
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height + ch;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const uv = {};
    for (const [k, [u0, v0, u1, v1]] of Object.entries(A.uv)) {
      const r = [u0, v0 * src.height / c.height, u1, v1 * src.height / c.height];
      for (let crowd = 0; crowd < 3; crowd++) uv[`${k}:${crowd}`] = r;
    }
    const flat = BUSART.atlas(), fu = flat.uv, fc = flat.canvas, side = Math.min(cw, ch), y = src.height;
    ['glow', 'snow', 'zzz'].forEach((k, i) => {
      const x = i * cw;
      if (k === 'zzz') {
        g.save(); g.translate(x + side / 2, y + side / 2);
        g.font = `900 ${Math.round(side * 0.78)}px -apple-system, 'Segoe UI', Roboto, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = side * 0.12; g.strokeStyle = '#ffffff'; g.strokeText('z', 0, 0);
        g.fillStyle = '#4b5a86'; g.fillText('z', 0, 0); g.restore();
      } else {
        const [u0, v0, u1, v1] = fu[k];
        g.drawImage(fc, u0 * fc.width, v0 * fc.height, (u1 - u0) * fc.width, (v1 - v0) * fc.height, x, y, side, side);
      }
      uv[k] = [x / c.width, y / c.height, (x + side) / c.width, (y + side) / c.height];
    });
    return { canvas: c, uv, cell: [CW, CH], anchor: [AX, AY] };
  }
  const portrait = (lv, crowd) => COACH3D.portrait(lv);
  return { atlas, portrait, CELL: [CW, CH], ANCHOR: [AX, AY] };
})();
