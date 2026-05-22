/* ═══════════════════════════════════════════════════════════
   ScreenMind — Main Application
   SPA with physics-inspired transitions & micro-interactions
   ═══════════════════════════════════════════════════════════ */

const API = '';
// Use local date (not UTC) to avoid timezone shift issues
const _now = new Date();
let currentDate = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
let currentView = 'timeline';

// ── Lock Screen Check ──────────────────────────────────────
var _dashboardLocked = false;

async function _checkAuth() {
  try {
    var r = await fetch('/api/auth/status');
    var data = await r.json();
    if (data.has_pin && !data.authenticated) {
      _dashboardLocked = true;
      document.getElementById('lock-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      // Delay focus to ensure element is visible and painted
      setTimeout(function() { document.getElementById('pin-input').focus(); }, 100);
    }
  } catch(e) {}
}

// Global keyboard guard — when locked, only allow typing in PIN input
document.addEventListener('keydown', function(e) {
  if (!_dashboardLocked) return;
  var pinInput = document.getElementById('pin-input');
  // Allow Enter to submit from anywhere on the lock screen
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    unlockDashboard();
    return;
  }
  // If the PIN input isn't focused, redirect focus to it
  if (document.activeElement !== pinInput) {
    pinInput.focus();
  }
}, true); // 'true' = capture phase, runs before any other handler

window.unlockDashboard = async function() {
  var pin = document.getElementById('pin-input').value;
  var errEl = document.getElementById('pin-error');
  errEl.textContent = '';
  try {
    var r = await fetch('/api/auth/verify', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pin: pin})
    });
    var data = await r.json();
    if (data.ok) {
      _dashboardLocked = false;
      document.getElementById('lock-screen').style.display = 'none';
      document.getElementById('app').style.display = '';
      // Now init the app
      _initApp();
    } else {
      errEl.textContent = data.error || 'Invalid PIN';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-input').focus();
    }
  } catch(e) {
    errEl.textContent = 'Invalid PIN';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
};

window.toggleIncognito = async function() {
  try {
    var r = await fetch('/api/incognito/toggle', { method: 'POST' });
    var data = await r.json();
    var btn = document.getElementById('incognito-btn');
    if (data.incognito) {
      btn.style.background = 'rgba(239,68,68,0.2)';
      btn.title = 'Incognito ON — click to disable';
      showToast('🕶️ Incognito mode — no recording', 'warning');
    } else {
      btn.style.background = '';
      btn.title = 'Incognito Mode';
      showToast('Incognito mode off', 'success');
    }
  } catch(e) {}
};

// ── API Client ────────────────────────────────────────────
async function api(path) {
  const r = await fetch(API + path);
  if (r.status === 401) {
    // Session expired — show lock screen
    _dashboardLocked = true;
    document.getElementById('lock-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    setTimeout(function() { document.getElementById('pin-input').focus(); }, 100);
    throw new Error('Session expired');
  }
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}
async function apiPost(path) {
  const r = await fetch(API + path, { method: 'POST' });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function catColor(cat) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--cat-${cat || 'other'}`).trim() || '#64748b';
}

// ── Modal (Enhanced: split view with OCR + details) ───────
window.openModal = async function(src, activityId) {
  $('#modal-img').src = src;
  $('#modal').classList.add('visible');
  // Fetch full activity details
  if (activityId) {
    try {
      const a = await api(`/api/activity/${activityId}`);
      const time = new Date(a.timestamp).toLocaleString();
      const cat = a.category || 'other';
      const method = a.analysis_method || 'unknown';
      const methodColors = {'full': '#a78bfa', 'cache:identical': '#34d399', 'cache:minor': '#fbbf24', 'skipped': '#6b7280', 'backfill:full': '#22d3ee', 'backfill:cache:identical': '#22d3ee', 'backfill:cache:minor': '#22d3ee', 'reanalyze': '#f97316'};
      const methodColor = methodColors[method] || '#6b7280';
      $('#modal-meta').innerHTML = `
        <div class="meta-row"><span class="time">${time}</span></div>
        <div class="meta-row"><strong>${a.app_name || 'Unknown'}</strong> <span class="badge badge-${cat}">${cat}</span> <span class="badge" style="background:${methodColor}22;color:${methodColor};border:1px solid ${methodColor}44;font-size:0.7rem;padding:2px 8px;border-radius:10px;margin-left:6px">${method}</span></div>`;
      $('#modal-summary').textContent = a.summary || 'No analysis yet';
      $('#modal-ocr').textContent = a.scene_description || a.details || 'No scene description yet';
    } catch { $('#modal-summary').textContent = 'Unable to load details'; }
  }
};
window.closeModal = function(e) {
  if (e && e.target && e.target !== $('#modal')) return;
  $('#modal').classList.remove('visible');
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Toast Notifications ───────────────────────────────────
window.showToast = function(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 300); }, 3000);
};

// ── Text Highlighting ─────────────────────────────────────
function highlightText(text, query) {
  if (!text || !query) return text || '';
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return text;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

// ── Sliding Nav Indicator ─────────────────────────────────
function moveIndicator(btn) {
  const indicator = $('#nav-indicator');
  const nav = $('#sidebar-nav');
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const y = btnRect.top - navRect.top;
  indicator.style.transform = `translateY(${y}px)`;
  indicator.style.height = `${btnRect.height}px`;
}

// ── Router with animated transitions ──────────────────────
// Chat and summary are "sticky" — their DOM persists across navigation
// so in-flight SSE streams and message history survive tab switches.
// All other views rebuild on each visit (fresh data, negligible cost).
const _stickyViews = new Set(['chat', 'summary']);

function navigate(view) {
  currentView = view;
  window.location.hash = view;

  // Update nav
  const btns = $$('.nav-item');
  btns.forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const activeBtn = $(`[data-view="${view}"]`);
  if (activeBtn) moveIndicator(activeBtn);

  // Update header
  const titles = { timeline:'Timeline', search:'Search', bookmarks:'Bookmarks', analytics:'Analytics', rewind:'Day Rewind', summary:'Summary & Standup', chat:'Chat', meetings:'Meetings', memos:'Voice Memos', agents:'Agents', settings:'Settings' };
  $('#page-title').textContent = titles[view] || view;

  const el = $('#content');

  // Clear initial loading spinner on first navigate
  const spinner = el.querySelector(':scope > .spinner');
  if (spinner) spinner.remove();

  // Hide all sticky containers
  el.querySelectorAll('.view-sticky').forEach(c => c.style.display = 'none');

  // Hide the ephemeral slot (non-sticky views share this)
  let ephemeral = el.querySelector('.view-ephemeral');

  if (_stickyViews.has(view)) {
    // ── Sticky view: preserve DOM across navigations ──
    if (ephemeral) ephemeral.style.display = 'none';

    let container = el.querySelector(`[data-view="${view}"]`);
    if (!container) {
      // First visit — create and render
      container = document.createElement('div');
      container.className = 'view-sticky view-enter';
      container.dataset.view = view;
      el.appendChild(container);
      const fns = { chat: renderChat, summary: renderSummary };
      (fns[view])(container);
    } else {
      // Already rendered — just show
      container.style.display = '';
      // Re-focus chat input when returning
      if (view === 'chat') {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }
    }
  } else {
    // ── Ephemeral view: rebuild each time (fresh data) ──
    if (!ephemeral) {
      ephemeral = document.createElement('div');
      ephemeral.className = 'view-ephemeral';
      el.appendChild(ephemeral);
    }
    ephemeral.style.display = '';
    ephemeral.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'view-enter';
    ephemeral.appendChild(wrapper);

    const fns = { timeline: renderTimeline, search: renderSearch, bookmarks: renderBookmarks, analytics: renderAnalytics, rewind: renderRewind, meetings: renderMeetings, memos: renderMemos, agents: renderAgents, settings: renderSettings };
    (fns[view] || renderTimeline)(wrapper);
  }
}

$('#sidebar-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (btn) navigate(btn.dataset.view);
});

// ── Status Polling ────────────────────────────────────────
async function pollStatus() {
  try {
    const s = await api('/api/status');
    const dot = $('#status-dot');
    const txt = $('#status-text');
    const pauseBtn = $('#pause-btn');
    const pauseIcon = $('#pause-icon');
    const pauseLabel = $('#pause-label');
    if (s.capture?.paused) {
      dot.className = 'status-dot paused'; txt.textContent = 'Ready';
      if (pauseBtn) { pauseBtn.classList.add('paused'); pauseIcon.textContent = '\u25b6'; pauseLabel.textContent = 'Start Capturing'; }
    } else {
      const count = s.capture?.captures || 0;
      dot.className = 'status-dot'; txt.textContent = `Capturing (${count})`;
      if (pauseBtn) { pauseBtn.classList.remove('paused'); pauseIcon.textContent = '\u23f8'; pauseLabel.textContent = 'Stop Capturing'; }
    }
  } catch { $('#status-text').textContent = 'Offline'; $('#status-dot').className = 'status-dot error'; }
}

// ── Start / Stop Capture Toggle ───────────────────────────
window.toggleCapture = async function() {
  const btn = $('#pause-btn');
  const isPaused = btn.classList.contains('paused');
  try {
    await apiPost(isPaused ? '/api/capture/resume' : '/api/capture/pause');
    showToast(isPaused ? 'Capture started!' : 'Capture stopped.', isPaused ? 'success' : 'warning');
    pollStatus();
  } catch (err) { showToast('Failed to toggle capture', 'warning'); }
};

// ── Animated Counter ──────────────────────────────────────
function animateValue(el, end, duration = 600) {
  const start = 0;
  const startTime = performance.now();
  const isFloat = String(end).includes('.');
  function update(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = start + (end - start) * eased;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if (t < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ══════════════════════════════════════════════════════════
//  TIMELINE VIEW
// ══════════════════════════════════════════════════════════
async function renderTimeline(el) {
  el.innerHTML = `
    <div class="date-nav" style="margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" id="prev-day">\u25c0</button>
      <input type="date" id="timeline-date" value="${currentDate}">
      <button class="btn btn-ghost btn-sm" id="next-day">\u25b6</button>
      <span style="margin-left:12px;color:var(--text-muted);font-size:0.85rem" id="tl-count"></span>
      <button class="btn btn-ghost btn-sm" id="clear-timeline" style="margin-left:auto;color:#ef4444;font-size:0.8rem" title="Clear today's timeline">🗑 Clear Timeline</button>
    </div>
    <div class="timeline" id="timeline-list"><div class="spinner"></div></div>`;
  $('#timeline-date').addEventListener('change', e => { currentDate = e.target.value; loadTimeline(); });
  $('#prev-day').addEventListener('click', () => shiftDate(-1));
  $('#next-day').addEventListener('click', () => shiftDate(1));
  $('#clear-timeline').addEventListener('click', confirmClearTimeline);
  loadTimeline();
  // Auto-refresh timeline every 30s
  if (window._tlRefresh) clearInterval(window._tlRefresh);
  window._tlRefresh = setInterval(() => { if (currentView === 'timeline') loadTimeline(true); }, 30000);
}

function shiftDate(days) {
  const d = new Date(currentDate); d.setDate(d.getDate() + days);
  currentDate = d.toISOString().split('T')[0];
  $('#timeline-date').value = currentDate;
  loadTimeline();
}

async function loadTimeline(silent = false) {
  const list = $('#timeline-list');
  if (!silent) list.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api(`/api/timeline?date=${currentDate}`);
    const acts = data.activities || [];

    // Also fetch meetings for this date
    let meetings = [];
    try {
      const mData = await api(`/api/meetings?date=${currentDate}`);
      meetings = mData.meetings || [];
    } catch { /* meetings endpoint not available */ }

    const totalCount = acts.length + meetings.length;
    $('#tl-count').textContent = `${totalCount} activities` + (meetings.length ? ` · ${meetings.length} meeting${meetings.length > 1 ? 's' : ''}` : '');

    if (!acts.length && !meetings.length) {
      list.innerHTML = `<div class="onboarding">
        <h2>🚀 ScreenMind is Running!</h2>
        <div class="subtitle">Your privacy-first AI memory is warming up. First capture coming soon...</div>
        <div class="feature-grid">
          <div class="feature-card"><div class="fc-icon">📋</div><div class="fc-title">Timeline</div><div class="fc-desc">Chronological activity feed with AI analysis</div></div>
          <div class="feature-card"><div class="fc-icon">🔍</div><div class="fc-title">Semantic Search</div><div class="fc-desc">Natural language queries powered by Gemma 4</div></div>
          <div class="feature-card"><div class="fc-icon">📊</div><div class="fc-title">Analytics</div><div class="fc-desc">Category breakdown, top apps, hours tracked</div></div>
          <div class="feature-card"><div class="fc-icon">⏪</div><div class="fc-title">Day Rewind</div><div class="fc-desc">Timelapse playback of your screen activity</div></div>
          <div class="feature-card"><div class="fc-icon">📝</div><div class="fc-title">Daily Summary</div><div class="fc-desc">AI-generated summaries and standup notes</div></div>
          <div class="feature-card"><div class="fc-icon">🛡️</div><div class="fc-title">100% Local</div><div class="fc-desc">No cloud, no telemetry — your data stays yours</div></div>
        </div>
        <div class="shortcut-row" style="margin-bottom:8px">
          <span class="shortcut-key">Ctrl+Shift+B</span> Bookmark from any app
          &nbsp;&nbsp;
          <span class="shortcut-key">Ctrl+Shift+P</span> Pause/Resume anywhere
        </div>
        <div class="waiting-pulse"><span class="pulse-dot"></span> Waiting for first capture...</div>
      </div>`;
      return;
    }
    // Render meeting cards first, then activity cards
    const meetingHtml = meetings.map(m => meetingCard(m)).join('');
    const activityHtml = acts.map((a, i) => timelineCard(a, i)).join('');
    list.innerHTML = meetingHtml + activityHtml;
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div>${err.message}</div></div>`;
  }
}

function meetingCard(m) {
  // Reuse the detail card (with three-dot menu) everywhere
  return meetingDetailCard(m);
}

function timelineCard(a, i) {
  const time = formatTime(a.timestamp);
  const cat = a.category || 'other';
  const bookmarkLabel = a.bookmarked ? '★ Bookmarked' : '☆ Bookmark';
  const bookmarkClass = a.bookmarked ? 'active' : '';
  const devCtx = a.repo_name ? `<div class="dev-ctx">🔀 ${a.repo_name}/${a.branch || 'main'} ${a.insertions ? `<span style="color:#10b981">+${a.insertions}</span>` : ''}${a.deletions ? ` <span style="color:#ef4444">-${a.deletions}</span>` : ''}</div>` : '';
  const thumb = a.screenshot_url ? `<img class="thumb" src="${a.screenshot_url}" loading="lazy" onclick="openModal('${a.screenshot_url}', ${a.id})" alt="">` : '<div class="thumb"></div>';
  return `
    <div class="timeline-item" style="animation-delay:${i * 0.06}s">
      ${thumb}
      <div class="info">
        <div class="top">
          <span class="time">${time}</span>
          <span class="app-name">${a.app_name || 'Unknown'}</span>
          <span class="badge badge-${cat}">${cat}</span>
        </div>
        <div class="summary">${a.summary || 'No analysis'}</div>
        ${devCtx}
      </div>
      <div class="card-menu-wrap">
        <button class="card-menu-trigger" onclick="event.stopPropagation(); toggleCardMenu(this)" title="Actions">⋮</button>
        <div class="card-menu">
          <button class="menu-item bookmark-item ${bookmarkClass}" onclick="event.stopPropagation(); toggleBookmark(${a.id}, this)">
            <span class="menu-icon">${a.bookmarked ? '★' : '☆'}</span> ${bookmarkLabel}
          </button>
          <button class="menu-item reanalyze-item" onclick="event.stopPropagation(); reanalyzeActivity(${a.id}, this)">
            <span class="menu-icon">↻</span> Re-analyze
          </button>
          <div class="menu-divider"></div>
          <button class="menu-item delete-item" onclick="event.stopPropagation(); deleteActivity(${a.id}, this)">
            <span class="menu-icon">✕</span> Delete
          </button>
        </div>
      </div>
    </div>`;
}

// ── Three-dot menu toggle ─────────────────────────────────
window.toggleCardMenu = function(trigger) {
  const menu = trigger.nextElementSibling;
  const isOpen = menu.classList.contains('open');
  // Close all other open menus first
  document.querySelectorAll('.card-menu.open').forEach(function(m) { m.classList.remove('open'); });
  document.querySelectorAll('.card-menu-trigger.active').forEach(function(t) { t.classList.remove('active'); });
  if (!isOpen) {
    menu.classList.add('open');
    trigger.classList.add('active');
  }
};

// Close menus when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('.card-menu.open').forEach(function(m) { m.classList.remove('open'); });
  document.querySelectorAll('.card-menu-trigger.active').forEach(function(t) { t.classList.remove('active'); });
});

window.toggleBookmark = async function(id, el) {
  try {
    const r = await fetch(`/api/activities/${id}/bookmark`, { method: 'PUT' });
    const data = await r.json();
    el.closest('.card-menu').classList.remove('open');
    el.closest('.card-menu-wrap').querySelector('.card-menu-trigger').classList.remove('active');
    showToast(data.bookmarked ? '⭐ Bookmarked!' : 'Bookmark removed', data.bookmarked ? 'success' : 'info');
    loadTimeline(true);
  } catch {}
};

window.reanalyzeActivity = async function(id, el) {
  el.closest('.card-menu').classList.remove('open');
  el.closest('.card-menu-wrap').querySelector('.card-menu-trigger').classList.remove('active');
  showToast('↻ Re-analyzing screenshot...', 'info');
  try {
    const r = await fetch(`/api/activities/${id}/reanalyze`, { method: 'POST' });
    if (!r.ok) throw new Error('Failed');
    showToast('✓ Re-analysis complete!', 'success');
    loadTimeline(true);
  } catch (err) {
    showToast('Re-analysis failed: ' + err.message, 'warning');
  }
};

window.deleteActivity = async function(id, btn) {
  if (!btn.classList.contains('confirm-delete')) {
    btn.innerHTML = '<span class="menu-icon">⚠</span> Confirm Delete';
    btn.classList.add('confirm-delete');
    setTimeout(function() {
      btn.innerHTML = '<span class="menu-icon">✕</span> Delete';
      btn.classList.remove('confirm-delete');
    }, 3000);
    return;
  }
  const card = btn.closest('.timeline-item');
  card.style.transform = 'translateX(100px)';
  card.style.opacity = '0';
  card.style.transition = 'all 0.3s ease';
  try {
    const r = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Failed');
    setTimeout(function() { card.remove(); }, 300);
    showToast('Activity deleted', 'success');
    const count = document.querySelectorAll('.timeline-item').length - 1;
    const countEl = $('#tl-count');
    if (countEl) countEl.textContent = `${count} activities`;
  } catch (err) {
    card.style.transform = ''; card.style.opacity = '';
    showToast('Delete failed', 'warning');
  }
};

// ── Clear Timeline (with confirmation) ────────────────────
function confirmClearTimeline() {
  const container = $('#toast-container');
  // Remove any existing confirm toast
  const existing = document.querySelector('.confirm-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast confirm-toast warning';
  toast.style.cssText = 'display:flex;flex-direction:column;gap:10px;max-width:320px;';
  toast.innerHTML = `
    <div style="font-weight:600">Clear timeline for ${currentDate}?</div>
    <div style="font-size:0.85rem;opacity:0.8">This will permanently delete all screenshots and activity data for this day.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="this.closest('.confirm-toast').remove()" style="color:var(--text-muted)">Cancel</button>
      <button class="btn btn-sm" onclick="executeClearTimeline()" style="background:#ef4444;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer">Yes, Delete</button>
    </div>`;
  container.appendChild(toast);
}

window.executeClearTimeline = async function() {
  const toast = document.querySelector('.confirm-toast');
  if (toast) toast.remove();
  try {
    const r = await fetch(`/api/timeline/clear?date=${currentDate}`, { method: 'DELETE' });
    const data = await r.json();
    showToast(`Cleared ${data.deleted} activities for ${data.date}`, 'success');
    loadTimeline();
  } catch (err) {
    showToast('Failed to clear timeline', 'warning');
  }
};

// ══════════════════════════════════════════════════════════
//  SEARCH VIEW
// ══════════════════════════════════════════════════════════
let searchTimeout;
async function renderSearch(el) {
  el.innerHTML = `
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="search-input" placeholder="Search your activity history... (e.g. 'working on auth module')">
    </div>
    <div class="search-filters">
      <select id="search-category">
        <option value="">All Categories</option>
        <option value="coding">Coding</option>
        <option value="writing">Writing</option>
        <option value="browsing">Browsing</option>
        <option value="communication">Communication</option>
        <option value="design">Design</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div id="search-results">
      <div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Semantic Search</div><div>Type a natural language query to search activities.</div></div>
    </div>`;
  const doSearchNow = () => {
    const q = $('#search-input').value;
    if (q.trim()) doSearch(q);
  };
  $('#search-input').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => doSearch(e.target.value), 400);
  });
  $('#search-category').addEventListener('change', doSearchNow);
  $('#search-input').focus();
}

async function doSearch(q) {
  if (!q.trim()) return;
  const res = $('#search-results');
  res.innerHTML = '<div class="spinner"></div>';
  const cat = $('#search-category')?.value || '';
  const catParam = cat ? `&category=${cat}` : '';
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}${catParam}`);
    let results = data.results || [];
    // Filter low-relevance noise
    const filtered = results.filter(r => r.relevance_score >= 0.12);
    const dropped = results.length - filtered.length;
    results = filtered;
    if (!results.length) {
      res.innerHTML = `<div class="empty-state"><div class="empty-icon">🤷</div><div class="empty-title">No results</div><div>Try a different query.${dropped ? ` (${dropped} low-relevance results filtered)` : ''}</div></div>`;
      return;
    }
    const countMsg = `${results.length} results${dropped ? ` <span style="opacity:0.5">(${dropped} low-relevance filtered)</span>` : ''}`;
    res.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px">${countMsg}</div>` +
      `<div class="timeline">${results.map((r, i) => {
        const time = formatTime(r.timestamp);
        const date = new Date(r.timestamp).toLocaleDateString();
        const rCat = r.category || 'other';
        const score = r.relevance_score !== undefined ? `<span class="relevance">${(r.relevance_score * 100).toFixed(0)}%</span>` : '';
        const badge = r.match_type === 'semantic' ? '<span class="match-badge semantic">🧠 Semantic</span>'
                    : r.match_type === 'keyword' ? '<span class="match-badge keyword">🔤 Keyword</span>'
                    : r.match_type === 'meeting' ? '<span class="match-badge meeting">🎙️ Meeting</span>' : '';
        const summaryHl = highlightText(r.summary || '', q);
        const ocrSnippet = r.ocr_snippet ? `<div class="ocr-snippet">${highlightText(r.ocr_snippet, q)}</div>` : '';
        const detailSnippet = r.match_type === 'meeting' && r.details ? `<div class="ocr-snippet">${highlightText(r.details, q)}</div>` : '';
        // Use highlighted screenshot (shows purple boxes over matching OCR text on the image)
        const isMeeting = r.match_type === 'meeting';
        const hlUrl = !isMeeting && r.screenshot_url ? `${r.screenshot_url}/highlight?q=${encodeURIComponent(q)}` : '';
        const thumbUrl = hlUrl || r.screenshot_url;
        const meetingIcon = isMeeting ? '<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(139,92,246,0.1)">🎙️</div>' : '';
        return `<div class="timeline-item search-result" style="animation-delay:${i * 0.06}s">
          ${isMeeting ? meetingIcon : thumbUrl ? `<img class="thumb" src="${thumbUrl}" loading="lazy" onclick="openModal('${thumbUrl}', ${r.id})" alt="">` : '<div class="thumb"></div>'}
          <div class="info">
            <div class="top"><span class="time">${date} ${time}</span><span class="app-name">${r.app_name || 'Unknown'}</span><span class="badge badge-${rCat}">${rCat}</span>${score} ${badge}</div>
            <div class="summary">${summaryHl}</div>
            ${ocrSnippet}
            ${detailSnippet}
          </div></div>`;
      }).join('')}</div>`;
    showToast(`🔍 ${results.length} results found`, 'info');
  } catch (err) { res.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${err.message}</div></div>`; }
}

// ══════════════════════════════════════════════════════════
//  ANALYTICS VIEW
// ══════════════════════════════════════════════════════════
let categoryChart, appsChart;
async function renderAnalytics(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div class="range-toggle" id="range-toggle">
        <button class="active" data-range="day">Day</button>
        <button data-range="week">Week</button>
        <button data-range="month">Month</button>
      </div>
    </div>
    <div class="stats-grid" id="stats-grid"></div>
    <div class="charts-grid">
      <div class="card"><div class="card-header"><span class="card-title">Activity Categories</span></div><canvas id="cat-chart"></canvas></div>
      <div class="card"><div class="card-header"><span class="card-title">Top Apps</span></div><canvas id="apps-chart"></canvas></div>
    </div>`;
  $('#range-toggle').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) { $$('#range-toggle button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); loadAnalytics(btn.dataset.range); }
  });
  loadAnalytics('day');
}

async function loadAnalytics(range) {
  try {
    const data = await api(`/api/stats?range=${range}`);
    const cats = data.category_breakdown || {};
    const apps = data.top_apps || {};
    const total = data.total_activities || 0;
    const hours = (total * 30 / 3600).toFixed(1);
    const topCat = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0] || '—';
    const meetingsCount = data.meetings_count || 0;
    const meetingsMins = data.meetings_minutes || 0;
    const meetingsHrs = meetingsMins >= 60 ? (meetingsMins / 60).toFixed(1) + 'h' : meetingsMins + 'm';

    $('#stats-grid').innerHTML = `
      <div class="stat-card" style="animation-delay:0s"><div class="stat-icon">📸</div><div class="stat-value" data-count="${total}">0</div><div class="stat-label">Activities</div></div>
      <div class="stat-card" style="animation-delay:0.1s"><div class="stat-icon">⏱️</div><div class="stat-value" data-count="${hours}">0</div><div class="stat-label">Hours Tracked</div></div>
      <div class="stat-card" style="animation-delay:0.2s"><div class="stat-icon">🏆</div><div class="stat-value">${topCat}</div><div class="stat-label">Top Category</div></div>
      <div class="stat-card" style="animation-delay:0.3s"><div class="stat-icon">💻</div><div class="stat-value" data-count="${Object.keys(apps).length}">0</div><div class="stat-label">Apps Used</div></div>
      <div class="stat-card" style="animation-delay:0.4s"><div class="stat-icon">🎙️</div><div class="stat-value" data-count="${meetingsCount}">0</div><div class="stat-label">Meetings</div></div>
      <div class="stat-card" style="animation-delay:0.5s"><div class="stat-icon">⏳</div><div class="stat-value">${meetingsCount > 0 ? meetingsHrs : '—'}</div><div class="stat-label">Meeting Time</div></div>`;

    // Animate counters
    $$('.stat-value[data-count]').forEach(el => {
      animateValue(el, parseFloat(el.dataset.count));
    });

    // Charts
    if (categoryChart) categoryChart.destroy();
    const catLabels = Object.keys(cats);
    categoryChart = new Chart($('#cat-chart'), {
      type: 'doughnut',
      data: { labels: catLabels, datasets: [{ data: Object.values(cats), backgroundColor: catLabels.map(c => catColor(c)), borderWidth: 0 }] },
      options: { responsive: true, animation: { animateRotate: true, duration: 800 }, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { family: 'Inter' } } } } }
    });

    if (appsChart) appsChart.destroy();
    const appLabels = Object.keys(apps).slice(0, 8);
    appsChart = new Chart($('#apps-chart'), {
      type: 'bar',
      data: { labels: appLabels, datasets: [{ data: appLabels.map(a => apps[a]), backgroundColor: '#8b5cf6', borderRadius: 6 }] },
      options: {
        indexAxis: 'y', responsive: true, animation: { duration: 800 },
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#94a3b8', font: { family: 'Inter' } }, grid: { display: false } } }
      }
    });
  } catch {}
}

// ══════════════════════════════════════════════════════════
//  REWIND VIEW
// ══════════════════════════════════════════════════════════
let rewindFrames = [], rewindIdx = 0, rewindInterval = null, rewindSpeed = 1000;
async function renderRewind(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <input type="date" id="rewind-date" value="${currentDate}">
      <button class="btn btn-primary btn-sm" id="load-rewind">Load Day</button>
    </div>
    <div class="rewind-player card" id="rewind-container">
      <div class="empty-state"><div class="empty-icon">⏪</div><div class="empty-title">Day Rewind</div><div>Select a date and click Load to replay your day as a timelapse.</div></div>
    </div>`;
  $('#load-rewind').addEventListener('click', () => { currentDate = $('#rewind-date').value; loadRewind(); });
}

async function loadRewind() {
  const c = $('#rewind-container');
  c.innerHTML = '<div class="spinner"></div>';
  if (rewindInterval) clearInterval(rewindInterval);
  try {
    const data = await api(`/api/rewind?date=${currentDate}`);
    rewindFrames = data.frames || [];
    if (!rewindFrames.length) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">📸</div><div class="empty-title">No frames</div></div>`; return; }
    rewindIdx = 0;
    c.innerHTML = `
      <div class="frame-container"><img id="rw-img" src="${rewindFrames[0].screenshot_url}" alt="">
        <div class="overlay-caption"><span id="rw-time" style="font-weight:600"></span> — <span id="rw-app"></span> <span id="rw-summary" style="color:var(--text-secondary)"></span></div>
      </div>
      <div class="controls" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" id="rw-play">▶ Play</button>
        <input type="range" class="scrub" id="rw-scrub" min="0" max="${rewindFrames.length - 1}" value="0">
        <span id="rw-counter" style="font-size:0.8rem;color:var(--text-muted);min-width:60px">1/${rewindFrames.length}</span>
        <button class="btn btn-ghost btn-sm" id="rw-speed">1x</button>
      </div>`;
    updateRewindFrame();
    $('#rw-play').addEventListener('click', toggleRewindPlay);
    $('#rw-scrub').addEventListener('input', e => { rewindIdx = +e.target.value; updateRewindFrame(); });
    $('#rw-speed').addEventListener('click', cycleSpeed);
  } catch (err) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div>${err.message}</div></div>`; }
}

function updateRewindFrame() {
  const f = rewindFrames[rewindIdx]; if (!f) return;
  const img = $('#rw-img');
  img.style.opacity = '0.5';
  img.src = f.screenshot_url;
  img.onload = () => { img.style.opacity = '1'; };
  $('#rw-time').textContent = formatTime(f.timestamp);
  $('#rw-app').textContent = f.app_name || '';
  $('#rw-summary').textContent = f.summary ? `— ${f.summary}` : '';
  $('#rw-scrub').value = rewindIdx;
  $('#rw-counter').textContent = `${rewindIdx + 1}/${rewindFrames.length}`;
}

function toggleRewindPlay() {
  const btn = $('#rw-play');
  if (rewindInterval) { clearInterval(rewindInterval); rewindInterval = null; btn.textContent = '▶ Play'; }
  else {
    btn.textContent = '⏸ Pause';
    rewindInterval = setInterval(() => {
      rewindIdx++;
      if (rewindIdx >= rewindFrames.length) { rewindIdx = 0; clearInterval(rewindInterval); rewindInterval = null; btn.textContent = '▶ Play'; }
      updateRewindFrame();
    }, rewindSpeed);
  }
}

function cycleSpeed() {
  const speeds = [2000, 1000, 500, 200];
  const labels = ['0.5x', '1x', '2x', '5x'];
  const cur = speeds.indexOf(rewindSpeed);
  const next = (cur + 1) % speeds.length;
  rewindSpeed = speeds[next];
  $('#rw-speed').textContent = labels[next];
  if (rewindInterval) { clearInterval(rewindInterval); rewindInterval = null; toggleRewindPlay(); }
}

// ══════════════════════════════════════════════════════════
//  SUMMARY & STANDUP VIEW
// ══════════════════════════════════════════════════════════
async function renderSummary(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
      <input type="date" id="summary-date" value="${currentDate}">
      <span class="hint-trigger" id="summary-hint-trigger" style="display:none" title="">?</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">📝 Daily Summary</span><button class="btn btn-primary btn-sm" id="gen-summary">Generate</button></div>
        <div id="summary-body"><div style="color:var(--text-muted)">Click Generate for an AI-powered daily summary.</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Standup Notes</span><button class="btn btn-primary btn-sm" id="gen-standup">Generate</button></div>
        <div id="standup-body"><div style="color:var(--text-muted)">Click Generate for standup meeting notes.</div></div>
      </div>
    </div>`;

  // Hover tooltip hint
  try {
    const mdata = await api('/api/models');
    if (!mdata.is_top_model) {
      const t = document.getElementById('summary-hint-trigger');
      t.style.display = 'inline-flex';
      t.title = `Using ${mdata.active}. Upgrade to a larger model in Settings for better summaries.`;
    }
  } catch {}
  $('#summary-date').addEventListener('change', e => { currentDate = e.target.value; loadExistingSummary(); });
  loadExistingSummary();
  $('#gen-summary').addEventListener('click', async () => {
    const body = $('#summary-body');
    body.innerHTML = '<div class="spinner"></div><div style="text-align:center;color:var(--text-muted);margin-top:8px">Gemma 4 is thinking... (think=True)</div>';
    try {
      const data = await apiPost(`/api/summary/generate?date=${currentDate}`);
      body.innerHTML = `<div class="summary-content">${data.summary?.summary || 'No summary.'}</div>`;
    } catch (err) { body.innerHTML = `<div style="color:#ef4444">Error: ${err.message}</div>`; }
  });
  $('#gen-standup').addEventListener('click', async () => {
        const body = $('#standup-body');
    body.innerHTML = '<div class="spinner"></div><div style="text-align:center;color:var(--text-muted);margin-top:8px">Generating standup notes...</div>';
    try {
      const data = await apiPost(`/api/standup/generate?date=${currentDate}`);
      body.innerHTML = `<div class="standup-box">${data.standup || 'No standup.'}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy',1500)})">📋 Copy</button>`;
    } catch (err) { body.innerHTML = `<div style="color:#ef4444">Error: ${err.message}</div>`; }
  });
}

async function loadExistingSummary() {
  try {
    const data = await api(`/api/summary?date=${currentDate}`);
    if (data.generated && data.summary) {
      $('#summary-body').innerHTML = `<div class="summary-content">${data.summary.summary || ''}</div>`;
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════
//  CHAT ASSISTANT (conversational chatbot)
// ══════════════════════════════════════════════════════════
let chatHistory = [];  // {role: 'user'|'assistant', content: string}
let chatBusy = false;

async function renderChat(el) {
  el.innerHTML = `
    <div class="chat-container" id="chat-root">
      <div class="chat-header">
        <div class="chat-header-title"><span>🧠</span> ScreenMind <span class="hint-trigger" id="chat-hint-trigger" style="display:none" title="">?</span></div>
        <button class="chat-new-btn" onclick="newChat()">+ New chat</button>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-welcome" id="chat-welcome">
          <div class="chat-welcome-icon">🧠</div>
          <h3>Hey! I'm ScreenMind</h3>
          <p>Chat with me about anything — or ask about your screen activity, emails, messages. I'll search your timeline when needed.</p>
          <div class="chat-suggestions" id="chat-suggestions">
            <button class="chat-suggest" onclick="chatSuggestion('What did aachii say?')">💬 What did aachii say?</button>
            <button class="chat-suggest" onclick="chatSuggestion('Tell me a joke')">😄 Tell me a joke</button>
            <button class="chat-suggest" onclick="chatSuggestion('What tabs do I have open?')">🔍 Open tabs?</button>
          </div>
        </div>
      </div>
      <div class="chat-input-bar">
        <input type="text" id="chat-input" placeholder="Type a message..." autocomplete="off">
        <button class="chat-send" id="chat-send" onclick="submitChat()">➤</button>
      </div>
    </div>`;

  $('#chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
  });
  $('#chat-input').focus();

  // Hover tooltip hint (non-intrusive)
  try {
    const mdata = await api('/api/models');
    if (!mdata.is_top_model) {
      const t = document.getElementById('chat-hint-trigger');
      t.style.display = 'inline-flex';
      t.title = `Using ${mdata.active}. Upgrade to a larger model in Settings for better results.`;
    }
  } catch {}
}

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function _formatAnswer(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function _addMessage(role, content, sources) {
  const messagesEl = $('#chat-messages');
  // Remove welcome if present
  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.remove();

  const isUser = role === 'user';
  const avatar = isUser ? '👤' : '🧠';
  const contentHtml = isUser ? _escapeHtml(content) : _formatAnswer(content);

  let sourcesHtml = '';
  if (sources && sources.length) {
    sourcesHtml = '<div class="chat-sources">' +
      '<div class="chat-sources-label">📎 Based on ' + sources.length + ' activities:</div>' +
      '<div class="chat-sources-list">' + sources.map(function(s) {
        return '<a class="chat-source-chip" onclick="openModal(\'' + s.screenshot_url + '\', ' + s.id + ')" title="' + _escapeHtml(s.summary || '') + '">' +
          '<span class="chat-source-time">' + new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</span> ' +
          _escapeHtml(s.app_name) + '</a>';
      }).join('') + '</div></div>';
  }

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg ' + role;
  msgEl.innerHTML = `
    <div class="chat-msg-avatar">${avatar}</div>
    <div class="chat-msg-bubble">${contentHtml}${sourcesHtml}</div>`;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function _showTyping() {
  const messagesEl = $('#chat-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.id = 'chat-typing';
  typingEl.innerHTML = `
    <div class="chat-msg-avatar" style="background:rgba(139,92,246,0.15);color:var(--accent)">🧠</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      <div class="chat-typing-dots">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
      <div class="chat-progress-steps" id="chat-progress"></div>
    </div>`;
  messagesEl.appendChild(typingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function _hideTyping() {
  const el = document.getElementById('chat-typing');
  if (el) el.remove();
}

window.chatSuggestion = function(q) {
  $('#chat-input').value = q;
  submitChat();
};

window.newChat = function() {
  chatHistory = [];
  const messagesEl = $('#chat-messages');
  messagesEl.innerHTML = `
    <div class="chat-welcome" id="chat-welcome">
      <div class="chat-welcome-icon">🧠</div>
      <h3>Hey! I'm ScreenMind</h3>
      <p>Chat with me about anything — or ask about your screen activity.</p>
      <div class="chat-suggestions">
        <button class="chat-suggest" onclick="chatSuggestion('What did aachii say?')">💬 What did aachii say?</button>
        <button class="chat-suggest" onclick="chatSuggestion('Tell me a joke')">😄 Tell me a joke</button>
        <button class="chat-suggest" onclick="chatSuggestion('What tabs do I have open?')">🔍 Open tabs?</button>
      </div>
    </div>`;
  $('#chat-input').value = '';
  $('#chat-input').focus();
};

window.submitChat = async function() {
  const input = $('#chat-input');
  const question = input.value.trim();
  if (!question || chatBusy) return;
  chatBusy = true;

  // Add user message
  _addMessage('user', question);
  chatHistory.push({ role: 'user', content: question });
  input.value = '';
  input.disabled = true;
  $('#chat-send').disabled = true;

  // Show typing indicator
  _showTyping();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: chatHistory.slice(0, -1) }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'progress') {
            const progressEl = document.getElementById('chat-progress');
            if (progressEl) {
              const step = document.createElement('div');
              step.className = 'chat-progress-step';
              step.textContent = event.step;
              progressEl.appendChild(step);
              $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
            }
          } else if (event.type === 'answer') {
            finalData = event;
          }
        } catch (parseErr) {}
      }
    }

    _hideTyping();

    if (finalData && finalData.answer) {
      _addMessage('assistant', finalData.answer, finalData.sources);
      chatHistory.push({ role: 'assistant', content: finalData.answer });
    } else {
      _addMessage('assistant', 'Hmm, I didn\'t get a response. Try asking again!');
    }
  } catch (err) {
    _hideTyping();
    _addMessage('assistant', 'Sorry, something went wrong: ' + err.message);
  }

  input.disabled = false;
  $('#chat-send').disabled = false;
  chatBusy = false;
  input.focus();
};


// ══════════════════════════════════════════════════════════
//  MEETINGS VIEW
// ══════════════════════════════════════════════════════════
var meetingsDate = new Date().toISOString().split('T')[0];

async function renderMeetings(el) {
  el.innerHTML = `
    <div class="date-nav" style="margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" id="mtg-prev">◀</button>
      <input type="date" id="mtg-date" value="${meetingsDate}">
      <button class="btn btn-ghost btn-sm" id="mtg-next">▶</button>
      <span style="margin-left:12px;color:var(--text-muted);font-size:0.85rem" id="mtg-count"></span>
      <span class="hint-trigger" id="mtg-hint-trigger" style="display:none" title="">?</span>
      <span id="mtg-recording-status" style="margin-left:auto;font-size:0.82rem"></span>
    </div>
    <div id="meetings-list"><div class="spinner"></div></div>`;
  $('#mtg-date').addEventListener('change', e => { meetingsDate = e.target.value; loadMeetings(); });
  $('#mtg-prev').addEventListener('click', () => shiftMeetingsDate(-1));
  $('#mtg-next').addEventListener('click', () => shiftMeetingsDate(1));
  loadMeetings();
  // Refresh status every 10s
  if (window._mtgRefresh) clearInterval(window._mtgRefresh);
  window._mtgRefresh = setInterval(() => { if (currentView === 'meetings') loadMeetingStatus(); }, 10000);
  loadMeetingStatus();

  // Whisper upgrade hint
  try {
    const cfg = await api('/api/settings');
    const whisper = cfg.whisper_model || 'tiny';
    if (whisper !== 'large-v3') {
      const t = document.getElementById('mtg-hint-trigger');
      t.style.display = 'inline-flex';
      t.title = `Using Whisper ${whisper}. Upgrade to a larger Whisper model in Settings for better transcription accuracy.`;
    }
  } catch {}
}

function shiftMeetingsDate(days) {
  const d = new Date(meetingsDate); d.setDate(d.getDate() + days);
  meetingsDate = d.toISOString().split('T')[0];
  $('#mtg-date').value = meetingsDate;
  loadMeetings();
}

async function loadMeetings() {
  const list = $('#meetings-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api(`/api/meetings?date=${meetingsDate}`);
    const meetings = data.meetings || [];
    $('#mtg-count').textContent = `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}`;
    if (!meetings.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🎙️</div>
        <div class="empty-title">No meetings recorded</div>
        <div style="color:var(--text-muted);font-size:0.85rem;max-width:380px;margin:0 auto;line-height:1.6">
          <p>Meeting transcription is <strong>${(await api('/api/settings')).meeting_transcription ? '✅ enabled' : '❌ disabled'}</strong>.</p>
          <p style="margin-top:8px">When enabled, ScreenMind auto-detects Zoom, Teams, Meet and other meeting apps, records audio, transcribes with Whisper, and generates Gemma-powered summaries.</p>
          <p style="margin-top:8px;color:var(--accent)">Enable it in <a href="#settings" style="color:var(--accent);cursor:pointer" onclick="navigate('settings')">⚙️ Settings</a></p>
        </div>
      </div>`;
      return;
    }
    list.innerHTML = meetings.map(m => meetingDetailCard(m)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div>${err.message}</div></div>`;
  }
}

async function loadMeetingStatus() {
  try {
    const status = await api('/api/meetings/status');
    const el = $('#mtg-recording-status');
    if (!el) return;
    if (status.in_meeting) {
      el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;color:#ef4444;font-weight:600"><span class="pulse-dot" style="background:#ef4444"></span> Recording — ${status.meeting_app || 'Meeting'} (${status.transcript_chunks} chunks)</span>`;
    } else if (status.enabled) {
      el.innerHTML = `<span style="color:var(--text-muted)">🎙️ Listening for meeting apps...</span>`;
    } else {
      el.innerHTML = `<span style="color:var(--text-muted)">❌ Transcription disabled</span>`;
    }
  } catch { /* endpoint not available */ }
}

function meetingDetailCard(m) {
  const startTime = new Date(m.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endTime = m.end_time ? new Date(m.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'ongoing';
  const duration = m.duration_minutes ? `${Math.round(m.duration_minutes)} min` : '—';
  const summaryText = (m.summary || '⏳ Generating summary...').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const transcriptText = (m.transcript || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tid = `mtg-transcript-${m.id}`;
  const menuId = `mtg-menu-${m.id}`;
  return `
    <div class="meeting-card" id="meeting-card-${m.id}" style="animation: fadeInUp 0.4s ease forwards">
      <div class="meeting-header">
        <div class="meeting-icon">🎙️</div>
        <div>
          <div class="meeting-title">Meeting — ${(m.app_name || 'Unknown').replace(/</g, '&lt;')}</div>
          <div class="meeting-meta">${startTime} – ${endTime}</div>
        </div>
        <div class="meeting-duration">${duration}</div>
        <div class="card-menu-wrap" style="margin-left:12px">
          <button class="card-menu-trigger" style="opacity:0.6" onclick="event.stopPropagation(); toggleMtgMenu('${menuId}', this)">⋮</button>
          <div class="card-menu" id="${menuId}">
            <button class="menu-item reanalyze-item" onclick="reanalyzeMeeting(${m.id})">
              <span class="menu-icon">🔄</span> Re-analyze Summary
            </button>
            <button class="menu-item" onclick="copyMeetingTranscript(${m.id})">
              <span class="menu-icon">📋</span> Copy Transcript
            </button>
            <button class="menu-item" onclick="copyMeetingSummary(${m.id})">
              <span class="menu-icon">📝</span> Copy Summary
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item delete-item" onclick="deleteMeeting(${m.id}, this)">
              <span class="menu-icon">🗑️</span> Delete Meeting
            </button>
          </div>
        </div>
      </div>
      <div class="meeting-summary" id="mtg-summary-${m.id}">${summaryText}</div>
      ${transcriptText ? `
        <button class="meeting-transcript-toggle" onclick="var t=document.getElementById('${tid}'); t.classList.toggle('open'); this.textContent = t.classList.contains('open') ? '▲ Hide transcript' : '▼ Show full transcript'">▼ Show full transcript</button>
        <div class="meeting-transcript" id="${tid}">${transcriptText}</div>
      ` : ''}
    </div>`;
}

// ── Meeting card actions ─────────────────────────────────────
function toggleMtgMenu(menuId, btn) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu.classList.contains('open');
  // Close all menus first
  document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.card-menu-trigger.active').forEach(b => b.classList.remove('active'));
  if (!wasOpen) {
    menu.classList.add('open');
    btn.classList.add('active');
    const close = (e) => { if (!menu.contains(e.target) && e.target !== btn) { menu.classList.remove('open'); btn.classList.remove('active'); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

async function reanalyzeMeeting(id) {
  document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  const sumEl = document.getElementById(`mtg-summary-${id}`);
  if (sumEl) sumEl.textContent = '⏳ Re-generating summary...';
  try {
    await api(`/api/meetings/${id}/reanalyze`, { method: 'POST' });
    showToast('Re-analyzing meeting — this takes ~15s...', 'info');
    // Poll every 5s until summary changes (Gemma takes 10-20s)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const m = await api(`/api/meetings/${id}`);
        const s = m.summary || '';
        if (!s.includes('Re-generating') && !s.includes('interrupted') && s.length > 10) {
          clearInterval(poll);
          if (sumEl) sumEl.textContent = s;
          showToast('Summary generated!', 'success');
          loadMeetings(); // Full refresh to update card
        } else if (attempts >= 6) {
          clearInterval(poll);
          loadMeetings(); // Show whatever we got
        }
      } catch { if (attempts >= 6) clearInterval(poll); }
    }, 5000);
  } catch (err) { showToast('Re-analyze failed: ' + err.message, 'warning'); }
}

function copyMeetingTranscript(id) {
  document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  const el = document.getElementById(`mtg-transcript-${id}`);
  if (el) { navigator.clipboard.writeText(el.textContent); showToast('Transcript copied!', 'success'); }
  else { showToast('No transcript available', 'warning'); }
}

function copyMeetingSummary(id) {
  document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  const el = document.getElementById(`mtg-summary-${id}`);
  if (el) { navigator.clipboard.writeText(el.textContent); showToast('Summary copied!', 'success'); }
  else { showToast('No summary available', 'warning'); }
}

async function deleteMeeting(id, btn) {
  if (!btn.classList.contains('confirm-delete')) {
    btn.classList.add('confirm-delete');
    btn.querySelector('.menu-icon').textContent = '⚠️';
    btn.childNodes[1].textContent = ' Confirm Delete';
    setTimeout(() => { if (btn) { btn.classList.remove('confirm-delete'); btn.querySelector('.menu-icon').textContent = '🗑️'; btn.childNodes[1].textContent = ' Delete Meeting'; } }, 3000);
    return;
  }
  try {
    await api(`/api/meetings/${id}`, { method: 'DELETE' });
    const card = document.getElementById(`meeting-card-${id}`);
    if (card) { card.style.transition = 'opacity 0.3s, transform 0.3s'; card.style.opacity = '0'; card.style.transform = 'translateX(40px)'; setTimeout(() => card.remove(), 300); }
    showToast('Meeting deleted', 'success');
  } catch (err) { showToast('Delete failed: ' + err.message, 'warning'); }
}


// ══════════════════════════════════════════════════════════
//  SETTINGS VIEW
// ══════════════════════════════════════════════════════════
// ── Agents Tab ─────────────────────────────────────────────────────
async function renderAgents(el) {
  el.innerHTML = '<div class="spinner"></div>';
  let data;
  try {
    data = await api('/api/agents');
  } catch {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Cannot load agents</div></div>';
    return;
  }

  var agents = data.agents || [];
  var html = '';

  // Header with create buttons
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">';
  html += '<div style="color:var(--text-muted);font-size:0.85rem">' + agents.length + ' agent(s) installed</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button class="btn" onclick="createAgent(\'markdown\')" style="font-size:0.82rem;padding:6px 14px">🤖 New AI Agent</button>';
  html += '<button class="btn" onclick="createAgent(\'python\')" style="font-size:0.82rem;padding:6px 14px">🐍 New Python Plugin</button>';
  html += '<button class="btn" onclick="document.getElementById(\'import-agent-file\').click()" style="font-size:0.82rem;padding:6px 14px">📥 Import .py</button>';
  html += '<input type="file" id="import-agent-file" accept=".py,.md" style="display:none" onchange="importAgentFile(this)">';
  html += '</div></div>';

  if (agents.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">🤖</div><div class="empty-title">No agents installed</div>';
    html += '<div class="empty-desc">Create an AI agent or Python plugin to automate tasks with your screen data.</div></div>';
  } else {
    html += '<div class="settings-grid">';
    agents.forEach(function(a) {
      var typeBadge = a.type === 'python'
        ? '<span style="font-size:0.7rem;background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:10px;font-weight:500">🐍 Python</span>'
        : '<span style="font-size:0.7rem;background:rgba(139,92,246,0.15);color:#8b5cf6;padding:2px 8px;border-radius:10px;font-weight:500">🤖 AI</span>';

      var statusDot = '';
      var lastRunInfo = '';
      if (a.last_run) {
        var icon = a.last_run.status === 'ok' ? '✅' : a.last_run.status === 'needs_approval' ? '🔒' : '❌';
        statusDot = icon;
        var t = a.last_run.timestamp || '';
        lastRunInfo = '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">' + icon + ' Last: ' + t.replace('T',' ').substring(0,16) + ' (' + a.last_run.duration + 's)</div>';
        if (a.last_run.output && a.last_run.status === 'ok') {
          lastRunInfo += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;max-height:60px;overflow:hidden;opacity:0.7">' + a.last_run.output.substring(0, 150).replace(/</g,'&lt;') + '...</div>';
        }
      }

      var enabledStyle = a.enabled ? '' : 'opacity:0.5;';

      // Data source badges — show what data this agent uses
      var dataBadges = '';
      var dataStr = (a.data || '').trim();
      if (dataStr && a.type !== 'python') {
        var dataIcons = {
          'timeline': '📋',
          'urls': '🔗',
          'apps': '📱',
          'meetings': '🎤',
          'mood': '😊'
        };
        dataStr.split(',').forEach(function(d) {
          d = d.trim().toLowerCase();
          if (d && dataIcons[d]) {
            dataBadges += '<span style="font-size:0.72rem;background:rgba(59,130,246,0.12);color:#60a5fa;padding:2px 7px;border-radius:6px;margin-right:4px">' + dataIcons[d] + ' ' + d + '</span>';
          }
        });
      } else if (a.type === 'python') {
        dataBadges = '<span style="font-size:0.72rem;background:rgba(16,185,129,0.12);color:#34d399;padding:2px 7px;border-radius:6px">⚡ SDK</span>';
      }

      // Model requirement badge
      var modelBadge = '';
      var modelReq = parseInt(a.model_requirement || '0');
      if (modelReq > 0) {
        modelBadge = '<span style="font-size:0.72rem;background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 7px;border-radius:6px;margin-left:4px" title="Needs ' + modelReq + '+ context tokens">⚠️ ' + Math.round(modelReq/1024) + 'k ctx</span>';
      }

      // Output destinations
      var outputDest = a.output || 'local';
      var destIcons = outputDest.split(',').map(function(d) {
        d = d.trim();
        if (d === 'obsidian') return '📒 Obsidian';
        if (d === 'webhook') return '🪝 Webhook';
        if (d === 'notion') return '📝 Notion';
        return '💾 Local';
      }).join(' + ');

      html += '<div class="settings-card" style="' + enabledStyle + '">';

      // Row 1: Name + type badge + toggle
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span>' + (a.name || a.filepath) + '</span> ' + typeBadge + modelBadge;
      html += '</div>';
      html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">' + (a.description || 'No description') + '</div>';

      // Row 2: Schedule + output + data badges
      html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span style="font-size:0.75rem;color:var(--text-muted)">⏱️ ' + (a.schedule || 'every 6h') + '</span>';
      html += '<span style="font-size:0.75rem;color:var(--text-muted)">→ ' + destIcons + '</span>';
      if (dataBadges) {
        html += '<span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px">│</span> ' + dataBadges;
      }
      html += '</div>';

      // Row 3: Last run info
      html += lastRunInfo;
      html += '</div>';

      // Toggle
      html += '<label class="settings-toggle" style="margin:0"><input type="checkbox" ' + (a.enabled ? 'checked' : '') + ' onchange="toggleAgent(\'' + (a.slug || a.name) + '\', this.checked)"><span></span></label>';
      html += '</div>';

      // Action buttons
      html += '<div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">';
      html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px" onclick="runAgentNow(\'' + (a.slug || a.name) + '\')">▶ Run Now</button>';
      html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px" onclick="editAgent(\'' + (a.slug || a.name) + '\')">✏️ Edit</button>';
      html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px" onclick="viewAgentOutputs(\'' + (a.slug || a.name) + '\')">📄 Outputs</button>';
      if (a.type === 'python') {
        html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px" onclick="openAgentInEditor(\'' + (a.slug || a.name) + '\')">📂 Open in Editor</button>';
      }
      if (a.type === 'python' && a.last_run && a.last_run.status === 'needs_approval') {
        html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px;background:rgba(16,185,129,0.15);color:#10b981" onclick="approveAgent(\'' + (a.slug || a.name) + '\')">✅ Approve & Run</button>';
      }
      html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px;margin-left:auto;color:#ef4444" onclick="confirmDeleteAgent(\'' + (a.slug || a.name) + '\', \'' + (a.name || a.slug).replace(/'/g,'') + '\')">🗑️ Delete</button>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Agent Run Log
  html += '<div style="margin-top:28px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<div style="font-weight:600;color:var(--text)">\ud83d\udccb Agent Run Log</div>';
  html += '<button class="btn" style="font-size:0.75rem;padding:4px 10px" onclick="navigate(\'agents\')">🔄 Refresh</button>';
  html += '</div>';
  html += '<div id="agent-log">Loading...</div>';
  html += '</div>';

  // Create Agent Inline Form (hidden)
  html += '<div id="create-agent-form" style="display:none;background:#111827;border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:16px;margin-bottom:16px">';
  html += '<div style="font-weight:600;color:var(--text-primary);margin-bottom:10px">Create New Agent</div>';
  html += '<div style="display:flex;gap:10px;align-items:center">';
  html += '<input type="text" id="new-agent-name" placeholder="agent-name (lowercase, no spaces)" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text-primary);font-size:0.85rem" autocomplete="off">';
  html += '<button class="btn btn-primary" style="font-size:0.82rem;padding:6px 16px" id="confirm-create-agent">Create</button>';
  html += '<button class="btn" style="font-size:0.82rem;padding:6px 14px" onclick="document.getElementById(\'create-agent-form\').style.display=\'none\'">Cancel</button>';
  html += '</div>';
  html += '<div id="create-agent-error" style="color:#ef4444;font-size:0.78rem;margin-top:6px"></div>';
  html += '</div>';

  // Editor Modal (hidden) — full-featured code editor
  html += '<div id="agent-editor-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.85);align-items:center;justify-content:center">';
  html += '<div style="background:#0d1117;border:1px solid rgba(139,92,246,0.25);border-radius:14px;width:780px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6)">';
  // Editor header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);border-radius:14px 14px 0 0">';
  html += '<div style="display:flex;align-items:center;gap:10px">';
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:0.95rem" id="editor-title">Edit Agent</div>';
  html += '<span id="editor-lang-badge" style="font-size:0.68rem;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.15);color:#10b981">Python</span>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;align-items:center">';
  html += '<span id="editor-status" style="font-size:0.72rem;color:var(--text-muted)"></span>';
  html += '<button class="btn" style="font-size:0.78rem;padding:4px 12px" onclick="closeAgentEditor()">✕ Close</button>';
  html += '</div></div>';
  // Editor hint
  html += '<div id="editor-hint" style="font-size:0.76rem;color:var(--text-muted);padding:8px 18px;background:rgba(139,92,246,0.05);border-bottom:1px solid rgba(255,255,255,0.04)"></div>';
  // Editor body with line numbers
  html += '<div style="flex:1;display:flex;overflow:hidden;min-height:0">';
  html += '<div id="editor-line-numbers" style="width:48px;padding:12px 6px;text-align:right;font-family:Consolas,\'Courier New\',monospace;font-size:0.78rem;line-height:1.65;color:rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);overflow:hidden;user-select:none;flex-shrink:0"></div>';
  html += '<textarea id="agent-editor-content" style="flex:1;border:none;outline:none;background:#0d1117;color:#e6edf3;font-family:Consolas,\'Courier New\',monospace;font-size:0.82rem;padding:12px 14px;resize:none;line-height:1.65;tab-size:4;white-space:pre;overflow-wrap:normal;overflow-x:auto" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>';
  html += '</div>';
  // Editor footer
  html += '<div style="display:flex;gap:8px;padding:10px 18px;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);border-radius:0 0 14px 14px">';
  html += '<div style="font-size:0.72rem;color:var(--text-muted)" id="editor-cursor-pos">Ln 1, Col 1</div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<span style="font-size:0.7rem;color:var(--text-muted);padding:4px 8px;background:rgba(255,255,255,0.04);border-radius:6px">Tab ↹ Indent</span>';
  html += '<span style="font-size:0.7rem;color:var(--text-muted);padding:4px 8px;background:rgba(255,255,255,0.04);border-radius:6px">Ctrl+S Save</span>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="btn" style="font-size:0.82rem;padding:6px 16px" onclick="closeAgentEditor()">Cancel</button>';
  html += '<button class="btn btn-primary" style="font-size:0.82rem;padding:6px 16px" onclick="saveAgentContent()">💾 Save</button>';
  html += '</div></div></div></div>';

  // Output Viewer Modal
  html += '<div id="agent-output-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.85);align-items:center;justify-content:center">';
  html += '<div style="background:#0d1117;border:1px solid rgba(139,92,246,0.2);border-radius:14px;width:700px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:1rem" id="output-viewer-title">Agent Outputs</div>';
  html += '<button class="btn" style="font-size:0.8rem;padding:4px 12px" onclick="closeOutputViewer()">✕ Close</button>';
  html += '</div>';
  html += '<div id="output-viewer-content" style="flex:1;overflow-y:auto;padding:4px"></div>';
  html += '</div></div>';

  el.innerHTML = html;

  // Load log
  try {
    var logData = await api('/api/agents/log');
    var logEl = document.getElementById('agent-log');
    var entries = logData.log || [];
    if (entries.length === 0) {
      logEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem">No runs yet. Enable an agent or click "Run Now".</div>';
    } else {
      function _buildLogRow(e) {
        var icon = e.status === 'ok' ? '✅' : e.status === 'needs_approval' ? '🔒' : '❌';
        var typeBadge = e.type === 'python' ? '🐍' : '🤖';
        var t = (e.timestamp || '').replace('T',' ').substring(5,16);
        var output = e.output ? e.output.substring(0,80).replace(/</g,'&lt;') : '';
        var err = e.error ? '<span style="color:#ef4444"> ' + e.error.substring(0,60) + '</span>' : '';
        return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">' +
          '<td style="padding:4px 8px">' + icon + '</td>' +
          '<td style="padding:4px 8px;color:var(--text-muted);font-size:0.78rem">' + t + '</td>' +
          '<td style="padding:4px 8px;font-size:0.78rem">' + typeBadge + ' ' + e.name + '</td>' +
          '<td style="padding:4px 8px;font-size:0.78rem;color:var(--text-muted)">' + e.duration + 's</td>' +
          '<td style="padding:4px 8px;font-size:0.75rem;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + output + err + '</td></tr>';
      }
      var LOG_PREVIEW = 5;
      var previewRows = entries.slice(0, LOG_PREVIEW).map(_buildLogRow).join('');
      var allRows = entries.map(_buildLogRow).join('');
      var showMoreBtn = entries.length > LOG_PREVIEW
        ? '<div style="text-align:center;margin-top:10px" id="log-expand-wrap"><button class="btn btn-sm btn-ghost" id="expand-log-btn" style="font-size:0.78rem">Show All ' + entries.length + ' Entries ▼</button></div>'
        : '';
      var tableHeader = '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><th style="padding:4px 8px;text-align:left;font-size:0.72rem;color:var(--text-muted)"></th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Time</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Agent</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Dur</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Output</th></tr></thead><tbody id="log-tbody">';
      logEl.innerHTML = tableHeader + previewRows + '</tbody></table>' + showMoreBtn;
      // Bind expand/collapse
      var expandBtn = document.getElementById('expand-log-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', function() {
          var tbody = document.getElementById('log-tbody');
          var wrap = document.getElementById('log-expand-wrap');
          if (this.dataset.expanded === '1') {
            tbody.innerHTML = previewRows;
            this.textContent = 'Show All ' + entries.length + ' Entries ▼';
            this.dataset.expanded = '0';
          } else {
            tbody.innerHTML = allRows;
            this.textContent = 'Show Less ▲';
            this.dataset.expanded = '1';
          }
        });
      }
    }
  } catch(e) {}
}

// Agent action functions
window.toggleAgent = async function(name, enabled) {
  try {
    var r = await fetch('/api/agents/' + name + '/toggle', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({enabled:enabled})
    });
    var data = await r.json();
    if (data.ok) {
      showToast(name + (enabled ? ' enabled' : ' disabled'), 'success');
    } else {
      showToast('Toggle failed: ' + (data.error || 'unknown'), 'warning');
      navigate('agents'); // refresh to show actual state
    }
  } catch(e) {
    showToast('Failed to toggle agent', 'warning');
    navigate('agents'); // refresh to show actual state
  }
};
window.runAgentNow = async function(name) {
  showToast('Running ' + name + '...', 'success');
  var result = await fetch('/api/agents/' + name + '/run', { method:'POST' }).then(r => r.json());
  if (result.status === 'ok') {
    showToast(name + ' completed (' + result.duration.toFixed(1) + 's)', 'success');
  } else if (result.status === 'needs_approval') {
    showToast(name + ' needs approval — click "Approve & Run"', 'warning');
  } else {
    showToast(name + ' failed: ' + (result.error || ''), 'warning');
  }
  navigate('agents');
};
window.approveAgent = async function(name) {
  await fetch('/api/agents/' + name + '/approve', { method:'POST' });
  showToast(name + ' approved! Running...', 'success');
  await window.runAgentNow(name);
};
window.confirmDeleteAgent = function(slug, displayName) {
  var overlay = document.createElement('div');
  overlay.id = 'delete-confirm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.15s ease';
  overlay.innerHTML = '<div style="background:#111827;border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:24px 28px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
    + '<div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>'
    + '<div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:8px">Delete Agent</div>'
    + '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;line-height:1.5">Are you sure you want to delete <strong style="color:#ef4444">' + displayName + '</strong>?<br>This action cannot be undone.</div>'
    + '<div style="display:flex;gap:10px;justify-content:center">'
    + '<button class="btn" style="padding:8px 20px;font-size:0.85rem" onclick="document.getElementById(\'delete-confirm-overlay\').remove()">Cancel</button>'
    + '<button class="btn" style="padding:8px 20px;font-size:0.85rem;background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4)" onclick="deleteAgent(\'' + slug + '\')">Delete</button>'
    + '</div></div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};
window.deleteAgent = async function(slug) {
  var overlay = document.getElementById('delete-confirm-overlay');
  if (overlay) overlay.remove();
  try {
    var r = await fetch('/api/agents/' + slug, { method:'DELETE' });
    var data = await r.json();
    if (data.ok) {
      showToast(slug + ' deleted', 'success');
    } else {
      showToast('Delete failed: ' + (data.error || 'unknown'), 'warning');
    }
  } catch(e) {
    showToast('Failed to delete agent', 'warning');
  }
  navigate('agents');
};

// Editor functions
var _editingAgentName = '';
var _editingAgentType = '';

function _updateLineNumbers() {
  var ta = document.getElementById('agent-editor-content');
  var nums = document.getElementById('editor-line-numbers');
  if (!ta || !nums) return;
  var lines = ta.value.split('\n').length;
  var html = '';
  for (var i = 1; i <= lines; i++) html += i + '\n';
  nums.textContent = html;
  // Sync scroll
  nums.scrollTop = ta.scrollTop;
}

function _updateCursorPos() {
  var ta = document.getElementById('agent-editor-content');
  var pos = document.getElementById('editor-cursor-pos');
  if (!ta || !pos) return;
  var text = ta.value.substring(0, ta.selectionStart);
  var line = text.split('\n').length;
  var col = ta.selectionStart - text.lastIndexOf('\n');
  pos.textContent = 'Ln ' + line + ', Col ' + col;
}

window.editAgent = async function(name) {
  _editingAgentName = name;
  var data = await fetch('/api/agents/' + name + '/content').then(r => r.json());
  if (!data.ok) { showToast('Cannot load agent', 'warning'); return; }
  _editingAgentType = data.type;
  document.getElementById('editor-title').textContent = (data.type === 'python' ? '🐍 ' : '🤖 ') + 'Edit: ' + name;
  var badge = document.getElementById('editor-lang-badge');
  if (data.type === 'python') {
    badge.textContent = 'Python';
    badge.style.background = 'rgba(16,185,129,0.15)';
    badge.style.color = '#10b981';
  } else {
    badge.textContent = 'Markdown';
    badge.style.background = 'rgba(139,92,246,0.15)';
    badge.style.color = '#8b5cf6';
  }
  document.getElementById('editor-hint').innerHTML = data.type === 'python'
    ? 'Must have a <code>run(context)</code> function. <b>output:</b> local, obsidian, webhook (comma-separated).'
    : 'Frontmatter (---) controls metadata. <b>output:</b> local, obsidian, webhook. Example: <code>output: local,obsidian</code>';
  var ta = document.getElementById('agent-editor-content');
  ta.value = data.content;
  document.getElementById('agent-editor-modal').style.display = 'flex';
  document.getElementById('editor-status').textContent = '';
  _updateLineNumbers();
  _updateCursorPos();

  // Bind editor events
  ta.onscroll = function() {
    document.getElementById('editor-line-numbers').scrollTop = ta.scrollTop;
  };
  ta.oninput = function() { _updateLineNumbers(); _updateCursorPos(); };
  ta.onclick = _updateCursorPos;
  ta.onkeyup = _updateCursorPos;

  // Tab key, auto-indent, bracket completion
  ta.onkeydown = function(e) {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAgentContent();
      return;
    }
    // Tab key — insert 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = ta.selectionStart;
      var end = ta.selectionEnd;
      if (e.shiftKey) {
        // Shift+Tab: outdent current line
        var lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
        var lineText = ta.value.substring(lineStart, end);
        if (lineText.startsWith('    ')) {
          ta.value = ta.value.substring(0, lineStart) + lineText.substring(4);
          ta.selectionStart = Math.max(lineStart, start - 4);
          ta.selectionEnd = Math.max(lineStart, end - 4);
        }
      } else {
        ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
      }
      _updateLineNumbers();
      return;
    }
    // Enter — auto-indent
    if (e.key === 'Enter') {
      e.preventDefault();
      var start = ta.selectionStart;
      var lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
      var currentLine = ta.value.substring(lineStart, start);
      var indent = currentLine.match(/^(\s*)/)[1];
      // Add extra indent after : (def, if, for, class, etc.)
      if (currentLine.trimEnd().endsWith(':')) indent += '    ';
      ta.value = ta.value.substring(0, start) + '\n' + indent + ta.value.substring(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = start + 1 + indent.length;
      _updateLineNumbers();
      return;
    }
    // Auto-close brackets
    var pairs = {'(': ')', '[': ']', '{': '}', '"': '"', "'": "'"};
    if (pairs[e.key] && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      var s = ta.selectionStart;
      ta.value = ta.value.substring(0, s) + e.key + pairs[e.key] + ta.value.substring(s);
      ta.selectionStart = ta.selectionEnd = s + 1;
      return;
    }
  };

  setTimeout(function() { ta.focus(); }, 100);
};
window.closeAgentEditor = function() {
  document.getElementById('agent-editor-modal').style.display = 'none';
  _editingAgentName = '';
};
window.saveAgentContent = async function() {
  var content = document.getElementById('agent-editor-content').value;
  var statusEl = document.getElementById('editor-status');
  statusEl.textContent = 'Saving...';
  statusEl.style.color = '#f59e0b';
  var r = await fetch('/api/agents/' + _editingAgentName + '/content', {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ content: content })
  }).then(r => r.json());
  if (r.ok) {
    statusEl.textContent = '✓ Saved';
    statusEl.style.color = '#10b981';
    showToast(_editingAgentName + ' saved!', 'success');
    setTimeout(function() { closeAgentEditor(); navigate('agents'); }, 600);
  } else {
    statusEl.textContent = '✕ Failed';
    statusEl.style.color = '#ef4444';
    showToast(r.error || 'Save failed', 'warning');
  }
};

window.viewAgentOutputs = async function(name) {
  document.getElementById('output-viewer-title').textContent = '📄 Outputs: ' + name;
  var el = document.getElementById('output-viewer-content');
  el.innerHTML = '<div class="spinner"></div>';
  document.getElementById('agent-output-modal').style.display = 'flex';

  var data = await fetch('/api/agents/' + name + '/outputs').then(function(r) { return r.json(); });
  var outputs = data.outputs || [];

  if (outputs.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">No outputs yet. Run the agent to generate output.</div>';
    return;
  }

  var html = '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">' + data.total + ' total output(s)</div>';
  outputs.forEach(function(o) {
    html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;margin-bottom:10px">';
    html += '<div style="font-size:0.78rem;color:var(--accent);margin-bottom:8px;font-weight:600">' + o.date + '</div>';
    html += '<div style="font-size:0.82rem;color:var(--text);white-space:pre-wrap;line-height:1.6;max-height:200px;overflow-y:auto">' + o.content.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>';
    html += '</div>';
  });
  el.innerHTML = html;
};

window.closeOutputViewer = function() {
  document.getElementById('agent-output-modal').style.display = 'none';
};

var _pendingAgentType = '';
window.createAgent = function(type) {
  _pendingAgentType = type;
  var form = document.getElementById('create-agent-form');
  var input = document.getElementById('new-agent-name');
  var errEl = document.getElementById('create-agent-error');
  errEl.textContent = '';
  input.value = '';
  form.style.display = 'block';
  input.focus();
  // Bind Enter key
  input.onkeydown = function(e) {
    if (e.key === 'Enter') { e.preventDefault(); _confirmCreateAgent(); }
    if (e.key === 'Escape') { form.style.display = 'none'; }
  };
  document.getElementById('confirm-create-agent').onclick = _confirmCreateAgent;
};

async function _confirmCreateAgent() {
  var input = document.getElementById('new-agent-name');
  var errEl = document.getElementById('create-agent-error');
  var name = input.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!name) { errEl.textContent = 'Name is required'; return; }
  if (!/^[a-z0-9\-]+$/.test(name)) { errEl.textContent = 'Only lowercase letters, numbers, and hyphens allowed'; return; }
  errEl.textContent = '';
  var result = await fetch('/api/agents/create', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:name, type:_pendingAgentType})
  }).then(r => r.json());
  if (result.ok) {
    document.getElementById('create-agent-form').style.display = 'none';
    showToast('Created ' + name + ' — opening editor', 'success');
    setTimeout(function() { navigate('agents'); setTimeout(function() { editAgent(name); }, 300); }, 200);
  } else {
    errEl.textContent = result.error || 'Failed to create agent';
  }
}

window.importAgentFile = async function(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = async function(e) {
    var content = e.target.result;
    var name = file.name.replace(/\.(py|md)$/, '').toLowerCase().replace(/\s+/g, '-');
    var type = file.name.endsWith('.py') ? 'python' : 'markdown';
    // Create agent first
    var r = await fetch('/api/agents/create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, type:type}) }).then(r => r.json());
    if (r.ok) {
      // Write imported content
      await fetch('/api/agents/' + name + '/content', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content:content}) });
      showToast('Imported ' + file.name, 'success');
      navigate('agents');
    } else if (r.error && r.error.includes('exists')) {
      if (confirm('Agent "' + name + '" already exists. Overwrite?')) {
        await fetch('/api/agents/' + name + '/content', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content:content}) });
        showToast('Updated ' + name, 'success');
        navigate('agents');
      }
    } else {
      showToast(r.error || 'Import failed', 'warning');
    }
  };
  reader.readAsText(file);
  input.value = '';  // Reset so same file can be re-imported
};

window.openAgentInEditor = async function(name) {
  var r = await fetch('/api/agents/' + name + '/open', { method:'POST' }).then(r => r.json());
  if (r.ok) {
    showToast('Opened in system editor', 'success');
  } else {
    showToast(r.error || 'Could not open file', 'warning');
  }
};

// ── Settings Tab ───────────────────────────────────────────────────
async function renderSettings(el) {
  el.innerHTML = '<div class="spinner"></div>';
  let cfg;
  try {
    cfg = await api('/api/settings');
  } catch {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Cannot load settings</div></div>';
    return;
  }

  function _sec(icon, title) { return '<div class="settings-section"><span class="settings-section-icon">' + icon + '</span><span class="settings-section-title">' + title + '</span></div>'; }
  function _sw(id, checked) { return '<label class="toggle-switch"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '><span class="toggle-slider"></span></label>'; }
  function _rp(name, val, label, cur) { return '<label class="radio-pill ' + (cur === val ? 'active' : '') + '"><input type="radio" name="' + name + '" value="' + val + '" ' + (cur === val ? 'checked' : '') + '> ' + label + '</label>'; }

  var wh_events = (cfg.webhook_events || 'summary,standup').split(',');

  el.innerHTML = '<div class="settings-grid">'

  // ── KEYBOARD SHORTCUTS ──
  + _sec('&#9000;', 'Keyboard Shortcuts')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Bookmark Hotkey</div><div class="settings-desc">Capture and bookmark the current screen instantly</div></div></div>'
  + '<div style="display:flex;align-items:center;gap:12px"><input type="text" id="bookmark-hotkey-input" class="hotkey-input" value="' + (cfg.bookmark_hotkey || 'ctrl+shift+b') + '" readonly>'
  + '<button class="btn btn-sm" onclick="startHotkeyCapture(\'bookmark-hotkey-input\')">Record</button>'
  + '<button class="btn btn-sm" style="color:var(--text-muted)" onclick="document.getElementById(\'bookmark-hotkey-input\').value=\'ctrl+shift+b\'">Reset</button></div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Pause / Resume Hotkey</div><div class="settings-desc">Toggle screen capture on and off</div></div></div>'
  + '<div style="display:flex;align-items:center;gap:12px"><input type="text" id="pause-hotkey-input" class="hotkey-input" value="' + (cfg.pause_hotkey || 'ctrl+shift+p') + '" readonly>'
  + '<button class="btn btn-sm" onclick="startHotkeyCapture(\'pause-hotkey-input\')">Record</button>'
  + '<button class="btn btn-sm" style="color:var(--text-muted)" onclick="document.getElementById(\'pause-hotkey-input\').value=\'ctrl+shift+p\'">Reset</button></div>'
  + '<div class="settings-note" style="margin-top:10px">Hotkey changes take effect after restarting ScreenMind.</div></div>'

  // ── CAPTURE ──
  + _sec('&#128248;', 'Capture')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Capture Interval</div><div class="settings-desc">How often to check for screen changes</div></div>'
  + '<span class="settings-value" id="interval-value">' + cfg.capture_interval + 's</span></div>'
  + '<input type="range" id="interval-slider" class="settings-slider" min="10" max="120" step="5" value="' + cfg.capture_interval + '"></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Auto-Pause Heavy Apps</div><div class="settings-desc">Pause capture when games or video editors are active</div></div>'
  + _sw('auto-pause-toggle', cfg.auto_pause_heavy_apps) + '</div>'
  + '<div class="settings-input-row"><label class="settings-label">App keywords (comma-separated):</label>'
  + '<input type="text" id="heavy-apps-input" class="settings-text-input" value="' + (cfg.heavy_apps || '') + '" placeholder="game,valorant,blender,obs..."></div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Deferred Analysis</div><div class="settings-desc">Queue screenshots and analyze only when system is idle</div></div>'
  + _sw('defer-toggle', cfg.defer_analysis) + '</div></div>'

  // ── AI & MODELS ──
  + _sec('&#129504;', 'AI &amp; Models')
  + '<div class="settings-card settings-card-accent" id="model-card"><div class="settings-card-header"><div><div class="settings-title">AI Model</div><div class="settings-desc">Select which Gemma model for analysis and chat</div></div></div>'
  + '<div id="model-list" class="model-list"><div class="spinner" style="margin:12px auto"></div></div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Performance Mode</div><div class="settings-desc">Controls GPU layer offloading for inference</div></div></div>'
  + '<div class="settings-note">Minimal = CPU-only (0 VRAM). Balanced = ~15 layers on GPU (~2GB). Maximum = all layers on GPU (~3GB, fastest).</div>'
  + '<div class="radio-group" id="perf-mode">' + _rp('perf','minimal','Minimal',cfg.performance_mode) + _rp('perf','balanced','Balanced',cfg.performance_mode) + _rp('perf','maximum','Maximum',cfg.performance_mode) + '</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Context Window</div><div class="settings-desc">Max tokens per request (prompt + image + output)</div></div>'
  + '<span class="settings-value" id="ctx-value">' + (cfg.context_window || 6144) + '</span></div>'
  + '<input type="range" id="ctx-slider" class="settings-slider" min="2048" max="8192" step="1024" value="' + (cfg.context_window || 6144) + '">'
  + '<div class="settings-note">Lower = less VRAM. 6144 fits all features. Increase to 8192 for larger models (E4B). Decrease to 4096 if low on VRAM (may truncate long chat/summaries).</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">KV Cache Quantization</div><div class="settings-desc">Compress attention cache to save VRAM</div></div>'
  + _sw('kv-cache-quant', cfg.kv_cache_quant === true) + '</div>'
  + '<div class="settings-note">Saves ~200MB VRAM but adds ~10s per inference due to quant/dequant overhead on CPU layers. Only enable if you are running out of VRAM. Disabled by default for faster inference.</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Flash Attention</div><div class="settings-desc">Optimized attention computation</div></div>'
  + _sw('flash-attention', cfg.flash_attention !== false) + '</div>'
  + '<div class="settings-note">Faster inference and lower VRAM usage. Disable if llama-server fails to start — some older GPUs (pre-Turing) don\'t support it.</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Analysis Mode</div><div class="settings-desc">How screenshots are analyzed</div></div></div>'
  + '<div class="radio-group" id="analysis-mode-group">' + _rp('analysis_mode','merged','⚡ Accurate (~76s)',cfg.analysis_mode) + _rp('analysis_mode','fast','🚀 Fast (~12s)',cfg.analysis_mode) + '</div>'
  + '<div class="settings-note">Accurate: best quality, AI reasons about layout. Fast: 6x faster, great for real-time use without backlog.</div></div>'

  + '<div class="settings-note" style="margin-top:4px;color:#f59e0b;font-size:0.78rem">⚠️ Context Window, KV Cache, and Flash Attention changes require restarting ScreenMind.</div>'

  // ── AUDIO & MEETINGS ──
  + _sec('&#127908;', 'Audio &amp; Meetings')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Meeting Transcription</div><div class="settings-desc">Auto-record and summarize meetings</div></div>'
  + _sw('meeting-toggle', cfg.meeting_transcription) + '</div>'
  + '<div class="settings-note">Requires <code>faster-whisper</code> and <code>sounddevice</code>.</div>'
  + '<div class="settings-input-row"><label class="settings-label">Meeting app keywords:</label>'
  + '<input type="text" id="meeting-apps-input" class="settings-text-input" value="' + (cfg.meeting_apps || '') + '" placeholder="zoom,teams,meet,webex,slack..."></div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Whisper Model</div><div class="settings-desc">Speech-to-text model size</div></div></div>'
  + '<div class="settings-note">Larger = more accurate but slower.</div>'
  + '<div class="radio-group" id="whisper-group">' + _rp('whisper','tiny','Tiny ~75MB',cfg.whisper_model||'tiny') + _rp('whisper','base','Base ~140MB',cfg.whisper_model||'tiny') + _rp('whisper','small','Small ~460MB',cfg.whisper_model||'tiny') + _rp('whisper','medium','Medium ~1.5GB',cfg.whisper_model||'tiny') + _rp('whisper','large-v3','Large V3 ~3GB',cfg.whisper_model||'tiny') + '</div></div>'

  // ── STORAGE ──
  + _sec('&#128451;', 'Storage')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Data Retention</div><div class="settings-desc">Auto-delete timeline data older than selected period</div></div></div>'
  + '<div class="settings-note">Data older than the selected period is permanently deleted on every startup.</div>'
  + '<div class="radio-group" id="retention-group">' + _rp('retention','1','1 Day',cfg.retention_days) + _rp('retention','7','7 Days',cfg.retention_days) + _rp('retention','30','30 Days',cfg.retention_days) + _rp('retention','90','90 Days',cfg.retention_days) + _rp('retention','0','Forever',cfg.retention_days) + '</div>'
  + '<div id="storage-estimate" class="settings-note" style="margin-top:8px;font-size:0.82rem"></div></div>'

  // ── MCP ──
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">MCP Integration</div><div class="settings-desc">Connect screen history to Claude, Cursor, VS Code</div></div></div>'
  + '<div class="settings-note" style="line-height:1.6"><strong>8 tools:</strong> search_screen, search_audio, get_recent_activity, get_activity_by_time, get_daily_summary, get_screenshot, capture_now, get_stats</div>'
  + '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 14px;font-family:monospace;font-size:0.75rem;color:var(--text-muted);overflow-x:auto;white-space:pre">{\n  "mcpServers": {\n    "screenmind": {\n      "command": "python",\n      "args": ["mcp_server.py"]\n    }\n  }\n}</div>'
  + '<div class="settings-note" style="margin-top:8px">See <code>MCP_SETUP.md</code> for full setup instructions.</div></div>'

  // ── INTEGRATIONS ──
  + _sec('&#128279;', 'Integrations')

  // Obsidian
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Obsidian Export</div><div class="settings-desc">Auto-export daily summaries to your vault</div></div>'
  + _sw('obsidian-enabled', cfg.obsidian_enabled) + '</div>'
  + '<input type="text" id="obsidian-vault-path" class="settings-text-input" value="' + (cfg.obsidian_vault_path || '') + '" placeholder="C:/Users/you/MyVault">'
  + '<div class="settings-note" style="margin-top:6px">Files saved to <code>{vault}/ScreenMind/YYYY-MM-DD.md</code></div></div>'

  // Notion
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Notion Export</div><div class="settings-desc">Push daily summaries to a Notion database</div></div>'
  + _sw('notion-enabled', cfg.notion_enabled) + '</div>'
  + '<div class="settings-input-row"><label class="settings-label">Notion API Token:</label>'
  + '<input type="password" id="notion-token" class="settings-text-input" value="' + (cfg.notion_token || '') + '" placeholder="secret_..."></div>'
  + '<div class="settings-input-row"><label class="settings-label">Database ID:</label>'
  + '<input type="text" id="notion-database-id" class="settings-text-input" value="' + (cfg.notion_database_id || '') + '" placeholder="abc123..."></div>'
  + '<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn btn-sm" onclick="testIntegration(\'notion\')">Test Connection</button><span id="notion-test-result" style="font-size:0.8rem"></span></div></div>'

  // Webhooks (FULL)
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Webhooks</div><div class="settings-desc">HTTP POST on events (Slack, Discord, IFTTT)</div></div>'
  + _sw('webhook-enabled', cfg.webhook_enabled) + '</div>'
  + '<div class="settings-input-row"><label class="settings-label">Webhook URL (comma-separated for multiple):</label>'
  + '<input type="text" id="webhook-url" class="settings-text-input" value="' + (cfg.webhook_url || '') + '" placeholder="https://hooks.slack.com/..."></div>'
  + '<div class="settings-input-row"><label class="settings-label">Events to fire on:</label>'
  + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">'
  + ['summary','standup','bookmark','meeting_end','capture_milestone'].map(function(ev) {
      return '<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;color:var(--text-secondary);cursor:pointer"><input type="checkbox" class="webhook-event-cb" value="' + ev + '" ' + (wh_events.indexOf(ev) >= 0 ? 'checked' : '') + ' style="accent-color:var(--accent)"> ' + ev + '</label>';
    }).join('') + '</div></div>'
  + '<div class="settings-input-row"><label class="settings-label">HMAC Secret (for <code>X-ScreenMind-Signature</code>):</label>'
  + '<input type="text" id="webhook-secret" class="settings-text-input" value="' + (cfg.webhook_secret || '') + '" placeholder="optional secret key"></div>'
  + '<div class="settings-input-row"><label class="settings-label">Custom Headers (one per line: <code>Header: value</code>):</label>'
  + '<textarea id="webhook-headers" class="settings-text-input" rows="2" style="resize:vertical;font-family:monospace;font-size:0.78rem" placeholder="Authorization: Bearer xxx">' + (cfg.webhook_headers || '') + '</textarea></div>'
  + '<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn btn-sm" onclick="testIntegration(\'webhook\')">Test Webhook</button><span id="webhook-test-result" style="font-size:0.8rem"></span></div>'
  + '<div style="margin-top:12px"><button class="btn btn-sm btn-ghost" onclick="loadWebhookLog()" style="margin-bottom:6px">View Delivery Log</button>'
  + '<div id="webhook-log" style="font-size:0.78rem;max-height:200px;overflow-y:auto"></div></div></div>'

  // ── AUTOMATION ──
  + _sec('&#129302;', 'Automation')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Agent System</div><div class="settings-desc">AI agents &amp; Python plugins for automated tasks</div></div>'
  + _sw('agents-enabled', cfg.agents_enabled) + '</div>'
  + '<div class="settings-toggle-row" style="margin-top:8px"><div><div class="settings-toggle-label">Auto-run Python plugins</div><div class="settings-toggle-desc">Skip confirmation before executing</div></div>'
  + _sw('agents-auto-run-python', cfg.agents_auto_run_python) + '</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Auto-Bookmark</div><div class="settings-desc">Bookmark important moments by keyword</div></div>'
  + _sw('auto-bookmark', cfg.auto_bookmark) + '</div>'
  + '<input type="text" id="auto-bookmark-keywords" class="settings-text-input" value="' + (cfg.auto_bookmark_keywords || '') + '" placeholder="git push,deploy,npm run build">'
  + '<div class="settings-note" style="margin-top:6px">Comma-separated. Matched against screen text and AI summaries.</div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Smart Notifications</div><div class="settings-desc">Distraction alerts and break reminders</div></div>'
  + _sw('smart-notifications', cfg.smart_notifications) + '</div>'
  + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">'
  + '<label style="font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:6px">Distraction alert <input type="number" id="distraction-minutes" value="' + (cfg.distraction_minutes || 45) + '" min="10" max="180" style="width:55px;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text-primary);text-align:center"> min</label>'
  + '<label style="font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:6px">Break reminder <input type="number" id="break-reminder-minutes" value="' + (cfg.break_reminder_minutes || 90) + '" min="30" max="300" style="width:55px;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text-primary);text-align:center"> min</label>'
  + '</div></div>'

  // ── PRIVACY & SECURITY ──
  + _sec('&#128737;', 'Privacy &amp; Security')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Sensitive Data Filter</div><div class="settings-desc">Auto-redact PII from captured text before storage</div></div>'
  + _sw('sensitive-filter-enabled', cfg.sensitive_filter_enabled) + '</div>'
  + '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">'
  + ['credit_card','ssn','api_key','password','email'].map(function(t) {
      var checked = (cfg.sensitive_filter_types || '').indexOf(t) >= 0 ? 'checked' : '';
      var labels = {credit_card:'Credit Cards', ssn:'SSN/ID Numbers', api_key:'API Keys', password:'Passwords', email:'Email Addresses'};
      return '<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text-secondary);cursor:pointer"><input type="checkbox" class="filter-type-cb" value="' + t + '" ' + checked + ' style="accent-color:var(--accent)"> ' + labels[t] + '</label>';
    }).join('') + '</div></div>'

  // Dashboard PIN � clear UX
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Dashboard Lock (PIN)</div><div class="settings-desc">Require a PIN to access the dashboard</div></div></div>'
  + (cfg.dashboard_pin_set
    ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#10b981;font-size:0.85rem;font-weight:500">&#10004; PIN is active</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px">'
      + '<div><label class="settings-label">Current PIN:</label><input type="password" id="current-pin" maxlength="6" class="settings-text-input" style="width:140px;text-align:center;letter-spacing:6px" placeholder="&#9679;&#9679;&#9679;&#9679;"></div>'
      + '<div><label class="settings-label">New PIN (leave blank to keep):</label><input type="password" id="new-pin" maxlength="6" class="settings-text-input" style="width:140px;text-align:center;letter-spacing:6px" placeholder="optional"></div>'
      + '<div style="display:flex;gap:8px"><button class="btn btn-sm btn-primary" onclick="changePIN()">Update PIN</button><button class="btn btn-sm" style="color:#ef4444" onclick="removePIN()">Remove PIN</button></div>'
      + '</div>'
    : '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px">No PIN set &mdash; dashboard is open to anyone on this machine.</div>'
      + '<div><label class="settings-label">Set a 4-6 digit PIN:</label>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-top:4px"><input type="password" id="new-pin" maxlength="6" class="settings-text-input" style="width:140px;text-align:center;letter-spacing:6px" placeholder="e.g. 1234"><button class="btn btn-sm btn-primary" onclick="setPIN()">Set PIN</button></div></div>'
  )
  + '<div id="pin-action-result" style="font-size:0.8rem;margin-top:8px"></div>'
  + '<div style="margin-top:12px;display:flex;align-items:center;gap:8px"><span style="font-size:0.82rem;color:var(--text-muted)">Auto-lock after</span>'
  + '<input type="number" id="dashboard-lock-timeout" value="' + (cfg.dashboard_lock_timeout || 30) + '" min="5" max="480" style="width:55px;padding:4px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text-primary);text-align:center">'
  + '<span style="font-size:0.82rem;color:var(--text-muted)">min of inactivity</span></div></div>'

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Screenshot Encryption</div><div class="settings-desc">Encrypt screenshots at rest (AES-128)</div></div>'
  + _sw('encryption-enabled', cfg.encryption_enabled) + '</div>'
  + '<div class="settings-note">Key stored in OS keyring. Requires <code>pip install cryptography keyring</code>.</div></div>'

  + '</div>'
  + '<button class="btn btn-primary settings-save" id="save-settings" onclick="saveSettings()">Save Settings</button>';

  // Radio button visual toggle
  el.querySelectorAll('.radio-pill input').forEach(function(radio) {
    radio.addEventListener('change', function() {
      var group = radio.closest('.radio-group');
      group.querySelectorAll('.radio-pill').forEach(function(p) { p.classList.remove('active'); });
      radio.closest('.radio-pill').classList.add('active');
    });
  });
  el.querySelectorAll('#retention-group input').forEach(function(radio) {
    radio.addEventListener('change', updateStorageEstimate);
  });
  var slider = document.getElementById('interval-slider');
  slider.addEventListener('input', function() {
    document.getElementById('interval-value').textContent = slider.value + 's';
  });
  var ctxSlider = document.getElementById('ctx-slider');
  if (ctxSlider) {
    ctxSlider.addEventListener('input', function() {
      document.getElementById('ctx-value').textContent = ctxSlider.value;
    });
  }

  updateStorageEstimate();
  loadModels();
}



async function updateStorageEstimate() {
  const el = document.getElementById('storage-estimate');
  if (!el) return;
  try {
    const data = await api('/api/storage-estimate');
    const selected = document.querySelector('input[name="retention"]:checked');
    const days = selected ? selected.value : '7';
    const est = data.estimates || {};
    const current = data.current_total_mb || 0;
    const perDay = data.avg_mb_per_day || 0;

    if (days === '0') {
      el.innerHTML = `📊 Current storage: <strong>${current} MB</strong> (${data.active_days} days tracked, ~${perDay} MB/day). <em>No auto-cleanup — storage will grow indefinitely.</em>`;
    } else {
      const estimated = est[days] || (perDay * parseInt(days));
      el.innerHTML = `📊 Current: <strong>${current} MB</strong> · Estimated for ${days} days: <strong>~${estimated} MB</strong> (~${perDay} MB/day)`;
    }
  } catch {
    el.textContent = '';
  }
}

async function loadModels() {
  const listEl = document.getElementById('model-list');
  if (!listEl) return;
  try {
    const data = await api('/api/models');
    const models = data.models || [];
    listEl.innerHTML = models.map(m => {
      const statusBadge = m.status === 'active'
        ? '<span class="model-badge model-active">✓ Active</span>'
        : m.status === 'downloaded'
        ? '<span class="model-badge model-downloaded">Downloaded</span>'
        : '<span class="model-badge model-not-installed">Not Installed</span>';
      const actionBtn = m.status === 'active'
        ? ''
        : m.status === 'downloaded'
        ? `<button class="btn-sm btn-switch" onclick="switchModel('${m.tag}')">Switch</button>`
        : `<button class="btn-sm btn-install" onclick="installModel('${m.tag}')">Install & Use</button>`;
      return `
        <div class="model-row ${m.status === 'active' ? 'model-row-active' : ''}">
          <div class="model-info">
            <div class="model-name">${m.name} ${statusBadge}</div>
            <div class="model-meta">${m.size} params · ${m.vram} VRAM · ${m.quality}</div>
          </div>
          <div class="model-action">${actionBtn}</div>
        </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div class="settings-note">⚠️ Could not load models. Is Ollama running?</div>';
  }
}

let _pullAbort = null;

window.installModel = async function(tag) {
  // Confirmation dialog
  if (!confirm(`Download and activate ${tag}?\nThis will download the model via Ollama. Continue?`)) return;

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Cancel';
  btn.classList.add('btn-downloading');
  btn.disabled = false;

  // Allow cancel via abort controller
  _pullAbort = new AbortController();
  let cancelled = false;

  btn.onclick = function() {
    if (_pullAbort) { _pullAbort.abort(); cancelled = true; }
    btn.textContent = 'Cancelling...';
    btn.disabled = true;
  };

  try {
    await fetch('/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
      signal: _pullAbort.signal,
    });
    if (!cancelled) {
      // Auto-switch after install
      await fetch('/api/models/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      showToast(`${tag} installed and activated!`, 'success');
    }
    loadModels();
  } catch (e) {
    if (cancelled || e.name === 'AbortError') {
      showToast(`Download cancelled`, 'warning');
    } else {
      showToast(`Failed to install ${tag}`, 'warning');
    }
    loadModels();
  } finally {
    _pullAbort = null;
  }
};

window.switchModel = async function(tag) {
  try {
    await fetch('/api/models/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    });
    showToast(`Switched to ${tag}`, 'success');
    loadModels();
  } catch {
    showToast('Failed to switch model', 'warning');
  }
};
// Hotkey capture function
window.startHotkeyCapture = function(inputId) {
  var el = document.getElementById(inputId);
  if (!el) return;
  el.value = 'Press keys...';
  el.style.borderColor = 'var(--accent)';
  el.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.2)';

  function handler(e) {
    e.preventDefault();
    e.stopPropagation();
    // Ignore lone modifier keys
    if (['Control','Shift','Alt','Meta'].includes(e.key)) return;

    var parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());

    el.value = parts.join('+');
    el.style.borderColor = '';
    el.style.boxShadow = '';
    document.removeEventListener('keydown', handler, true);
  }
  document.addEventListener('keydown', handler, true);
};

window.saveSettings = async function() {
  var perf = document.querySelector('input[name="perf"]:checked');
  var retention = document.querySelector('input[name="retention"]:checked');
  var whisper = document.querySelector('input[name="whisper"]:checked');

  var body = {
    performance_mode: perf ? perf.value : 'balanced',
    context_window: parseInt(document.getElementById('ctx-slider').value) || 6144,
    kv_cache_quant: document.getElementById('kv-cache-quant').checked,
    flash_attention: document.getElementById('flash-attention').checked,
    analysis_mode: (document.querySelector('input[name="analysis_mode"]:checked') || {}).value || 'merged',
    auto_pause_heavy_apps: document.getElementById('auto-pause-toggle').checked,
    heavy_apps: document.getElementById('heavy-apps-input').value,
    defer_analysis: document.getElementById('defer-toggle').checked,
    capture_interval: parseInt(document.getElementById('interval-slider').value),
    meeting_transcription: document.getElementById('meeting-toggle').checked,
    meeting_apps: document.getElementById('meeting-apps-input').value,
    retention_days: retention ? parseInt(retention.value) : 7,
    whisper_model: whisper ? whisper.value : 'tiny',
    // Integrations
    obsidian_enabled: (document.getElementById('obsidian-enabled') || {}).checked || false,
    obsidian_vault_path: (document.getElementById('obsidian-vault-path') || {}).value || '',
    notion_enabled: (document.getElementById('notion-enabled') || {}).checked || false,
    notion_token: (document.getElementById('notion-token') || {}).value || '',
    notion_database_id: (document.getElementById('notion-database-id') || {}).value || '',
    webhook_enabled: (document.getElementById('webhook-enabled') || {}).checked || false,
    webhook_url: (document.getElementById('webhook-url') || {}).value || '',
    webhook_events: (function() { var evts=[]; document.querySelectorAll('.webhook-event-cb:checked').forEach(function(cb){evts.push(cb.value)}); return evts.join(','); })(),
    webhook_secret: (document.getElementById('webhook-secret') || {}).value || '',
    webhook_headers: (document.getElementById('webhook-headers') || {}).value || '',
    // Automation
    agents_enabled: document.getElementById('agents-enabled').checked,
    agents_auto_run_python: document.getElementById('agents-auto-run-python').checked,
    auto_bookmark: document.getElementById('auto-bookmark').checked,
    auto_bookmark_keywords: document.getElementById('auto-bookmark-keywords').value,
    smart_notifications: document.getElementById('smart-notifications').checked,
    distraction_minutes: parseInt(document.getElementById('distraction-minutes').value) || 45,
    break_reminder_minutes: parseInt(document.getElementById('break-reminder-minutes').value) || 90,
    // Privacy
    sensitive_filter_enabled: document.getElementById('sensitive-filter-enabled').checked,
    sensitive_filter_types: (function() {
      var types = [];
      document.querySelectorAll('.filter-type-cb:checked').forEach(function(cb) { types.push(cb.value); });
      return types.join(',');
    })(),
    dashboard_lock_timeout: parseInt(document.getElementById('dashboard-lock-timeout').value) || 30,
    encryption_enabled: document.getElementById('encryption-enabled').checked,
    // Hotkeys
    bookmark_hotkey: document.getElementById('bookmark-hotkey-input').value,
    pause_hotkey: document.getElementById('pause-hotkey-input').value,
  };
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast('Settings saved', 'success');
  } catch {
    showToast('Failed to save settings', 'warning');
  }
};

// PIN management functions
window.setPIN = async function() {
  var pin = document.getElementById('new-pin').value;
  if (!pin || pin.length < 4) { showToast('PIN must be 4-6 digits', 'warning'); return; }
  var r = await fetch('/api/auth/set-pin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:pin}) }).then(r=>r.json());
  if (r.ok) { showToast('PIN set! Dashboard is now locked.', 'success'); navigate('settings'); }
  else { showToast(r.error || 'Failed', 'warning'); }
};
window.changePIN = async function() {
  var current = document.getElementById('current-pin').value;
  var newPin = document.getElementById('new-pin').value;
  if (!newPin || newPin.length < 4) { showToast('New PIN must be 4-6 digits', 'warning'); return; }
  var r = await fetch('/api/auth/set-pin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:newPin, current_pin:current}) }).then(r=>r.json());
  if (r.ok) { showToast('PIN changed!', 'success'); navigate('settings'); }
  else { showToast(r.error || 'Current PIN incorrect', 'warning'); }
};
window.removePIN = async function() {
  if (!confirm('Remove PIN? Dashboard will be accessible without authentication.')) return;
  var current = document.getElementById('current-pin').value;
  var r = await fetch('/api/auth/set-pin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:'', current_pin:current}) }).then(r=>r.json());
  if (r.ok) { showToast('PIN removed', 'success'); navigate('settings'); }
  else { showToast(r.error || 'Current PIN incorrect', 'warning'); }
};
window.testIntegration = async function(type) {
  var resultEl = document.getElementById(type === 'notion' ? 'notion-test-result' : 'webhook-test-result');
  resultEl.innerHTML = '<span style="color:var(--text-muted)">Testing...</span>';

  var payload = { type: type };
  if (type === 'notion') {
    payload.token = document.getElementById('notion-token').value;
    payload.database_id = document.getElementById('notion-database-id').value;
  } else {
    payload.url = document.getElementById('webhook-url').value;
    payload.secret = document.getElementById('webhook-secret').value;
    payload.headers = document.getElementById('webhook-headers').value;
  }

  try {
    var resp = await fetch('/api/integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var result = await resp.json();
    if (result.ok) {
      resultEl.innerHTML = '<span style="color:#10b981">✅ Connection successful' + (result.database_title ? ` — ${result.database_title}` : '') + '</span>';
    } else {
      resultEl.innerHTML = '<span style="color:#f59e0b">❌ ' + (result.error || 'Failed') + '</span>';
    }
  } catch (e) {
    resultEl.innerHTML = '<span style="color:#ef4444">❌ ' + e.message + '</span>';
  }
};

window.loadWebhookLog = async function() {
  var logEl = document.getElementById('webhook-log');
  if (!logEl) return;
  logEl.innerHTML = '<span style="color:var(--text-muted)">Loading...</span>';
  try {
    var resp = await api('/api/webhooks/log');
    var deliveries = resp.deliveries || [];
    if (deliveries.length === 0) {
      logEl.innerHTML = '<span style="color:var(--text-muted)">No deliveries yet. Enable webhooks and trigger an event.</span>';
      return;
    }
    var rows = deliveries.map(function(d) {
      var icon = d.status === 'ok' ? '✅' : '❌';
      var statusColor = d.status === 'ok' ? '#10b981' : '#ef4444';
      var time = d.timestamp ? d.timestamp.replace('T', ' ').replace('Z', '') : '';
      time = time.substring(5, 16); // MM-DD HH:MM
      var retry = d.attempt > 1 ? ' <span style="color:#f59e0b">(retry)</span>' : '';
      var err = d.error ? '<br><span style="color:#ef4444;font-size:0.72rem">' + d.error.substring(0, 60) + '</span>' : '';
      return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">' +
        '<td style="padding:4px 8px">' + icon + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-muted)">' + time + '</td>' +
        '<td style="padding:4px 8px"><code style="font-size:0.75rem">' + d.event + '</code>' + retry + '</td>' +
        '<td style="padding:4px 8px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + d.url + '</td>' +
        '<td style="padding:4px 8px">' + (d.status_code || '') + err + '</td></tr>';
    }).join('');
    logEl.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><th style="padding:4px 8px;text-align:left;font-size:0.72rem;color:var(--text-muted)"></th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Time</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Event</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">URL</th><th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:4px 8px">Status</th></tr></thead><tbody id="log-tbody">' + rows + '</tbody></table>';
  } catch (e) {
    logEl.innerHTML = '<span style="color:#ef4444">Failed to load: ' + e.message + '</span>';
  }
};

// ── Init ──────────────────────────────────────────────────
function _initApp() {
  const initialView = window.location.hash.slice(1) || 'timeline';
  requestAnimationFrame(() => {
    const activeBtn = $(`[data-view="${initialView}"]`);
    if (activeBtn) moveIndicator(activeBtn);
  });
  navigate(initialView);
  pollStatus();
  setInterval(pollStatus, 15000);
}

// Wait for auth check before initializing app
_checkAuth().then(function() {
  if (!_dashboardLocked) {
    _initApp();
  }
});
