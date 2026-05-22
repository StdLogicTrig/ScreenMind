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
