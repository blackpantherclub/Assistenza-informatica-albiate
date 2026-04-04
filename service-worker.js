// ════════════════════════════════════════════════════
// Service Worker — Doctor Computer & Software PWA
// Strategia: Cache-first per risorse statiche
//             Network-first per pagine HTML
// ════════════════════════════════════════════════════

const CACHE_NAME = 'doctor-computer-v1';
const OFFLINE_PAGE = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/contatti.html',
  '/richiesta-assistenza.html',
  '/richiesta-preventivo.html',
  '/negozio-software.html',
  '/i-nostri-servizi.html',
  '/assistenza-remota.html',
  '/assistenza-smartphone.html',
  '/sicurezza-casa.html',
  '/microsoft.html',
  '/reseller.html',
  '/manifest.json',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap'
];

// ── INSTALL: metti in cache le risorse statiche ─────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'reload'})))
        .catch(err => console.warn('[SW] Alcuni file non cachati:', err));
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: rimuovi cache vecchie ────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: strategia Network-first per HTML, Cache-first per resto ─
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Ignora richieste esterne (Formspree, PayPal, WhatsApp, ecc.)
  if (url.origin !== location.origin &&
      !url.href.includes('fonts.googleapis.com') &&
      !url.href.includes('fonts.gstatic.com')) {
    return;
  }

  // Pagine HTML → Network-first (sempre aggiornate)
  if (event.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // Font e CSS → Cache-first
  if (url.href.includes('fonts.googleapis.com') || url.href.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Tutto il resto → Cache-first con fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => caches.match(OFFLINE_PAGE));
    })
  );
});

// ── PUSH NOTIFICATIONS (futuro) ────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Doctor Computer', {
    body: data.body || 'Hai un nuovo messaggio.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
