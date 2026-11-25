/* DEMO DATA for the Bengaluru bus map. The map's scripts expect a server (data/*.json, live/*.json); this file stands
   in for it so the page runs by itself. It answers those same requests from inside the browser (a fetch shim) with
   data it generates: synthetic routes between real Bengaluru areas (straight-ish lines, not roads), their stops,
   timetables, observed speeds, and about 180 buses that run the routes all day, with predicted arrival times,
   in the same format as live/vehicles.json (fmt 2) and live/delta/<t>.json.
   The routes, stop names, timings and buses are INVENTED. Add ?real to the page address to turn this off and use
   real data/ and live/ files served beside the page. Must load before app.js. */
'use strict';
(() => {
  // Phase 1: Real GTFS data is generated and active. Disable synthetic interception by default; pass ?demo to force mock data.
  if (/[?&]real\b/.test(location.search) || !/[?&]demo\b/.test(location.search)) {
    // Update or hide demo tag if present
    window.addEventListener('DOMContentLoaded', () => {
      const dt = document.getElementById('demo-tag');
      if (dt) { dt.textContent = 'BMTC GTFS Data Active'; dt.style.background = 'rgba(21,128,61,.85)'; }
      const sm = document.querySelector('#panel h1 small');
      if (sm) sm.textContent = 'GTFS data';
    });
    return;
  }
  const K = 111320, RAD = Math.PI / 180;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const dist = (a, b) => Math.hypot((b[1] - a[1]) * K * Math.cos(a[0] * RAD), (b[0] - a[0]) * K);   // [lat, lon] pairs, metres

  /* ── places: [lat, lon] ── */
  const HUB = {
    'Majestic': [12.9774, 77.5724], 'Shivajinagar': [12.9857, 77.6040], 'MG Road': [12.9756, 77.6068], 'Ulsoor': [12.9812, 77.6208],
    'Indiranagar': [12.9719, 77.6412], 'Domlur': [12.9609, 77.6387], 'Marathahalli': [12.9569, 77.7011], 'Whitefield': [12.9698, 77.7500],
    'Kadugodi': [12.9991, 77.7615], 'KR Puram': [13.0074, 77.6960], 'Banaswadi': [13.0108, 77.6516], 'Hennur': [13.0360, 77.6420],
    'Hebbal': [13.0358, 77.5970], 'Yelahanka': [13.1007, 77.5963], 'Airport': [13.1989, 77.7068], 'Nagawara': [13.0450, 77.6200],
    'Mekhri Circle': [13.0143, 77.5806], 'Malleswaram': [13.0031, 77.5710], 'Yeshwanthpur': [13.0285, 77.5400], 'Peenya': [13.0285, 77.5197],
    'Rajajinagar': [12.9910, 77.5520], 'Vijayanagar': [12.9719, 77.5300], 'Kengeri': [12.9177, 77.4833], 'Banashankari': [12.9255, 77.5468],
    'Jayanagar': [12.9299, 77.5838], 'Lalbagh': [12.9507, 77.5848], 'JP Nagar': [12.9063, 77.5857], 'Gottigere': [12.8570, 77.5780],
    'Koramangala': [12.9352, 77.6245], 'Silk Board': [12.9176, 77.6233], 'HSR Layout': [12.9116, 77.6389], 'Bellandur': [12.9260, 77.6762],
    'Sarjapur': [12.9100, 77.6870], 'Electronic City': [12.8456, 77.6603], 'Richmond Circle': [12.9650, 77.5990],
  };
  const NAMES = { 'Majestic': 'Majestic (Kempegowda Bus Station)', 'Airport': 'Kempegowda Airport', 'Kengeri': 'Kengeri TTMC', 'Whitefield': 'Whitefield TTMC' };
  const nm = k => NAMES[k] || k;

  /* ── services: number, family, hubs it runs through ── */
  const SVC = [
    ['1', 'regular', ['Majestic', 'Richmond Circle', 'Koramangala', 'Silk Board']],
    ['15', 'regular', ['Majestic', 'Lalbagh', 'Jayanagar', 'JP Nagar']],
    ['43', 'regular', ['Majestic', 'Malleswaram', 'Mekhri Circle', 'Hebbal']],
    ['201', 'regular', ['Banashankari', 'Jayanagar', 'Lalbagh', 'Majestic', 'Shivajinagar']],
    ['210', 'regular', ['Kengeri', 'Vijayanagar', 'Majestic']],
    ['253', 'regular', ['Yeshwanthpur', 'Rajajinagar', 'Majestic', 'Richmond Circle']],
    ['298', 'regular', ['Hebbal', 'Nagawara', 'Banaswadi', 'KR Puram']],
    ['335E', 'regular', ['Majestic', 'Shivajinagar', 'Ulsoor', 'Domlur', 'Marathahalli', 'Whitefield']],
    ['500-D', 'regular', ['Hebbal', 'Shivajinagar', 'Richmond Circle', 'Koramangala', 'Silk Board']],
    ['500-K', 'regular', ['Kadugodi', 'Marathahalli', 'Bellandur', 'Silk Board']],
    ['365', 'regular', ['Yelahanka', 'Hebbal', 'Mekhri Circle', 'Majestic']],
    ['G-4', 'bigcircle', ['Majestic', 'Malleswaram', 'Hebbal', 'Nagawara', 'Banaswadi', 'Indiranagar']],
    ['G-3', 'bigcircle', ['Silk Board', 'HSR Layout', 'Bellandur', 'Marathahalli', 'Domlur']],
    ['G-2', 'bigcircle', ['Banashankari', 'JP Nagar', 'Silk Board', 'Koramangala']],
    ['V-335E', 'vajra', ['Majestic', 'Shivajinagar', 'Domlur', 'Marathahalli', 'Whitefield']],
    ['V-500K', 'vajra', ['Kadugodi', 'Marathahalli', 'Bellandur', 'Silk Board']],
    ['V-365', 'vajra', ['Yelahanka', 'Hebbal', 'Majestic']],
    ['KIA-9', 'kia', ['Majestic', 'Mekhri Circle', 'Hebbal', 'Yelahanka', 'Airport']],
    ['KIA-5', 'kia', ['Silk Board', 'Koramangala', 'Richmond Circle', 'Shivajinagar', 'Hebbal', 'Airport']],
    ['KIA-7', 'kia', ['Banashankari', 'Majestic', 'Hebbal', 'Airport']],
    ['MF-1', 'feeder', ['Indiranagar', 'Domlur', 'Marathahalli']],
    ['MF-9', 'feeder', ['Hebbal', 'Nagawara', 'Hennur']],
    ['MF-12', 'feeder', ['Silk Board', 'HSR Layout', 'Sarjapur']],
    ['EXP-12', 'express', ['Majestic', 'Rajajinagar', 'Yeshwanthpur', 'Peenya']],
    ['EXP-4', 'express', ['Electronic City', 'Silk Board', 'Koramangala', 'Shivajinagar']],
    ['CHAKRA-1', 'chakra', ['Majestic', 'Lalbagh', 'Jayanagar', 'Banashankari']],
    ['CHAKRA-2', 'chakra', ['Kengeri', 'Banashankari', 'JP Nagar', 'Gottigere']],
    ['KBS-2', 'shuttle', ['Whitefield', 'Kadugodi', 'KR Puram']],
    ['D12', 'depot', ['Peenya', 'Yeshwanthpur', 'Malleswaram']],
    ['V-KSRTC-1', 'ksrtc', ['Majestic', 'Kengeri']],
    ['SP-1', 'special', ['Electronic City', 'Silk Board', 'HSR Layout']],
  ];
  const FLAG = { regular: '', bigcircle: 'B', vajra: 'Va', kia: 'Ka', feeder: 'F', express: 'X', chakra: 'C', shuttle: 'S', ksrtc: 'Ra', special: 'Z', depot: 'D' };

  /* ── geometry: one polyline per pair of hubs (shared by every route that uses the pair, so corridors coincide) ── */
  const PAIR = new Map(), STOP = new Map(), STOPS = [];
  let sid = 0;
  const pairKey = (a, b) => (a < b ? a + '>' + b : b + '>' + a);
  function pair(a, b) {                                        // oriented a -> b: { pts: [[lat, lon]], cum, len, mids: [{id, f}] }
    const key = pairKey(a, b), flip = a > b;
    if (!PAIR.has(key)) {
      const [p, q] = flip ? [b, a] : [a, b], P = HUB[p], Q = HUB[q], len = dist(P, Q);
      const n = Math.max(4, Math.ceil(len / 140)), amp = Math.max(-700, Math.min(700, (hash(key) - 0.5) * 0.2 * len));
      const dx = (Q[1] - P[1]) * K * Math.cos(P[0] * RAD), dy = (Q[0] - P[0]) * K, nx = -dy / len, ny = dx / len, pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, w = Math.sin(Math.PI * f) * amp + Math.sin(f * 17 + hash(key) * 9) * 18 * Math.sin(Math.PI * f);
        pts.push([P[0] + (dy * f + ny * w) / K, P[1] + (dx * f + nx * w) / (K * Math.cos(P[0] * RAD))]);
      }
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
      const m = Math.max(1, Math.round(cum[cum.length - 1] / 850) - 1), mids = [];
      const SUF = ['Main Road', 'Cross', 'Circle', 'Junction', 'Signal', 'Market', 'Temple', 'Park', 'Layout', 'Flyover', 'Bus Stop'];
      for (let k = 1; k <= m; k++) {
        const f = k / (m + 1), at = pointAt({ pts, cum }, f * cum[cum.length - 1]).ll;
        const near = dist(at, P) < dist(at, Q) ? p : q;
        mids.push({ id: 'M' + key + k, f, name: `${near} ${SUF[Math.floor(hash(key + k) * SUF.length)]} ${k}` });
      }
      PAIR.set(key, { pts, cum, len: cum[cum.length - 1], mids });
    }
    const c = PAIR.get(key);
    return flip ? { pts: c.pts.slice().reverse(), cum: c.cum.slice().reverse().map(x => c.len - x), len: c.len, mids: c.mids.slice().reverse().map(s => ({ ...s, f: 1 - s.f })) } : c;
  }
  function pointAt(g, d) {                                      // { ll: [lat, lon], brg } at distance d along g
    const { pts, cum } = g; d = Math.max(0, Math.min(cum[cum.length - 1], d));
    let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[hi], f = cum[hi] > cum[lo] ? (d - cum[lo]) / (cum[hi] - cum[lo]) : 0;
    const dx = (b[1] - a[1]) * Math.cos(a[0] * RAD), dy = b[0] - a[0];
    return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], brg: (Math.atan2(dx, dy) / RAD + 360) % 360 };
  }
  function stopOf(key, name, ll) {
    if (!STOP.has(key)) { const s = { id: 'S' + String(++sid).padStart(4, '0'), name, lat: ll[0], lon: ll[1], sns: new Set() }; STOP.set(key, s); STOPS.push(s); }
    return STOP.get(key);
  }
  function working(sn, hubs, code) {                           // one direction of a service
    const pts = [], cum = [0], stops = []; let base = 0;
    const add = (ll, d) => { if (pts.length) { if (d - base < 0.5 && pts.length && Math.abs(ll[0] - pts[pts.length - 1][0]) < 1e-9) return; } pts.push(ll); };
    stops.push({ ...stopOf('H' + hubs[0], nm(hubs[0]), HUB[hubs[0]]), d: 0 });
    pts.push(HUB[hubs[0]]);
    for (let i = 0; i + 1 < hubs.length; i++) {
      const g = pair(hubs[i], hubs[i + 1]);
      for (let j = 1; j < g.pts.length; j++) { pts.push(g.pts[j]); cum.push(base + g.cum[j]); }
      for (const m of g.mids) { const ll = pointAt(g, m.f * g.len).ll; stops.push({ ...stopOf(m.id, m.name, ll), d: base + m.f * g.len }); }
      base += g.len;
      stops.push({ ...stopOf('H' + hubs[i + 1], nm(hubs[i + 1]), HUB[hubs[i + 1]]), d: base });
    }
    stops.forEach(s => STOP.get(s.id) || 0);
    return { code, sn, hubs, pts, cum, L: base, stops };
  }

  /* ── build the network once ── */
  const WORK = [], BYSN = {}, SEG = new Map(), RS = {}, TIM = {};
  SVC.forEach(([sn, fam, hubs], i) => {
    const A = working(sn, hubs, 'W' + (i + 1) + 'A'), B = working(sn, hubs.slice().reverse(), 'W' + (i + 1) + 'B');
    A.fam = B.fam = fam; BYSN[sn] = { sn, fam, A, B, i };
    for (const w of [A, B]) {
      WORK.push(w);
      w.stops.forEach(s => STOPS.find(x => x.id === s.id).sns.add(sn));
      RS[w.code] = { d: [{ o: nm(w.hubs[0]), e: nm(w.hubs[w.hubs.length - 1]), s: w.stops.map(s => [s.id, s.name, +s.lat.toFixed(6), +s.lon.toFixed(6)]) }] };
      const trips = 24 + Math.floor(hash(w.code) * 60), first = 5 + Math.floor(hash(w.code + 'f') * 2), last = 21 + Math.floor(hash(w.code + 'l') * 3);
      const hours = Array.from({ length: 24 }, (_, h) => h < first || h > last ? 0 : Math.max(1, Math.round(trips / (last - first + 1) * (h >= 8 && h <= 10 || h >= 17 && h <= 19 ? 1.7 : 0.8))));
      const ac = fam === 'vajra' || fam === 'kia' || fam === 'ksrtc';
      TIM[w.code] = { first: `0${first}:${hash(w.code) < .5 ? '00' : '30'}`, last: `${last}:${hash(w.code) < .5 ? '15' : '45'}`, freq: `every ${Math.round(900 / trips * 4) } min`,
        trips: hours.reduce((a, b) => a + b, 0), hours, tiers: ac ? { AC: trips } : { ORDINARY: trips }, src: 'generated demo timetable, not BMTC\u2019s' };
      // stop-to-stop road segments (both directions get a key)
      for (let k = 0; k + 1 < w.stops.length; k++) {
        const a = w.stops[k], b = w.stops[k + 1], key = a.id + '|' + b.id;
        if (SEG.has(key)) continue;
        const coords = [[a.lon, a.lat]];
        for (let j = 1; j < w.pts.length - 1; j++) if (w.cum[j] > a.d + 1 && w.cum[j] < b.d - 1) coords.push([w.pts[j][1], w.pts[j][0]]);
        coords.push([b.lon, b.lat]);
        SEG.set(key, coords);
      }
    }
  });
  WORK.forEach(w => { w.lat0 = w.pts[0]; });

  const FC = f => ({ type: 'FeatureCollection', features: f });
  const routes = FC(WORK.map((w, i) => ({ type: 'Feature', properties: { sn: w.sn, route_name: w.sn + (w.code.endsWith('B') ? ' (2)' : ''), code: w.code, source: nm(w.hubs[0]), destinatio: nm(w.hubs[w.hubs.length - 1]),
    nstops: w.stops.length, trips: TIM[w.code].trips }, geometry: { type: 'LineString', coordinates: w.pts.map(p => [+p[1].toFixed(6), +p[0].toFixed(6)]) } })));
  const stopsFC = FC(STOPS.map(s => ({ type: 'Feature', properties: { 'Stop Name': s.name, 'route name': JSON.stringify([...s.sns]) }, geometry: { type: 'Point', coordinates: [+s.lon.toFixed(6), +s.lat.toFixed(6)] } })));
  const ends = new Set(); WORK.forEach(w => { ends.add(w.hubs[0]); ends.add(w.hubs[w.hubs.length - 1]); });
  const terminiFC = FC([...ends].map(h => ({ type: 'Feature', properties: { 'Name of th': nm(h).replace(/ \(.*/, '') + ' Bus Station', Ownership: 'Demo' }, geometry: { type: 'Point', coordinates: [HUB[h][1], HUB[h][0]] } })));
  const line = (col, name, pts) => ({ type: 'Feature', properties: { color: col, name }, geometry: { type: 'LineString', coordinates: pts.map(p => [p[1], p[0]]) } });
  const metroFC = FC([
    line('#7c3aed', 'Purple Line (approx.)', [[12.9958, 77.7570], [13.0074, 77.6960], [12.9908, 77.6525], [12.9783, 77.6385], [12.9756, 77.6068], [12.9797, 77.5907], [12.9757, 77.5727], [12.9709, 77.5304], [12.9467, 77.5300], [12.9120, 77.4600]]),
    line('#16a34a', 'Green Line (approx.)', [[13.0476, 77.5000], [13.0285, 77.5197], [13.0236, 77.5500], [12.9757, 77.5727], [12.9503, 77.5842], [12.9299, 77.5838], [12.9063, 77.5857], [12.8626, 77.5367]]),
  ]);
  const segFC = FC([...SEG].flatMap(([k, c]) => { const [a, b] = k.split('|'); return [
    { type: 'Feature', properties: { k }, geometry: { type: 'LineString', coordinates: c } },
    { type: 'Feature', properties: { k: b + '|' + a }, geometry: { type: 'LineString', coordinates: c.slice().reverse() } }]; }));

  /* ── observed speeds ── */
  const hourF = h => 1 - 0.34 * Math.exp(-(((h - 9) / 1.7) ** 2)) - 0.42 * Math.exp(-(((h - 18.5) / 1.9) ** 2)) + (h < 6 || h > 22 ? 0.18 : 0);
  function speeds() {
    const nowH = new Date().getHours(), s = {}; let sum = 0, n = 0;
    for (const f of segFC.features) {
      const k = f.properties.k, base = 13 + hash(k) * 14, row = [Math.round(base * hourF(nowH) * (0.9 + hash(k + Date.now() / 6e5 | 0) * 0.2)), 1 + Math.floor(hash(k + 'n') * 4)];
      for (let h = 0; h < 24; h++) row.push(Math.round(base * hourF(h)));
      s[k] = row; sum += row[0]; n++;
    }
    return { t: Math.floor(Date.now() / 1000), days: 7, city: { now: Math.round(sum / n), h: Array.from({ length: 24 }, (_, h) => Math.round(20 * hourF(h))) }, s };
  }

  /* ── the fleet ── */
  const BUSES = [];
  Object.values(BYSN).forEach(S => {
    const n = Math.max(2, Math.min(8, Math.round(S.A.L / 3200)));
    for (let j = 0; j < n; j++) {
      const key = S.sn + j, ev = S.fam === 'regular' && hash(key + 'e') < 0.22, low = S.fam === 'vajra' || S.fam === 'kia' || ev || hash(key + 'l') < 0.3;
      const reg = (ev ? 'KA51AH' : S.fam === 'vajra' || S.fam === 'kia' || S.fam === 'ksrtc' ? 'KA01AR' : 'KA57F') + String(1000 + Math.floor(hash(key + 'r') * 8999));
      BUSES.push({ reg, S, v: 4.4 + hash(key + 'v') * 2.2, lay: 900 + hash(key + 'y') * 900, off: 0, flags: FLAG[S.fam] + (ev ? 'e' : '') + (low ? 'l' : '') + (S.fam === 'express' ? 'x' : ''), j, n });
    }
  });
  BUSES.forEach(b => { b.C = 2 * (b.S.A.L + b.lay); b.off = (b.j / b.n) * b.C + hash(b.reg) * 600; });
  function row(b, tf) {
    const p = (((tf * b.v + b.off) % b.C) + b.C) % b.C, per = b.S.A.L + b.lay, k = Math.floor(p / per), q = p - k * per;
    const W = k ? b.S.B : b.S.A, waiting = q < b.lay, pos = waiting ? 0 : q - b.lay, wait = waiting ? (b.lay - q) / b.v : 0;
    const at = pointAt(W, pos), eta = [];
    for (let i = 0; i < W.stops.length && eta.length < 16; i++) if (W.stops[i].d > pos + 3) eta.push(i, Math.round(wait + (W.stops[i].d - pos) / b.v));
    if (!eta.length) eta.push(W.stops.length - 1, 1);
    return [b.reg, W.code, +at.ll[0].toFixed(5), +at.ll[1].toFixed(5), Math.round(at.brg), Math.floor(tf), b.flags + (waiting ? 'u' : ''), eta, b.S.sn];
  }
  const STEP = 5, feedT = () => Math.floor(Date.now() / 1000 / STEP) * STEP;
  const rows = t => BUSES.map(b => row(b, t - Math.floor(hash(b.reg + t) * 20)));
  const full = () => { const t = feedT(); return { t, fmt: 2, v: rows(t) }; };
  const delta = from => { const t = feedT(); return { from, t, up: rows(t), rm: [], meta: { fmt: 2 } }; };

  /* ── the fetch shim: the same URLs the real server answers ── */
  const J = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  const NF = () => new Response('', { status: 404 });
  const table = {
    'data/routes_lite.geojson': () => routes, 'data/mtc_routes.geojson': () => routes, 'data/bus_stops.geojson': () => stopsFC,
    'data/bus_termini.geojson': () => terminiFC, 'data/metro_lines.geojson': () => metroFC, 'data/route_stops.json': () => RS,
    'data/seg_geo.json': () => segFC, 'data/timings.json': () => TIM, 'data/notes.json': () => ({}),
    'data/sources.json': () => [['Demo data', null, 'Everything on this map is generated in your browser: routes, stops, timetables, speeds and buses are invented. Base map: OpenStreetMap contributors, via OpenFreeMap. Add ?real to the address to use real data/ and live/ files instead.']],
    'live/vehicles.json': full, 'live/speeds.json': speeds,
  };
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input !== 'string' || /^([a-z]+:)?\/\//i.test(input)) return orig(input, init);
    const path = input.split('?')[0].replace(/^\.?\//, '');
    if (table[path]) return Promise.resolve(J(table[path]()));
    const m = /^live\/delta\/(\d+)\.json$/.exec(path);
    if (m) { const t = +m[1], now = feedT(); return Promise.resolve(t >= now || now - t > 120 ? NF() : J(delta(t))); }
    return Promise.resolve(NF());
  };
  window.DEMO = { routes: routes.features.length, stops: STOPS.length, buses: BUSES.length, WORK, BUSES, row, full, delta, table };
})();
