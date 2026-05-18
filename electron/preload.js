const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kobeOS', {
  system: {
    shutdown:         ()     => ipcRenderer.invoke('system-shutdown'),
    reboot:           ()     => ipcRenderer.invoke('system-reboot'),
    installToDisk:    (disk) => ipcRenderer.invoke('install-to-disk', disk),
    scanDisks:        ()     => ipcRenderer.invoke('scan-disks'),
    getSystemMode:    ()     => ipcRenderer.invoke('get-system-mode'),
    getBackendStatus: ()     => ipcRenderer.invoke('get-backend-status'),
  },

  updater: {
    check:    () => ipcRenderer.invoke('updater-check'),
    download: () => ipcRenderer.invoke('updater-download'),
    install:  () => ipcRenderer.invoke('updater-install'),
    rollback: () => ipcRenderer.invoke('updater-rollback'),
    status:   () => ipcRenderer.invoke('updater-status'),

    // Subscribe to update lifecycle events. Returns an unsubscribe fn.
    onEvent: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('updater', handler);
      return () => ipcRenderer.removeListener('updater', handler);
    },
  },
});
