const CACHE = 'danvibe-v8';

// Alle App-Dateien die offline verfügbar sein müssen
const ASSETS = [
  './player.html',
  './player.css',
  './player.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

// Beim Installieren: alle App-Dateien sofort cachen
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Alte Caches löschen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Google Fonts: beim ersten Laden cachen, danach offline verfügbar
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Alle anderen Anfragen: Cache zuerst, dann Netzwerk
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(response => {
      // Neue Dateien dynamisch in Cache aufnehmen
      if (response.ok) {
        caches.open(CACHE).then(c => c.put(e.request, response.clone()));
      }
      return response;
    }))
  );
});
