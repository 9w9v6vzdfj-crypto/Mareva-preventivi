// Cache-busting: cambia questo nome ad ogni rilascio per forzare l'aggiornamento.
const CACHE = 'facile-preventivo-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Installazione — mette in cache i file dell'app
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

// Attivazione — rimuove le vecchie cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

// Permette alla pagina di forzare l'attivazione del nuovo SW
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // HTML / navigazione → RETE PRIMA (così le nuove versioni arrivano subito),
  // con fallback alla cache quando si è offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', clone));
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Altre risorse → CACHE PRIMA, poi rete
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
