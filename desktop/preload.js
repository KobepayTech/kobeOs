const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kobeOS', {
  // ── Kobe Runtime API ──────────────────────────────────────────────────────
  // All hardware and OS-level access goes through here.
  // Apps must never call platform APIs directly.
  runtime: {
    status: () => ipcRenderer.invoke('runtime:status'),

    hal: {
      platform: () => ipcRenderer.invoke('runtime:hal:platform'),
      display:  () => ipcRenderer.invoke('runtime:hal:display'),
      network:  () => ipcRenderer.invoke('runtime:hal:network'),
      storage:  () => ipcRenderer.invoke('runtime:hal:storage'),
      power:    () => ipcRenderer.invoke('runtime:hal:power'),
      usb:      () => ipcRenderer.invoke('runtime:hal:usb'),
    },

    audio: {
      getVolume: ()        => ipcRenderer.invoke('runtime:audio:getVolume'),
      setVolume: (level)   => ipcRenderer.invoke('runtime:audio:setVolume', level),
      getMute:   ()        => ipcRenderer.invoke('runtime:audio:getMute'),
      setMute:   (muted)   => ipcRenderer.invoke('runtime:audio:setMute', muted),
      status:    ()        => ipcRenderer.invoke('runtime:audio:status'),
    },

    ai: {
      chat:   (messages, opts) => ipcRenderer.invoke('runtime:ai:chat', messages, opts),
      embed:  (text)           => ipcRenderer.invoke('runtime:ai:embed', text),
      status: ()               => ipcRenderer.invoke('runtime:ai:status'),
    },

    file: {
      read:   (vpath, appId, enc) => ipcRenderer.invoke('runtime:file:read',   vpath, appId, enc),
      write:  (vpath, appId, data) => ipcRenderer.invoke('runtime:file:write',  vpath, appId, data),
      list:   (vpath, appId)       => ipcRenderer.invoke('runtime:file:list',   vpath, appId),
      delete: (vpath, appId)       => ipcRenderer.invoke('runtime:file:delete', vpath, appId),
      exists: (vpath, appId)       => ipcRenderer.invoke('runtime:file:exists', vpath, appId),
      mkdir:  (vpath, appId)       => ipcRenderer.invoke('runtime:file:mkdir',  vpath, appId),
      stat:   (vpath, appId)       => ipcRenderer.invoke('runtime:file:stat',   vpath, appId),
      status: ()                   => ipcRenderer.invoke('runtime:file:status'),
    },

    cloud: {
      ping:   () => ipcRenderer.invoke('runtime:cloud:ping'),
      status: () => ipcRenderer.invoke('runtime:cloud:status'),
    },

    devices: {
      list:   ()               => ipcRenderer.invoke('runtime:devices:list'),
      byType: (type)           => ipcRenderer.invoke('runtime:devices:byType', type),
      send:   (id, cmd, data)  => ipcRenderer.invoke('runtime:devices:send', id, cmd, data),
      status: ()               => ipcRenderer.invoke('runtime:devices:status'),
    },

    // Direct driver access for advanced apps (POS, payment, etc.)
    driver: {
      send: (driverId, deviceId, command, data) =>
        ipcRenderer.invoke('runtime:driver:send', driverId, deviceId, command, data),
    },

    bluetooth: {
      select:  (deviceId) => ipcRenderer.invoke('runtime:bluetooth:select', deviceId),
      cancel:  ()         => ipcRenderer.invoke('runtime:bluetooth:cancel'),
      devices: ()         => ipcRenderer.invoke('runtime:bluetooth:devices'),
      // Subscribe to device list events from main process. Returns unsubscribe fn.
      onDeviceList: (cb) => {
        const handler = (_event, list) => cb(list);
        ipcRenderer.on('bluetooth:device-list', handler);
        return () => ipcRenderer.removeListener('bluetooth:device-list', handler);
      },
    },

    // Subscribe to runtime service events (audio, cloud, devices, etc.)
    // cb receives { service, event, data }. Returns unsubscribe fn.
    onEvent: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('runtime-event', handler);
      return () => ipcRenderer.removeListener('runtime-event', handler);
    },
  },

  system: {
    shutdown:         ()     => ipcRenderer.invoke('system-shutdown'),
    reboot:           ()     => ipcRenderer.invoke('system-reboot'),
    installToDisk:    (disk) => ipcRenderer.invoke('install-to-disk', disk),
    scanDisks:        ()     => ipcRenderer.invoke('scan-disks'),
    getSystemMode:    ()     => ipcRenderer.invoke('get-system-mode'),
    getBackendStatus: ()     => ipcRenderer.invoke('get-backend-status'),
    toggleFullscreen: ()     => ipcRenderer.invoke('toggle-fullscreen'),
    isFullscreen:     ()     => ipcRenderer.invoke('is-fullscreen'),
    // Subscribe to fullscreen state changes. Returns unsubscribe fn.
    onFullscreenChange: (cb) => {
      const handler = (_event, isFS) => cb(isFS);
      ipcRenderer.on('fullscreen-changed', handler);
      return () => ipcRenderer.removeListener('fullscreen-changed', handler);
    },
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
