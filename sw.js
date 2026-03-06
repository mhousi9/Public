// ── Osobnosti Service Worker ──
const CACHE = 'osobnosti-v2';

// Soubory k cachování při instalaci
const PRECACHE = [
  './',
  './index.html',
  // mammoth.js se NEPRECACHUJE — app funguje bez něj (jen import .docx nebude offline)
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // addAll selže pokud jeden soubor selže — proto zachytíme chyby jednotlivě
      return Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pouze same-origin GET requesty
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Strategie: Network first, cache fallback (pro HTML stránku)
  // Pro ostatní (obrázky z CDN apod.) jen cache nebo síť
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === self.location.pathname.replace('sw.js', '') ) {
    // Network first pro hlavní stránku
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            const cl = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, cl));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
  } else {
    // Cache first pro ostatní (JS knihovny z CDN apod.)
    e.respondWith(
      caches.match(e.request).then(r => {
        if (r) return r;
        return fetch(e.request).then(resp => {
          if (resp && resp.status === 200 && resp.type !== 'opaque') {
            const cl = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, cl));
          }
          return resp;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
  }
});
