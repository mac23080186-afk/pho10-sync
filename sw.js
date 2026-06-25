/* Phở 10 Sync — Service Worker v1 */

const CACHE_NAME = 'pho10-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/customer.html',
  '/kitchen.html',
  '/offline.html',
  '/css/style.css',
  '/js/script.js',
  '/js/customer.js',
  '/js/kitchen.js',
  '/js/firebase-init.js',
  '/assets/icon.svg',
];

/* ── Install: pre-cache all static assets ────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: remove stale caches from previous versions ───── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: cache-first for app shell; network-only for Firebase ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Pass Firebase, CDN, and external API requests straight to the network.
     These require live data and cannot be meaningfully cached here. */
  if (
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith('/__/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          /* Offline fallback: navigation requests → offline.html */
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
    })
  );
});
