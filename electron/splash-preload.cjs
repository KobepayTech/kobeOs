const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kobeSplash', {
  onBootProgress: (callback) => {
    const handler = (_event, { pct, msg }) => callback(pct, msg);
    ipcRenderer.on('boot-progress', handler);
    return () => ipcRenderer.removeListener('boot-progress', handler);
  },
});
