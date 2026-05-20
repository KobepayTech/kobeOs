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

  // Local SQLite DB — offline-first storage
  db: {
    kvGet:   (key)              => ipcRenderer.invoke('localdb:kvGet', key),
    kvSet:   (key, value)       => ipcRenderer.invoke('localdb:kvSet', key, value),
    kvDel:   (key)              => ipcRenderer.invoke('localdb:kvDel', key),
    query:   (table, filters)   => ipcRenderer.invoke('localdb:query', table, filters),
    insert:  (table, record)    => ipcRenderer.invoke('localdb:insert', table, record),
    update:  (table, id, changes) => ipcRenderer.invoke('localdb:update', table, id, changes),
    delete:  (table, id)        => ipcRenderer.invoke('localdb:delete', table, id),
    enqueue: (operation)        => ipcRenderer.invoke('localdb:enqueue', operation),
    getStats: ()                => ipcRenderer.invoke('localdb:getStats'),
  },

  // LAN server mode — act as local sync hub for other KobeOS instances
  lan: {
    start:    () => ipcRenderer.invoke('lan:start'),
    stop:     () => ipcRenderer.invoke('lan:stop'),
    status:   () => ipcRenderer.invoke('lan:status'),
    discover: () => ipcRenderer.invoke('lan:discover'),
  },

  // OS-level package/kernel updates
  osUpdate: {
    status:      () => ipcRenderer.invoke('os-update:status'),
    run:         () => ipcRenderer.invoke('os-update:run'),
    clearReboot: () => ipcRenderer.invoke('os-update:clearReboot'),
  },

  // Sync engine — offline queue drain
  sync: {
    status:    () => ipcRenderer.invoke('sync:status'),
    forceSync: () => ipcRenderer.invoke('sync:forceSync'),

    // Subscribe to sync events (queued, drained, error). Returns unsubscribe fn.
    onEvent: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('sync', handler);
      return () => ipcRenderer.removeListener('sync', handler);
    },
  },
});
