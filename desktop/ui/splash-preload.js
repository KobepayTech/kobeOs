const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kobeSplash', {
  onBootProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('boot-progress', handler);
    return () => ipcRenderer.removeListener('boot-progress', handler);
  },
});
