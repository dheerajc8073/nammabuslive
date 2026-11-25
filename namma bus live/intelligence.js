/**
 * NammaBusLive - Intelligent Vehicle Analysis & AI Operations Dashboard (Phase 3.2)
 * Connects frontend to Namma AI Gateway, GPS Validator, and Authoritative Review System.
 * Fully preserves MapLibre 3D, Three.js bus models, and core transit telemetry.
 */
'use strict';

(() => {
  const BMTC_CATEGORIES_LIST = [
    { id: 'regular', name: 'Regular', col: '#2563eb' },
    { id: 'vajra', name: 'Vajra (AC)', col: '#1f5fbf' },
    { id: 'vayu_vajra', name: 'Vayu Vajra (Airport)', col: '#0f8a8f' },
    { id: 'electric', name: 'Electric', col: '#12a4a0' },
    { id: 'metro_feeder', name: 'Metro Feeder', col: '#7a3fc0' },
    { id: 'big_circle', name: 'Big Circle', col: '#2f8a4a' },
    { id: 'express', name: 'Express', col: '#c27c00' },
    { id: 'chakra', name: 'Chakra', col: '#d0573a' },
    { id: 'shuttle', name: 'Callbus & Shuttles', col: '#8a6d3b' },
    { id: 'v_ksrtc', name: 'V-KSRTC', col: '#b23a2e' },
    { id: 'special', name: 'Special & Contract', col: '#a1478b' },
    { id: 'depot_runs', name: 'Depot Runs', col: '#7c7c84' },
    { id: 'unclassified', name: 'Unknown / Unclassified', col: '#6b7280' }
  ];

  let currentSubTab = 'overview';
  let cachedSummary = null;
  let cachedUsage = null;
  let isLoading = false;

  // DOM Elements
  const tabSearch = document.getElementById('tab-search');
  const tabPlan = document.getElementById('tab-plan');
  const tabAi = document.getElementById('tab-ai');
  const aiFab = document.getElementById('ai-fab');
  const searchView = document.getElementById('search-view');
  const planView = document.getElementById('plan-view');
  const aiView = document.getElementById('ai-view');
  const searchResults = document.getElementById('results');
  const planResults = document.getElementById('plan-results');
  const aiContent = document.getElementById('ai-content');
  const aiSubtabs = document.getElementById('ai-subtabs');
  const aiReviewBadge = document.getElementById('ai-review-badge');

  function showToast(msg) {
    let t = document.getElementById('lv-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lv-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ── Navigation & Tab Switching ──
  function activateAiTab(subTab = 'overview') {
    if (!aiView || !tabAi) return;
    document.body.classList.add('search-open');
    document.body.classList.add('ai-tab-active');

    if (tabSearch) tabSearch.classList.remove('active');
    if (tabPlan) tabPlan.classList.remove('active');
    tabAi.classList.add('active');

    if (searchView) searchView.style.display = 'none';
    if (searchResults) searchResults.style.display = 'none';
    if (planView) planView.style.display = 'none';
    if (planResults) planResults.style.display = 'none';

    aiView.style.display = 'flex';
    switchSubTab(subTab);
  }

  if (tabAi) {
    tabAi.addEventListener('click', e => {
      e.stopPropagation();
      activateAiTab(currentSubTab);
    });
  }

  if (aiFab) {
    aiFab.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = document.body.classList.contains('search-open') && tabAi && tabAi.classList.contains('active');
      if (isOpen) {
        document.body.classList.remove('search-open');
        document.body.classList.remove('ai-tab-active');
      } else {
        activateAiTab('overview');
      }
    });
  }

  // Sub-tabs handling inside AI Dashboard
  function updateSubTabUI(sub) {
    currentSubTab = sub;
    const subTabButtons = document.querySelectorAll('.ai-stab');
    subTabButtons.forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  }

  function switchSubTab(sub) {
    updateSubTabUI(sub);
    if (!aiContent) return;

    if (sub === 'overview') renderOverviewTab();
    else if (sub === 'review') renderReviewQueueTab();
    else if (sub === 'history') renderAuditHistoryTab();
    else if (sub === 'quota') renderQuotaTab();
  }

  if (aiSubtabs) {
    aiSubtabs.addEventListener('click', e => {
      const btn = e.target.closest('.ai-stab');
      if (!btn) return;
      e.stopPropagation();
      const sub = btn.dataset.sub;
      if (sub) switchSubTab(sub);
    });
  }

  // ── Module 1: Fleet Overview Dashboard ──
  async function renderOverviewTab() {
    aiContent.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:12px;">Loading fleet intelligence metrics...</div>';
    try {
      const [sumRes, usageRes, queueRes] = await Promise.all([
        fetch('/api/ai/vehicles/summary').then(r => r.json()),
        fetch('/api/ai/usage').then(r => r.json()),
        fetch('/api/ai/vehicles/review-queue?limit=3').then(r => r.json()).catch(() => ({ items: [] }))
      ]);
      cachedSummary = sumRes;
      cachedUsage = usageRes;

      if (aiReviewBadge) {
        aiReviewBadge.textContent = sumRes.pending_review_count || 0;
      }

      const total = sumRes.total_active_vehicles || 0;
      const classPct = total ? Math.round((sumRes.classified_count / total) * 100) : 0;
      const unclassPct = total ? Math.round((sumRes.unclassified_count / total) * 100) : 0;

      // 13 Category Progress Bars
      let catBarsHTML = '';
      BMTC_CATEGORIES_LIST.forEach(cat => {
        const count = sumRes.category_breakdown[cat.id] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const barWidth = count > 0 ? Math.max(2, pct) : 0;
        catBarsHTML += `
          <div class="ai-cat-row">
            <span class="ai-cat-dot" style="background:${cat.col}"></span>
            <span class="ai-cat-name" title="${cat.name}">${cat.name}</span>
            <div class="ai-cat-bar-bg">
              <div class="ai-cat-bar-fill" style="width:${barWidth}%;background:${cat.col}"></div>
            </div>
            <span class="ai-cat-count">${count} <small style="color:#64748b;font-size:9.5px">(${pct}%)</small></span>
          </div>`;
      });

      // Review Queue Preview Items
      const previewItems = queueRes.items || [];
      let queuePreviewHTML = '';
      if (previewItems.length > 0) {
        queuePreviewHTML = previewItems.map(item => `
          <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div>
              <div style="font-weight:800;font-size:12.5px;color:#f8fafc;font-family:monospace;">${item.vehicle_id}</div>
              <div style="font-size:10.5px;color:#94a3b8;">Suggested: <b style="color:#38bdf8;">${item.suggested_category}</b> (${Math.round(item.confidence_score * 100)}%)</div>
            </div>
            <div style="display:flex;gap:5px;">
              <button class="ai-btn-sm ai-btn-inspect" data-action="inspect" data-veh="${item.vehicle_id}" style="padding:4px 8px;font-size:10.5px;">Inspect</button>
              <button class="ai-btn-sm ai-btn-approve" data-action="approve" data-veh="${item.vehicle_id}" data-cat="${item.suggested_category}" style="padding:4px 8px;font-size:10.5px;">Approve</button>
            </div>
          </div>
        `).join('');
      } else {
        queuePreviewHTML = '<div style="font-size:11.5px;color:#4ade80;padding:6px 0;">All telemetry records resolved. Review queue is clear.</div>';
      }

      aiContent.innerHTML = `
        <!-- 6 Fleet Summary Cards -->
        <div class="ai-grid-6">
          <div class="ai-stat-card card-cyan">
            <span class="ai-stat-lbl">Active Telemetry</span>
            <span class="ai-stat-num">${total.toLocaleString()}</span>
            <span class="ai-stat-sub">Tracking fleet</span>
          </div>
          <div class="ai-stat-card card-green">
            <span class="ai-stat-lbl">Live Fixes</span>
            <span class="ai-stat-num" style="color:#4ade80;">${sumRes.live_vehicles.toLocaleString()}</span>
            <span class="ai-stat-sub">&lt; 90s freshness</span>
          </div>
          <div class="ai-stat-card card-amber">
            <span class="ai-stat-lbl">Stale Fixes</span>
            <span class="ai-stat-num" style="color:#fbbf24;">${sumRes.stale_vehicles.toLocaleString()}</span>
            <span class="ai-stat-sub">90s - 10m delayed</span>
          </div>
          <div class="ai-stat-card card-blue">
            <span class="ai-stat-lbl">Classified Fleet</span>
            <span class="ai-stat-num" style="color:#60a5fa;">${sumRes.classified_count.toLocaleString()}</span>
            <span class="ai-stat-sub">${classPct}% matched</span>
          </div>
          <div class="ai-stat-card card-slate">
            <span class="ai-stat-lbl">Unclassified</span>
            <span class="ai-stat-num" style="color:#94a3b8;">${sumRes.unclassified_count.toLocaleString()}</span>
            <span class="ai-stat-sub">${unclassPct}% schedule link</span>
          </div>
          <div class="ai-stat-card card-purple">
            <span class="ai-stat-lbl">Review Queue</span>
            <span class="ai-stat-num" style="color:#c084fc;">${sumRes.pending_review_count.toLocaleString()}</span>
            <span class="ai-stat-sub">Requires verification</span>
          </div>
        </div>

        <!-- 13 Categories Distribution -->
        <div class="ai-cat-card">
          <div class="ai-card-title">
            <span>Fleet Category Distribution</span>
            <span style="font-size:10px;font-weight:700;background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;color:#38bdf8;">13 Categories</span>
          </div>
          ${catBarsHTML}
        </div>

        <!-- GPS Health & Telemetry Diagnosis -->
        <div class="ai-cat-card">
          <div class="ai-card-title">
            <span>Telemetry & GPS Sanity Audit</span>
            <span style="font-size:10px;font-weight:700;color:#4ade80;background:rgba(74,222,128,0.12);padding:2px 7px;border-radius:4px;">Validated</span>
          </div>
          <div style="font-size:11px;color:#cbd5e1;line-height:1.6;">
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span><b>${sumRes.gps_health.valid_coordinates}</b> coordinates verified within Bengaluru metropolitan bounds</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><b>${sumRes.gps_health.out_of_bounds}</b> out-of-bounds coordinate anomalies detected</span>
            </div>
            <div style="margin-top:4px;padding:6px 8px;background:rgba(15,23,42,0.6);border-radius:6px;border-left:2px solid #38bdf8;font-size:10.5px;color:#94a3b8;">
              Diagnosis: Unclassified telemetry is caused by empty GTFS-RT trip descriptors (<code>trip: {}</code>) in incoming provider batches.
            </div>
          </div>
        </div>

        <!-- AI Gateway Snapshot -->
        <div class="ai-cat-card" style="border-left:3px solid #6366f1;">
          <div class="ai-card-title">
            <span>OpenRouter Free AI Gateway</span>
            <span style="font-size:9.5px;font-weight:800;background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 6px;border-radius:4px;">ACTIVE</span>
          </div>
          <div style="font-size:11px;color:#cbd5e1;line-height:1.5;">
            <div>Primary Model: <code style="color:#38bdf8;">${usageRes.model || 'openrouter/free'}</code></div>
            <div>Daily Free Quota: <b>${usageRes.remaining_today}</b> of ${usageRes.daily_limit} requests remaining</div>
            <div>Cache Hit Efficiency: <b style="color:#4ade80;">${Math.round(usageRes.cache_hit_ratio * 100)}%</b> instant response</div>
          </div>
        </div>

        <!-- Review Queue Preview Section -->
        <div class="ai-cat-card">
          <div class="ai-card-title">
            <span>Pending Review Candidates</span>
            <span style="font-size:10.5px;color:#c084fc;cursor:pointer;" data-action="switch-sub" data-target="review">View All (${sumRes.pending_review_count}) &rarr;</span>
          </div>
          ${queuePreviewHTML}
          ${sumRes.pending_review_count > 0 ? `
            <button class="ai-btn-sm ai-btn-inspect" data-action="switch-sub" data-target="review" style="width:100%;margin-top:4px;padding:8px;">
              Open Full Review Queue (${sumRes.pending_review_count} vehicles) &rarr;
            </button>
          ` : ''}
        </div>
      `;
    } catch (err) {
      aiContent.innerHTML = `<div style="padding:20px;color:#f87171;font-size:12px;">Failed to load fleet summary: ${err.message}</div>`;
    }
  }

  // ── Module 3: Review Queue Interface ──
  async function renderReviewQueueTab() {
    aiContent.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:12px;">Loading review queue candidates...</div>';
    try {
      const res = await fetch('/api/ai/vehicles/review-queue?limit=50').then(r => r.json());
      const items = res.items || [];

      if (aiReviewBadge) {
        aiReviewBadge.textContent = items.length;
      }

      if (!items.length) {
        aiContent.innerHTML = `
          <div class="ai-cat-card" style="text-align:center;padding:28px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" style="margin:0 auto 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:4px;">Review Queue is Clear</div>
            <div style="font-size:11.5px;color:#94a3b8;">All active telemetry records are classified or confirmed by transit operators.</div>
          </div>`;
        return;
      }

      let itemsHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:700;color:#94a3b8;">AWAITING OPERATOR VERIFICATION (${items.length})</span>
          <button class="ai-btn-sm" data-action="refresh-review" style="flex:0;padding:4px 9px;font-size:10.5px;background:rgba(255,255,255,0.06);color:#38bdf8;">↻ Refresh</button>
        </div>`;

      items.forEach(item => {
        const confPct = Math.round(item.confidence_score * 100);
        const evidenceStr = item.evidence && item.evidence.length ? item.evidence.join(' &bull; ') : 'Telemetry contains generic BMTC ID with no active trip schedule link.';
        const freshBadge = item.last_seen_timestamp && (Date.now()/1000 - item.last_seen_timestamp) < 90
          ? '<span class="ai-badge-live">LIVE</span>'
          : '<span class="ai-badge-stale">STALE</span>';

        itemsHTML += `
          <div class="ai-review-item" data-veh="${item.vehicle_id}">
            <div class="ai-review-top">
              <span class="ai-review-reg">${item.vehicle_id}</span>
              <div style="display:flex;gap:4px;align-items:center;">
                ${freshBadge}
                <span class="ai-review-badge ai-badge-warn">${item.current_category}</span>
              </div>
            </div>
            <div class="ai-review-reason">
              ${evidenceStr}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;">
              <span>Suggested: <b style="color:#38bdf8;">${item.suggested_category}</b></span>
              <span>Confidence: <b style="color:#4ade80;">${confPct}%</b></span>
            </div>
            <div class="ai-review-actions">
              <button class="ai-btn-sm ai-btn-inspect" data-action="inspect" data-veh="${item.vehicle_id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Inspect</span>
              </button>
              <button class="ai-btn-sm ai-btn-approve" data-action="approve" data-veh="${item.vehicle_id}" data-cat="${item.suggested_category}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Approve</span>
              </button>
              <button class="ai-btn-sm ai-btn-reject" data-action="reject" data-veh="${item.vehicle_id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span>Reject</span>
              </button>
            </div>
          </div>`;
      });

      aiContent.innerHTML = itemsHTML;
    } catch (err) {
      aiContent.innerHTML = `<div style="padding:20px;color:#f87171;font-size:12px;">Failed to load review queue: ${err.message}</div>`;
    }
  }

  // ── Module 5: Audit History Tab ──
  async function renderAuditHistoryTab() {
    aiContent.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:12px;">Loading decision audit trail...</div>';
    try {
      const audits = await fetch('/api/ai/vehicles/audit-trail?limit=40').then(r => r.json());
      if (!audits.length) {
        aiContent.innerHTML = `
          <div class="ai-cat-card" style="text-align:center;padding:28px;">
            <div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px;">No Audit Records Yet</div>
            <div style="font-size:11px;color:#94a3b8;">Authoritative approval and rejection decisions will be tracked here in PostgreSQL.</div>
          </div>`;
        return;
      }

      let auditsHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:700;color:#94a3b8;">DECISION AUDIT TIMELINE (${audits.length})</span>
          <button class="ai-btn-sm" data-action="refresh-audit" style="flex:0;padding:4px 9px;font-size:10.5px;background:rgba(255,255,255,0.06);color:#38bdf8;">↻ Refresh</button>
        </div>`;

      audits.forEach(a => {
        const timeStr = a.timestamp ? new Date(a.timestamp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : 'Recent';
        const actionClass = a.action === 'approve' ? 'action-approve' : (a.action === 'reject' ? 'action-reject' : 'action-ai');
        auditsHTML += `
          <div class="ai-audit-item">
            <div class="ai-audit-header">
              <span>Bus <b style="color:#f8fafc;font-family:monospace;">${a.vehicle_id}</b> &rarr; <span style="color:#38bdf8;">${a.suggested_category || a.action}</span></span>
              <span class="ai-audit-action ${actionClass}">${a.action}</span>
            </div>
            <div class="ai-audit-detail">
              <span>By <b>${a.performed_by || 'operator'}</b> &middot; ${timeStr}</span>
              ${a.reason ? `<div style="margin-top:4px;font-style:italic;color:#cbd5e1;background:rgba(15,23,42,0.4);padding:4px 6px;border-radius:4px;">"${a.reason}"</div>` : ''}
            </div>
          </div>`;
      });

      aiContent.innerHTML = auditsHTML;
    } catch (err) {
      aiContent.innerHTML = `<div style="padding:20px;color:#f87171;font-size:12px;">Failed to load audit history: ${err.message}</div>`;
    }
  }

  // ── Module 6: Quota & Free Tier Monitor Tab ──
  async function renderQuotaTab() {
    aiContent.innerHTML = '<div style="padding:28px;text-align:center;color:#94a3b8;font-size:12px;">Fetching OpenRouter quota status...</div>';
    try {
      const [usage, health] = await Promise.all([
        fetch('/api/ai/usage').then(r => r.json()),
        fetch('/api/ai/health').then(r => r.json())
      ]);

      const quotaPct = Math.round(((usage.daily_limit - usage.remaining_today) / usage.daily_limit) * 100);

      aiContent.innerHTML = `
        <div class="ai-cat-card" style="border-left:3.5px solid #4ade80;">
          <div class="ai-card-title">
            <span>Gateway Health Status</span>
            <span style="color:#4ade80;font-weight:800;font-size:11px;">${health.status.toUpperCase()}</span>
          </div>
          <div style="font-size:11.5px;color:#cbd5e1;line-height:1.6;">
            <div>Primary Model: <b style="color:#38bdf8;">${health.configured_model}</b></div>
            <div>Cache Backend: <b>${health.cache_backend}</b> (Connected: ${health.redis_connected ? '<span style="color:#4ade80;">Yes</span>' : '<span style="color:#fbbf24;">In-Memory Fallback</span>'})</div>
            <div>Request Timeout: <b>${health.request_timeout_seconds}s</b> &middot; Cache TTL: <b>${Math.round(health.cache_ttl_seconds/60)}m</b></div>
          </div>
        </div>

        <div class="ai-cat-card">
          <div class="ai-card-title">
            <span>Daily Free-Tier Quota</span>
            <span style="color:#38bdf8;"><b>${usage.remaining_today}</b> left</span>
          </div>
          <div class="ai-cat-bar-bg" style="height:9px;margin-bottom:6px;">
            <div class="ai-cat-bar-fill" style="width:${quotaPct}%;background:${quotaPct > 80 ? '#ef4444' : '#38bdf8'}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#94a3b8;">
            <span>Consumed Today: <b style="color:#f8fafc;">${usage.requests_today}</b></span>
            <span>Daily Limit: <b style="color:#f8fafc;">${usage.daily_limit} reqs</b></span>
          </div>
        </div>

        <div class="ai-cat-card">
          <div class="ai-card-title">
            <span>Cache & Performance Metrics</span>
          </div>
          <div style="font-size:11.5px;color:#cbd5e1;line-height:1.7;">
            <div>Instant Cache Hits: <b style="color:#4ade80;">${usage.total_cache_hits}</b></div>
            <div>Cache Efficiency Ratio: <b style="color:#4ade80;">${Math.round(usage.cache_hit_ratio * 100)}%</b></div>
            <div>Requests This Minute: <b>${usage.requests_this_minute}</b> / ${usage.minute_limit}</div>
            <div>Cumulative Invocations: <b>${usage.total_requests}</b></div>
            <div>Provider Errors / Fallbacks: <b style="color:${usage.total_errors > 0 ? '#f87171' : '#4ade80'};">${usage.total_errors}</b></div>
          </div>
        </div>

        <div style="font-size:10.5px;color:#94a3b8;line-height:1.45;padding:6px 8px;background:rgba(15,23,42,0.6);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
          <div style="font-weight:700;color:#38bdf8;margin-bottom:2px;">🔒 Privacy & Safety Guarantee</div>
          Live bus positions, coordinates, and real-time transit telemetry are never streamed to OpenRouter or external providers. Inference is exclusively user-initiated for ambiguous vehicle classification.
        </div>`;
    } catch (err) {
      aiContent.innerHTML = `<div style="padding:20px;color:#f87171;font-size:12px;">Failed to load quota info: ${err.message}</div>`;
    }
  }

  // ── Global Event Delegation for Dynamic Buttons inside aiContent ──
  if (aiContent) {
    aiContent.addEventListener('click', e => {
      const btn = e.target.closest('button, [data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      const vehId = btn.dataset.veh;
      const catId = btn.dataset.cat;
      const targetSub = btn.dataset.target;

      if (action === 'inspect' && vehId) {
        inspectVehicle(vehId);
      } else if (action === 'approve' && vehId) {
        openApprovalModal(vehId, catId);
      } else if (action === 'reject' && vehId) {
        openRejectionModal(vehId);
      } else if (action === 'switch-sub' && targetSub) {
        switchSubTab(targetSub);
      } else if (action === 'refresh-review') {
        renderReviewQueueTab();
      } else if (action === 'refresh-audit') {
        renderAuditHistoryTab();
      }
    });
  }

  // ── Module 2 & 4: Selected Vehicle Detail Card Intelligence Integration ──
  async function renderVehicleAIIntelligence(reg) {
    if (!reg) return;
    let busFacts = document.getElementById('lv-busfacts');
    const card = document.getElementById('card');
    if (!busFacts && card) {
      // Create fallback facts container if card was opened for an inactive/historical vehicle
      busFacts = document.getElementById('lv-busfacts-fallback');
      if (!busFacts) {
        busFacts = document.createElement('div');
        busFacts.id = 'lv-busfacts-fallback';
        busFacts.style.padding = '12px 14px';
        card.appendChild(busFacts);
      }
    }
    if (!busFacts) return;

    // Check or create container
    let box = document.getElementById('lv-ai-intel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lv-ai-intel';
      box.className = 'lv-ai-box';
      busFacts.after(box);
    }

    box.innerHTML = '<div style="font-size:11px;color:#94a3b8;text-align:center;padding:8px;">Analyzing vehicle intelligence telemetry...</div>';

    try {
      const res = await fetch(`/api/ai/vehicles/${encodeURIComponent(reg)}`).then(r => r.json());
      const isVerified = res.classification_status === 'verified';
      const confPct = Math.round(res.confidence_score * 100);
      const confCol = confPct >= 80 ? '#4ade80' : (confPct >= 50 ? '#fbbf24' : '#94a3b8');

      let evidenceHTML = '';
      (res.evidence || []).forEach(ev => {
        evidenceHTML += `
          <div class="lv-ai-ev-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${ev}</span>
          </div>`;
      });

      const rtoText = res.rto_details ? `${res.rto_details.district} (${res.rto_details.series} Series)` : '';

      box.innerHTML = `
        <div class="lv-ai-head">
          <span class="lv-ai-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3.5"/></svg>
            <span>Vehicle Intelligence</span>
          </span>
          <span class="conf-pill ${isVerified ? 'conf-high' : (confPct >= 80 ? 'conf-high' : 'conf-unknown')}" style="font-size:9.5px;padding:2px 7px;">
            ${isVerified ? 'VERIFIED' : `${confPct}% CONFIDENCE`}
          </span>
        </div>

        ${rtoText ? `<div class="lv-ai-rto">Reg: <b>${rtoText}</b></div>` : ''}

        <div class="lv-ai-confbar">
          <div class="lv-ai-confbar-fill" style="width:${confPct}%;background:${confCol}"></div>
        </div>

        <div class="lv-ai-evidence">
          ${evidenceHTML}
        </div>

        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="lv-ai-btn" id="btn-ai-investigate" type="button">
            <span>⚡ Investigate with Namma AI</span>
          </button>
          <button class="ai-btn-sm ai-btn-approve" id="btn-card-approve" type="button" style="flex:0 0 75px;">Approve</button>
        </div>
        <div id="lv-ai-deep-result"></div>`;

      // Attach direct event listeners to card buttons
      const btnInvestigate = box.querySelector('#btn-ai-investigate');
      if (btnInvestigate) {
        btnInvestigate.addEventListener('click', e => {
          e.stopPropagation();
          triggerDeepInvestigation(reg);
        });
      }

      const btnApprove = box.querySelector('#btn-card-approve');
      if (btnApprove) {
        btnApprove.addEventListener('click', e => {
          e.stopPropagation();
          openApprovalModal(reg, res.suggested_category);
        });
      }
    } catch (err) {
      box.innerHTML = `<div style="font-size:11px;color:#94a3b8;padding:6px;">Intelligence telemetry offline for this bus.</div>`;
    }
  }

  // ── Deep On-Demand AI Investigation ──
  async function triggerDeepInvestigation(reg) {
    const btn = document.getElementById('btn-ai-investigate');
    const resultBox = document.getElementById('lv-ai-deep-result');
    if (!btn || !resultBox) return;

    btn.disabled = true;
    btn.innerHTML = '<span>Consulting OpenRouter free models...</span>';
    resultBox.innerHTML = '<div style="font-size:11px;color:#94a3b8;padding:8px 0;">Evaluating transit corridors and fleet context...</div>';

    try {
      const res = await fetch(`/api/ai/vehicles/${encodeURIComponent(reg)}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(r => r.json());

      btn.disabled = false;
      btn.innerHTML = '<span>⚡ Re-investigate with AI</span>';

      resultBox.innerHTML = `
        <div class="lv-ai-result">
          <div class="lv-ai-result-hdr">
            <span>AI Recommendation: <b>${(res.suggested_category || 'unclassified').toUpperCase()}</b></span>
            <span>${Math.round(res.confidence_score * 100)}%</span>
          </div>
          <div class="lv-ai-result-body">
            ${res.reason || 'Completed analysis based on GTFS telemetry and historical registration context.'}
          </div>
          <div style="margin-top:8px;display:flex;justify-content:flex-end;gap:6px;">
            <button class="ai-btn-sm ai-btn-approve" id="btn-deep-authorize" style="padding:5px 10px;font-size:11px;" type="button">Authorize Suggestion</button>
          </div>
        </div>`;

      const btnAuth = resultBox.querySelector('#btn-deep-authorize');
      if (btnAuth) {
        btnAuth.addEventListener('click', e => {
          e.stopPropagation();
          openApprovalModal(reg, res.suggested_category);
        });
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡ Investigate with Namma AI</span>';
      resultBox.innerHTML = `<div style="font-size:11px;color:#f87171;padding:6px 0;">AI analysis error: ${err.message}</div>`;
    }
  }

  // ── Modals: Approve & Reject Workflows ──
  function openApprovalModal(vehId, defaultCat) {
    closeExistingModal();
    const scrim = document.createElement('div');
    scrim.className = 'ai-modal-scrim';
    scrim.id = 'ai-modal-scrim';

    let optionsHTML = '';
    BMTC_CATEGORIES_LIST.forEach(c => {
      optionsHTML += `<option value="${c.id}" ${c.id === defaultCat ? 'selected' : ''}>${c.name}</option>`;
    });

    scrim.innerHTML = `
      <div class="ai-modal" role="dialog" aria-modal="true">
        <h3 class="ai-modal-h">Authorize Vehicle Category</h3>
        <p class="ai-modal-desc">Confirm and apply category for vehicle <b style="color:#f8fafc;font-family:monospace;">${vehId}</b>. This updates the database and live map immediately.</p>
        <div>
          <label style="font-size:10px;font-weight:700;color:#94a3b8;display:block;margin-bottom:4px;letter-spacing:0.04em;">SERVICE CATEGORY</label>
          <select id="modal-cat-select" class="ai-select">
            ${optionsHTML}
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:#94a3b8;display:block;margin-bottom:4px;letter-spacing:0.04em;">VERIFICATION NOTES (OPTIONAL)</label>
          <textarea id="modal-notes" class="ai-textarea" placeholder="e.g. Verified Volvo 8400 AC at Majestic platform"></textarea>
        </div>
        <div id="modal-error-box" style="display:none;font-size:11px;color:#f87171;"></div>
        <div class="ai-modal-btns">
          <button class="ai-btn-sm ai-btn-reject" id="modal-cancel-btn" type="button">Cancel</button>
          <button class="ai-btn-sm ai-btn-approve" id="modal-submit-btn" type="button">Apply & Authorize</button>
        </div>
      </div>`;

    document.body.appendChild(scrim);

    // Stop propagation so busmap.js panel-close doesn't fire
    scrim.addEventListener('click', e => {
      if (e.target === scrim) closeExistingModal();
    });
    const modalEl = scrim.querySelector('.ai-modal');
    if (modalEl) {
      modalEl.addEventListener('click', e => e.stopPropagation());
    }

    const cancelBtn = scrim.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeExistingModal();
      });
    }

    const submitBtn = scrim.querySelector('#modal-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', e => {
        e.stopPropagation();
        submitApproval(vehId);
      });
    }
  }

  function openRejectionModal(vehId) {
    closeExistingModal();
    const scrim = document.createElement('div');
    scrim.className = 'ai-modal-scrim';
    scrim.id = 'ai-modal-scrim';

    scrim.innerHTML = `
      <div class="ai-modal" role="dialog" aria-modal="true">
        <h3 class="ai-modal-h">Reject Classification Proposal</h3>
        <p class="ai-modal-desc">Record rejection rationale for vehicle <b style="color:#f8fafc;font-family:monospace;">${vehId}</b>. Vehicle will remain in unclassified status.</p>
        <div>
          <label style="font-size:10px;font-weight:700;color:#94a3b8;display:block;margin-bottom:4px;letter-spacing:0.04em;">REJECTION REASON (REQUIRED)</label>
          <textarea id="modal-reject-reason" class="ai-textarea" placeholder="e.g. Scrapped training chassis, not active service bus"></textarea>
        </div>
        <div id="modal-error-box" style="display:none;font-size:11px;color:#f87171;"></div>
        <div class="ai-modal-btns">
          <button class="ai-btn-sm ai-btn-reject" id="modal-cancel-btn" type="button">Cancel</button>
          <button class="ai-btn-sm" id="modal-confirm-reject-btn" style="background:#dc2626;color:#fff;" type="button">Confirm Rejection</button>
        </div>
      </div>`;

    document.body.appendChild(scrim);

    scrim.addEventListener('click', e => {
      if (e.target === scrim) closeExistingModal();
    });
    const modalEl = scrim.querySelector('.ai-modal');
    if (modalEl) {
      modalEl.addEventListener('click', e => e.stopPropagation());
    }

    const cancelBtn = scrim.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeExistingModal();
      });
    }

    const submitBtn = scrim.querySelector('#modal-confirm-reject-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', e => {
        e.stopPropagation();
        submitRejection(vehId);
      });
    }
  }

  function closeExistingModal() {
    const existing = document.getElementById('ai-modal-scrim');
    if (existing) existing.remove();
  }

  // Close modals on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeExistingModal();
  });

  async function submitApproval(vehId) {
    const select = document.getElementById('modal-cat-select');
    const notesInput = document.getElementById('modal-notes');
    const errBox = document.getElementById('modal-error-box');
    const submitBtn = document.getElementById('modal-submit-btn');
    if (!select) return;

    const categoryId = select.value;
    const notes = notesInput ? notesInput.value.trim() : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authorizing...';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const operatorKey = (typeof window !== 'undefined' && window.sessionStorage) ? (window.sessionStorage.getItem('namma_operator_key') || '') : '';
      if (operatorKey) {
        headers['X-Operator-Key'] = operatorKey;
      }
      const operatorRole = (typeof window !== 'undefined' && window.sessionStorage) ? (window.sessionStorage.getItem('namma_operator_role') || '') : '';
      if (operatorRole) {
        headers['X-Operator-Role'] = operatorRole;
      }

      const resp = await fetch(`/api/ai/vehicles/${encodeURIComponent(vehId)}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ category_id: categoryId, notes, verified_by: 'reviewer' })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 401) {
          throw new Error('Unauthorized: Operator authentication required to approve classifications.');
        } else if (resp.status === 403) {
          throw new Error(errData.detail || 'Forbidden: Insufficient permissions for this action.');
        }
        throw new Error(errData.detail || `Server returned ${resp.status}`);
      }

      closeExistingModal();
      showToast(`✓ Category '${categoryId}' approved for ${vehId}`);
      if (currentSubTab === 'review') renderReviewQueueTab();
      else if (currentSubTab === 'overview') renderOverviewTab();
      renderVehicleAIIntelligence(vehId);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply & Authorize';
      }
      if (errBox) {
        errBox.textContent = `Error: ${err.message}`;
        errBox.style.display = 'block';
      }
    }
  }

  async function submitRejection(vehId) {
    const reasonInput = document.getElementById('modal-reject-reason');
    const errBox = document.getElementById('modal-error-box');
    const submitBtn = document.getElementById('modal-confirm-reject-btn');
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!reason || reason.length < 5) {
      if (errBox) {
        errBox.textContent = 'Please provide a valid reason (minimum 5 characters).';
        errBox.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Recording...';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const operatorKey = (typeof window !== 'undefined' && window.sessionStorage) ? (window.sessionStorage.getItem('namma_operator_key') || '') : '';
      if (operatorKey) {
        headers['X-Operator-Key'] = operatorKey;
      }
      const operatorRole = (typeof window !== 'undefined' && window.sessionStorage) ? (window.sessionStorage.getItem('namma_operator_role') || '') : '';
      if (operatorRole) {
        headers['X-Operator-Role'] = operatorRole;
      }

      const resp = await fetch(`/api/ai/vehicles/${encodeURIComponent(vehId)}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason, rejected_by: 'reviewer' })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 401) {
          throw new Error('Unauthorized: Operator authentication required to reject classifications.');
        } else if (resp.status === 403) {
          throw new Error(errData.detail || 'Forbidden: Insufficient permissions for this action.');
        }
        throw new Error(errData.detail || `Server returned ${resp.status}`);
      }

      closeExistingModal();
      showToast(`✓ Rejection recorded for ${vehId}`);
      if (currentSubTab === 'review') renderReviewQueueTab();
      else if (currentSubTab === 'overview') renderOverviewTab();
      renderVehicleAIIntelligence(vehId);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Rejection';
      }
      if (errBox) {
        errBox.textContent = `Error: ${err.message}`;
        errBox.style.display = 'block';
      }
    }
  }

  function inspectVehicle(vehId) {
    // Dismiss drawer on mobile / smaller viewports so vehicle card and 3D model are clearly visible
    if (window.innerWidth < 700) {
      document.body.classList.remove('search-open');
      document.body.classList.remove('ai-tab-active');
    }

    if (window.openBus && typeof window.openBus === 'function') {
      try {
        window.openBus(vehId);
      } catch (e) {
        console.warn('openBus notice:', e);
      }
    }

    renderVehicleAIIntelligence(vehId);

    const card = document.getElementById('card');
    if (card) {
      card.classList.add('open');
      card.classList.remove('min');
    }
  }

  // Expose global controller
  window.NammaAI = {
    activateAiTab,
    renderVehicleAIIntelligence,
    triggerDeepInvestigation,
    openApprovalModal,
    openRejectionModal,
    closeModal: closeExistingModal,
    submitApproval,
    submitRejection,
    inspectVehicle,
    switchSubTab
  };
})();
