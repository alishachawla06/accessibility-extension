// ─── Issue Diff / History Module ─────────────────────────────────────────────
// Loads scorecard run history from chrome.storage.local and presents a
// timeline view plus a per-URL comparison between the two most recent scans.
import { escapeHtml, getActiveTab, showElement, hideElement } from './utils.js';

const MAX_RUNS = 50;
let history = [];       // flat list of all runs, sorted newest first
let historyByUrl = {};  // { url: [runs] } for per-URL comparison
let compareUrl = null;  // URL currently selected for comparison

function gradeColor(letter) {
  const map = { A: '#2e7d32', B: '#558b2f', C: '#f9a825', D: '#ef6c00', F: '#c62828' };
  return map[letter] || '#666';
}

/* ── Load history ─────────────────────────────────────────────────────────── */
async function loadHistory() {
  const data = await chrome.storage.local.get('a11y_history');
  historyByUrl = data.a11y_history || {};
  history = Object.values(historyByUrl).flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RUNS);
  return history;
}

/* ── Render Timeline ──────────────────────────────────────────────────────── */
function renderTimeline() {
  const container = document.getElementById('history-timeline');
  const stats = document.getElementById('history-stats');
  if (!container) return;

  if (!history.length) {
    container.innerHTML = '<div class="empty-state">No scan history yet. Run the Scorecard to start tracking.</div>';
    hideElement(stats);
    return;
  }

  stats.innerHTML = `<span class="stat-pill"><strong>${history.length}</strong> scan${history.length > 1 ? 's' : ''} recorded</span>`;
  showElement(stats);

  container.innerHTML = history.map((run, i) => {
    const date = new Date(run.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const color = gradeColor(run.grade);
    const urlShort = run.url ? new URL(run.url).pathname.slice(0, 40) : '';

    let catDetails = '';
    if (run.categories) {
      catDetails = run.categories.map(c =>
        `<span class="hist-cat-pill" style="color:${gradeColor(c.grade)}">${c.name.split(' ')[0]}: ${c.score}</span>`
      ).join(' ');
    }

    return `
      <div class="hist-card" data-index="${i}">
        <div class="hist-card-top">
          <div class="hist-grade" style="background:${color}">${run.grade}</div>
          <div class="hist-meta">
            <div class="hist-score">${run.score}/100</div>
            <div class="hist-date">${dateStr} ${timeStr}</div>
            <div class="hist-url" title="${escapeHtml(run.url || '')}">${escapeHtml(urlShort)}</div>
          </div>
          <div class="hist-issues">${run.totalIssues || 0} issues</div>
        </div>
        ${catDetails ? `<div class="hist-cats">${catDetails}</div>` : ''}
      </div>`;
  }).join('');
}

/* ── Render Comparison ────────────────────────────────────────────────────── */
async function renderComparison() {
  const container = document.getElementById('history-compare-results');
  if (!container) return;

  const urls = Object.keys(historyByUrl).filter(u => historyByUrl[u].length >= 1);

  if (!urls.length) {
    container.innerHTML = '<div class="empty-state">No scan history yet. Run the Scorecard to start tracking.</div>';
    return;
  }

  // Default to current tab's URL if we haven't picked one yet
  if (!compareUrl) {
    try {
      const tab = await getActiveTab();
      if (tab?.url && historyByUrl[tab.url]) compareUrl = tab.url;
    } catch (_) { /* ignore */ }
  }
  // Fall back to the URL with the most runs
  if (!compareUrl || !historyByUrl[compareUrl]) {
    compareUrl = urls.sort((a, b) => historyByUrl[b].length - historyByUrl[a].length)[0];
  }

  // Build URL selector
  let urlLabel;
  try { urlLabel = new URL(compareUrl).pathname.slice(0, 50); } catch (_) { urlLabel = compareUrl; }

  let html = `<div class="hist-url-picker">
    <label for="hist-url-select">Comparing scans for:</label>
    <select id="hist-url-select">
      ${urls.map(u => {
        let label;
        try { label = new URL(u).pathname.slice(0, 60); } catch (_) { label = u; }
        const count = historyByUrl[u].length;
        const selected = u === compareUrl ? ' selected' : '';
        return `<option value="${escapeHtml(u)}"${selected}>${escapeHtml(label)} (${count} scan${count > 1 ? 's' : ''})</option>`;
      }).join('')}
    </select>
  </div>`;

  const runs = (historyByUrl[compareUrl] || []).sort((a, b) => b.timestamp - a.timestamp);

  if (runs.length < 2) {
    html += `<div class="empty-state">Need at least 2 scans of this page to compare. Currently ${runs.length} scan${runs.length !== 1 ? 's' : ''}.</div>`;
    container.innerHTML = html;
    wireUrlPicker(container);
    return;
  }

  const runB = runs[0]; // newest
  const runA = runs[1]; // previous

  const scoreDelta = runB.score - runA.score;
  const issueDelta = (runB.totalIssues || 0) - (runA.totalIssues || 0);

  const scoreSign = scoreDelta > 0 ? '+' : '';
  const scoreCls = scoreDelta > 0 ? 'hist-delta-better' : scoreDelta < 0 ? 'hist-delta-worse' : 'hist-delta-same';
  const issueCls = issueDelta < 0 ? 'hist-delta-better' : issueDelta > 0 ? 'hist-delta-worse' : 'hist-delta-same';
  const issueSign = issueDelta > 0 ? '+' : '';

  const dateA = new Date(runA.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateB = new Date(runB.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  html += `
    <div class="hist-compare-header">
      <span>${dateA} (${runA.grade} ${runA.score})</span>
      <span class="hist-arrow">→</span>
      <span>${dateB} (${runB.grade} ${runB.score})</span>
    </div>
    <div class="hist-compare-summary">
      <div class="hist-compare-card ${scoreCls}">
        <div class="hist-compare-label">Score</div>
        <div class="hist-compare-value">${scoreSign}${scoreDelta}</div>
      </div>
      <div class="hist-compare-card ${issueCls}">
        <div class="hist-compare-label">Issues</div>
        <div class="hist-compare-value">${issueSign}${issueDelta}</div>
      </div>
    </div>`;

  // Category-by-category
  if (runA.categories && runB.categories) {
    html += '<div class="hist-cat-compare">';
    runB.categories.forEach((catB) => {
      const catA = runA.categories.find(c => c.name === catB.name);
      if (!catA) return;
      const d = catB.score - catA.score;
      const cls = d > 0 ? 'hist-delta-better' : d < 0 ? 'hist-delta-worse' : 'hist-delta-same';
      const sign = d > 0 ? '+' : '';
      html += `<div class="hist-cat-row">
        <span class="hist-cat-name">${escapeHtml(catB.name)}</span>
        <span class="hist-cat-scores">${catA.score} → ${catB.score}</span>
        <span class="${cls}">${sign}${d}</span>
      </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
  wireUrlPicker(container);
}

function wireUrlPicker(container) {
  container.querySelector('#hist-url-select')?.addEventListener('change', (e) => {
    compareUrl = e.target.value;
    renderComparison();
  });
}

/* ── Clear all history ────────────────────────────────────────────────────── */
async function clearHistory() {
  await chrome.storage.local.remove('a11y_history');
  history = [];
  renderTimeline();
  renderComparison();
}

/* ── Export history as JSON ────────────────────────────────────────────────── */
function exportHistory() {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `a11ylens-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
export function initIssueHistory() {
  loadHistory().then(() => {
    renderTimeline();
    renderComparison();
  });

  document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);
  document.getElementById('btn-export-history')?.addEventListener('click', exportHistory);

  // Listen for scorecard runs to refresh
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.a11y_history) {
      loadHistory().then(() => {
        renderTimeline();
        renderComparison();
      });
    }
  });
}
