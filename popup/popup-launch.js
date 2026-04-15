// ─── Launch Pad ─────────────────────────────────────────────────────────────
document.querySelectorAll('.lp-card').forEach(card => {
  card.addEventListener('click', () => {
    const panel = card.dataset.panel;
    chrome.runtime.sendMessage({ type: 'openPanel', panel });
    window.close();
  });
});
