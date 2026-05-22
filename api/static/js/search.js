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
