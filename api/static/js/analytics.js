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
