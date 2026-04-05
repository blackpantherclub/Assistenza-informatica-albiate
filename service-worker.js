// ════════════════════════════════════════════════════
// Service Worker — Doctor Computer & Software
// Versione: v3 — NO cache HTML, cache solo assets
// ════════════════════════════════════════════════════

const CACHE_NAME = 'doctor-computer-v3';

const STATIC_ASSETS = [
  '/manifest.json',
  '/offline.html',
  '/logo.png',
  '/logo.jpg',
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap'
];

// ── INSTALL ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Alcuni asset non cachati:', err);
      });
    })
  );
  self.skipWaiting(); // attiva subito senza aspettare
});

// ── ACTIVATE: cancella cache vecchie ────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Cancello cache vecchia:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim(); // prendi controllo subito di tutte le schede
});

// ── FETCH ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ✅ Pagine HTML → SEMPRE dalla rete, MAI dalla cache
  if (
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname === ''
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // ✅ Font Google → cache-first
  if (url.origin.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // ✅ Immagini e assets statici → cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|css)$/) &&
    url.origin === location.origin
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Tutto il resto → sempre dalla rete
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
