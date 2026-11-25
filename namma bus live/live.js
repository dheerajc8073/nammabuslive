/* Live buses: every BMTC bus BMTC's own tracking reports, moving on the map. This is the MTC map's
   live layer (../mapsv2/live.js) on Bengaluru: bengaluru_bus/server/bmtc_collector.py writes the same
   feed from BMTC's commuter site (nammabmtcapp.karnataka.gov.in, the same vendor's platform as MTC's).
   Bengaluru differences: buses are grouped by BMTC service family (an upper-case flag the collector
   adds from the route number: K Vayu Vajra, F metro feeder, V Vajra, X express, B Big Circle, C Chakra,
   S shuttles and Callbus, R V-KSRTC, D depot runs, Z special and contract, G regular); no rider
   reports, spoken stops, crowding estimate or Blender models yet (the drawn 3D buses stand in).

   (MTC's notes follow.)

   Data: live/vehicles.json, rewritten every ~20 s on the server by
   mtcits_collector.py from MTC's ITS. A bus's GPS fix can be a minute or two
   old, but each bus also carries MTC's official predicted arrival at the
   stops ahead of it. A bus is therefore drawn by dead reckoning along its
   road-snapped route: from its last fix, through those predicted stop times.

   Two rules keep that honest (2026-10-20, after a field check that showed
   buses "confused about direction"):
     - a bus does not leave its fix before it has to. A bus waiting at a
       terminus for its next trip used to creep forward and then be pulled back
       by the next fix, sliding backwards on screen;
     - a bus is never drawn moving backwards. If a new fix shows the forecast
       ran ahead, the bus waits on the spot until reality catches up.
   On the archive, buses really do move along their listed working 71 % of the
   time and backwards only 1.4 %, so the route direction itself is right.

   Rendering is a WebGL custom layer, not a GeoJSON source: re-tiling a GeoJSON
   of thousands of points every frame is what made the page hot on phones.
   Positions are computed only for buses in (or near) view, the frame rate
   follows the zoom (a refresh every 2 s for the whole city, ~25 fps on a
   street), and nothing runs while the tab is hidden. Moving buses glow in
   their livery colour; AC buses carry a snowflake.

   Row (fmt 2): [reg, routeCode, lat, lon, bearing, fixEpoch, flags, [i, dt, i, dt, ...]]
   with dt seconds after the fix; older files carry [[i, etaEpoch], ...].
   i indexes ROUTE_STOPS[routeCode].d[0].s; flags a=AC e=electric l=low floor
   x=express p=premium u=waiting for its next trip,
     d=Deluxe fare class, s=small bus, w=ladies only (MTC's service type).
   An optional 9th field is the route number MTC shows on the bus.

   Loaded after app.js and buses.js; shares app.js's script scope (map,
   ROUTE_IDX, ROUTE_STOPS, openStop, selectRoute, showCard, tagHTML, $). */
'use strict';
(() => {
  const URL_ = 'live/vehicles.json', K = 111320;
  const FEEDSRC = null;   // Poll live/vehicles.json directly from FastAPI backend
  const REPORTS = false;          // rider reports: no reports container behind /bengaluru yet
  const MOBILE = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const SAVE = !!(navigator.connection && navigator.connection.saveData);
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const POLL_MS = SAVE ? 40000 : 15000;   // deltas are a few hundred bytes: phones too
  /* BMTC's service families (the collector's upper-case flag, from the route number; app.js BMTC_FAM has the
     same rules for route cards), each in its own colour; regular routes split by electric / diesel. `lv` is
     the drawn livery (buses.js). The liveries tell kinds apart on the map: they are not BMTC's paint. */
  /* BMTC Vehicle Classification Taxonomy (shared with backend) */
  const ST = Object.assign({}, typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES : {}, {
    kia: (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES.vayu_vajra : null) || { name: 'Vayu Vajra (Airport)', col: '#0f8a8f', lv: 'vayu' },
    feeder: (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES.metro_feeder : null) || { name: 'Metro feeder', col: '#7a3fc0', lv: 'feeder' },
    bigcircle: (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES.big_circle : null) || { name: 'Big Circle', col: '#2f8a4a', lv: 'sarige' },
    ksrtc: (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES.v_ksrtc : null) || { name: 'V-KSRTC', col: '#b23a2e', lv: 'vajra' },
    depot: (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.CATEGORIES.depot_runs : null) || { name: 'Depot runs', col: '#7c7c84', lv: 'sarige' },
  });
  // Ensure drawn 2D livery keys
  for (const [k, v] of Object.entries(ST)) {
    if (!v.lv) {
      if (k === 'vayu_vajra' || k === 'kia') v.lv = 'vayu';
      else if (k === 'vajra' || k === 'v_ksrtc' || k === 'ksrtc') v.lv = 'vajra';
      else if (k === 'electric') v.lv = 'astra';
      else if (k === 'metro_feeder' || k === 'feeder') v.lv = 'feeder';
      else if (k === 'express') v.lv = 'express';
      else v.lv = 'sarige';
    }
  }
  const stOf = (fl, row) => {
    if (row && typeof BMTC_VEHICLES !== 'undefined') {
      return BMTC_VEHICLES.classifyRow(row).catId;
    }
    if (fl && fl.includes('e')) return 'electric';
    if (fl && fl.includes('K')) return 'vayu_vajra';
    if (fl && fl.includes('V')) return 'vajra';
    if (fl && fl.includes('F')) return 'metro_feeder';
    if (fl && fl.includes('B')) return 'big_circle';
    if (fl && fl.includes('X')) return 'express';
    if (fl && fl.includes('C')) return 'chakra';
    if (fl && fl.includes('S')) return 'shuttle';
    if (fl && fl.includes('R')) return 'v_ksrtc';
    if (fl && fl.includes('D')) return 'depot_runs';
    if (fl && fl.includes('Z')) return 'special';
    if (fl && fl.includes('a')) return 'vajra';
    if (fl && fl.includes('G')) return 'regular';
    return 'unclassified';
  };
  const lvOf = fl => fl.includes('e') ? 'astra' : fl.includes('a') ? (stOf(fl).includes('vayu') ? 'vayu' : 'vajra') : (ST[stOf(fl)] ? ST[stOf(fl)].lv : 'sarige');
  const lvCol = fl => ST[stOf(fl)] ? ST[stOf(fl)].col : '#6b7280';
  /* no trip in MTC's system (flag n): the bus is drawn as a ghost. Still transmitting (a fix in
     the last GHOST_FRESH s): where it is. Gone quiet: at its base, the terminus it most often
     starts its day from (live/homes.json, from the GPS archive), if known. */
  const GHOST_FRESH = 600;
  let HOMES = null;
  fetch('live/db/homes.json?t=' + Math.floor(Date.now() / 3600e3)).then(r => r.ok ? r.json() : null).then(j => { HOMES = j; }).catch(() => {});
  const ghostOf = v => (v[6] || '').includes('n');
  const homeOfReg = r => {
    if (!HOMES) return null;
    const clean = String(r || '').replace(/[^A-Za-z0-9]/g, '');
    return HOMES[clean] || HOMES[r] || null;
  };
  const homeOf = v => ghostOf(v) && now() - v[5] > GHOST_FRESH ? homeOfReg(v[0]) : null;
  let on = (() => { try { return localStorage.getItem('blrLive') !== '0'; } catch (e) { return true; } })();
  let FEED = null, pollT = null, running = false, CODE_FEAT = null;
  const fetchT0 = Date.now();
  let selReg = null, cardStop = null, cardBus = null, cardIds = null;
  const RING = { el: null, ll: null, dy: 0, d: 40 };   // the ring over the open bus (placeRing)
  let follow = false;                     // the map keeps the open bus in the middle (Follow this bus)
  let focusSn = null;                      // a route picked from search or the map: its buses stay in colour
  const GEO = new Map(), TRACK = new Map();
  // every working's road has arrived (app.js routesFull): buses that ran on stop-to-stop lines take the road
  document.addEventListener('routes-full', () => { CODE_FEAT = null; GEO.clear(); for (const tr of TRACK.values()) tr.ready = false; });
  const now = () => Date.now() / 1000;

  /* ── geometry: route lines as distance-along polylines ── */
  function codeFeat(code) {
    if (!CODE_FEAT) {
      if (!Object.keys(ROUTE_IDX).length) return null;
      CODE_FEAT = new Map();
      Object.values(ROUTE_IDX).forEach(e => e.works.forEach(w => CODE_FEAT.set(String(w.properties.code), w)));
    }
    return CODE_FEAT.get(code) || null;
  }
  function stopsOf(code) {
    const r = ROUTE_STOPS && ROUTE_STOPS[code];
    return r && r.d && r.d[0] ? r.d[0].s : null;
  }
  function prep(coords) {
    const cx = Math.cos(coords[0][1] * Math.PI / 180) * K;
    const n = coords.length, xs = new Float64Array(n), ys = new Float64Array(n), cum = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs[i] = coords[i][0] * cx; ys[i] = coords[i][1] * K; if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]); }
    return { xs, ys, cum, cx, n };
  }
  // nearest point on the line between vertices [i0, i1]; returns {d, off, i}
  function project(g, lon, lat, i0 = 0, i1 = g.n - 1) {
    const px = lon * g.cx, py = lat * K;
    let bd = 0, bo = Infinity, bi = i0;
    for (let i = Math.max(0, i0), e = Math.min(i1, g.n - 1); i < e; i++) {
      const ax = g.xs[i], ay = g.ys[i], dx = g.xs[i + 1] - ax, dy = g.ys[i + 1] - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
      const o = Math.hypot(ax + t * dx - px, ay + t * dy - py);
      if (o < bo) { bo = o; bd = g.cum[i] + t * Math.sqrt(L); bi = i; }
    }
    return { d: bd, off: bo, i: bi };
  }
  function xy(g, d, out) {
    const c = g.cum, n = g.n;
    d = d < 0 ? 0 : d > c[n - 1] ? c[n - 1] : d;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    const t = (d - c[lo]) / ((c[hi] - c[lo]) || 1);
    out[0] = g.xs[lo] + t * (g.xs[hi] - g.xs[lo]); out[1] = g.ys[lo] + t * (g.ys[hi] - g.ys[lo]);
  }
  /* Where the bus is and which way its nose points: the heading is taken over
     the road just behind to just ahead, so it swings through a bend instead of
     snapping at every vertex. Writes lon, lat, heading into out. */
  const _a = [0, 0], _b = [0, 0], _c = [0, 0];
  function at(g, d, out) {
    xy(g, d, _a); xy(g, d - 18, _b); xy(g, d + 32, _c);
    out[0] = _a[0] / g.cx; out[1] = _a[1] / K;
    out[2] = (Math.atan2(_c[0] - _b[0], _c[1] - _b[1]) * 180 / Math.PI + 360) % 360;
  }
  // route line + where along it each stop sits; only built for buses in view
  function geo(code) {
    if (GEO.has(code)) return GEO.get(code);
    const f = codeFeat(code), st = stopsOf(code);
    if (!st || st.length < 2 || !CODE_FEAT) return null;
    let coords = f && f.geometry && (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates.flat() : f.geometry.coordinates);
    if (!coords || coords.length < 2) coords = st.map(s => [s[3], s[2]]);
    const g = prep(coords);
    let seg = 0, prev = 0;
    g.stopD = st.map(s => {
      // search a window ahead of the previous stop first; the whole line only if that misses
      let p = project(g, s[3], s[2], seg, seg + 400);
      if (p.off > 80) { const q = project(g, s[3], s[2]); if (q.off < p.off - 40) p = q; }
      const d = Math.max(prev, p.d); prev = d; seg = Math.max(seg, p.i);
      return d;
    });
    GEO.set(code, g);
    return g;
  }

  /* ── tracks: (time, distance) knots per bus, built lazily when in view ── */
  const CRUISE = 5.5;                 // m/s, ~20 km/h: how long a bus needs to reach its next stop
  function makeTrack(tr) {
    tr.ready = true;
    const [, code, lat, lon, , fix, fl, eta] = tr.v;
    const g = geo(code);
    if (!g) { tr.ready = !(ROUTE_STOPS && CODE_FEAT); return; }   // retry once data has loaded
    tr.g = g;
    if (!eta.length) return;
    const first = g.stopD[eta[0][0]];
    if (first == null) return;
    let segMax = 1;
    while (segMax < g.n - 1 && g.cum[segMax] < first) segMax++;
    const p = project(g, lon, lat, 0, segMax + 1);
    if (p.off > 150) return;          // off its route (depot, diversion): drawn at the GPS fix
    const d0 = Math.min(p.d, first), knots = [[fix, d0]];
    for (const [i, t] of eta) {
      const d = g.stopD[i], last = knots[knots.length - 1];
      if (d == null || t <= last[0] || d < last[1]) continue;
      knots.push([t, d]);
    }
    // leave the fix only when it must to make the first predicted stop
    if (knots.length > 1) {
      const need = (knots[1][1] - d0) / CRUISE;
      knots[0][2] = Math.max(fix, knots[1][0] - need);
    }
    tr.knots = knots;
    tr.upcoming = fl.includes('u');
  }
  /* Distance along the route at time t: dwell at each stop, smoothstep between
     stops, and never less than what is already on screen (tr.hold). */
  const DWELL = 14;
  function dOf(tr, t) {
    const k_ = tr.knots;
    let d = k_[0][1];
    if (t >= k_[k_.length - 1][0]) d = k_[k_.length - 1][1];
    else if (t > k_[0][0]) {
      for (let k = 1; k < k_.length; k++) {
        if (t <= k_[k][0]) {
          const [t0, d0] = k_[k - 1], [t1, d1] = k_[k];
          const dep = k > 1 ? t0 + Math.min(DWELL, 0.3 * (t1 - t0)) : (k_[0][2] || t0);
          const u = Math.max(0, Math.min(1, (t - dep) / ((t1 - dep) || 1)));
          d = d0 + (d1 - d0) * (k > 1 ? u * u * (3 - 2 * u) : u * (2 - u));
          break;
        }
      }
    }
    if (tr.hold != null) { if (d < tr.hold) d = tr.hold; else tr.hold = null; }
    return d;
  }
  /* Continuity. A new GPS fix moves where a bus "should" be; the drawn bus never
     jumps to it. On its route it closes the gap smoothly (exponential catch-up,
     so it briefly runs faster) and never moves backwards - if the new estimate is
     behind, it waits for the estimate to come level. Off its route it glides from
     where it was drawn to the new fix. */
  const CATCH_S = 1.6, SNAP_M = 2500, GLIDE_S = 4;
  function smoothD(tr, target, t) {
    if (tr.disp == null || !isFinite(tr.disp)) { tr.disp = target; tr.dispT = t; return target; }
    const dt = Math.max(0, Math.min(2, t - tr.dispT)), gap = target - tr.disp;
    tr.dispT = t;
    if (Math.abs(gap) > SNAP_M) tr.disp = target;
    else if (gap > 0) tr.disp += gap * (1 - Math.exp(-dt / CATCH_S));
    return tr.disp;
  }
  function glide(tr, t, out) {
    if (tr.home) { out[0] = tr.home[0]; out[1] = tr.home[1]; out[2] = tr.v[4] || 0; return out; }   // a ghost gone quiet: at its base
    out[0] = tr.v[3]; out[1] = tr.v[2]; out[2] = tr.v[4] || 0;
    if (!tr.from) return out;
    const u = Math.min(1, (t - tr.from[2]) / GLIDE_S);
    if (u >= 1) { tr.from = null; return out; }
    const e = u * u * (3 - 2 * u);
    out[0] = tr.from[0] + (out[0] - tr.from[0]) * e; out[1] = tr.from[1] + (out[1] - tr.from[1]) * e;
    return out;
  }
  const _p = [0, 0, 0];
  function posOf(tr, t, out = _p) {
    if (!tr.ready) makeTrack(tr);
    if (!tr.knots) { glide(tr, t, out); tr.shown = [out[0], out[1]]; return out; }
    tr.lastD = smoothD(tr, dOf(tr, t), t);
    at(tr.g, tr.lastD, out);
    // Phase 4A: Clamping protection against dead-reckoning drift
    // If projection or dead-reckoning pulls marker > 50m from raw GPS fix, clamp to genuine raw GPS
    const rawLon = tr.v[3], rawLat = tr.v[2];
    const dx = (out[0] - rawLon) * K * Math.cos(rawLat * Math.PI / 180);
    const dy = (out[1] - rawLat) * K;
    if (Math.hypot(dx, dy) > 50) {
      glide(tr, t, out);
    }
    tr.shown = [out[0], out[1]];
    return out;
  }

  function parse(j) {
    // fmt 2 ships eta as [i, dt, i, dt ...]; expand to [[i, epoch], ...] once per row. delta.js hands back
    // the same rows while nothing changed, so a row already expanded is left alone (expanding it again wiped its ETAs)
    if (j.fmt === 2) for (const v of j.v) {
      const f = v[7], out = [];
      if (!Array.isArray(f) || Array.isArray(f[0])) continue;
      for (let k = 0; k + 1 < f.length; k += 2) out.push([f[k], v[5] + f[k + 1]]);
      v[7] = out;
    }
    return j;
  }
  function ingest(j) {
    const t = now(), prev = new Map(TRACK);
    TRACK.clear();
    for (const v of j.v) {
      const tr = { v, ready: false, g: null, knots: null, lastD: null, hold: null, moving: 0, home: homeOf(v) };
      const old = prev.get(v[0]);
      if (old && old.v[1] === v[1] && old.disp != null) {
        // same bus, same working, drawn before: carry on from where it is drawn
        tr.disp = old.disp; tr.dispT = old.dispT;
        tr.moving = old.moving;
      } else if (old && old.shown) {
        tr.moving = old.moving;
      }
      if (old) { tr.ox = old.ox || 0; tr.oy = old.oy || 0; }       // keep any easing-apart offset
      if (old && old.shown) {
        const dx = (old.shown[0] - v[3]) * K * Math.cos(v[2] * Math.PI / 180), dy = (old.shown[1] - v[2]) * K;
        if (Math.hypot(dx, dy) > 3 && Math.hypot(dx, dy) < 3000) tr.from = [old.shown[0], old.shown[1], t];
      }
      TRACK.set(v[0], tr);
    }
  }

  /* ── crowding (estimated) ──
     No crowd or ticket counts are published for MTC buses, and Chennai One's
     crowd field is empty. What is real and hourly: when the city travels —
     CMRL's ticket entries by hour (weekday and weekend averages over 44 days
     of the CMRL Commuter Archive, Sept–Oct 2026) — and how many buses each
     working runs in that hour (its timetable). Crowding is the ratio of the
     two: the hour's share of the day's riders over the hour's share of the
     route's buses. A route that runs few buses at 9 am rates crowded; one
     with a big peak fleet does not. An estimate, labelled as one. */
  const DEM_WD = [0.01, 0, 0, 0, 0.27, 0.93, 2.41, 3.92, 7.53, 11.08, 7.71, 4.39, 4.16, 4.67, 5.17, 4.44, 4.86, 6.73, 10.12, 9.44, 6.16, 3.69, 1.83, 0.47];
  const DEM_WE = [0.01, 0, 0, 0, 0.39, 1.35, 2.61, 3.56, 4.81, 6.18, 6.33, 5.54, 5.57, 5.62, 6.74, 6.49, 6.77, 7.33, 8.4, 7.94, 6.16, 4.67, 2.81, 0.71];
  const CROWD_NAMES = ['Seats free', 'Seats taken', 'Standing room only'];
  let timingsAsked = false;
  function ensureTimings() {
    if (TIMINGS !== undefined || timingsAsked) return;
    timingsAsked = true;
    dataJoin('timings.json').then(j => { if (TIMINGS === undefined) TIMINGS = j; crowdCache.clear(); }).catch(() => {});
  }
  function crowdRatio(code, h, weekend) {
    return null;                    // Bengaluru: no hourly demand curve yet (MTC's is CMRL's ticket entries)
    const tm = TIMINGS && TIMINGS[code]; if (!tm || !tm.hours) return null;
    const S = tm.hours, tot = S.reduce((a, b) => a + b, 0); if (!tot) return null;
    const sup = (S[h] * 0.5 + (S[(h + 23) % 24] + S[(h + 1) % 24]) * 0.25) / tot;
    const dem = (weekend ? DEM_WE : DEM_WD)[h] / 100;
    return Math.min(3, dem / Math.max(sup, 0.5 / tot));
  }
  const crowdCache = new Map();
  function crowdOf(code, h) {
    const k = code + ':' + h;
    if (crowdCache.has(k)) return crowdCache.get(k);
    const d = new Date(Date.now() + 19800000), we = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const r = crowdRatio(code, h, we);
    const out = r == null ? null : { r, level: r < 0.75 ? 0 : r < 1.3 ? 1 : 2, p: 1 / (1 + Math.exp(-(r - 1.15) * 3.5)), we };
    if (TIMINGS) crowdCache.set(k, out);
    return out;
  }
  const PEOPLE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const CROWD_COL = ['#2fa35a', '#e0a100', '#d6402b'];

  /* ── WebGL layer ── */
  const VS = `
    attribute vec2 a_pos; attribute vec2 a_off; attribute vec2 a_uv; attribute float a_rot; attribute vec4 a_col; attribute float a_gray;
    uniform mat4 u_matrix; uniform vec2 u_view; uniform float u_bearing;
    varying vec2 v_uv; varying vec4 v_col; varying float v_gray;
    void main() {
      vec4 p = u_matrix * vec4(a_pos, 0.0, 1.0);
      float r = radians(a_rot) - u_bearing * step(-500.0, a_rot);
      if (a_rot < -500.0) r = 0.0;
      vec2 o = vec2(a_off.x * cos(r) - a_off.y * sin(r), a_off.x * sin(r) + a_off.y * cos(r));
      p.xy += vec2(o.x, -o.y) * 2.0 / u_view * p.w;
      gl_Position = p; v_uv = a_uv; v_col = a_col; v_gray = a_gray;
    }`;
  const FS = `
    precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; varying vec4 v_col; varying float v_gray;
    void main() {
      vec4 c = texture2D(u_tex, v_uv) * v_col;
      // a bus that is not the one picked: pale grey, faded (premultiplied alpha). Lifted toward white
      // so a rendered bus and its shadow read as a light silhouette, not a dark smudge
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor = mix(c, vec4(vec3(l * 0.5 + 0.42 * c.a), c.a) * 0.5, v_gray);
    }`;
  const STRIDE = 12;                       // pos2 off2 uv2 rot1 col4 gray1
  let vbuf = new Float32Array(STRIDE * 6 * 4096), nverts = 0, ref = [0.5, 0.5], UV = null, SEGS = [];
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const COLS = {};
  const mercX = lng => (lng + 180) / 360;
  const mercY = lat => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;

  function quad(mx, my, w, h, uv, rot, r, g, b, a, dy = 0, dx = 0, gray = 0) {
    if ((nverts + 6) * STRIDE > vbuf.length) { const nb = new Float32Array(vbuf.length * 2); nb.set(vbuf); vbuf = nb; }
    const x0 = -w / 2 + dx, x1 = w / 2 + dx, y0 = -h / 2 + dy, y1 = h / 2 + dy;
    const P = [[x0, y0, uv[0], uv[1]], [x1, y0, uv[2], uv[1]], [x1, y1, uv[2], uv[3]], [x0, y0, uv[0], uv[1]], [x1, y1, uv[2], uv[3]], [x0, y1, uv[0], uv[3]]];
    for (const [ox, oy, u, v] of P) {
      const o = nverts++ * STRIDE;
      vbuf[o] = mx; vbuf[o + 1] = my; vbuf[o + 2] = ox; vbuf[o + 3] = oy; vbuf[o + 4] = u; vbuf[o + 5] = v;
      vbuf[o + 6] = rot; vbuf[o + 7] = r * a; vbuf[o + 8] = g * a; vbuf[o + 9] = b * a; vbuf[o + 10] = a; vbuf[o + 11] = gray;
    }
  }

  // any triangle, offsets in screen px from (mx, my) (y down), one flat colour: the cast shadows
  function tri3(mx, my, P, uv, a) {
    if ((nverts + 3) * STRIDE > vbuf.length) { const nb = new Float32Array(vbuf.length * 2); nb.set(vbuf); vbuf = nb; }
    const u = (uv[0] + uv[2]) / 2, v = (uv[1] + uv[3]) / 2;
    for (const [ox, oy] of P) {
      const o = nverts++ * STRIDE;
      vbuf[o] = mx; vbuf[o + 1] = my; vbuf[o + 2] = ox; vbuf[o + 3] = oy; vbuf[o + 4] = u; vbuf[o + 5] = v;
      vbuf[o + 6] = -1000; vbuf[o + 7] = 0; vbuf[o + 8] = 0; vbuf[o + 9] = 0; vbuf[o + 10] = a; vbuf[o + 11] = 0;
    }
  }

  /* Where the sun is (azimuth clockwise from north, elevation, degrees) at a moment and place:
     the usual low-precision solar formulae, good to a fraction of a degree, plenty for a shadow. */
  const RAD = Math.PI / 180;
  function sunAt(ms, lat, lon) {
    const d = ms / 86400000 - 10957.5;                      // days from J2000.0
    const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    const H = (gmst * 15 + lon) * RAD - ra, f = lat * RAD;
    const el = Math.asin(Math.sin(f) * Math.sin(dec) + Math.cos(f) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(f) - Math.tan(dec) * Math.cos(f)) / RAD + 180;
    return [(az + 360) % 360, el / RAD];
  }
  // ?sun=09:30 puts the sun where it is at that time today (IST) without moving the buses: for checking shadows after dark
  const SUN_SHIFT = (() => {
    const m = /^(\d{1,2}):?(\d{2})?$/.exec(new URLSearchParams(location.search).get('sun') || '');
    if (!m) return 0;
    const d = new Date(Date.now() + 19800000), want = (+m[1] * 60 + +(m[2] || 0)) * 60000;
    return want - (d.getUTCHours() * 60 + d.getUTCMinutes()) * 60000;
  })();
  let SUN = null, SUN_T = 0;
  const sunNow = () => {
    const ms = Date.now() + SUN_SHIFT;
    if (!SUN || ms - SUN_T > 20000) { const c = map.getCenter(); SUN = sunAt(ms, c.lat, c.lng); SUN_T = ms; }
    return SUN;
  };

  /* Each bus's shadow on the road, cast from where the sun is right now: the box of the bus
     (its model's length, width and height) swept away from the sun by height / tan(elevation),
     drawn in the sprites' own view (50 degrees from overhead), so the shade falls on the side of
     the street it really does. Three nested copies give it a soft edge. A faint contact shadow
     stays under every bus, night or day. The sprites themselves are lit from overhead (no side
     is the sunny one) so this shadow is the only cue. */
  const COS_T = Math.cos(50 * RAD);
  const _H = [];
  function hull(pts) {                       // monotone chain, pts [[x, y], ...] -> convex hull
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function shadow(mx, my, h, dims, pxm, bearing, sun, a, uv) {
    const [L, W0, Ht] = dims, W = W0 - 0.35;   // the model's width includes its mirrors
    // ground (east, north) metres -> screen px offsets from the anchor, y down
    const B = bearing * RAD, cb = Math.cos(B), sb = Math.sin(B);
    const scr = (e, n) => [(e * cb - n * sb) * pxm, -(e * sb + n * cb) * COS_T * pxm];
    const hr = h * RAD, ax = [Math.sin(hr), Math.cos(hr)], cx = [Math.cos(hr), -Math.sin(hr)];
    const [az, el] = sun;
    const lit = el > 2 ? Math.min(1, (el - 2) / 10) : 0;   // fades in after sunrise, out before sunset
    const len = lit ? Math.min(Ht / Math.tan(Math.max(el, 4) * RAD), Ht * 3.2) : 0;
    const sx = -Math.sin(az * RAD) * len, sy = -Math.cos(az * RAD) * len;   // away from the sun
    const layers = lit ? [[0.45, 0.11 * lit], [0.1, 0.11 * lit], [-0.3, 0.11 * lit]] : [];
    layers.push([0.25, 0.09]);                                             // contact shadow, always
    for (let k = 0; k < layers.length; k++) {
      const [grow, al] = layers[k], cast = k < layers.length - 1;
      const hl = L / 2 + grow, hw = W / 2 + grow;
      _H.length = 0;
      for (const [u, w] of [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]]) {
        const e = ax[0] * u + cx[0] * w, n = ax[1] * u + cx[1] * w;
        _H.push(scr(e, n));
        if (cast) _H.push(scr(e + sx, n + sy));
      }
      const P = hull(_H);
      for (let i = 1; i + 1 < P.length; i++) tri3(mx, my, [P[0], P[i], P[i + 1]], uv, al * a);
    }
  }
  let DIMS = {};
  const DIM0 = [12, 2.6, 3.2];

  /* Which side of the bus is in the shade for the rest of its trip: the sun's side of each stretch
     of road still ahead, weighted by how long the bus is on it (MTC's own times). In Chennai you
     sit on the left (door side) or the right. Nothing at night, nothing when the sun is overhead. */
  function shadeOf(tr) {
    if (!tr || !tr.knots || !tr.g || tr.knots.length < 2) return null;
    const t0 = now();
    if (tr._shade && t0 - tr._shade[0] < 60) return tr._shade[1];
    const K_ = tr.knots, p = [0, 0, 0];
    let left = 0, right = 0, total = 0;
    const d0 = tr.lastD != null ? tr.lastD : K_[0][1];
    for (let k = 1; k < K_.length; k++) {
      const [ta, da] = K_[k - 1], [tb, db] = K_[k];
      if (db <= d0 || tb <= ta) continue;
      const n = Math.max(1, Math.ceil((db - da) / 250));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, d = da + (db - da) * u;
        if (d < d0) continue;
        const dt = (tb - ta) / n, tm = ta + (tb - ta) * u;
        at(tr.g, d, p);
        const [az, el] = sunAt(tm * 1000 + SUN_SHIFT, p[1], p[0]);
        total += dt;
        if (el < 8 || el > 72) continue;
        // sun to the right of the nose: sin(az - heading) > 0. Weaker when it is higher
        const s = Math.sin((az - p[2]) * RAD) * Math.cos(el * RAD);
        if (s > 0.15) right += dt; else if (s < -0.15) left += dt;
      }
    }
    let out = null;
    if (total > 120 && left + right > total * 0.25) {
      const sunR = right >= left, share = Math.round(100 * Math.max(left, right) / (left + right));
      out = share < 60 ? { side: null, text: 'The sun comes in on both sides about equally for the rest of this trip' }
        : { side: sunR ? 'left' : 'right', share, text: `Sit on the <b>${sunR ? 'left' : 'right'}</b>${sunR ? ' (door side)' : ''} for shade: the sun is on the ${sunR ? 'right' : 'left'} for ${share}% of the rest of this trip` };
    }
    tr._shade = [t0, out];
    return out;
  }

  /* The buses as the MTC Fleet Archive's Blender models (/buses), rendered offline from the same
     camera as iso.js — 16 headings, 50 degrees from overhead, lit from the north-west, a soft
     shadow — into one sprite sheet (bus3d/, tools/bus3d/). It loads after the map is up, in place
     of the drawn buses, so a bus looks like the real one from every side at sprite cost: no 3D
     engine runs on the map. The glow, snowflake and z cells come over from the drawn atlas. */
  let UV3D = null;
  function load3D(layer) {
    if (SAVE || !BUS3D) return;
    const sz = MOBILE ? '1x' : '2x';
    fetch(`bus3d/atlas.json?v=${BUS3D_V}`).then(r => r.ok ? r.json() : null).then(A => {
      if (!A) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const B = 64;                         // one row more for the wheelchair badge
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height + B;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const uv = {}, iso = layer.iso, ic = iso.canvas;
        for (const [k, [x, y, w, h]] of Object.entries(A.cells[sz])) uv[k] = [x / c.width, y / c.height, (x + w) / c.width, (y + h) / c.height];
        for (const k of ['glow', 'snow', 'zzz']) {
          const [x, y, w, h] = A.cells[sz]['_' + k], [u0, v0, u1, v1] = iso.uv[k];
          g.clearRect(x, y, w, h);
          g.drawImage(ic, u0 * ic.width, v0 * ic.height, (u1 - u0) * ic.width, (v1 - v0) * ic.height, x, y, w, h);
          uv[k] = [x / c.width, y / c.height, (x + w) / c.width, (y + h) / c.height];
        }
        // the wheelchair badge (low floor with a ramp), as in the bus card: white on solid blue
        {
          const y = img.height, k = B / 24;
          g.save(); g.beginPath(); g.roundRect(3, y + 3, B - 6, B - 6, 12); g.fillStyle = '#1f5fd6'; g.fill();
          g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
          g.translate(B * 0.18, y + B * 0.18); g.scale(k * 0.64, k * 0.64);
          g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff';
          for (const d of ['M16 3a1 1 0 1 0 0.01 0', 'm18 19 1-7-6 1', 'm5 8 3-3 5.5 3-2.36 3.5', 'M4.24 14.5a5 5 0 0 0 6.88 6', 'M13.76 17.5a5 5 0 0 0-6.88-6']) g.stroke(new Path2D(d));
          g.restore();
          uv.acc = [0, y / c.height, B / c.width, (y + B) / c.height];
          // a solid white block for the cast shadows (tri3 samples its middle)
          g.fillStyle = '#fff'; g.fillRect(B + 8, y + 8, 16, 16);
          uv.px = [(B + 12) / c.width, (y + 12) / c.height, (B + 20) / c.width, (y + 20) / c.height];
          // zoomed out, a bus is a disc in its service colour with an arrow for its heading (white
          // shapes, tinted per bus): a filled disc, and a chevron pointing up (turned by the shader)
          const dx0 = B + 32;
          g.beginPath(); g.arc(dx0 + B / 2, y + B / 2, B / 2 - 2, 0, 6.2832); g.fillStyle = '#fff'; g.fill();
          uv.disc = [dx0 / c.width, y / c.height, (dx0 + B) / c.width, (y + B) / c.height];
          const ax = dx0 + B + 8;
          g.beginPath(); g.moveTo(ax + B / 2, y + 4); g.lineTo(ax + B - 6, y + B - 6); g.lineTo(ax + B / 2, y + B * 0.68); g.lineTo(ax + 6, y + B - 6); g.closePath(); g.fill();
          uv.arrow = [ax / c.width, y / c.height, (ax + B) / c.width, (y + B) / c.height];
        }
        DIMS = A.dims || {};
        layer.upload(c);
        UV = uv; UV3D = true; update();
      };
      img.src = `bus3d/atlas@${sz}.webp?v=${BUS3D_V}`;
    }).catch(() => {});
  }
  const BUS3D_V = 'b1', BUS3D = false;   // BMTC 3D buses rendered interactively via Three.js (bus3d.js)
  /* Dedicated 3D vehicle model ID resolved via centralized classification engine */
  function modelOf(reg, fl, row) {
    if (row && typeof BMTC_VEHICLES !== 'undefined') {
      const clf = BMTC_VEHICLES.classifyRow(row);
      return clf.modelId;
    }
    const cat = stOf(fl);
    return (typeof BMTC_VEHICLES !== 'undefined' && BMTC_VEHICLES.CATEGORIES[cat])
      ? BMTC_VEHICLES.CATEGORIES[cat].modelId
      : 'unclassified-generic';
  }
  /* Close up, the sheet above is stretched (140 px a bus on a phone, on a screen of 3 pixels a
     point: mush). From HI_Z each model in view loads its own sheet at three times the detail
     (bus3d/hi/<model>.webp: 16 headings, 4 x 4 cells of 420 x 330), drawn with its own texture. */
  const HI_Z = MOBILE ? 15 : 16, HI_CW = 420, HI_CH = 330;
  const HI = {};                          // model -> 'loading' | texture
  const hiUV = d => { const x = (d % 4) * HI_CW, y = Math.floor(d / 4) * HI_CH, W = HI_CW * 4, H = HI_CH * 4; return [x / W, y / H, (x + HI_CW) / W, (y + HI_CH) / H]; };
  function loadHi(m) {
    if (HI[m] || SAVE || !glLayer.gl) return;
    HI[m] = 'loading';
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { HI[m] = glLayer.texture(img); update(); };
    img.onerror = () => { HI[m] = 'failed'; };
    img.src = `bus3d/hi/${m}.webp?v=${BUS3D_V}`;
  }

  const glLayer = {
    id: 'live-gl', type: 'custom', renderingMode: '2d',
    onAdd(m, gl) {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      this.pr = pr; this.buf = gl.createBuffer();
      this.loc = {};
      for (const a of ['a_pos', 'a_off', 'a_uv', 'a_rot', 'a_col', 'a_gray']) this.loc[a] = gl.getAttribLocation(pr, a);
      for (const u of ['u_matrix', 'u_view', 'u_bearing', 'u_tex']) this.loc[u] = gl.getUniformLocation(pr, u);
      const at = BUSISO.atlas(MOBILE ? 1.0 : 1.25, MOBILE ? 2048 : 4096); UV = at.uv;
      this.gl = gl; this.iso = at;
      this.tex = gl.createTexture();
      this.upload(at.canvas);
      this.dirty = true;
      load3D(this);
    },
    // a WebGL2 context (MapLibre 4) mipmaps any size: no shimmer when a big sprite is drawn small
    texture(src) { const t = this.gl.createTexture(); this.upload(src, t); return t; },
    upload(src, tex = this.tex) {
      const gl = this.gl, mip = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    },
    render(gl, matrix) {
      if (!on || !nverts) return;
      const l = this.loc;
      gl.useProgram(this.pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      if (this.dirty) { gl.bufferData(gl.ARRAY_BUFFER, vbuf.subarray(0, nverts * STRIDE), gl.DYNAMIC_DRAW); this.dirty = false; }
      const F = 4;
      const attr = (n, size, off) => { gl.enableVertexAttribArray(l[n]); gl.vertexAttribPointer(l[n], size, gl.FLOAT, false, STRIDE * F, off * F); };
      attr('a_pos', 2, 0); attr('a_off', 2, 2); attr('a_uv', 2, 4); attr('a_rot', 1, 6); attr('a_col', 4, 7); attr('a_gray', 1, 11);
      // positions are relative to `ref` for float precision; fold the offset into the matrix
      const M = Array.from(matrix), rx = ref[0], ry = ref[1];
      M[12] = matrix[0] * rx + matrix[4] * ry + matrix[12]; M[13] = matrix[1] * rx + matrix[5] * ry + matrix[13];
      M[14] = matrix[2] * rx + matrix[6] * ry + matrix[14]; M[15] = matrix[3] * rx + matrix[7] * ry + matrix[15];
      gl.uniformMatrix4fv(l.u_matrix, false, new Float32Array(M));
      const cv = map.getCanvas();
      gl.uniform2f(l.u_view, cv.clientWidth, cv.clientHeight);
      gl.uniform1f(l.u_bearing, map.getBearing() * Math.PI / 180);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(l.u_tex, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      // runs of vertices, each with its texture: the sheet, or a model's close-up sheet
      for (const [tex, a, n] of SEGS) { gl.bindTexture(gl.TEXTURE_2D, tex || this.tex); gl.drawArrays(gl.TRIANGLES, a, n); }
    },
  };
  // the picked bus: rings when zoomed out, light leaving its outline zoomed in (assets/busmap/selfx.js),
  // drawn just under the buses from this layer's own texture
  const FX = typeof SELFX !== 'undefined' ? SELFX.create(map, { id: 'live-gl-fx', tex: () => glLayer.tex }) : null;

  /* ── per-update: positions of buses in view -> vertex buffer ── */
  const lerp = (z, pts) => { if (z <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) { const [z0, a] = pts[i - 1], [z1, b] = pts[i]; return a + (b - a) * (z - z0) / (z1 - z0); } return pts[pts.length - 1][1]; };
  const fl0 = v => v[6] || '';
  let VIS = [];                            // [reg, lng, lat, halfSize] of what was drawn, for clicks and labels
  const P3 = [0, 0, 0];
  function update() {
    if (!on || !FEED || !UV) return;
    if (feedDown()) { nverts = 0; VIS = []; if (FX) FX.set(null); map.triggerRepaint(); labels(); return; }
    const t = now(), z = map.getZoom(), b = map.getBounds();
    const padX = (b.getEast() - b.getWest()) * 0.2 + 0.01, padY = (b.getNorth() - b.getSouth()) * 0.2 + 0.01;
    const W = b.getWest() - padX, E = b.getEast() + padX, S_ = b.getSouth() - padY, N = b.getNorth() + padY;
    const city = z < 11.5, bearing = map.getBearing();
    // 3D sprites: CW x CH logical px, anchored where the wheels meet the road
    const s = BUSMAP.busScale(z);           // one size curve for every network's buses (busmap.js)
    const [CW, CH] = BUSISO.CELL, [, AY] = BUSISO.ANCHOR;
    const bw = CW * s, bh = CH * s, lift = -(AY - CH / 2) * s;
    const glowR = 12 * 9 * s * 1.35;
    const snowZ = z >= 12.5, snowPx = lerp(z, [[12.5, 10], [15, 14], [18, 18]]);
    const hourNow = new Date(Date.now() + 19800000).getUTCHours();
    const pulseT = CALM ? 0 : t * 2.4;
    ref = [mercX((b.getWest() + b.getEast()) / 2), mercY((b.getNorth() + b.getSouth()) / 2)];
    const glows = [], buses = [], snows = [], zzs = [], RAW = [];
    let pick = null;
    VIS = [];
    // a bus is open: the other buses on its route stay in colour, the rest go grey
    const selTr = selReg && TRACK.get(selReg), selSn = selTr ? snOf(selTr.v[1]) : null;
    RING.dy = -(AY - CH / 2) * s; RING.d = Math.max(40, bw * 0.62);
    // zoomed out a 3D bus is a speck that is hard to find: buses are discs in their service colour with a
    // heading arrow up to MK0, the 3D models from MK1, the two crossfading in between (as on MTC)
    const MK0 = 12.6, MK1 = 13.6, mk = UV && UV.disc ? Math.max(0, Math.min(1, (MK1 - z) / (MK1 - MK0))) : 0;
    const mR = lerp(z, [[9, 3.5], [11, 5], [12.6, 7], [13.6, 8]]), marks = [];
    RING.dy = RING.dy * (1 - mk); RING.d = RING.d * (1 - mk) + Math.max(26, mR * 4.2) * mk;
    for (const [reg, tr] of TRACK) {
      const v = tr.v;
      // cull on the fix first (cheap); a bus moves a few km at most between polls
      const cx0 = tr.home ? tr.home[0] : v[3], cy0 = tr.home ? tr.home[1] : v[2];
      if (reg !== selReg && (cx0 < W - 0.05 || cx0 > E + 0.05 || cy0 < S_ - 0.05 || cy0 > N + 0.05)) continue;
      if (reg !== selReg && !passes(v)) continue;
      const prevD = tr.lastD;
      if (city && !tr.ready) {
        // city view: the GPS fix as-is — no route geometry built, nothing to animate
        glide(tr, t, P3); tr.shown = [P3[0], P3[1]];
        if (!fl0(v).includes('u')) tr.moving = t;
      } else posOf(tr, t, P3);
      const lng0 = P3[0], lat0 = P3[1], h = P3[2];
      if (reg !== selReg && (lng0 < W || lng0 > E || lat0 < S_ || lat0 > N)) continue;
      if (tr.lastD != null && prevD != null && tr.lastD - prevD > 0.05) tr.moving = t; // moved since last update
      const rx = mercX(lng0) - ref[0], ry = mercY(lat0) - ref[1];
      RAW.push([tr, rx, ry, h]);
      // drawn where it is, nudged aside if it would sit on top of another bus (separate())
      const mx = rx + (tr.ox || 0), my = ry + (tr.oy || 0);
      const lng = lng0 + (tr.ox || 0) * 360, lat = lat0 - (tr.oy || 0) * 360 * Math.cos(lat0 * Math.PI / 180);
      const fl = v[6], st = stOf(fl, v), lv = (ST[st] && ST[st].lv) || 'sarige', col = COLS[st] || (COLS[st] = hex((ST[st] && ST[st].col) || '#2563eb'));
      const waiting = fl.includes('u');      // MTC: waiting for its next trip
      const ghost = fl.includes('n');        // no trip in MTC's system: drawn as a ghost
      const isMoving = !waiting && !ghost && t - (tr.moving || 0) < 3, sel = reg === selReg;
      // a bus or a route is picked: everything else goes black and white
      const gray = selReg ? (sel || snOf(v[1]) === selSn ? 0 : 1) : focusSn ? (snOf(v[1]) === focusSn ? 0 : 1) : 0;
      if (isMoving && !sel && !gray) {     // the picked bus has its own light (selfx.js)
        const ph = (reg.charCodeAt(1) * 7 + reg.charCodeAt(reg.length - 1) * 13) % 628 / 100;
        glows.push([mx, my, glowR, col, (0.30 + 0.14 * Math.sin(pulseT + ph)) * (z < 12 ? 0.6 : 1)]);
      }
      const dir = Math.round((((h - bearing) % 360 + 360) % 360) / 22.5) % 16;
      const cr = crowdOf(v[1], hourNow), lvl = cr ? cr.level : 1;
      // parked at a terminus (or waiting for its next trip): drawn faded, labelled "parked", and
      // at street zoom it sleeps - a standing bus at the end of its route is not on its way to you
      // MTC lists a bus under its next trip early, sometimes while it still finishes the last one:
      // only a bus that has also stood still for 90 s counts as parked
      const still = t - (tr.moving || 0) > 90;
      let sleep = waiting && still;
      if (!sleep && still) {
        const stStops = stopsOf(v[1]);
        if (stStops && stStops.length > 1) {
          const cx = K * Math.cos(lat * Math.PI / 180), far = s_ => Math.hypot((s_[3] - lng) * cx, (s_[2] - lat) * K);
          sleep = Math.min(far(stStops[0]), far(stStops[stStops.length - 1])) < 400;
        }
      }
      // flag p: the collector found it standing in a depot (or at a terminus away from its next stop) for 5 min:
      // not in service, whatever MTC's trip data says (J1383 / J1041 on A51 in Chrompet depot, 16 Nov)
      tr.depot = fl.includes('p');
      tr.parked = (sleep || tr.depot) && !ghost;
      // the archive's 3D models once their atlas has loaded (UV3D), the drawn ones until then
      const key = UV3D ? `${modelOf(reg, fl, v)}:${dir}` : `${lv}:${dir}:${lvl}`;
      // a ghost keeps its livery, see-through, unless something else is picked
      const ba = sel ? 1 : ghost ? (gray ? 0.6 : 0.42) : sleep ? 0.5 : 1;
      if (mk > 0) marks.push([mx, my, col, gray, ba * mk, h, sel ? 1 : 0, (sleep || tr.depot || ghost || waiting) ? 0 : 1]);
      if (mk < 1) buses.push([mx, my, key, gray, ba * (1 - mk), dir * 22.5 + bearing, sel ? 1 : 0]);   // the heading the sprite shows
      if (z >= 13 && mk < 0.5 && sleep && !ghost && !gray) zzs.push([mx, my, (reg.charCodeAt(reg.length - 1) % 10) / 10]);
      // above the bus: a snowflake for AC, a wheelchair for a ramp, side by side when both
      if (snowZ && mk < 0.5) {
        const bs = [fl.includes('a') && UV.snow, fl.includes('l') && UV.acc].filter(Boolean);
        bs.forEach((u, i) => snows.push([mx, my, -(AY * s + snowPx * 0.55), gray, u, (i - (bs.length - 1) / 2) * snowPx * 1.1]));
      }
      VIS.push([reg, lng, lat, Math.max(14, 12 * 9 * s * 0.45), gray]);
      if (sel) pick = { id: reg, lng, lat, col, rect: UV[key] || [0, 0, 0, 0], bw, bh, lift, mk, discR: mR * 1.35 + 1.75, z };
    }
    separate(RAW, z, bw);
    if (FX) FX.set(pick);
    nverts = 0; SEGS = [];
    const seg = tex => { const L = SEGS[SEGS.length - 1]; if (L && L[0] === tex) return; if (L) L[2] = nverts - L[1]; SEGS.push([tex, nverts, 0]); };
    seg(null);
    for (const [mx, my, r, c, a] of glows) quad(mx, my, r, r, UV.glow, -1000, c[0], c[1], c[2], a);
    // shadows on the road, under every bus, from the sun as it is now (street zooms, the 3D buses)
    if (UV3D && UV.px && z >= 13) {
      const sun = sunNow(), pxm = 9 * s, fade = Math.min(1, z - 13);
      for (const [mx, my, key, g, a, h] of buses) shadow(mx, my, h, DIMS[key.split(':')[0]] || DIM0, pxm, bearing, sun, fade * (g ? 0.4 : 1) * a * a, UV.px);
    }
    // back to front: farther (higher on screen) first; the picked buses over the greyed ones.
    // Close up, each model in view from its own sheet (loadHi), drawn over the rest
    buses.sort((p, q) => (p[6] - q[6]) || (q[3] - p[3]) || (p[1] - q[1]));   // the open bus last, over all the others
    const hiOn = UV3D && z >= HI_Z, hiQ = {};
    for (const bq of buses) {
      const [mx, my, key, g, a] = bq, m = hiOn && key.split(':')[0];
      if (m) { loadHi(m); if (HI[m] && typeof HI[m] === 'object') { (hiQ[m] || (hiQ[m] = [])).push(bq); continue; } }
      quad(mx, my, bw, bh, UV[key], -1000, a, a, a, a, lift, 0, g);   // premultiplied: fade all four
    }
    let hiSel = null;
    for (const m in hiQ) {
      seg(HI[m]);
      for (const bq of hiQ[m]) { const [mx, my, key, g, a] = bq; if (bq[6]) { hiSel = [m, bq]; continue; } quad(mx, my, bw, bh, hiUV(+key.split(':')[1]), -1000, a, a, a, a, lift, 0, g); }
    }
    if (hiSel) { const [m, [mx, my, key, g, a]] = hiSel; seg(HI[m]); quad(mx, my, bw, bh, hiUV(+key.split(':')[1]), -1000, a, a, a, a, lift, 0, g); }
    seg(null);
    if (marks.length) {
      marks.sort((p, q) => (p[6] - q[6]) || (q[3] - p[3]) || (p[1] - q[1]));   // the open bus on top
      for (const [mx, my, c, g, a, h, sl, run] of marks) {
        const R = mR * (sl ? 1.35 : 1);
        quad(mx, my, 2 * R + 3.5, 2 * R + 3.5, UV.disc, -1000, 1, 1, 1, a, 0, 0, g);          // white rim
        quad(mx, my, 2 * R, 2 * R, UV.disc, -1000, c[0], c[1], c[2], a, 0, 0, g);              // service colour
        // the heading arrow, just ahead of the disc; a standing bus (parked, depot, no trip) gets none
        if (run) quad(mx, my, R * 1.5, R * 1.5, UV.arrow, h, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, a, -(R + R * 0.62), 0, g);
      }
    }
    for (const [mx, my, dy, g, u, dx] of snows) quad(mx, my, snowPx, snowPx, u, -1000, 1, 1, 1, 1, dy, dx, g);
    // three z's drifting up and fading, out of phase with each other and other buses
    if (UV.zzz) for (const [mx, my, ph0] of zzs) for (let k = 0; k < 3; k++) {
      const ph = ((CALM ? 0.5 : t * 0.45) + k / 3 + ph0) % 1, sz = (10 + 10 * ph) * Math.max(1, s * 1.8);
      quad(mx, my, sz, sz, UV.zzz, -1000, 1, 1, 1, Math.sin(Math.PI * ph) * 0.95, -(AY * s + 4 + 26 * ph), 6 + 12 * ph);
    }
    SEGS[SEGS.length - 1][2] = nverts - SEGS[SEGS.length - 1][1];
    glLayer.dirty = true;
    map.triggerRepaint();
    labels();
    // Follow this bus: keep it in the middle (moveend below skips the move this makes)
    if (follow && selReg) {
      const e = VIS.find(x => x[0] === selReg), c = map.getCenter();
      if (e && (Math.abs(c.lng - e[1]) > 1e-6 || Math.abs(c.lat - e[2]) > 1e-6)) { following = true; map.setCenter([e[1], e[2]]); following = false; }
      SPEAK.tick(TRACK.get(selReg), t);
    }
  }
  let following = false;
  map.on('dragstart', () => { if (follow) { follow = false; syncFollow(); } });

  /* Buses that would be drawn on top of each other - bunched, or several routes at one
     stop - line up along the road instead, like a queue at a stop. Buses closer
     than a bus length form a group (and stay in it until they are half a length
     further apart, so a group does not flicker); the group is laid out along its
     buses' common heading, in the order they stand on the road, and that order
     only changes when one bus has clearly passed another. No sideways push, so a
     sprite never drifts off the road into the buildings, and big groups close up
     rather than spreading down the street. Street zooms only, and only where the
     sprite is drawn: the position on the road is untouched. */
  let grpSeq = 0;
  function separate(raw, z, bw) {
    const EASE = 0.12;
    const ease = (tr, tx, ty) => {
      tr.ox = (tr.ox || 0) + (tx - (tr.ox || 0)) * EASE; tr.oy = (tr.oy || 0) + (ty - (tr.oy || 0)) * EASE;
      if (!tx && !ty && Math.abs(tr.ox) + Math.abs(tr.oy) < 1e-11) tr.ox = tr.oy = 0;
    };
    if (z < 14.5) { for (const [tr] of raw) { tr.grp = 0; if (tr.ox || tr.oy) ease(tr, 0, 0); } return; }
    const minD = bw * 0.8 / (512 * Math.pow(2, z)), far = minD * 1.5;
    const up = raw.map((_, i) => i), root = i => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
    const cell = new Map();
    raw.forEach((r, i) => { const k = Math.floor(r[1] / far) + ',' + Math.floor(r[2] / far); (cell.get(k) || cell.set(k, []).get(k)).push(i); });
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i][1], y = raw[i][2], cx = Math.floor(x / far), cy = Math.floor(y / far), gi = raw[i][0].grp;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of cell.get((cx + a) + ',' + (cy + b)) || []) {
        if (j <= i) continue;
        const d = Math.hypot(raw[j][1] - x, raw[j][2] - y);
        if (d < (gi && gi === raw[j][0].grp ? far : minD)) up[root(i)] = root(j);
      }
    }
    const groups = new Map();
    raw.forEach((r, i) => { const k = root(i); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
    for (const g of groups.values()) {
      if (g.length === 1) { const tr = g[0][0]; tr.grp = 0; ease(tr, 0, 0); continue; }
      // the group's road: the mean of its buses' headings as an axis (either direction counts the same)
      let sx = 0, sy = 0, mx = 0, my = 0;
      for (const r of g) { const h = (r[3] || 0) * Math.PI / 90; sx += Math.cos(h); sy += Math.sin(h); mx += r[1]; my += r[2]; }
      const ang = Math.atan2(sy, sx) / 2, ux = Math.sin(ang), uy = -Math.cos(ang);
      mx /= g.length; my /= g.length;
      const id = g.reduce((m, r) => r[0].grp && (!m || r[0].grp < m) ? r[0].grp : m, 0) || ++grpSeq;
      for (const r of g) { r[4] = (r[1] - mx) * ux + (r[2] - my) * uy; if (r[0].grp !== id) r[0].rank = r[4] / minD; }
      // keep last frame's order; swap neighbours only once one is clearly past the other
      g.sort((p, q) => (p[0].rank - q[0].rank) || (p[4] - q[4]));
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k + 1 < g.length; k++)
        if (g[k][4] > g[k + 1][4] + minD * 0.5) { const t_ = g[k]; g[k] = g[k + 1]; g[k + 1] = t_; }
      const step = minD * Math.min(1, 4 / (g.length - 1)), cap = minD * 2.5;
      g.forEach((r, k) => {
        const tr = r[0], off = Math.max(-cap, Math.min(cap, (k - (g.length - 1) / 2) * step - r[4]));
        tr.grp = id; tr.rank = k - (g.length - 1) / 2;
        ease(tr, off * ux, off * uy);
      });
    }
  }

  /* Route numbers under the buses, street zooms only. Plain HTML labels moved with
     the bus on every frame: a symbol layer refreshed from moving points re-places
     and fades each label in again at street zoom, so the numbers flickered. */
  const LBL = new Map();
  let lblBox = null;
  function labels() {
    if (!lblBox) {
      lblBox = document.createElement('div'); lblBox.className = 'lv-lbls';
      map.getCanvasContainer().appendChild(lblBox);
    }
    const show = on && running && map.getZoom() >= 14;
    const seen = new Set();
    if (show) for (const [reg, lng, lat, , gray] of VIS.slice(0, 400)) {
      const tr = TRACK.get(reg); if (!tr) continue;
      let el = LBL.get(reg);
      if (!el) { el = document.createElement('span'); LBL.set(reg, el); lblBox.appendChild(el); }
      const sn = busSn(tr) + (tr.depot ? ' · in depot' : tr.parked ? ' · parked' : ''), c = gray || tr.parked ? '#8a8a8a' : lvCol(tr.v[6]);
      if (el._sn !== sn) { el.textContent = sn.length > 22 ? sn.slice(0, 21) + '…' : sn; el.title = sn; el._sn = sn; }
      if (el._c !== c) { el.style.color = c; el._c = c; el.classList.toggle('dim', !!gray); }
      el._ll = [lng, lat];
      seen.add(reg);
    }
    for (const [reg, el] of LBL) if (!seen.has(reg)) { el.remove(); LBL.delete(reg); }
    const se = on && selReg && VIS.find(x => x[0] === selReg);
    RING.ll = se ? [se[1], se[2]] : null;
    placeLabels();
  }
  /* The open bus, marked with a pulsing ring above every other bus, so it is found at a glance */
  (() => { const st = document.createElement('style');
    st.textContent = `.lv-ring{position:absolute;left:0;top:0;pointer-events:none;z-index:3;will-change:transform}
.lv-ring i{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:50%;box-sizing:border-box;border:3px solid #ff6a13;box-shadow:0 0 0 2px #fff,0 0 12px rgba(255,106,19,.6)}
.lv-ring i+i{border-width:2px;box-shadow:none;animation:lvring 1.6s ease-out infinite}
@keyframes lvring{from{transform:scale(1);opacity:.9}to{transform:scale(2.1);opacity:0}}
@media (prefers-reduced-motion:reduce){.lv-ring i+i{animation:none;opacity:0}}
.lv-also{margin-top:12px}
.lv-f.ng{border:1px solid #e2ddd2}
.lv-f.ng.on,#lv-strip .lv-drop .lv-f.ng.on{background:#6f6b63;color:#fff;border-color:#6f6b63}
.lv-f.ng.on i{background:rgba(255,255,255,.3)!important;color:#fff}
.lv-f.ng.on .lv-n,.lv-f.ng.on span,.lv-f.wc.on .lv-n,.lv-f.wc.on span{color:#fff!important}
.lv-f.ng.on:hover{background:#5d5a53}`;
    document.head.appendChild(st); })();
  function placeRing() {
    if (!RING.ll) { if (RING.el) RING.el.style.display = 'none'; return; }
    if (!RING.el) { RING.el = document.createElement('div'); RING.el.className = 'lv-ring'; RING.el.innerHTML = '<i></i><i></i>'; map.getCanvasContainer().appendChild(RING.el); }
    const q = map.project(RING.ll), d = RING.d;
    RING.el.style.display = ''; RING.el.style.width = RING.el.style.height = d + 'px';
    RING.el.style.transform = `translate(${Math.round(q.x - d / 2)}px, ${Math.round(q.y + RING.dy - d / 2)}px)`;
  }
  function placeLabels() {
    placeRing();
    for (const el of LBL.values()) {
      const q = map.project(el._ll);
      el.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px) translate(-50%, 14px)`;
    }
  }
  map.on('move', () => { if (LBL.size || RING.ll) placeLabels(); });

  /* Pace: how often bus positions are recomputed. The map itself redraws on
     every pan or zoom regardless; this is only the animation clock. */
  function interval() {
    const z = map.getZoom();
    if (CALM || SAVE) return 3000;
    if (z < 11) return 2000;
    if (z < 13) return MOBILE ? 500 : 250;
    return MOBILE ? 50 : 33;
  }
  let lastU = 0;
  function loop(ts) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (document.hidden || !FEED) return;
    if (ts - lastU < interval()) return;
    lastU = ts;
    update();
  }
  map.on('moveend', () => { if (running && !following) update(); });

  function addLayers() {
    if (map.getLayer('live-gl')) return;
    map.addLayer(glLayer);
    if (FX) FX.add('live-gl');
  }
  // clicks: the nearest drawn bus within reach of the tap
  function busAt(p) {
    if (!on || !running) return null;
    let best = null, bd = Infinity;
    for (const [reg, lng, lat, half] of VIS) {
      const q = map.project([lng, lat]), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < Math.max(14, half) && d < bd) { bd = d; best = reg; }
    }
    return best;
  }
  window.liveBusAt = p => !!busAt(p);
  window.openBus = openBus;
  window.getFeed = () => FEED;
  window.getTrack = () => TRACK;
  window.getCurrentViewer = () => CURRENT_VIEWER;
  map.on('click', e => {
    const r = busAt(e.point);
    if (r) {
      openBus(r);
    } else if (typeof stopNear === 'function' && !stopNear(e.point) && $('card') && $('card').classList.contains('open')) {
      if (typeof closeCard === 'function') closeCard();
    }
  });
  let hoverT = 0;
  map.on('mousemove', e => {
    if (performance.now() - hoverT < 80) return; hoverT = performance.now();
    if (busAt(e.point)) map.getCanvas().style.cursor = 'pointer';
    else if (map.getCanvas().style.cursor === 'pointer' && !map.queryRenderedFeatures(e.point).length) map.getCanvas().style.cursor = '';
  });
  // "c:<name>": a bus the collector could not place on one of our workings (a service
  // Chennai One does not carry, e.g. Chennai Ula) — shown under the operator's route name
  // the number shown for a bus: the collector's own when it differs from the working's
  // (a 570S bus placed on P570S's stops), else the working's
  const busSn = tr => tr.v[8] || snOf(tr.v[1]);
  /* A bus whose trip matched none of our workings comes as "c:<MTC's number>", and MTC's numbers carry
     variant tags ours don't: "113 CT2" is our 113CT, "A51CT 1" is A51CT, "M51R" is M51RCT. Resolve the
     way the route build matched them (chennai_one dataset/mtcits_supplement.py service_no), so the
     card still shows the route; the bus label keeps MTC's own number (busSn). */
  const svcNo = rno => { const t = String(rno).trim().split(/\s+/); let o = t[0];
    t.slice(1).forEach(x => { if (/^(CT|CUT)\d*$/i.test(x)) o += 'CT'; else if (!/^(R|RE|E|D|C)?\d*$/i.test(x)) o += x; });
    return o.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  const snOf = code => { const f = codeFeat(code); if (f) return f.properties.sn || f.properties.route_name;
    const raw = String(code).replace(/^c:/, ''); if (ROUTE_IDX[raw]) return raw;
    const first = raw.trim().split(/\s+/)[0];
    return [first].find(x => x && ROUTE_IDX[x]) || raw; };

  let DWELL_P = null;
  const dwellOf = sid => (DWELL_P || (DWELL_P = fetch('live/dwell.json?t=' + Math.floor(Date.now() / 3600000)).then(r => r.ok ? r.json() : null).catch(() => null)))
    .then(j => (j && j.stop && sid && j.stop[sid]) || null);

  /* ── watching: the route of the open bus, or the picked route, is polled fast on the
     server while anyone has it open. One ping a minute; the server caps how many routes. */
  const watchSn = () => {
    if (!on) return null;
    if (selReg) { const tr = TRACK.get(selReg); return tr ? snOf(tr.v[1]) : null; }
    return focusSn;
  };
  let watchedAt = 0, watchedSn = null;
  function watchPing(force) {
    const sn = watchSn();
    if (!REPORTS || !sn || document.hidden) return;
    if (!force && sn === watchedSn && Date.now() - watchedAt < 60000) return;
    watchedSn = sn; watchedAt = Date.now();
    fetch('api/watch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sn }) }).catch(() => {});
  }
  setInterval(watchPing, 15000);

  /* ── polling ── */
  function poll(force) {
    if (document.hidden && !force && !navigator.webdriver) return;
    // the whole feed once, then only the buses that changed (delta.js); without it, the whole file each time
    (FEEDSRC ? FEEDSRC.get().catch(() => null) : fetch(`${URL_}?t=${Math.floor(Date.now() / 10000)}`).then(r => r.ok ? r.json() : null)).then(j => {
      if (!j || !Array.isArray(j.v)) throw 0;
      FEED = parse(j); feedErr = false;
      ingest(FEED); update(); pill(false);
      if (cardStop) paintStopArrivals();
      if (cardBus) paintBus(cardBus, false);
      else if (focusSn) liveOnRoute();
    }).catch(() => { pill(true); });
  }
  window.pollLive = poll;
  function ensureStops() {
    if (ROUTE_STOPS !== undefined) return Promise.resolve();
    return dataJoin('route_stops.json').then(j => { if (ROUTE_STOPS === undefined) ROUTE_STOPS = j; })
      .catch(() => {});
  }
  function start() {
    ensureTimings();
    addLayers();
    ensureStops().then(() => { for (const tr of TRACK.values()) tr.ready = false; GEO.clear(); });
    poll();
    clearInterval(pollT);
    // every 10 s while a bus or route is open (the collector polls those every 15 s), else POLL_MS
    let lastPoll = Date.now();
    pollT = setInterval(() => {
      if (watchSn() || Date.now() - lastPoll >= POLL_MS - 500) { lastPoll = Date.now(); poll(); }
    }, 10000);
    if (!running) { running = true; requestAnimationFrame(loop); }
    pill();
  }
  function stop() {
    clearInterval(pollT); pollT = null; running = false;
    nverts = 0; VIS = []; if (FX) FX.set(null); map.triggerRepaint(); labels();
    pill();
    if (cardStop) paintStopArrivals();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && on) poll(); });

  /* ── filters (in the strip at the bottom): tap a bus type to hide or show it, or show
     only wheelchair-accessible buses. LIVE, at the top, stays a status. ── */
  // Categories from centralized BMTC taxonomy
  const GROUPS = (typeof BMTC_VEHICLES !== 'undefined' ? BMTC_VEHICLES.getAllCategories() : [])
    .map(c => [c.id, c.icon || 'bus', c.name]);
  const groupOf = (fl, row) => stOf(fl, row);
  const FILT = (() => { try { const j = JSON.parse(localStorage.getItem('blrLiveFilter') || '{}'); return { off: (j.off || []).filter(g => ST[g]), wc: !!j.wc, ng: !!j.ng }; } catch (e) { return { off: [], wc: false, ng: false }; } })();
  const saveFilt = () => { try { localStorage.setItem('blrLiveFilter', JSON.stringify(FILT)); } catch (e) {} };
  const passes = arg => {
    if (!arg) return false;
    let g = 'unclassified', fl = '';
    if (Array.isArray(arg)) {
      g = (typeof BMTC_VEHICLES !== 'undefined') ? BMTC_VEHICLES.classifyRow(arg).catId : stOf(arg[6]);
      fl = arg[6] || '';
    } else if (typeof arg === 'string') {
      fl = arg;
      g = stOf(fl);
    }
    return !FILT.off.includes(g) && (!FILT.wc || fl.includes('l')) && (!FILT.ng || !fl.includes('n'));
  };
  const filtered = () => FILT.off.length > 0 || FILT.wc || FILT.ng;

  /* ── status pill ── (its styles, and the card's, are in ../assets/busmap/busmap.css) */
  const pillEl = document.createElement('div');
  pillEl.id = 'live-pill';
  document.body.appendChild(pillEl);
  /* The feed is down when the server's file stops changing (collector or the
     source API stopped: older than 3 min, or written with no buses) or cannot
     be fetched at all. Then no buses are drawn - dead reckoning from old fixes
     would invent them - and the pill turns red until the feed comes back. */
  let feedErr = false, wasDown = false;
  const FRESH_LIVE_SEC = 90;
  const FRESH_RETENTION_SEC = 600;
  const isLive = fix => (now() - fix) <= FRESH_LIVE_SEC;
  const isStale = fix => { const age = now() - fix; return age > FRESH_LIVE_SEC && age <= FRESH_RETENTION_SEC; };
  const isExpired = fix => (now() - fix) > FRESH_RETENTION_SEC;

  // the file is rewritten even while the source API fails (with the last buses it had),
  // so freshness is read from the GPS fixes too: no bus heard from in 5 min = down
  const heard = F => F.heard != null ? F.heard : (F.heard = F.v.some(v => v[5] > F.t - 300 && v[5] < F.t + 600));
  const feedDown = () => FEED ? (FEED.v.length === 0 || now() - FEED.t > 180 || !heard(FEED)) : feedErr;
  function pill(err) {
    if (err !== undefined) feedErr = !!err;
    if (!on) { pillEl.classList.remove('show'); return; }
    pillEl.classList.add('show');
    
    // Explicit freshness classification
    const liveVehicles = FEED ? FEED.v.filter(v => isLive(v[5]) && passes(v)) : [];
    const totalLive = FEED ? FEED.v.filter(v => isLive(v[5])).length : 0;
    const staleVehicles = FEED ? FEED.v.filter(v => isStale(v[5]) && passes(v)) : [];
    
    const down = feedDown() || (FEED && totalLive === 0 && staleVehicles.length === 0);
    const staleOnly = !down && FEED && totalLive === 0 && staleVehicles.length > 0;

    pillEl.classList.toggle('down', down);
    pillEl.classList.toggle('stale', staleOnly);
    pillEl.classList.toggle('wait', !FEED && !down && !staleOnly);
    
    if (down !== wasDown) { wasDown = down; if (down) toast('Live bus tracking is paused. It will resume soon.'); update(); }
    
    const count = filtered()
      ? `${liveVehicles.length.toLocaleString('en-IN')} of ${totalLive.toLocaleString('en-IN')}`
      : `${totalLive.toLocaleString('en-IN')}`;

    let pillContent = '';
    if (down) {
      pillContent = `<span><b>0 buses</b> · ${FEED && FEED.msg ? FEED.msg : 'Live tracking will resume soon'}</span>`;
    } else if (staleOnly) {
      pillContent = `<span class="badge stale">STALE</span><span><b>0 live</b> (${staleVehicles.length} delayed fixes)</span>`;
    } else if (FEED) {
      pillContent = `<b>LIVE</b><span>${count} buses</span>`;
    } else {
      pillContent = `<span>connecting…</span>`;
    }
    pillEl.innerHTML = `<span class="lv-live"><span class="dot"></span>${pillContent}</span>`;
    strip();
  }
  /* Mobile first: the filters in one strip at the bottom — the three biggest kinds of bus, and a
     "Filters" button opening every choice as a list. Nothing scrolls sideways. A tap redraws only
     what changed: the open list keeps its place (no jump back to the top, no replayed animation). */
  const stripEl = document.createElement('div');
  stripEl.id = 'lv-strip';
  document.body.appendChild(stripEl);
  let MORE = false;
  function strip() {
    if (!on) { stripEl.classList.remove('show'); return; }
    stripEl.classList.add('show');
    const stats = {};
    for (const [id] of GROUPS) stats[id] = { total: 0, live: 0, stale: 0 };
    if (FEED && FEED.v) {
      for (const v of FEED.v) {
        const g = groupOf(v[6], v);
        if (!stats[g]) stats[g] = { total: 0, live: 0, stale: 0 };
        stats[g].total++;
        if (isLive(v[5])) stats[g].live++; else stats[g].stale++;
      }
    }
    const groups = GROUPS.slice().sort((x, y) => (stats[y[0]] ? stats[y[0]].total : 0) - (stats[x[0]] ? stats[x[0]].total : 0));
    const chip = ([g, icon, name], isDropdown = false) => {
      const s = stats[g] || { total: 0, live: 0, stale: 0 };
      const cat = ST[g] || { col: '#6b7280' };
      const off = FILT.off.includes(g);
      const countHTML = isDropdown
        ? `<b class="lv-n"><span class="cnt-live" title="${s.live} LIVE">${s.live}</span>${s.stale ? `<span class="cnt-stale" style="opacity:0.6;font-weight:normal;margin-left:3px" title="${s.stale} STALE">(${s.stale})</span>` : ''}</b>`
        : `<b class="lv-n" title="${s.live} live, ${s.stale} stale">${(s.live || s.total).toLocaleString('en-IN')}</b>`;
      return `<button class="lv-f${off ? ' off' : ''}" data-g="${g}" aria-pressed="${!off}" title="${off ? 'Show' : 'Hide'} ${name} buses (${s.live} live, ${s.stale} stale)"><i style="background:${cat.col}">${ic(icon, 10)}</i><span>${name}</span>${FEED ? countHTML : ''}</button>`;
    };
    // an on/off choice in force fills its whole cell (blue for Accessible only, grey for the hidden
    // no-trip buses), with the count of buses it touches and the result in its label (as on MTC)
    let nA = 0, nN = 0; if (FEED) for (const v of FEED.v) { if (v[6].includes('l')) nA++; if (v[6].includes('n')) nN++; }
    const cnt = k => FEED ? `<b class="lv-n">${k.toLocaleString('en-IN')}</b>` : '';
    const wcB = `<button class="lv-f wc${FILT.wc ? ' on' : ''}" data-wc aria-pressed="${FILT.wc}" title="${FILT.wc ? 'Only wheelchair-accessible buses are shown: tap to show all buses' : 'Show only wheelchair-accessible buses'}"><i style="background:#1f5fd6">${ic('access', 10)}</i><span>${FILT.wc ? 'Accessible only: shown' : 'Accessible only'}</span>${cnt(nA)}</button>`;
    const ngB = `<button class="lv-f ng${FILT.ng ? ' on' : ''}" data-ng aria-pressed="${FILT.ng}" title="${FILT.ng ? 'Buses with no trip in BMTC\u2019s system are hidden: tap to show them (faded)' : 'Buses with no trip in BMTC\u2019s system are shown faded: tap to hide them'}"><i style="background:#9a9aa0">${ic('bus', 10)}</i><span>${FILT.ng ? 'Not on a trip: hidden' : 'Hide buses not on a trip'}</span>${cnt(nN)}</button>`;
    const extra = [wcB, ngB];
    const MAIN = 3, all = groups.length + extra.length <= MAIN + 1;   // few enough: every choice on the strip, no menu
    const active = FILT.off.length + (FILT.wc ? 1 : 0) + (FILT.ng ? 1 : 0);
    const html = all ? `<div class="key">${groups.map(g => chip(g, false)).join('')}${extra.join('')}</div>`
      : `<div class="key">${groups.slice(0, MAIN).map(g => chip(g, false)).join('')}`
        + `<button class="lv-f lv-more${MORE ? ' on' : ''}" data-more aria-expanded="${MORE}" title="Every kind of bus, accessible buses"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg><em>Filters</em>${active ? `<b class="lv-dotn">${active}</b>` : ''}<span class="chev">${MORE ? '▾' : '▴'}</span></button></div>`
        + (MORE ? `<div class="lv-drop" role="menu"><div class="lv-dh">Kinds of bus</div>${groups.map(g => chip(g, true)).join('')}${extra.length ? `<div class="lv-dh">Show</div>${extra.join('')}` : ''}</div>` : '');
    if (html === stripEl._html) return;
    const had = !!stripEl.querySelector('.lv-drop');
    stripEl._html = html;
    const t = document.createElement('div'); t.id = 'lv-strip'; t.className = stripEl.className; t.innerHTML = html;
    morph(stripEl, t);
    const d = stripEl.querySelector('.lv-drop'); if (d && !had) d.classList.add('anim');
  }
  const morph = (a, b) => {    // make node a look like node b, touching only what differs
    if (a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
    if (a.nodeType === 3) { if (a.data !== b.data) a.data = b.data; return; }
    if (a.nodeType !== 1) return;
    for (const n of [...a.attributes]) if (!b.hasAttribute(n.name)) a.removeAttribute(n.name);
    for (const n of [...b.attributes]) if (a.getAttribute(n.name) !== n.value) a.setAttribute(n.name, n.value);
    const ka = [...a.childNodes], kb = [...b.childNodes];
    kb.forEach((n, i) => i < ka.length ? morph(ka[i], n) : a.appendChild(n));
    ka.slice(kb.length).forEach(n => n.remove());
  };

  // a click anywhere else closes the menu (a button redrawn by its own click is no longer in the page: not "elsewhere")
  document.addEventListener('click', e => { if (MORE && e.target.isConnected && !stripEl.contains(e.target)) { MORE = false; strip(); } });
  stripEl.addEventListener('click', e => {
    const b = e.target.closest('.lv-f'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.more != null) { MORE = !MORE; strip(); return; }
    if (b.dataset.g) {
      const g = b.dataset.g, i = FILT.off.indexOf(g);
      if (i >= 0) FILT.off.splice(i, 1); else FILT.off.push(g);
      if (FILT.off.length === GROUPS.length) FILT.off = FILT.off.filter(x => x !== g);   // never hide everything
    } else if (b.dataset.wc != null) FILT.wc = !FILT.wc;
    else if (b.dataset.ng != null) FILT.ng = !FILT.ng;
    saveFilt(); pill(); update();
    if (cardStop) paintStopArrivals();
  });
  setInterval(() => on && pill(), 15000);

  /* ── cards ── */
  const hhmm = t => new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const inMin = t => { const m = Math.round((t - now()) / 60); return m <= 0 ? 'due' : `${m} min`; };
  /* Lucide icons (ISC licence), the set the rest of the map uses */
  const ICON = {
    access: '<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    seat: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    full: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    late: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    early: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
    noshow: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    skip: '<path d="m15 9-6 6"/><path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="m9 9 6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    snow: '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
    bolt: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
    bus: '<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  };
  const ic = (k, sz = 16) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  /* Bus features as icon badges, not words: a bolt for electric, a snowflake
     for AC, the metro app's step-free icon for low floor (every low-floor bus,
     AC or not, has a ramp). A diesel non-AC bus has no badge at all. */
  const badge = (k, bg, title, cls = '') => `<span class="lv-ico${cls}" style="background:${bg}" title="${title}" aria-label="${title}">${ic(k, 12)}</span>`;
  const chips = fl => {
    const lv = lvOf(fl);
    return (fl.includes('e') ? badge('bolt', BUSART.L[lv] && BUSART.L[lv].ev ? BUSART.L[lv].key : '#2f7fd6', 'Electric') : '')
      // AC: a blue snowflake on ice, so it never reads as the solid-blue wheelchair badge
      + (fl.includes('a') ? badge('snow', '#e4f3ff', 'AC', ' ac') : '')
      + (fl.includes('l') ? badge('access', '#1f5fd6', 'Low floor with a ramp — wheelchair accessible') : '')
      + (fl.includes('g') ? `<span class="lv-chip" style="background:#5a6b7d" title="BMTC's tracking runs no trips on this route yet: its route, next stop and times come from the bus's GPS">Trip from GPS</span>` : '')
      + (fl.includes('x') ? `<span class="lv-chip" style="background:#b8860b">Express</span>` : '')
      + (fl.includes('d') ? `<span class="lv-chip" style="background:#b03a3a">Deluxe</span>` : '')
      + (fl.includes('s') ? `<span class="lv-chip" style="background:#7d8c5c">Small bus</span>` : '')
      + (fl.includes('w') ? `<span class="lv-chip" style="background:#c2185b">Ladies only</span>` : '')
      + (fl.includes('p') ? `<span class="lv-chip" style="background:#8a8a8e">In depot · not in service</span>`
        : fl.includes('u') ? `<span class="lv-chip" style="background:#8a8a8e">Waiting for next trip</span>` : '');
  };
  const ago = s => s < 90 ? `${Math.max(0, Math.round(s))} s` : `${Math.round(s / 60)} min`;

  /* ── shareable state: the address bar always holds a link to what is open,
     and the Share button hands out the short link whose card WhatsApp, X and
     Facebook can show (/r /s /b, served by share_api.py) ── */
  // short share links on whichever domain the map is served from (maps.reclaim.city, or the old maps.reclaimchennai.city)
  // share links + social cards: bengaluru_bus/server/share_api.py --city bengaluru (container bmtc-share on raw)
  const ORIGIN = 'https://maps.reclaim.city/bmtc';
  let SHARE = null;
  function setShare(q, short, title) {
    SHARE = { url: ORIGIN + short, title };                          // /r /s /b: share pages with cards
    try { history.replaceState(null, '', q ? '?' + q : location.pathname); } catch (e) {}
    shareBtn.classList.toggle('on', !!q);
  }
  const shareBtn = document.createElement('button');
  shareBtn.className = 'cclose lv-share'; shareBtn.setAttribute('aria-label', 'Share'); shareBtn.title = 'Share';
  shareBtn.innerHTML = ic('share', 15);
  $('card-close').after(shareBtn);
  const toast = msg => {
    let t = $('lv-toast');
    if (!t) { t = document.createElement('div'); t.id = 'lv-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  };
  shareBtn.addEventListener('click', async e => {
    e.stopPropagation();
    if (!SHARE) return;
    if (navigator.share) { try { await navigator.share({ title: SHARE.title, text: SHARE.title, url: SHARE.url }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(SHARE.url); toast('Link copied'); } catch (err) { toast(SHARE.url); }
  });

  /* One card for a bus: its own header (route, destination, registration, GPS
     age, badges, report, crowding) on top of the route card of the working it
     is running — workings, timings and the stop diagram — with the bus's
     progress drawn on that diagram. The map stays where the rider was looking. */
  /* Bring the opened bus into view: only if it is off the map or under the card (opened from a
     list, a search or a link), and zoomed in to at least `zmin` when given. The card's side is
     left out of the view, so the bus lands in the part of the map that can be seen. */
  function revealBus(reg, zmin) {
    const tr = TRACK.get(reg); if (!tr) return;
    const p = posOf(tr, now(), [0, 0, 0]), c = map.getContainer().getBoundingClientRect();
    const cd = $('card') && $('card').getBoundingClientRect();
    const pad = { top: 70, bottom: 50, left: 40, right: 40 };
    if (cd && cd.width && cd.height && cd.bottom > c.top && cd.top < c.bottom) {
      if (cd.width > c.width * 0.7) pad.bottom = Math.max(pad.bottom, c.bottom - cd.top + 30);   // phone: a sheet from the bottom
      else if (cd.left - c.left < c.width / 2) pad.left = Math.max(pad.left, cd.right - c.left + 30);
      else pad.right = Math.max(pad.right, c.right - cd.left + 30);
    }
    if (pad.top + pad.bottom > c.height - 80) pad.bottom = Math.max(50, c.height - 80 - pad.top);
    if (pad.left + pad.right > c.width - 80) pad.left = pad.right = 40;
    const q = map.project([p[0], p[1]]);
    const seen = q.x > pad.left && q.x < c.width - pad.right && q.y > pad.top && q.y < c.height - pad.bottom;
    const z = Math.max(map.getZoom(), zmin || 0);
    if (seen && z <= map.getZoom() + 0.01) return;
    map.flyTo({ center: [p[0], p[1]], zoom: z, offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2], duration: 900, essential: true });
  }
  function openBus(reg, opts = {}) {
    const tr = TRACK.get(reg); if (!tr) return;
    const code = tr.v[1], sn = snOf(code);
    if (selStopMarker) { selStopMarker.remove(); selStopMarker = null; }
    const cam = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    selReg = reg; cardBus = reg; cardStop = null;
    if (ROUTE_IDX[sn]) { baseSelect(sn, code); map.stop(); map.jumpTo(cam); } else showCard();
    // Clean up any stale route-level onroute box so it doesn't collide with the bus's also-on-route
    const onr = $('lv-onroute'); if (onr) onr.remove();
    paintBus(reg, true); showBusRoute(code, reg); update(); watchPing();
    setShare(`bus=${encodeURIComponent(reg)}`, `/b/${encodeURIComponent(reg)}`, `Bus ${reg} on route ${busSn(tr)} — live on the Bengaluru BMTC map`);
    requestAnimationFrame(() => { if (selReg === reg) revealBus(reg, opts.zoom); });
  }
  // trace the bus's own working on the map, the way tapping a route does
  let activeRouteFetchReg = null;
  function showBusRoute(code, reg) {
    if (!map.getSource('sel')) return;
    const f = codeFeat(code);
    const sn = snOf(code);
    selMarkers.forEach(m => m.remove()); selMarkers = [];
    if (f && f.geometry) {
      map.getSource('sel').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: f.geometry, properties: { ...f.properties, color: f.properties.color || hashColor(sn) } }] });
      map.setPaintProperty('sel-line', 'line-width', 5.5);
      map.setPaintProperty('sel-glow', 'line-width', 16); map.setPaintProperty('sel-glow', 'line-blur', 8);
      if (map.getLayer('sel-arrows')) map.setLayoutProperty('sel-arrows', 'visibility', 'visible');
    } else {
      map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
      if (map.getLayer('sel-arrows')) map.setLayoutProperty('sel-arrows', 'visibility', 'none');
    }
    if (map.getLayer('routes')) {
      map.setPaintProperty('routes', 'line-opacity', 0.08);
    }

    // Phase 4A Dynamic Route Highlighting from Backend Route Geometry API
    if (reg) {
      activeRouteFetchReg = reg;
      fetch(`/api/v1/vehicles/${encodeURIComponent(reg)}/route-geometry`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || selReg !== reg || activeRouteFetchReg !== reg) return;
          if (data.has_geometry && data.geojson && data.geojson.features && data.geojson.features.length) {
            const routeCol = hashColor(data.route_short_name || sn || 'BMTC');
            data.geojson.features.forEach(feat => {
              if (feat.properties) feat.properties.color = feat.properties.color || routeCol;
            });
            map.getSource('sel').setData(data.geojson);
            
            if (data.association_level === 3) {
              map.setPaintProperty('sel-line', 'line-width', 4.5);
              map.setPaintProperty('sel-glow', 'line-width', 12);
            } else {
              map.setPaintProperty('sel-line', 'line-width', 5.5);
              map.setPaintProperty('sel-glow', 'line-width', 16);
            }
            if (map.getLayer('sel-arrows')) map.setLayoutProperty('sel-arrows', 'visibility', 'visible');
          }
        })
        .catch(err => console.debug('Route geometry fetch:', err));
    }
  }
  function paintBus(reg, first) {
    const tr = TRACK.get(reg);
    if (!tr) { const bb = $('lv-busbar'); if (bb) bb.innerHTML = '<div class="lv-note">This bus is no longer reporting.</div>'; return; }
    const [, code, , , , fix, fl] = tr.v, sn = busSn(tr), st = stopsOf(code) || [];
    const f = codeFeat(code), dest = f ? f.properties.destinatio : (st.length ? st[st.length - 1][1] : '');
    
    // Nearest stop and coordinates
    let nearestStop = '';
    if (st && st.length) {
      let minDist = Infinity;
      for (const s of st) {
        const d = Math.hypot((s[3] - tr.v[3]) * 108000, (s[2] - tr.v[2]) * 111000);
        if (d < minDist) { minDist = d; nearestStop = s[1]; }
      }
    }
    const age = now() - fix;
    const fresh = isLive(fix);
    const badgeHTML = `<span class="badge ${fresh ? 'live' : 'stale'}">${fresh ? 'LIVE' : 'STALE'}</span>`;

    const clf = (typeof BMTC_VEHICLES !== 'undefined') ? BMTC_VEHICLES.classifyRow(tr.v) : {
      catId: stOf(fl),
      category: ST[stOf(fl)] || { name: 'BMTC', col: '#2563eb' },
      modelId: modelOf(reg, fl, tr.v),
      confidence: 'UNKNOWN'
    };
    const cat = clf.category;
    const isUnclassified = clf.catId === 'unclassified';
    const catBadge = `<span class="cat-pill" style="background:${cat.col}22;color:${cat.col};border:1px solid ${cat.col}66;">${cat.name}</span>`;
    const confBadge = `<span class="conf-pill conf-${(clf.confidence || 'unknown').toLowerCase()}">${clf.confidence || 'UNKNOWN'} CONFIDENCE</span>`;

    // Phase 4A Route Association, Speed, Delay & Movement Metadata
    const speedKmh = tr.v[12];
    const movementStatus = tr.v[13] || 'unknown';
    const delaySec = tr.v[14];
    const tripHeadsign = tr.v[17];
    const assocLevel = tr.v[18] != null ? tr.v[18] : 4;

    let movementBadge = '';
    if (movementStatus === 'moving') {
      movementBadge = `<span class="badge" style="background:#16a34a22;color:#16a34a;border:1px solid #16a34a66">🟢 Moving ${speedKmh ? '· ' + Math.round(speedKmh) + ' km/h' : ''}</span>`;
    } else if (movementStatus === 'stopped') {
      movementBadge = `<span class="badge" style="background:#dc262622;color:#dc2626;border:1px solid #dc262666">🔴 Stopped</span>`;
    } else {
      movementBadge = `<span class="badge" style="background:#6b728022;color:#6b7280;border:1px solid #6b728066">⚪ In Transit</span>`;
    }

    let delayBadge = '';
    if (delaySec == null) {
      delayBadge = `<span class="badge" style="background:#6b728022;color:#6b7280;border:1px solid #6b728066">Delay unavailable</span>`;
    } else if (delaySec >= -60 && delaySec <= 60) {
      delayBadge = `<span class="badge" style="background:#16a34a22;color:#16a34a;border:1px solid #16a34a66">⏱️ On time</span>`;
    } else if (delaySec > 60) {
      delayBadge = `<span class="badge" style="background:#f59e0b22;color:#d97706;border:1px solid #f59e0b66">⚠️ +${Math.round(delaySec / 60)} min late</span>`;
    } else {
      delayBadge = `<span class="badge" style="background:#2563eb22;color:#2563eb;border:1px solid #2563eb66">⚡ ${Math.round(Math.abs(delaySec) / 60)} min early</span>`;
    }

    let assocBadge = '';
    if (assocLevel === 1) {
      assocBadge = `<span class="badge" style="background:#10b98122;color:#059669;border:1px solid #10b98166;font-size:11px;">✓ Verified GTFS Trip</span>`;
    } else if (assocLevel === 2) {
      assocBadge = `<span class="badge" style="background:#3b82f622;color:#2563eb;border:1px solid #3b82f666;font-size:11px;">Matched GTFS Route</span>`;
    } else if (assocLevel === 3) {
      assocBadge = `<span class="badge" style="background:#f59e0b22;color:#d97706;border:1px solid #f59e0b66;font-size:11px;">Spatial Candidate (65% confidence)</span>`;
    } else {
      assocBadge = `<span class="badge" style="background:#6b728022;color:#4b5563;border:1px solid #6b728066;font-size:11px;">Route Assignment Pending</span>`;
    }

    const home = homeOfReg(reg);
    let resolvedDest = tripHeadsign || dest;
    if (!resolvedDest) {
      if (home && home[2]) resolvedDest = `Base: ${home[2]}`;
      else resolvedDest = 'Bengaluru Transit';
    }

    // Determine clean route tag
    let tagSn = sn;
    if (!tagSn || tagSn === 'BMTC' || tagSn === 'undefined') {
      if (tr.v[8] && tr.v[8] !== 'BMTC') tagSn = tr.v[8];
      else if (home && home[2]) tagSn = 'DEPOT';
      else tagSn = cat.name;
    }

    $('card-title').innerHTML = `${tagHTML(tagSn, f && f.properties.category)}<span class="ttl"><span>${fl.includes('n') ? 'Not on a trip' : '→ ' + resolvedDest}</span></span>`;
    $('card-sub').innerHTML = `<div class="lv-card-meta"><span class="lv-busline">${chips(fl)}Bus <b>${reg}</b> &middot; ${badgeHTML} ${movementBadge} ${delayBadge}</span><div class="lv-catline">${catBadge} ${confBadge} ${assocBadge}</div></div><span class="lv-mnext" id="lv-mnext"></span>`;
    
    let bar = $('lv-busbar');
    if (!bar || first) {
      if (bar) bar.remove();
      bar = document.createElement('div'); bar.id = 'lv-busbar';
      $('card-body').prepend(bar);
    }
    const hNow = new Date(Date.now() + 19800000).getUTCHours(), cr = crowdOf(code, hNow);
    let crowdHTML = '';
    if (cr) {
      const bars = Array.from({ length: 24 }, (_, h) => crowdRatio(code, h, cr.we));
      const mx = Math.max(1.6, ...bars.filter(x => x != null));
      crowdHTML = `<div class="seclbl">Crowding now · estimated</div>`
        + `<div class="lv-crowd"><span style="color:${CROWD_COL[cr.level]}">${PEOPLE} <b>${CROWD_NAMES[cr.level]}</b></span>`
        + `<span>${Math.round(cr.p * 100)}% chance you'll stand</span></div>`
        + `<div class="lv-bars" title="Estimated crowding by hour on this working">${bars.map((x, h) => `<i style="height:${x == null ? 2 : Math.max(2, 100 * x / mx)}%;background:${x == null ? '#e7e2d6' : CROWD_COL[x < 0.75 ? 0 : x < 1.3 ? 1 : 2]};${h === hNow ? 'outline:1.5px solid #1c1c1e;outline-offset:1px' : ''}"></i>`).join('')}</div>`
        + `<div class="lv-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>`;
    }
    const lv = lvOf(fl), lvl = cr ? cr.level : 1, stype = clf.catId;
    // the stop it is heading for, with BMTC's own time for it
    const t = now(), nx = (tr.v[7] || []).find(([, et]) => et > t - 20), ns = nx && st[nx[0]];
    const wait = fl.includes('u');
    // the bus itself, in 3D: the hero is built once per bus and kept while the rest of the card refreshes
    const board = { no: String(tagSn).trim().split(/\s+/)[0], dest: fl.includes('n') ? '' : (resolvedDest.replace(/^Base:\s*/, '')) || '' };
    if (!bar._hero || bar._k !== reg + clf.catId + clf.modelId + board.no + board.dest) {
      bar._k = reg + clf.catId + clf.modelId + board.no + board.dest;
      const unclassifiedBanner = isUnclassified
        ? `<div class="lv-unclassified-banner"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span><b>Unclassified Vehicle</b>: Operating without matched GTFS schedule.${home && home[2] ? ` Base depot: <b>${home[2]}</b>.` : ' Showing representative 3D geometry.'}</span></div>`
        : '';
      bar.innerHTML = `<div class="lv-hero" id="lv-hero"></div>${unclassifiedBanner}<div id="lv-busfacts"></div>`;
      bar._hero = true;
      hero3D($('lv-hero'), clf.modelId, BUSISO.portrait(lv, lvl), cat.name, board);
    }
    const shade = shadeOf(tr);
    const nextStopHeroHTML = ns
      ? `<div class="lv-hero-next" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f3f4f6;border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--ink);"><span>Next stop <b>${ns[1]}</b> &middot; <span style="color:#16a34a">${inMin(nx[1])}</span> &middot; ${hhmm(nx[1])}</span></div>`
      : nearestStop
      ? `<div class="lv-hero-next" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f3f4f6;border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--ink);"><span>Near <b>${nearestStop}</b></span></div>`
      : '';
    const posHTML = `<div class="lv-pos">📍 <b>${tr.v[2].toFixed(4)}° N, ${tr.v[3].toFixed(4)}° E</b>${nearestStop ? ` · near <b>${nearestStop}</b>` : ''}</div>`;
    const nextStopHTML = ns
      ? `<dl class="bm-facts"><dt>${wait ? 'Starts from' : 'Next stop'}</dt><dd>${ns[1]} · ${inMin(nx[1])} · ${hhmm(nx[1])}</dd></dl>`
      : fl.includes('p')
      ? `<dl class="bm-facts"><dt>Next stop</dt><dd>In depot or at terminus for over 5 minutes</dd></dl>`
      : `<dl class="bm-facts"><dt>Next stop</dt><dd>${nearestStop ? `Approaching <b>${nearestStop}</b>` : 'In transit'} <small style="color:var(--muted)">(ETA unavailable: no real-time trip update from BMTC)</small></dd></dl>`;

    const punctualityText = delaySec == null ? 'Unavailable' : (delaySec > 60 ? '+' + Math.round(delaySec / 60) + ' min late' : (delaySec < -60 ? Math.round(Math.abs(delaySec) / 60) + ' min early' : 'On time'));
    const movementText = movementStatus === 'moving' ? (speedKmh ? `Moving (${Math.round(speedKmh)} km/h)` : 'Moving') : (movementStatus === 'stopped' ? 'Stopped' : 'In Transit');
    
    const routeTelemetryHTML = `
      <div class="lv-route-telemetry" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:8px 0;font-size:12.5px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:700;color:var(--ink);">Route & Telemetry</span>
          ${assocBadge}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div><span style="color:var(--muted)">Route:</span> <b>${tagSn}</b></div>
          <div><span style="color:var(--muted)">Movement:</span> <b>${movementText}</b></div>
          <div><span style="color:var(--muted)">Punctuality:</span> <b>${punctualityText}</b></div>
          <div><span style="color:var(--muted)">Terminus:</span> <b>${resolvedDest}</b></div>
        </div>
      </div>
    `;

    $('lv-busfacts').innerHTML = nextStopHeroHTML + posHTML + routeTelemetryHTML + nextStopHTML
      + (shade && !fl.includes('n') && !wait ? `<div class="lv-shade${shade.side ? '' : ' even'}">${ic('sun', 15)}<span>${shade.text}</span></div>` : '')
      + `<button class="timings-btn${follow ? ' on' : ''}" id="followbtn">${follow ? 'Following this bus' : 'Follow this bus'}</button>`
      + `<div class="lv-stophead" style="margin-top:10px"><span></span>${REPORTS ? `<button class="lv-report" id="lv-report" style="margin:0">${ic('flag', 14)}Report</button>` : ''}</div><div id="lv-said"></div>${crowdHTML}` + `<div id="lv-also" class="lv-also"></div>`;
    onRouteList($('lv-also'), snOf(code), reg);
    if ($('lv-report')) $('lv-report').addEventListener('click', e => { e.stopPropagation(); report({ reg, route: code, sn, fl, stop: '', stop_name: '', lat: tr.v[2], lon: tr.v[3] }); });
    $('followbtn').addEventListener('click', e => {
      e.stopPropagation(); follow = !follow; syncFollow();
      if (follow) { const p = posOf(tr, now(), [0, 0, 0]); map.easeTo({ center: [p[0], p[1]], zoom: Math.max(map.getZoom(), 14) }); if (SPEAK.has(tr)) SPEAK.start(tr); }
    });
    said({ reg });
    railProgress(first);
    miniNext(true);
    if (window.NammaAI && typeof window.NammaAI.renderVehicleAIIntelligence === 'function') {
      window.NammaAI.renderVehicleAIIntelligence(reg);
    }
  }

  /* The bus in the card, in 3D: the archive's model of its type (bus3d/models/, Draco + WebP,
     200-340 KB), turned by finger or mouse. model-viewer loads only when the first bus card
     opens; until it and the model arrive (or on Save-Data) the drawn portrait stands in. */
  let MV = null;
  const loadMV = () => MV || (MV = new Promise((ok, no) => {
    if (customElements.get('model-viewer')) return ok();
    const sc = document.createElement('script'); sc.type = 'module';
    sc.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
    sc.onload = () => customElements.whenDefined('model-viewer').then(ok); sc.onerror = no;
    document.head.appendChild(sc);
  }));
  /* The bus's own route on its destination boards. Every BMTC model's boards are amber LED dot
     matrices, one texture per board material (Blender exports, bmtc-buses): <model>_board (front
     and rear: number and destination, in Kannada as BMTC shows it), <model>_boardin (the same, seen
     from inside) and <model>_sideled (the side LED: the number). Each is redrawn here as the
     same dot matrix and swapped in, as colour and glow. Kannada destinations: BMTC's own names
     for the terminus station (data/dest_kn.json, from BMTC's API, lan kn), English where none. */
  const BOARD_W = { 'astra-switch': 886, 'ordinary-bs4': 1057, 'sarige-bs6': 1090, 'tata-ev': 1163, 'vajra-volvo': 984, 'vayuvajra-ev': 1004 };
  const SIDE_W = { 'ordinary-bs4': 756, 'sarige-bs6': 669, 'vajra-volvo': 756 };
  let DEST_KN = null;
  const destKn = () => DEST_KN || (DEST_KN = fetch('data/dest_kn.json?v=1').then(r => r.ok ? r.json() : {}).catch(() => ({})));
  function ledBoard(text, W, H = 128) {
    const P = 5, cols = Math.floor(W / P), rows = Math.floor(H / P), ox = (W - cols * P) / 2 + P / 2, oy = (H - rows * P) / 2 + P / 2;
    const g = document.createElement('canvas'); g.width = cols; g.height = rows;
    const x = g.getContext('2d', { willReadFrequently: true });
    const font = px => `700 ${px}px "Noto Sans Kannada","Noto Sans",system-ui,sans-serif`;
    let px = Math.round(rows * 0.8), t = text;
    x.font = font(px);
    while (x.measureText(t).width > cols - 4 && px > 14) x.font = font(--px);
    while (x.measureText(t).width > cols - 4 && t.length > 4) t = t.slice(0, -1).trimEnd();
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.fillText(t, cols / 2, rows / 2 + 1);
    const a = x.getImageData(0, 0, cols, rows).data;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const o = c.getContext('2d');
    o.fillStyle = '#14110b'; o.fillRect(0, 0, W, H);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = a[(j * cols + i) * 4 + 3] > 100;
      o.fillStyle = lit ? '#ffb31a' : '#2b2416';
      o.beginPath(); o.arc(ox + i * P, oy + j * P, lit ? 2.1 : 1.6, 0, 7); o.fill();
    }
    return c.toDataURL('image/png');
  }
  async function setBoards(mv, model, board) {
    if (!board || !board.no || !mv.model) return;
    const kn = board.dest ? (await destKn())[board.dest] : '';
    const front = board.dest ? `${board.no} ${kn || board.dest}` : board.no;
    const tex = {}, get = async (k, txt, w) => tex[k] || (tex[k] = await mv.createTexture(ledBoard(txt, w), 'image/png'));
    for (const m of mv.model.materials) {
      const side = /_sideled$/.test(m.name);
      if (!side && !/_board(in)?$/.test(m.name)) continue;
      const t = side ? await get('s', board.no, SIDE_W[model] || 756) : await get('f', front, BOARD_W[model] || 1024);
      if (m.pbrMetallicRoughness.baseColorTexture) m.pbrMetallicRoughness.baseColorTexture.setTexture(t);
      if (m.emissiveTexture) m.emissiveTexture.setTexture(t);
    }
  }
  let CURRENT_VIEWER = null;
  function hero3D(el, model, poster, name, board) {
    if (CURRENT_VIEWER) {
      try { CURRENT_VIEWER.dispose(); } catch (e) {}
      CURRENT_VIEWER = null;
    }
    if (typeof BUS3D_LIB !== 'undefined' && BUS3D_LIB.hasThree()) {
      el.innerHTML = '';
      CURRENT_VIEWER = BUS3D_LIB.mountViewer(el, model, board);
      return;
    }
    el.innerHTML = `<img alt="${name} bus" src="${poster}">`;
  }

  /* Spoken stops while following a bus: when it leaves a stop, "next stop" in Kannada and then in
     English, both in Sarvam bulbul's Gokul voice (the Chennai map's voice) from BMTC's own Kannada stop
     names (BMTC's API, lan kn). The English one reads the place name in Kannada script, so it is not
     anglicised. Recorded once per station (audio/stops.json; bengaluru_bus voice/bmtc_stopnames.py,
     voice/tts_stops_kn.py), so nothing is synthesised on the phone. Routes with clips: the manifest's
     "routes" (VOICE below, so the Follow button knows before it loads). A map stop is matched to BMTC's
     station by place (within 150 m). The first clip plays inside the tap on Follow, which is
     what lets phones play the rest. */
  const VOICE = new Set(['410-FA']);   // grown from audio/routes.json: route numbers all of whose stations have clips
  fetch('audio/routes.json?v=2').then(r => r.ok ? r.json() : null).catch(() => null)
    .then(j => { for (const r of (j && j.routes) || []) VOICE.add(String(r).toUpperCase()); });
  const VOICE_URL = 'audio/stops.json?v=2';
  const SPEAK = (() => {
    const el = new Audio(); el.preload = 'auto';
    let man = {}, q = [], last = null, reg = null, on = false;
    const load = sn => man[sn] instanceof Promise ? man[sn] : Promise.resolve(man[sn] !== undefined ? man[sn]
      : (man[sn] = fetch(VOICE_URL).then(r => r.ok ? r.json() : null).catch(() => null).then(j => (man[sn] = j))));
    const play = () => { if (!q.length || !el.paused && !el.ended) return; el.src = q.shift(); el.play().catch(() => {}); };
    el.addEventListener('ended', () => setTimeout(play, 250));
    function sid(M, code, i) {
      const s_ = (stopsOf(code) || [])[i]; if (!s_ || !M) return null;
      const key = code + ':' + i; M._m = M._m || {};
      if (key in M._m) return M._m[key];
      let best = null, bd = 150;
      const cx = Math.cos(s_[2] * Math.PI / 180) * K;
      for (const [id, x] of Object.entries(M.stops)) {
        const d = Math.hypot((x.lon - s_[3]) * cx, (x.lat - s_[2]) * K);
        if (d < bd) { bd = d; best = id; }
      }
      if (!best) {                    // same stop, placed apart: the same first word of its name within 1.5 km
        const w = String(s_[1]).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)[0];
        bd = 1500;
        for (const [id, x] of Object.entries(M.stops)) {
          if (String(x.en).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)[0] !== w) continue;
          const d = Math.hypot((x.lon - s_[3]) * cx, (x.lat - s_[2]) * K);
          if (d < bd) { bd = d; best = id; }
        }
      }
      return (M._m[key] = best);
    }
    function say(M, code, i) {
      const id = sid(M, code, i); if (!id) return;
      q = [`audio/kn/${id}.mp3`].concat(M.stops[id].en_ms ? [`audio/en/${id}.mp3`] : []); el.pause(); play();
    }
    return {
      has: tr => !!tr && VOICE.has(String(busSn(tr)).toUpperCase()),
      start(tr) {                     // in the tap: unlock audio, say the stop it is heading for
        on = true; reg = tr.v[0]; last = null;
        el.src = 'audio/silence.mp3';
        el.play().catch(() => {});
        load(String(busSn(tr)).toUpperCase()).then(M => { if (on && M) this.tick(TRACK.get(reg), now(), true); });
      },
      stop() { on = false; reg = null; q = []; el.pause(); },
      tick(tr, t, force) {
        if (!on || !tr || tr.v[0] !== reg) return;
        const sn = String(busSn(tr)).toUpperCase(), M = man[sn];
        if (!M || M instanceof Promise) return;
        const nx = (tr.v[7] || []).find(([, et]) => et > t - 20);
        if (!nx) return;
        const k = tr.v[1] + ':' + nx[0];
        if (k === last && !force) return;
        last = k; say(M, tr.v[1], nx[0]);
      },
    };
  })();

  function syncFollow() {
    if (!follow) SPEAK.stop(); const f = $('followbtn'); if (f) { f.classList.toggle('on', follow); f.textContent = follow ? 'Following this bus' : 'Follow this bus'; } }

  /* The buses running the open route right now, as on the APSRTC/TGSRTC route cards:
     each with the way it is heading (MTC runs both directions under one number),
     or waiting for its next trip. Tap one to open it. */
  function liveOnRoute() {
    const box = $('lv-onroute'); if (!box || !focusSn || cardBus) return;
    onRouteList(box, focusSn, null);
  }
  // the buses on route `sn` now, tap one to open it; `skip`: the open bus, left out ("Also on this route")
  function onRouteList(box, sn, skip) {
    if (!on || !FEED) { box.innerHTML = ''; return; }
    const t = now(), cut = s => s && s.length > 20 ? s.slice(0, 19) + '…' : s || '';
    
    // Unassigned or generic depot vehicles should not group all together
    if (!sn || sn === "BMTC" || sn === "undefined") {
      const html = `<div class="lv-note">${skip ? 'This bus is operating on an unassigned or depot service.' : 'Unassigned service.'}</div>`;
      if (box._html === html) return;
      box._html = html; box.innerHTML = html;
      return;
    }

    const allOnRoute = [...TRACK.entries()].filter(([r, tr]) => {
      const routeCode = snOf(tr.v[1]);
      return routeCode === sn && passes(tr.v) && !isExpired(tr.v[5]);
    });

    const liveOnRoute = allOnRoute.filter(([r, tr]) => isLive(tr.v[5]));
    const bs = allOnRoute.filter(([r]) => r !== skip)
      .sort((a, b) => (isLive(b[1].v[5]) - isLive(a[1].v[5])) || b[1].v[5] - a[1].v[5]);

    let headerHTML = '';
    if (skip) {
      headerHTML = `<div class="seclbl">Also on this route <b>${bs.length}</b></div>`;
    } else {
      headerHTML = `<div class="seclbl">Live on this route <b>${liveOnRoute.length}</b>${allOnRoute.length > liveOnRoute.length ? ` <small style="color:var(--muted)">(${allOnRoute.length - liveOnRoute.length} stale)</small>` : ''}</div>`;
    }

    let listHTML = '';
    if (bs.length > 0) {
      listHTML = `<div class="lv-onr">${bs.slice(0, 40).map(([reg, tr]) => {
        const fl = tr.v[6], clf_ = (typeof BMTC_VEHICLES !== 'undefined') ? BMTC_VEHICLES.classifyRow(tr.v) : { category: { name: 'BMTC', col: '#888' } }, L_ = { name: clf_.category.name, key: clf_.category.col }, f = codeFeat(tr.v[1]), st = stopsOf(tr.v[1]) || [];
        const dest = f ? f.properties.destinatio : st.length ? st[st.length - 1][1] : '';
        const age = t - tr.v[5];
        const fresh = isLive(tr.v[5]);
        return `<button class="lv-onb${fresh ? '' : ' stale'}" data-bus="${reg}" title="${L_.name || ''}${dest ? ' · to ' + dest : ''}"><i style="background:${L_.key || '#888'}">${ic('bus', 11)}</i>`
          + `<span><b>${reg}</b><small>${fl.includes('n') ? 'no trip assigned' : fl.includes('p') ? 'in depot' : fl.includes('u') ? 'waiting for next trip' : '→ ' + cut(dest)} · <b class="${fresh ? 't-live' : 't-stale'}">${ago(age)}</b></small></span></button>`;
      }).join('')}</div>`;
    } else if (skip && allOnRoute.some(([r]) => r === skip)) {
      listHTML = `<div class="lv-note">This is the only bus currently tracking on this route.</div>`;
    } else {
      listHTML = `<div class="lv-note">${skip ? 'No other bus is on this route right now.' : 'No live bus is on this route right now.'}</div>`;
    }

    const html = headerHTML + listHTML;
    if (box._html === html) return;
    box._html = html; box.innerHTML = html;
    box.querySelectorAll('[data-bus]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = TRACK.get(el.dataset.bus); if (!tr) return;
      openBus(el.dataset.bus, skip ? {} : { zoom: 14 });
    }));
  }

  /* The folded card (tap its header): the stop the bus is heading for stays on its last line,
     blinking slowly as the bus closes in (within 1 km or 4 min), fast when it is nearly there
     (250 m or a minute), and steady once it stands at the stop. A long name scrolls. */
  let miniT = null;
  function miniNext(first) {
    const card = $('card'), el = $('lv-mnext');
    const tr = cardBus && TRACK.get(cardBus);
    if (!card || !el || !tr) { if (card) card.classList.remove('lv-hasnext'); return; }
    const t = now(), fl = tr.v[6], code = tr.v[1], st = stopsOf(code) || [];
    const nx = (tr.v[7] || []).find(([, et]) => et > t - 20), ns = nx && st[nx[0]];
    let txt = '', cls = '';
    if (ns && !fl.includes('p') && !fl.includes('n')) {
      const p = posOf(tr, t, [0, 0, 0]), cx = K * Math.cos(p[1] * Math.PI / 180);
      const dist = s_ => Math.hypot((s_[3] - p[0]) * cx, (s_[2] - p[1]) * K);
      const prev = nx[0] > 0 && st[nx[0] - 1], d = dist(ns), sec = nx[1] - t;
      if (fl.includes('u')) { txt = `Starts from <b>${ns[1]}</b> · ${hhmm(nx[1])}`; cls = 'wait'; }
      else if (d < 45) { txt = `At <b>${ns[1]}</b>`; cls = 'at'; }
      else if (prev && dist(prev) < 45 && sec > 60) { txt = `At <b>${prev[1]}</b>`; cls = 'at'; }
      else {
        cls = d < 250 || sec < 60 ? 'near' : d < 1000 || sec < 240 ? 'appr' : '';
        txt = `Next <b>${ns[1]}</b> · ${cls === 'near' ? 'arriving' : inMin(nx[1])}`;
      }
    }
    card.classList.toggle('lv-hasnext', !!txt);
    el.className = 'lv-mnext' + (cls ? ' ' + cls : '');
    if (el._t !== txt) {
      el._t = txt;
      el.innerHTML = txt ? `<i></i><span class="lv-mtrack"><span class="lv-mtxt">${txt}</span></span>` : '';
      const tk = el.querySelector('.lv-mtrack'), tx = el.querySelector('.lv-mtxt');
      // a long name scrolls: measured once it is laid out (the folded card may still be animating)
      if (tk) requestAnimationFrame(() => { const over = tx.scrollWidth - tk.clientWidth; tx.classList.toggle('scroll', over > 4); tx.style.setProperty('--dx', -over - 8 + 'px'); tx.style.setProperty('--dur', Math.max(5, over / 22 + 3) + 's'); });
    }
    if (first) { clearInterval(miniT); miniT = setInterval(() => { if (!cardBus) { clearInterval(miniT); miniT = null; } miniNext(); }, 1000); }
  }

  /* The bus's progress on the stop diagram: stops behind it filled, the stop it
     is heading for blinking, the rest hollow with their predicted times. Runs on
     every poll and every few seconds, so the blink moves on as the bus does. */
  function railProgress(scroll, tries = 0) {
    if (!cardBus) return;
    const tr = TRACK.get(cardBus), rail = $('stops-wrap') && $('stops-wrap').querySelector('.rail');
    if (!tr || !rail) { if (tries < 20) setTimeout(() => railProgress(scroll, tries + 1), 250); return; }
    const t = now(), eta = new Map(tr.v[7].map(([i, et]) => [i, et]));
    const upcoming = tr.v[7].filter(([, et]) => et > t - 20).map(([i]) => i);
    const next = upcoming.length ? Math.min(...upcoming) : Infinity;
    rail.classList.add('lv-live');
    rail.querySelectorAll('[data-i]').forEach(el => {
      const i = +el.dataset.i;
      el.classList.toggle('passed', i < next);
      el.classList.toggle('next', i === next);
      if (el.tagName === 'LI' || el.classList.contains('capname')) {
        let e = el.querySelector('.lv-eta');
        const et = eta.get(i);
        if (et != null && i >= next) {
          if (!e) { e = document.createElement('span'); e.className = 'lv-eta'; (el.querySelector('.lbl.out') || el).appendChild(e); }
          e.textContent = `${inMin(et)} · ${hhmm(et)}`;
        } else if (e) e.remove();
      }
    });
    if (!rail._lvWired) {
      rail._lvWired = true;
      rail.addEventListener('click', ev => {
        const el = ev.target.closest('[data-i]'); if (!el || !cardBus) return;
        const t2 = TRACK.get(cardBus), s2 = t2 && stopsOf(t2.v[1]);
        if (s2 && s2[+el.dataset.i]) goToStop(s2[+el.dataset.i], cardBus);
      });
    }
    if (scroll) { const n = rail.querySelector('li.next'); if (n) setTimeout(() => n.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }
  }
  setInterval(() => { if (cardBus && !document.hidden) railProgress(false); }, 5000);

  // which route-stop entries sit at this physical stop (stops are merged by location on the map)
  let STOP_GRID = null;
  // ids: a per-side pin's stop ids - only that side's stops (its position may be MTC's, up to 80 m from ours)
  function stopKeys(lon, lat, ids) {
    if (!ROUTE_STOPS) return [];
    if (!STOP_GRID) {
      STOP_GRID = new Map();
      for (const [code, r] of Object.entries(ROUTE_STOPS)) {
        const s = r.d && r.d[0] ? r.d[0].s : [];
        s.forEach((x, i) => {
          const k = `${Math.round(x[2] * 500)},${Math.round(x[3] * 500)}`;
          if (!STOP_GRID.has(k)) STOP_GRID.set(k, []);
          STOP_GRID.get(k).push([code, i, x[2], x[3], x[0]]);
        });
      }
    }
    const out = [], gy = Math.round(lat * 500), gx = Math.round(lon * 500);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      for (const e of STOP_GRID.get(`${gy + dy},${gx + dx}`) || [])
        if ((!ids || ids.has(e[4])) && Math.hypot((e[3] - lon) * K * Math.cos(lat * Math.PI / 180), (e[2] - lat) * K) < (ids ? 150 : 70)) out.push(e);
    return out;
  }
  function paintStopArrivals() {
    const box = $('lv-arrivals'); if (!box || !cardStop) return;
    if (!on) {
      box.innerHTML = `<div class="seclbl">Live arrivals</div><div class="lv-note">Live buses are switched off.</div><button class="lv-btn" id="lv-on">Show live buses</button>`;
      $('lv-on').addEventListener('click', () => setOn(true));
      return;
    }
    if (!FEED || ROUTE_STOPS === undefined) { box.innerHTML = `<div class="seclbl">Live arrivals</div><div class="lv-note">Loading live buses…</div>`; ensureStops().then(paintStopArrivals); return; }
    const keys = stopKeys(cardStop[0], cardStop[1], cardIds);
    const want = new Map(); keys.forEach(([code, i]) => { if (!want.has(code)) want.set(code, new Set()); want.get(code).add(i); });
    const t = now(), arr = [];
    for (const [reg, tr] of TRACK) {
      const s = want.get(tr.v[1]); if (!s) continue;
      for (const [i, et] of tr.v[7]) if (s.has(i) && et > t - 30 && et < t + 5400) { arr.push({ reg, code: tr.v[1], et, fl: tr.v[6], sn: busSn(tr) }); break; }
    }
    arr.sort((a, b) => a.et - b.et);
    const hidden = arr.filter(a => !passes(a.fl)).length;
    arr.splice(0, arr.length, ...arr.filter(a => passes(a.fl)));
    const rows = arr.slice(0, 12).map(a => {
      const f = codeFeat(a.code), dest = f ? f.properties.destinatio : '';
      return `<div class="lv-row" data-reg="${a.reg}" style="cursor:pointer">${tagHTML(a.sn || snOf(a.code), f && f.properties.category)}`
        + `<span class="meta">→ <b>${dest || ''}</b><br>${chips(a.fl)}${a.reg}${(c => c ? ` <span title="${CROWD_NAMES[c.level]} (estimated)" style="color:${CROWD_COL[c.level]}">${PEOPLE}</span>` : '')(crowdOf(a.code, new Date(a.et * 1000 + 19800000).getUTCHours()))}</span>`
        + `<span class="when">${inMin(a.et)}<small>${hhmm(a.et)}</small></span></div>`;
    }).join('');
    box.innerHTML = `<div class="seclbl">Live arrivals · next 90 min</div>`
      + (rows || `<div class="lv-note">No tracked bus is due here in the next 90 minutes. Not every bus reports its position.</div>`)
      + (hidden ? `<div class="lv-note">${hidden} more bus${hidden === 1 ? '' : 'es'} hidden by the filters at the bottom.</div>` : '')
      + (rows ? `<div class="lv-note">Arrival times are BMTC's own, from its bus tracking. Tap a bus to follow it.</div>` : '');
    box.querySelectorAll('[data-reg]').forEach(el => el.addEventListener('click', () => {
      const tr = TRACK.get(el.dataset.reg); if (!tr) return;
      openBus(el.dataset.reg, { zoom: 14 });
    }));
  }

  // add a live section to every stop card
  const baseOpenStop = openStop;
  openStop = function (f, opts = {}) {
    baseOpenStop(f);
    cardBus = null; selReg = null; focusSn = null;
    cardStop = f.geometry.coordinates;
    cardIds = f.properties && f.properties.ids ? new Set(String(f.properties.ids).split(',')) : null;
    if (opts.fly) map.flyTo({ center: cardStop, zoom: Math.max(map.getZoom(), 16), duration: 1100, essential: true });
    const head = document.createElement('div');
    head.className = 'lv-stophead';
    head.innerHTML = (opts.fromBus ? `<button class="lv-backbtn" id="lv-back">${ic('back', 14)}Bus ${opts.fromBus}</button>` : '<span></span>')
      + (REPORTS ? `<button class="lv-report" id="lv-report-stop" style="margin:0">${ic('flag', 14)}Report</button>` : '');
    const box = document.createElement('div'); box.id = 'lv-arrivals'; box.style.marginBottom = '12px';
    const saidBox = document.createElement('div'); saidBox.id = 'lv-said';
    $('card-body').prepend(head, saidBox, box);
    if (opts.fromBus) $('lv-back').addEventListener('click', () => swapCard(() => {
      const tr = TRACK.get(opts.fromBus); if (!tr) return;
      openBus(opts.fromBus, { zoom: 15 });
    }));
    const keys = stopKeys(cardStop[0], cardStop[1], cardIds);
    const stopCode = keys.length ? stopsOf(keys[0][0])[keys[0][1]][0] : '';
    const stopName = f.properties['Stop Name'] || '';
    if ($('lv-report-stop')) $('lv-report-stop').addEventListener('click', () => report({ stop: stopCode, stop_name: stopName, lat: cardStop[1], lon: cardStop[0], atStop: true }));
    // how long buses stand here, measured from their GPS (travel_model.py -> live/dwell.json)
    const sid = f.properties.stop_id || stopCode;
    dwellOf(sid).then(d => {
      if (!d || !document.body.contains(head)) return;
      const n = document.createElement('div'); n.className = 'lv-note'; n.style.margin = '0 0 8px';
      n.textContent = `Buses stand here about ${d < 90 ? d + ' s' : Math.round(d / 60) + ' min'} when they stop · measured from their GPS`;
      head.after(n);
    });
    if (stopCode) said({ stop: stopCode });
    paintStopArrivals();
    const key = `${cardStop[1].toFixed(5)},${cardStop[0].toFixed(5)}`;
    setShare(`stop=${key}`, `/s/${key}`, `${stopName} — live bus arrivals on the Bengaluru BMTC map`);
  };

  /* bus card -> stop card: fly to the stop and slide the card across */
  function swapCard(fn) {
    const c = $('card');
    c.classList.add('lv-out');
    setTimeout(() => { fn(); c.classList.remove('lv-out'); c.classList.add('lv-in'); setTimeout(() => c.classList.remove('lv-in'), 260); }, 170);
  }
  function goToStop(s, fromBus) {
    if (!s) return;
    const [code, name, lat, lon] = s;
    // the map's stop pins are merged by place; take the one at this stop
    let best = null, bd = 120;
    for (const f of (STOPS && STOPS.features) || []) {
      const c = f.geometry.coordinates, d = Math.hypot((c[0] - lon) * K * Math.cos(lat * Math.PI / 180), (c[1] - lat) * K);
      if (d < bd) { bd = d; best = f; }
    }
    const f = best || { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { 'Stop Name': name, 'route name': '[]' } };
    swapCard(() => openStop(f, { fly: true, fromBus }));
  }

  /* ── rider reports: tap, tap, done ── */
  const SAY = {
    seats: { label: 'How full is it?', opts: {
      free: ['seat', 'Seats free', { many: 'Lots of seats', some: 'A few seats', few: 'One or two' }],
      standing: ['users', 'Standing', { some: 'A few standing', crowded: 'Crowded aisle', packed: 'Packed' }],
      full: ['full', 'Full', { boarded: 'I got on', squeezed: 'Squeezed in', left_behind: "Couldn't get on" }] } },
    timing: { label: 'Is it on time?', opts: {
      on_time: ['clock', 'On time', null],
      late: ['late', 'Late', { lt5: 'Under 5 min', '5_15': '5–15 min', '15_30': '15–30 min', gt30: '30+ min' }],
      early: ['early', 'Early', { lt5: 'Under 5 min', '5_15': '5–15 min', gt15: '15+ min' }],
      no_show: ['noshow', "Didn't come", { 15: 'Waited 15 min', 30: 'Waited 30 min', 60: 'An hour or more' }],
      skipped: ['skip', "Didn't stop", { did_not_stop: 'Drove past', full: 'Too full to stop' }] } },
    access: { label: 'Ramp and access', opts: {
      ramp_ok: ['access', 'Ramp worked', null], ramp_broken: ['access', "Ramp didn't work", null], not_low_floor: ['access', 'Not low floor', null] } },
  };
  const sheet = document.createElement('div');
  sheet.id = 'lv-sheet';
  document.body.appendChild(sheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('open'); });
  function report(ctx) {
    const pickBus = () => {
      // at a stop: which bus? (the next arrivals here, or none listed)
      const keys = stopKeys(ctx.lon, ctx.lat), want = new Set(keys.map(k => k[0])), t = now(), arr = [];
      for (const [reg, tr] of TRACK) if (want.has(tr.v[1])) {
        const e = tr.v[7].find(([i, et]) => keys.some(k => k[0] === tr.v[1] && k[1] === i) && et > t - 600 && et < t + 2400);
        if (e) arr.push([e[1], reg, tr]);
      }
      arr.sort((a, b) => a[0] - b[0]);
      return arr.slice(0, 6);
    };
    const tile = (k, icon, label, cls = '') => `<button class="lv-tile ${cls}" data-k="${k}">${ic(icon, 26)}<span>${label}</span></button>`;
    const frame = (title, body, back) => {
      sheet.innerHTML = `<div class="lv-sheetbox" role="dialog" aria-label="Report">`
        + `<div class="lv-sheethead">${back ? `<button class="lv-x" data-back>${ic('back', 18)}</button>` : '<span></span>'}<b>${title}</b><button class="lv-x" data-close>✕</button></div>`
        + `<div class="lv-sub">${ctx.sn ? `${tagHTML(ctx.sn)} ` : ''}${ctx.reg ? `Bus <b>${ctx.reg}</b>` : ''}${ctx.stop_name ? ` · ${ctx.stop_name}` : ''}</div>${body}</div>`;
      sheet.querySelector('[data-close]').onclick = () => sheet.classList.remove('open');
      if (back) sheet.querySelector('[data-back]').onclick = back;
      sheet.classList.add('open');
    };
    const send = (kind, value, detail) => {
      frame('Sending…', '<div class="lv-note">One moment.</div>');
      fetch('api/report', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, value, detail, reg: ctx.reg || '', route: ctx.route || '', sn: ctx.sn || '', stop: ctx.stop || '', stop_name: ctx.stop_name || '', lat: ctx.lat, lon: ctx.lon }) })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(() => {
          frame('Thank you', `<div class="lv-thanks">${ic('check', 34)}<div>Saved. Other riders see it for the next 90 minutes, and it helps check the crowding estimate.</div></div>`
            + `<div class="lv-tiles two"><button class="lv-tile" data-again>${ic('flag', 22)}<span>Report something else</span></button><button class="lv-tile" data-done>${ic('check', 22)}<span>Done</span></button></div>`);
          sheet.querySelector('[data-again]').onclick = step1;
          sheet.querySelector('[data-done]').onclick = () => sheet.classList.remove('open');
          said(ctx.reg ? { reg: ctx.reg } : { stop: ctx.stop }, true);
        })
        .catch(e => frame("Couldn't send", `<div class="lv-note">${e === 429 ? 'That is a lot of reports from this phone — thank you, please try later.' : 'No connection to the server. Please try again.'}</div>`, step1));
    };
    const step2 = (kind, value) => {
      const [icon, label, more] = SAY[kind].opts[value];
      if (!more) return send(kind, value, '');
      frame(label, `<div class="lv-tiles">${Object.entries(more).map(([d, l]) => tile(d, icon, l)).join('')}</div>`, step1);
      sheet.querySelectorAll('.lv-tile').forEach(b => b.onclick = () => send(kind, value, b.dataset.k));
    };
    const step1 = () => {
      const groups = Object.entries(SAY).filter(([k]) => k !== 'access' || ctx.fl == null || ctx.fl.includes('l'))
        .map(([k, g]) => `<div class="lv-glabel">${g.label}</div><div class="lv-tiles">${Object.entries(g.opts)
          .filter(([v]) => ctx.atStop || v !== 'no_show').map(([v, [icon, label]]) => tile(`${k}:${v}`, icon, label)).join('')}</div>`).join('');
      frame('Report', groups, ctx.atStop ? () => { Object.assign(ctx, { reg: '', route: '', sn: '', fl: undefined }); pick(); } : null);
      sheet.querySelectorAll('.lv-tile').forEach(b => b.onclick = () => { const [k, v] = b.dataset.k.split(':'); step2(k, v); });
    };
    const pick = () => {
      const buses = pickBus();
      frame('Which bus?', `<div class="lv-tiles">${buses.map(([et, reg, tr]) => `<button class="lv-tile" data-reg="${reg}">${tagHTML(busSn(tr))}<span>${reg} · ${inMin(et)}</span></button>`).join('')}`
        + `<button class="lv-tile" data-reg="">${ic('noshow', 26)}<span>A bus that isn't listed</span></button></div>`);
      sheet.querySelectorAll('[data-reg]').forEach(b => b.onclick = () => {
        const tr = TRACK.get(b.dataset.reg);
        if (tr) Object.assign(ctx, { reg: b.dataset.reg, route: tr.v[1], sn: busSn(tr), fl: tr.v[6] });
        step1();
      });
    };
    ctx.atStop && !ctx.reg ? pick() : step1();
  }
  // what riders said recently, on the bus or stop card
  const NAMES = {};
  for (const [k, g] of Object.entries(SAY)) for (const [v, [, l, more]] of Object.entries(g.opts)) { NAMES[k + ':' + v] = l; for (const [d, dl] of Object.entries(more || {})) NAMES[`${k}:${v}:${d}`] = dl; }
  function said(q, fresh) {
    if (!REPORTS) return;
    const box = $('lv-said'); if (!box) return;
    const qs = q.reg ? `reg=${encodeURIComponent(q.reg)}` : `stop=${encodeURIComponent(q.stop)}`;
    fetch(`api/recent?${qs}&t=${fresh ? Date.now() : Math.floor(Date.now() / 60000)}`).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !j.reports || !j.reports.length || !$('lv-said')) return;
      const last = j.reports.slice(-3).reverse();
      $('lv-said').innerHTML = `<div class="seclbl">Riders said</div>` + last.map(([k, v, d, m, sn]) =>
        `<div class="lv-said">${ic(SAY[k].opts[v][0], 14)}<b>${NAMES[k + ':' + v]}</b>${d ? ` · ${NAMES[`${k}:${v}:${d}`]}` : ''}${sn && !q.reg ? ` · ${sn}` : ''}<span>${m < 1 ? 'just now' : m + ' min ago'}</span></div>`).join('');
    }).catch(() => {});
  }
  $('card-close').addEventListener('click', () => {
    if (CURRENT_VIEWER) {
      try { CURRENT_VIEWER.dispose(); } catch (e) {}
      CURRENT_VIEWER = null;
    }
    cardStop = cardBus = selReg = focusSn = null; follow = false; update(); setShare('', '', '');
  });
  const baseClear = clearSelection;
  clearSelection = function (...a) {
    if (CURRENT_VIEWER) {
      try { CURRENT_VIEWER.dispose(); } catch (e) {}
      CURRENT_VIEWER = null;
    }
    activeRouteFetchReg = null;
    if (typeof map !== 'undefined' && map && map.getSource && map.getSource('sel')) {
      map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
      if (map.getLayer('sel-arrows')) map.setLayoutProperty('sel-arrows', 'visibility', 'none');
    }
    focusSn = null; update(); return baseClear.apply(this, a);
  };
  const baseSelect = selectRoute;
  selectRoute = function (...a) {
    if (CURRENT_VIEWER) {
      try { CURRENT_VIEWER.dispose(); } catch (e) {}
      CURRENT_VIEWER = null;
    }
    cardStop = cardBus = selReg = null; follow = false;
    const bb = $('lv-busbar'); if (bb) bb.remove();
    focusSn = a[0] || null;
    setTimeout(watchPing, 0);
    const out = baseSelect.apply(this, a);
    if ($('card-body') && !a[1]) $('card-body').scrollTop = 0;   // a new route opens at its top, not where the last card was scrolled
    if ($('card-body') && !$('lv-onroute')) { $('card-body').insertAdjacentHTML('afterbegin', '<div id="lv-onroute"></div>'); liveOnRoute(); }
    const sn = a[0], e = ROUTE_IDX[sn], w = a[1] || (e && e.code) || '';
    if (sn) setShare(`route=${encodeURIComponent(sn)}${w ? `&w=${w}` : ''}`, `/r/${encodeURIComponent(sn)}${w ? `?w=${w}` : ''}`, `Route ${sn}${e && e.source ? ` · ${e.source} → ${e.dest}` : ''} — Bengaluru BMTC map`);
    return out;
  };

  /* ── search: live buses by fleet number, above the routes and stops ── */
  $('q').addEventListener('input', () => {
    // a fleet number or a route number, typed any way ("k 5660", "570s" finds P570S buses)
    const key = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const v = key($('q').value);
    if (!on || v.length < 2 || !TRACK.size) return;
    // the route number typed exactly comes first, then the fleet number typed exactly;
    // a fleet number that merely contains the digits ("534" in DL1PD4534) comes last
    const score = (reg, tr) => {
      const r = key(reg), sn = key(busSn(tr)), wsn = key(snOf(tr.v[1])), bare = x => x.replace(/^[A-Z]+(?=\d)/, '');
      if (sn === v || bare(sn) === v || wsn === v) return 0;
      if (r === v || r.endsWith(v) && v.length >= 4) return 1;
      if (sn.startsWith(v) || bare(sn).startsWith(v) || wsn.startsWith(v)) return 2;
      return r.includes(v) ? 3 : -1;
    };
    const hits = [...TRACK.entries()].map(([r, tr]) => [score(r, tr), r]).filter(([s]) => s >= 0)
      .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).map(([, r]) => r).slice(0, 12);
    if (!hits.length) return;
    const box = $('results'), none = box.querySelector('.hint');
    if (none) none.remove();
    // below the routes (what most people search for), above the stops
    const stopsGrp = [...box.querySelectorAll('.grp')].find(g => /Stops/.test(g.textContent));
    const html = '<div class="grp">Live buses</div>' + hits.map(r => {
      const tr = TRACK.get(r), f = codeFeat(tr.v[1]);
      return `<div class="it" data-bus="${r}">${tagHTML(busSn(tr), f && f.properties.category)}<span>Bus <b>${r}</b><div class="sub">${chips(tr.v[6])}${f ? '→ ' + (f.properties.destinatio || '') : ''}</div></span></div>`;
    }).join('');
    if (stopsGrp) stopsGrp.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    box.querySelectorAll('[data-bus]').forEach(el => el.addEventListener('click', () => {
      const tr = TRACK.get(el.dataset.bus); if (!tr) return;
      openBus(el.dataset.bus, { zoom: 15 });
    }));
  });

  /* ── deep links: ?route= / ?stop= / ?bus= open what was shared ── */
  (() => {
    const q = new URLSearchParams(location.search);
    const route = q.get('route'), w = q.get('w'), stop = q.get('stop'), bus = q.get('bus');
    if (!route && !stop && !bus) return;
    const until = (ok, then, ms = 40000) => { const t0 = Date.now(); const tick = () => { if (ok()) then(); else if (Date.now() - t0 < ms) setTimeout(tick, 250); else if (bus) toast('That bus is not reporting its position right now'); }; tick(); };
    if (route) until(() => ROUTE_IDX[route] && dataReady, () => selectRoute(route, w || undefined));
    else if (stop) until(() => STOPS && dataReady, () => {
      const [lat, lon] = stop.split(',').map(Number);
      let best = null, bd = 170;
      for (const f of STOPS.features) { const c = f.geometry.coordinates, d = Math.hypot((c[0] - lon) * K * Math.cos(lat * Math.PI / 180), (c[1] - lat) * K); if (d < bd) { bd = d; best = f; } }
      if (best) openStop(best, { fly: true });
    });
    else if (bus) {
      if (!on) setOn(true);
      // wait for the map data and the live feed; give the feed 30 s to bring this bus in
      until(() => FEED && dataReady && Object.keys(ROUTE_IDX).length && (TRACK.has(bus) || Date.now() - fetchT0 > 30000), () => {
        if (!TRACK.has(bus)) { toast('That bus is not reporting its position right now'); return; }
        openBus(bus, { zoom: 15 });
      }, 60000);
    }
  })();

  /* ── toggle in the layer menu ── */
  const btn = document.createElement('button');
  btn.className = 'lyr' + (on ? ' on' : '');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 16.1a10 10 0 0 1 0-14.2"/><path d="M7.8 13.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="9" r="2"/><path d="M16.2 4.8a6 6 0 0 1 0 8.4"/><path d="M19.1 1.9a10 10 0 0 1 0 14.2"/><path d="M9.5 22 12 13l2.5 9"/></svg><span>Live buses</span>`;
  $('layer-menu').prepend(btn);
  function setOn(v) {
    on = v; btn.classList.toggle('on', on);
    try { localStorage.setItem('blrLive', on ? '1' : '0'); } catch (e) {}
    if (on) start(); else stop();
    if (cardStop) paintStopArrivals();
  }
  btn.addEventListener('click', e => { e.stopPropagation(); setOn(!on); });

  const boot = () => { if (on) start(); else pill(); };
  if (map.loaded() && map.getSource('routes')) boot(); else map.once('idle', boot);
})();
