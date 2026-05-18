const { ipcRenderer } = require('electron');

// Forward boot-progress events from main process into the splash page
ipcRenderer.on('boot-progress', (_event, { pct, msg }) => {
  if (window.__setBootProgress) {
    window.__setBootProgress(pct, msg);
  }
});
