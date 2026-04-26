/* ── GlucoAI — Frontend Logic ── */

let glucoseChart = null;

// ── Navigation ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.section;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
    if (target === 'dashboard') loadDashboard();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStatus(level) {
  if (level < 70)  return 'Low';
  if (level > 180) return 'High';
  return 'Normal';
}

function statusClass(s) {
  return s === 'Low' ? 'low' : s === 'High' ? 'high' : 'normal';
}

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const res  = await fetch('/get-readings');
  const data = await res.json();
  const readings = data.readings || [];

  document.getElementById('stat-count').textContent = readings.length;

  if (readings.length === 0) {
    document.getElementById('stat-latest').textContent = '—';
    document.getElementById('stat-avg').textContent    = '—';
    document.getElementById('stat-normal').textContent = '—';
    document.getElementById('status-latest').textContent = 'No data yet';
    document.getElementById('status-avg').textContent    = 'All readings';
    document.getElementById('chartEmpty').style.display  = 'flex';
    if (glucoseChart) { glucoseChart.destroy(); glucoseChart = null; }
    return;
  }

  const latest = readings[readings.length - 1];
  const avg    = readings.reduce((s, r) => s + r.level, 0) / readings.length;
  const normal = readings.filter(r => r.level >= 70 && r.level <= 180).length;
  const pct    = Math.round((normal / readings.length) * 100);
  const st     = getStatus(latest.level);

  document.getElementById('stat-latest').textContent = latest.level;
  document.getElementById('stat-avg').textContent    = avg.toFixed(1);
  document.getElementById('stat-normal').textContent = pct;
  document.getElementById('status-latest').textContent = st;
  document.getElementById('status-avg').textContent    = `${readings.length} readings`;

  renderChart(readings);
}

function renderChart(readings) {
  document.getElementById('chartEmpty').style.display = 'none';
  const ctx = document.getElementById('glucoseChart').getContext('2d');

  const labels = readings.map(r => r.date);
  const values = readings.map(r => r.level);
  const colors = values.map(v => v < 70 ? '#ef4444' : v > 180 ? '#f59e0b' : '#10b981');

  if (glucoseChart) glucoseChart.destroy();

  glucoseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Blood Glucose (mg/dL)',
        data: values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: colors,
        pointBorderColor: '#0d1117',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131929',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 12,
          callbacks: {
            label: ctx => `${ctx.parsed.y} mg/dL — ${getStatus(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          min: 40, max: Math.max(250, ...values) + 30,
        }
      },
      animation: { duration: 600 }
    }
  });

  // Reference lines
  const low = 70, high = 180;
  glucoseChart.options.plugins.annotation = {};
}

// ── Tracker ───────────────────────────────────────────────────────────────────
document.getElementById('inputDate').valueAsDate = new Date();

document.getElementById('btnAdd').addEventListener('click', async () => {
  const date  = document.getElementById('inputDate').value;
  const level = parseFloat(document.getElementById('inputLevel').value);
  const msg   = document.getElementById('formMsg');

  if (!date || isNaN(level)) {
    msg.textContent = 'Please fill in both date and glucose level.';
    msg.className   = 'form-feedback error';
    return;
  }
  if (level < 20 || level > 600) {
    msg.textContent = 'Level must be between 20 and 600 mg/dL.';
    msg.className   = 'form-feedback error';
    return;
  }

  const res  = await fetch('/add-reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, level })
  });
  const data = await res.json();

  if (res.ok) {
    msg.textContent = `✓ Reading added: ${level} mg/dL (${getStatus(level)})`;
    msg.className   = 'form-feedback success';
    document.getElementById('inputLevel').value = '';
    loadReadingsList();
    loadDashboard();
    setTimeout(() => { msg.textContent = ''; }, 3000);
  } else {
    msg.textContent = data.error || 'Error adding reading.';
    msg.className   = 'form-feedback error';
  }
});

async function loadReadingsList() {
  const res  = await fetch('/get-readings');
  const data = await res.json();
  const readings = (data.readings || []).slice().reverse();
  const list  = document.getElementById('readingsList');
  const badge = document.getElementById('readingsCount');

  badge.textContent = `${readings.length} ${readings.length === 1 ? 'entry' : 'entries'}`;

  if (readings.length === 0) {
    list.innerHTML = `
      <div class="readings-empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.25"><rect x="6" y="4" width="28" height="33" rx="4" stroke="#94a3b8" stroke-width="2"/><path d="M12 14h16M12 20h16M12 26h10" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>
        <p>No readings logged yet</p>
      </div>`;
    return;
  }

  list.innerHTML = readings.map(r => {
    const s  = getStatus(r.level);
    const sc = statusClass(s);
    return `
      <div class="reading-card">
        <div>
          <div class="rc-date">${r.date}</div>
          <div class="rc-val ${sc}">${r.level} <span style="font-size:0.7rem;font-weight:400;color:var(--muted)">mg/dL</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="rc-badge ${sc}">${s}</span>
          <button class="rc-del" onclick="deleteReading(${r.id})" title="Delete">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M3 3.5l.75 7h5.5L10 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

async function deleteReading(id) {
  await fetch(`/delete-reading/${id}`, { method: 'DELETE' });
  loadReadingsList();
  loadDashboard();
}

loadReadingsList();

// ── Chat ──────────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');
const chatSend     = document.getElementById('chatSend');

function appendMessage(role, text) {
  const isBot = role === 'bot';
  const div   = document.createElement('div');
  div.className = `msg ${isBot ? 'bot' : 'user'}`;

  const avatar = isBot
    ? `<div class="msg-avatar bot-avatar">
         <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9 Q6 4 9 9 Q12 14 15 9" stroke="url(#ba2)" stroke-width="2" fill="none" stroke-linecap="round"/><defs><linearGradient id="ba2" x1="0" y1="0" x2="18" y2="0"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs></svg>
       </div>`
    : `<div class="msg-avatar user-avatar">U</div>`;

  div.innerHTML = `
    ${avatar}
    <div class="msg-body">
      <div class="bubble">${text}</div>
      <div class="msg-time">${timeStr()}</div>
    </div>`;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar bot-avatar">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9 Q6 4 9 9 Q12 14 15 9" stroke="url(#ba3)" stroke-width="2" fill="none" stroke-linecap="round"/><defs><linearGradient id="ba3" x1="0" y1="0" x2="18" y2="0"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs></svg>
    </div>
    <div class="msg-body">
      <div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  chatSend.disabled = true;
  appendMessage('user', text);
  showTyping();

  try {
    const res  = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    removeTyping();
    appendMessage('bot', data.response || 'Sorry, no response received.');
  } catch (e) {
    removeTyping();
    appendMessage('bot', 'Connection error. Please try again.');
  }

  chatSend.disabled = false;
  chatInput.focus();
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); });

// Quick questions
document.querySelectorAll('.qbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    chatInput.value = btn.dataset.q;
    // Switch to chat section if needed
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-section="chat"]').classList.add('active');
    document.getElementById('chat').classList.add('active');
    sendMessage();
  });
});

// Clear memory
document.getElementById('clearMemBtn').addEventListener('click', async () => {
  await fetch('/clear-memory', { method: 'POST' });
  chatMessages.innerHTML = '';
  appendMessage('bot', 'Conversation memory cleared. Starting fresh! Ask me anything about diabetes management.');
});

// Init dashboard
loadDashboard();
