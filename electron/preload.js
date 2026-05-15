const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kobeOS', {
  system: {
    shutdown: () => ipcRenderer.invoke('system-shutdown'),
    reboot: () => ipcRenderer.invoke('system-reboot'),
    installToDisk: (disk) => ipcRenderer.invoke('install-to-disk', disk),
    scanDisks: () => ipcRenderer.invoke('scan-disks'),
    getSystemMode: () => ipcRenderer.invoke('get-system-mode'),
  }
});
