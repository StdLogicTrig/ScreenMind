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
    // First-run: show welcome screen
    if (data.first_run) {
      _dashboardLocked = true;
      document.getElementById('welcome-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      setTimeout(function() { document.getElementById('setup-pin').focus(); }, 100);
      return;
    }
    if (data.has_pin && !data.authenticated) {
      _dashboardLocked = true;
      document.getElementById('lock-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      // Delay focus to ensure element is visible and painted
      setTimeout(function() { document.getElementById('pin-input').focus(); }, 100);
    }
  } catch(e) {}
}

window.completeSetup = async function(withPin) {
  var pin = '';
  if (withPin) {
    pin = document.getElementById('setup-pin').value;
    if (pin.length < 4) {
      document.getElementById('setup-pin').style.borderColor = '#ef4444';
      document.getElementById('setup-pin').setAttribute('placeholder', 'Min 4 digits');
      return;
    }
  }
  try {
    var r = await fetch('/api/auth/setup-complete', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pin: pin})
    });
    var data = await r.json();
    if (data.ok) {
      _dashboardLocked = false;
      document.getElementById('welcome-screen').style.display = 'none';
      document.getElementById('app').style.display = '';
      _initApp();
    }
  } catch(e) {
    _dashboardLocked = false;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('app').style.display = '';
    _initApp();
  }
};

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
  // Numpad fix — system-level keyboard hooks can eat numpad events
  // before they reach the browser. Manually insert the digit.
  if (e.code && e.code.startsWith('Numpad') && /^[0-9]$/.test(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    pinInput.focus();
    var maxLen = parseInt(pinInput.maxLength) || 6;
    if (pinInput.value.length < maxLen) {
      pinInput.value += e.key;
    }
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

      // Mood emoji mapping
      const moodEmojis = {'productive': '🔥', 'distracted': '😵‍💫', 'collaborative': '🤝', 'learning': '📚', 'neutral': '😐'};
      const moodColors = {'productive': '#10b981', 'distracted': '#f59e0b', 'collaborative': '#8b5cf6', 'learning': '#3b82f6', 'neutral': '#6b7280'};
      const mood = a.mood || 'neutral';
      const moodEmoji = moodEmojis[mood] || '😐';
      const moodColor = moodColors[mood] || '#6b7280';

      // Confidence bar
      const conf = Math.round((a.confidence || 0) * 100);
      const confColor = conf >= 80 ? '#10b981' : conf >= 60 ? '#f59e0b' : '#ef4444';

      $('#modal-meta').innerHTML = `
        <div class="meta-row"><span class="time">${time}</span></div>
        <div class="meta-row"><strong>${a.app_name || 'Unknown'}</strong> <span class="badge badge-${cat}">${cat}</span> <span class="badge" style="background:${methodColor}22;color:${methodColor};border:1px solid ${methodColor}44;font-size:0.7rem;padding:2px 8px;border-radius:10px;margin-left:6px">${method}</span></div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
          <span style="display:inline-flex;align-items:center;gap:4px;background:${moodColor}18;color:${moodColor};border:1px solid ${moodColor}33;padding:3px 10px;border-radius:10px;font-size:0.75rem;font-weight:500">${moodEmoji} ${mood}</span>
          <div style="display:flex;align-items:center;gap:6px;flex:1">
            <span style="font-size:0.7rem;color:var(--text-muted)">Confidence</span>
            <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;max-width:120px">
              <div style="width:${conf}%;height:100%;background:${confColor};border-radius:3px;transition:width 0.5s ease"></div>
            </div>
            <span style="font-size:0.7rem;color:${confColor};font-weight:600">${conf}%</span>
          </div>
        </div>
        ${a.active_url ? `<div style="margin-top:6px"><a href="${a.active_url}" target="_blank" rel="noopener" style="font-size:0.75rem;color:#60a5fa;text-decoration:none;word-break:break-all;display:inline-flex;align-items:center;gap:4px" title="${a.active_url}">🔗 ${a.active_url.length > 80 ? a.active_url.substring(0, 80) + '…' : a.active_url}</a></div>` : ''}`;
      // Modal shows detailed context (timeline cards already show the short summary)
      $('#modal-summary').textContent = a.details || a.summary || 'No analysis yet';

      $('#modal-ocr').textContent = a.scene_description || 'No scene description yet';
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

  // Hide the ephemeral slot
  let ephemeral = el.querySelector('.view-ephemeral');

  if (_stickyViews.has(view)) {
    if (ephemeral) ephemeral.style.display = 'none';

    let container = el.querySelector(`[data-view="${view}"]`);
    if (!container) {
      container = document.createElement('div');
      container.className = 'view-sticky view-enter';
      container.dataset.view = view;
      el.appendChild(container);
      const fns = { chat: renderChat, summary: renderSummary };
      (fns[view])(container);
    } else {
      container.style.display = '';
      if (view === 'chat') {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }
    }
  } else {
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
