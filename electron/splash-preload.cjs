const { ipcRenderer } = require('electron');

let domReady = false;
let pendingProgress = { pct: 0, msg: 'Initializing…' };
let statusTimer = null;

function renderProgress() {
  if (!domReady) return;

  const bar = document.getElementById('bar');
  const track = document.querySelector('.progress-track');
  const status = document.getElementById('status');
  if (!bar || !track || !status) return;

  const pct = Math.min(100, Math.max(0, Number(pendingProgress.pct) || 0));
  bar.style.width = `${pct}%`;
  track.setAttribute('aria-valuenow', String(pct));

  if (pendingProgress.msg) {
    clearTimeout(statusTimer);
    status.style.opacity = '0';
    statusTimer = setTimeout(() => {
      status.textContent = String(pendingProgress.msg);
      status.style.opacity = '1';
    }, 150);
  }
}

ipcRenderer.on('boot-progress', (_event, progress = {}) => {
  pendingProgress = {
    pct: progress.pct,
    msg: progress.msg,
  };
  renderProgress();
});

window.addEventListener('DOMContentLoaded', () => {
  domReady = true;
  renderProgress();
}, { once: true });
