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

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Voice Memo Hotkey</div><div class="settings-desc">Hold to record a voice memo with screenshot</div></div></div>'
  + '<div style="display:flex;align-items:center;gap:12px"><input type="text" id="voice-hotkey-input" class="hotkey-input" value="' + (cfg.voice_hotkey || 'ctrl+shift+v') + '" readonly>'
  + '<button class="btn btn-sm" onclick="startHotkeyCapture(\'voice-hotkey-input\')">Record</button>'
  + '<button class="btn btn-sm" style="color:var(--text-muted)" onclick="document.getElementById(\'voice-hotkey-input\').value=\'ctrl+shift+v\'">Reset</button></div></div>'

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

  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Analysis Mode</div><div class="settings-desc">How screenshots are analyzed</div></div>'
  + '<div class="radio-group" id="analysis-mode-group">' + _rp('analysis_mode','merged','\u26a1 Accurate (~76s)',cfg.analysis_mode) + _rp('analysis_mode','balanced','\u2696\ufe0f Balanced (~40s)',cfg.analysis_mode) + _rp('analysis_mode','fast','\ud83d\ude80 Fast (~12s)',cfg.analysis_mode) + '</div>'
  + '<div class="settings-note">Accurate: best quality, AI reasons about layout. Balanced: AI thinking without layout. Fast: no thinking, fastest.</div></div>'


  + '<div class="settings-note" style="margin-top:4px;color:#f59e0b;font-size:0.78rem">⚠️ Context Window, KV Cache, and Flash Attention changes require restarting ScreenMind.</div>'

  // ── AUDIO & MEETINGS ──
  + _sec('&#127908;', 'Audio &amp; Meetings')
  + '<div class="settings-card"><div class="settings-card-header"><div><div class="settings-title">Meeting Transcription</div><div class="settings-desc">Auto-record and summarize meetings</div></div>'
  + _sw('meeting-toggle', cfg.meeting_transcription) + '</div>'
  + '<div class="settings-note">Uses Gemma 4 audio decoding. Requires <code>sounddevice</code>.</div>'
  + '<div class="settings-input-row"><label class="settings-label">Meeting app keywords:</label>'
  + '<input type="text" id="meeting-apps-input" class="settings-text-input" value="' + (cfg.meeting_apps || '') + '" placeholder="zoom,teams,meet,webex,slack..."></div></div>'

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
    voice_hotkey: document.getElementById('voice-hotkey-input').value,
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
