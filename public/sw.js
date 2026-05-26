const CACHE_NAME = 'saraya-menu-admin-v2';

// Only cache admin shell assets
const PRECACHE_URLS = [
  '/admin',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle admin routes
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/admin')) return;

  // Network first for admin (always fresh data)
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((r) => r || caches.match('/admin'))
    )
  );
});
