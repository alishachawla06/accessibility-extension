// ─── Color Vision Deficiency Simulation Module ──────────────────────────────
// Uses CDP Emulation.setEmulatedVisionDeficiency to simulate how the page
// appears to users with various color vision deficiencies.
import { getActiveTab, showElement, hideElement } from './utils.js';

const DEFICIENCIES = [
  { type: 'deuteranopia',  label: 'Deuteranopia',  desc: 'Green-blind', prevalence: '~6% of males' },
  { type: 'protanopia',    label: 'Protanopia',    desc: 'Red-blind',   prevalence: '~2% of males' },
  { type: 'tritanopia',    label: 'Tritanopia',    desc: 'Blue-blind',  prevalence: '~0.01%' },
  { type: 'achromatopsia', label: 'Achromatopsia', desc: 'Total color blindness', prevalence: '~0.003%' },
  { type: 'blurredVision', label: 'Blurred Vision', desc: 'Low visual acuity', prevalence: 'common' }
];

let activeType = null;

async function applyDeficiency(type) {
  const tab = await getActiveTab();
  const resp = await chrome.runtime.sendMessage({
    type: 'setVisionDeficiency', tabId: tab.id, deficiency: type
  });
  if (!resp?.success) throw new Error(resp?.error || 'Vision simulation failed');
  activeType = type;
  updateUI();
}

async function clearDeficiency() {
  const tab = await getActiveTab();
  await chrome.runtime.sendMessage({ type: 'clearVisionDeficiency', tabId: tab.id });
  activeType = null;
  updateUI();
}

function updateUI() {
  document.querySelectorAll('.cv-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.deficiency === activeType);
  });
  const status = document.getElementById('cv-status');
  if (status) {
    if (activeType) {
      const d = DEFICIENCIES.find(d => d.type === activeType);
      status.innerHTML = `<span class="cv-status-active">Simulating: <strong>${d?.label || activeType}</strong></span>`;
    } else {
      status.innerHTML = '<span class="cv-status-off">Normal vision</span>';
    }
  }
  const resetBtn = document.getElementById('btn-cv-reset');
  if (resetBtn) resetBtn.classList.toggle('hidden', !activeType);
}

export function initColorVision() {
  document.querySelectorAll('.cv-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => applyDeficiency(btn.dataset.deficiency));
  });
  document.getElementById('btn-cv-reset')?.addEventListener('click', clearDeficiency);
  updateUI();
}
