// Minimal offline shell: network-first with cache fallback, same-origin GETs
// only. Cross-origin requests (Google Fonts) are never intercepted, so the
// COEP:credentialless headers the multi-threaded engine needs are untouched —
// and the Cache API preserves stored response headers, so an offline page
// still comes back crossOriginIsolated.
const CACHE = 'rc-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('/');
          throw new Error('offline and uncached: ' + req.url);
        }),
      ),
  );
});
