const CACHE_NAME = 'kobe-os-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Web Push — payload is JSON sent by PushService:
//   { title, body, url?, tag? }
// The OS shows a system notification; clicking it focuses an open
// tab pointing at `url` or opens a new one.
self.addEventListener('push', (event) => {
  let data = { title: 'KobeOS', body: '' };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (_) { /* malformed payload — fall through with defaults */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Focus an existing tab pointing at the same path if there is one.
    for (const client of all) {
      try {
        const url = new URL(client.url);
        if (url.pathname === target || url.pathname.startsWith(target.split('?')[0])) {
          await client.focus();
          return;
        }
      } catch (_) { /* invalid URL — skip */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful same-origin responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
