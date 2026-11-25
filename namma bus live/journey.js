/**
 * NammaBusLive - Multimodal Journey Planner (Phase 4)
 * Connects frontend to FastAPI / OTP2 multimodal routing engine.
 * Supports BMTC Buses, Namma Metro, and Walking transfers.
 */
'use strict';

(() => {
  let selectedFrom = null;
  let selectedTo = null;
  let activeMode = 'TRANSIT';
  let activeSort = 'fastest';
  let journeyMarkers = [];
  let currentItineraries = [];

  const tabSearch = document.getElementById('tab-search');
  const tabPlan = document.getElementById('tab-plan');
  const tabAi = document.getElementById('tab-ai');
  const searchView = document.getElementById('search-view');
  const planView = document.getElementById('plan-view');
  const aiView = document.getElementById('ai-view');
  const searchResults = document.getElementById('results');
  const planResults = document.getElementById('plan-results');

  const inputFrom = document.getElementById('plan-from');
  const inputTo = document.getElementById('plan-to');
  const submitBtn = document.getElementById('plan-submit-btn');
  const modeChips = document.querySelectorAll('.mchip');

  if (!tabSearch || !tabPlan || !planView) return;

  // 1. Tab Switching
  tabSearch.addEventListener('click', () => {
    tabSearch.classList.add('active');
    tabPlan.classList.remove('active');
    if (tabAi) tabAi.classList.remove('active');
    document.body.classList.remove('ai-tab-active');
    searchView.style.display = 'block';
    searchResults.style.display = 'block';
    planView.style.display = 'none';
    planResults.style.display = 'none';
    if (aiView) aiView.style.display = 'none';
    clearJourneyLayers();
  });

  tabPlan.addEventListener('click', () => {
    tabPlan.classList.add('active');
    tabSearch.classList.remove('active');
    if (tabAi) tabAi.classList.remove('active');
    document.body.classList.remove('ai-tab-active');
    searchView.style.display = 'none';
    searchResults.style.display = 'none';
    planView.style.display = 'block';
    planResults.style.display = 'block';
    if (aiView) aiView.style.display = 'none';
    if (!planResults.innerHTML.trim()) {
      renderPlanHint();
    }
  });

  // 2. Mode Chip Selection
  modeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      modeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeMode = chip.dataset.mode;
      selectedFrom = null;
      selectedTo = null;
    });
  });

  function renderPlanHint() {
    planResults.innerHTML = `
      <div class="hint">
        <b>Multimodal Journey Planner</b><br>
        Plan journeys across <b>BMTC buses</b>, <b>Namma Metro</b> (Purple & Green lines), and walking transfers.
        <br><br>
        Enter a starting point (e.g. <i>Majestic</i>) and destination (e.g. <i>Indiranagar</i>) to find routes.
      </div>
    `;
  }

  // 3. Autocomplete Setup
  function setupAutocomplete(inputEl, onSelect) {
    let dropdown = null;
    let timer = null;

    function closeDropdown() {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
    }

    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim();
      clearTimeout(timer);
      closeDropdown();
      if (q.length < 2) return;

      timer = setTimeout(async () => {
        try {
          const resp = await fetch(`/api/v1/journey/stops?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(activeMode)}&limit=7`);
          if (!resp.ok) return;
          const stops = await resp.json();
          if (!stops || !stops.length) return;

          closeDropdown();
          dropdown = document.createElement('div');
          dropdown.className = 'plan-autocomplete';

          stops.forEach(s => {
            const item = document.createElement('div');
            item.className = 'plan-ac-item';
            const agencyClass = s.agency === 'BMRCL' ? 'BMRCL' : 'BMTC';
            const modeIcon = s.mode === 'SUBWAY' ? '🚇' : '🚌';
            item.innerHTML = `
              <span>${modeIcon} ${s.name}</span>
              <span class="plan-ac-agency ${agencyClass}">${s.agency}</span>
            `;
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              inputEl.value = s.name;
              closeDropdown();
              onSelect(s);
            });
            dropdown.appendChild(item);
          });

          inputEl.parentElement.appendChild(dropdown);
        } catch (err) {
          console.error('Autocomplete error:', err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== inputEl) {
        closeDropdown();
      }
    });
  }

  setupAutocomplete(inputFrom, (stop) => { selectedFrom = stop; });
  setupAutocomplete(inputTo, (stop) => { selectedTo = stop; });

  // 4. Submit Journey Plan
  submitBtn.addEventListener('click', async () => {
    const fromText = inputFrom.value.trim();
    const toText = inputTo.value.trim();

    if (!fromText || !toText) {
      alert('Please enter both origin and destination.');
      return;
    }

    planResults.innerHTML = '<div class="hint" style="text-align:center;padding:24px 0">Searching optimal BMTC & Metro routes via OTP2...</div>';

    // Prepare payload
    const payload = {
      num_itineraries: 4
    };

    if (selectedFrom && selectedFrom.name === fromText) {
      payload.from_stop_id = selectedFrom.gtfs_id;
    } else {
      try {
        const rF = await fetch(`/api/v1/journey/stops?q=${encodeURIComponent(fromText)}&mode=${encodeURIComponent(activeMode)}&limit=1`);
        if (rF.ok) {
          const stopsF = await rF.json();
          if (stopsF && stopsF.length) {
            selectedFrom = stopsF[0];
            payload.from_stop_id = selectedFrom.gtfs_id;
          }
        }
      } catch (e) {}
      if (!payload.from_stop_id) payload.from_place = fromText;
    }

    if (selectedTo && selectedTo.name === toText) {
      payload.to_stop_id = selectedTo.gtfs_id;
    } else {
      try {
        const rT = await fetch(`/api/v1/journey/stops?q=${encodeURIComponent(toText)}&mode=${encodeURIComponent(activeMode)}&limit=1`);
        if (rT.ok) {
          const stopsT = await rT.json();
          if (stopsT && stopsT.length) {
            selectedTo = stopsT[0];
            payload.to_stop_id = selectedTo.gtfs_id;
          }
        }
      } catch (e) {}
      if (!payload.to_stop_id) payload.to_place = toText;
    }

    if (activeMode === 'BUS') {
      payload.modes = ['BUS', 'WALK'];
    } else if (activeMode === 'SUBWAY') {
      payload.modes = ['SUBWAY', 'WALK'];
    } else {
      payload.modes = ['TRANSIT', 'WALK'];
    }

    try {
      const resp = await fetch('/api/v1/journey/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        planResults.innerHTML = `<div class="hint" style="color:var(--red)"><b>Planning Error:</b> ${err.detail || 'Service unavailable'}</div>`;
        return;
      }

      const data = await resp.json();
      currentItineraries = data.itineraries || [];
      renderItineraries(currentItineraries);
    } catch (err) {
      console.error('Planning fetch failed:', err);
      planResults.innerHTML = '<div class="hint" style="color:var(--red)">Failed to contact journey planning service.</div>';
    }
  });

  // 5. Render Itinerary List
  function formatTime(epochMs) {
    const d = new Date(epochMs);
    let h = d.getHours();
    let m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    m = m < 10 ? '0' + m : m;
    return `${h}:${m} ${ampm}`;
  }

  function renderItineraries(itineraries) {
    if (!itineraries || !itineraries.length) {
      planResults.innerHTML = '<div class="hint">No journey alternatives found for the selected points and mode. Try selecting another transport mode or a nearby stop.</div>';
      return;
    }

    let html = `
      <div class="itin-rank-bar">
        <button class="rank-btn ${activeSort === 'fastest' ? 'active' : ''}" data-sort="fastest">⚡ Fastest</button>
        <button class="rank-btn ${activeSort === 'fewest_transfers' ? 'active' : ''}" data-sort="fewest_transfers">🔁 Fewest Transfers</button>
        <button class="rank-btn ${activeSort === 'least_walking' ? 'active' : ''}" data-sort="least_walking">🚶 Least Walking</button>
      </div>
      <div class="grp">${itineraries.length} Suggested Routes</div>
    `;

    let hasRealtimeOverall = false;

    itineraries.forEach((it, idx) => {
      const mins = Math.round(it.duration / 60);
      const startTimeStr = it.departure_time_formatted || formatTime(it.start_time);
      const endTimeStr = it.arrival_time_formatted || formatTime(it.end_time);

      if (it.realtime_enriched) hasRealtimeOverall = true;

      let legBadges = '';
      it.legs.forEach((l, lIdx) => {
        if (lIdx > 0) legBadges += '<span class="leg-arrow">&rarr;</span>';
        if (l.mode === 'WALK') {
          legBadges += `<span class="leg-badge" style="background:#64748b;color:#fff">🚶 ${Math.round(l.duration / 60)}m</span>`;
        } else {
          const color = l.route ? l.route.color : '#2563eb';
          const name = l.route ? l.route.short_name : l.mode;
          const icon = l.mode === 'SUBWAY' ? '🚇' : '🚌';
          const liveDot = (l.is_live && l.live_vehicle) ? '<span class="badge-dot" title="Live bus tracking active"></span>' : '';
          legBadges += `<span class="leg-badge" style="background:${color}">${icon} ${name} ${liveDot}</span>`;
        }
      });

      const transfersTxt = it.transfers === 0 ? 'Direct route' : `${it.transfers} transfer${it.transfers > 1 ? 's' : ''}`;
      const walkTxt = it.walk_distance > 0 ? `${Math.round(it.walk_distance)}m walking` : 'No walking';

      let rtStatusPill = '';
      if (it.data_freshness === 'LIVE') {
        rtStatusPill = '<span class="itin-rt-pill live">🟢 Live GPS</span>';
      } else if (it.data_freshness === 'MIXED') {
        rtStatusPill = '<span class="itin-rt-pill mixed">🟡 Partial Live</span>';
      } else if (it.data_freshness === 'STALE') {
        rtStatusPill = '<span class="itin-rt-pill stale">🟠 Stale GPS</span>';
      } else {
        rtStatusPill = '<span class="itin-rt-pill sched">📅 Scheduled</span>';
      }

      const rankTagHtml = it.rank_tag ? `<span class="itin-rank-tag">${it.rank_tag}</span>` : '';

      html += `
        <div class="itin-card" data-idx="${idx}">
          <div class="itin-top">
            <div><span class="itin-dur">${mins} mins</span> ${rankTagHtml}</div>
            <div>${rtStatusPill} <span class="itin-times" style="margin-left:6px">${startTimeStr} &ndash; ${endTimeStr}</span></div>
          </div>
          <div class="itin-legs">${legBadges}</div>
          <div class="itin-bottom">
            <span class="itin-meta-pill">🔁 ${transfersTxt}</span>
            <span class="itin-meta-pill">🚶 ${walkTxt}</span>
          </div>
        </div>
      `;
    });

    if (hasRealtimeOverall) {
      html += `<div class="honesty-notice live-notice">🟢 <b>Real-Time GPS Tracking Active</b> &middot; BMTC live vehicle telemetry bound via GTFS trip matching. Timetables dynamically adjusted.</div>`;
    } else {
      html += `<div class="honesty-notice">📅 <b>Static GTFS Timetables</b> via OpenTripPlanner 2.7.0. Not live GPS tracking.</div>`;
    }
    planResults.innerHTML = html;

    // Attach rank filter button handlers
    planResults.querySelectorAll('.rank-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sortKey = btn.dataset.sort;
        if (sortKey === activeSort) return;
        activeSort = sortKey;
        if (sortKey === 'fewest_transfers') {
          itineraries.sort((a, b) => (a.transfers - b.transfers) || (a.duration - b.duration));
        } else if (sortKey === 'least_walking') {
          itineraries.sort((a, b) => (a.walk_distance - b.walk_distance) || (a.duration - b.duration));
        } else {
          itineraries.sort((a, b) => (a.duration - b.duration) || (a.transfers - b.transfers));
        }
        renderItineraries(itineraries);
      });
    });

    // Attach click handlers
    planResults.querySelectorAll('.itin-card').forEach(card => {
      card.addEventListener('click', () => {
        planResults.querySelectorAll('.itin-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const idx = parseInt(card.dataset.idx, 10);
        selectItinerary(itineraries[idx]);
      });
    });

    // Auto-select first itinerary
    if (itineraries.length > 0) {
      const firstCard = planResults.querySelector('.itin-card');
      if (firstCard) firstCard.classList.add('selected');
      selectItinerary(itineraries[0]);
    }
  }

  // 6. Map Layer & Marker Management
  function clearJourneyLayers() {
    journeyMarkers.forEach(m => m.remove());
    journeyMarkers = [];

    if (window.map) {
      if (window.map.getSource('journey-lines')) {
        window.map.getSource('journey-lines').setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }

  function ensureJourneySource() {
    if (!window.map) return;
    if (!window.map.getSource('journey-lines')) {
      window.map.addSource('journey-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Glow casing
      window.map.addLayer({
        id: 'journey-casing',
        type: 'line',
        source: 'journey-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#000',
          'line-width': 8,
          'line-opacity': 0.25,
          'line-blur': 3
        }
      });

      // Solid color line
      window.map.addLayer({
        id: 'journey-line',
        type: 'line',
        source: 'journey-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.95
        }
      });
    }
  }

  function selectItinerary(itinerary) {
    if (!itinerary || !window.map) return;
    ensureJourneySource();
    clearJourneyLayers();

    const features = [];
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    itinerary.legs.forEach((leg, lIdx) => {
      const color = leg.mode === 'WALK' ? '#64748b' : (leg.route ? leg.route.color : '#2563eb');
      const coords = leg.coordinates || [];

      if (coords.length >= 2) {
        hasCoords = true;
        coords.forEach(pt => bounds.extend(pt));
        features.push({
          type: 'Feature',
          properties: {
            mode: leg.mode,
            color: color,
            name: leg.route ? leg.route.short_name : 'Walk'
          },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        });
      }

      // Add pins for origin, destination and transfers
      if (lIdx === 0 && leg.from_place.lat) {
        const pStart = new maplibregl.Marker({
          element: BUSMAP.pinEl('#16a34a', 1.0),
          anchor: 'bottom'
        }).setLngLat([leg.from_place.lon, leg.from_place.lat]).addTo(window.map);
        journeyMarkers.push(pStart);
        bounds.extend([leg.from_place.lon, leg.from_place.lat]);
      }

      if (leg.to_place.lat) {
        const isLast = (lIdx === itinerary.legs.length - 1);
        const pinColor = isLast ? '#f01b48' : '#2563eb';
        const pMarker = new maplibregl.Marker({
          element: BUSMAP.pinEl(pinColor, isLast ? 1.0 : 0.75),
          anchor: 'bottom'
        }).setLngLat([leg.to_place.lon, leg.to_place.lat]).addTo(window.map);
        journeyMarkers.push(pMarker);
        bounds.extend([leg.to_place.lon, leg.to_place.lat]);
      }
    });

    // Update map layer
    const src = window.map.getSource('journey-lines');
    if (src) {
      src.setData({ type: 'FeatureCollection', features });
    }

    // Zoom and fit map to journey
    if (hasCoords && !bounds.isEmpty()) {
      window.map.fitBounds(bounds, {
        padding: BUSMAP.fitPad(),
        maxZoom: 14.5,
        duration: 800
      });
    }

    // Populate detail Card
    renderJourneyCard(itinerary);
  }

  function renderJourneyCard(itinerary) {
    const card = document.getElementById('card');
    const cardTitle = document.getElementById('card-title');
    const cardSub = document.getElementById('card-sub');
    const cardBody = document.getElementById('card-body');
    if (!card || !cardTitle || !cardSub || !cardBody) return;

    const mins = Math.round(itinerary.duration / 60);
    cardTitle.innerHTML = `<span class="ttl"><span>${mins} mins Multimodal Journey</span><span>${formatTime(itinerary.start_time)} &rarr; ${formatTime(itinerary.end_time)}</span></span>`;
    cardSub.innerHTML = `<b>${itinerary.summary}</b> &middot; ${itinerary.transfers} transfer(s) &middot; ${Math.round(itinerary.walk_distance)}m walk`;

    let stepsHtml = '<div class="seclbl">Step-by-step directions</div>';
    itinerary.legs.forEach((leg, i) => {
      const modeIcon = leg.mode === 'SUBWAY' ? '🚇' : (leg.mode === 'BUS' ? '🚌' : '🚶');
      const legDur = Math.round(leg.duration / 60);
      const legDist = Math.round(leg.distance);
      const depTime = leg.departure_time_formatted || formatTime(leg.start_time);
      const arrTime = leg.arrival_time_formatted || formatTime(leg.end_time);

      if (leg.mode === 'WALK') {
        stepsHtml += `
          <div class="journey-step">
            <div class="journey-step-header">
              <span>🚶</span>
              <b>Walk to ${leg.to_place.name}</b>
            </div>
            <div class="journey-step-meta">
              ${depTime} &rarr; ${arrTime} &middot; ${legDur} min &middot; ${legDist} meters
            </div>
          </div>
        `;
      } else {
        const agency = leg.route ? leg.route.agency_name : 'Transit';
        const color = leg.route ? leg.route.color : '#2563eb';
        const rName = leg.route ? leg.route.short_name : 'Transit';
        const headsign = leg.trip && leg.trip.trip_headsign ? ` towards <b>${leg.trip.trip_headsign}</b>` : ` towards <b>${leg.to_place.name}</b>`;

        let transferInfo = '';
        if (leg.transfer_wait_duration && leg.transfer_wait_duration > 30) {
          transferInfo += `<div class="journey-step-meta" style="color:#2563eb;margin-bottom:4px">⏳ <b>Connection:</b> Wait ~${Math.round(leg.transfer_wait_duration / 60)} min before boarding</div>`;
        }

        let liveStatusHtml = '';
        if (leg.live_vehicle) {
          const lv = leg.live_vehicle;
          const isLiveGps = (lv.gps_freshness === 'LIVE' || (lv.is_live && lv.freshness === 'LIVE'));
          const delayClass = (lv.delay_seconds && lv.delay_seconds > 60) ? 'delayed' : 'ontime';
          const speedHtml = lv.speed_kmh ? `<span class="live-speed">${Math.round(lv.speed_kmh)} km/h</span>` : '';
          const confLabel = lv.association_confidence || lv.confidence || 'EXACT_TRIP';
          const freshLabel = lv.gps_freshness || lv.freshness || 'LIVE';
          const confClass = confLabel.toLowerCase();
          const dotHtml = isLiveGps ? '<span class="live-pulse-dot"></span>' : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#d97706;margin-right:4px"></span>';
          const freshTag = isLiveGps ? '<span class="itin-rt-pill live" style="font-size:9.5px">LIVE</span>' : `<span class="itin-rt-pill stale" style="font-size:9.5px">STALE (${lv.gps_freshness_seconds}s)</span>`;
          const reasonText = lv.association_reason ? lv.association_reason.replace(/_/g, ' ') : 'verified match';

          liveStatusHtml = `
            <div class="journey-live-status">
              ${dotHtml}
              <span class="live-veh-reg">Bus: <b>${lv.vehicle_id}</b></span>
              <span class="conf-pill conf-${confClass}">${confLabel}</span>
              ${freshTag}
              <span class="live-delay-tag ${delayClass}">${lv.delay_text}</span>
              ${speedHtml}
              <span style="font-size:10.5px;color:var(--muted);margin-left:auto">${reasonText}</span>
            </div>
          `;
        } else if (leg.mode === 'BUS') {
          liveStatusHtml = `
            <div class="journey-sched-status">
              <span>📅 Scheduled timetable &middot; Real-time GPS not active for this vehicle</span>
            </div>
          `;
        }

        const timingHtml = leg.predicted_departure_formatted 
          ? `Predicted: <b>${leg.predicted_departure_formatted}</b> &middot; Sched: ${leg.scheduled_departure_formatted || depTime}`
          : `Departure: <b>${depTime}</b> (Scheduled)`;

        stepsHtml += `
          <div class="journey-step">
            ${transferInfo}
            <div class="journey-step-header">
              <span>${modeIcon}</span>
              <span class="service-tag" style="background:${color}">${rName}</span>
              <b>Board at ${leg.from_place.name}</b>
            </div>
            <div class="journey-step-meta">
              Ride ${agency}${headsign}<br>
              ${timingHtml} &middot; Alight at <b>${leg.to_place.name}</b> (${arrTime}) &middot; ${legDur} min (${legDist}m)
            </div>
            ${liveStatusHtml}
          </div>
        `;
      }
    });

    if (itinerary.realtime_enriched) {
      stepsHtml += `
        <div class="honesty-notice live-notice" style="margin-top:14px">
          🟢 <b>Real-Time GPS Tracking Active:</b> Telemetry verified via GTFS trip matching. Timetables dynamically updated with live delays.
        </div>
      `;
    } else {
      stepsHtml += `
        <div class="honesty-notice" style="margin-top:14px">
          📅 <b>Data Honesty:</b> Scheduled static GTFS timetables via OpenTripPlanner 2.7.0.<br>
          Estimates based on published timetables, not real-time GPS tracking.
        </div>
      `;
    }

    cardBody.innerHTML = stepsHtml;
    card.classList.add('open');
    document.body.classList.add('card-open');
  }

  // Hook card close button to clear journey layer when in Plan tab
  const cardCloseBtn = document.getElementById('card-close');
  if (cardCloseBtn) {
    cardCloseBtn.addEventListener('click', () => {
      if (tabPlan && tabPlan.classList.contains('active')) {
        clearJourneyLayers();
      }
    });
  }

  window.multimodalJourney = {
    plan: (fromStop, toStop) => {
      if (tabPlan) tabPlan.click();
      if (inputFrom) inputFrom.value = fromStop;
      if (inputTo) inputTo.value = toStop;
      if (submitBtn) submitBtn.click();
    }
  };
})();
