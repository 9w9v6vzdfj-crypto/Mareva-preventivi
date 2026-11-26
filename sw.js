// Cache-busting: cambia questo nome ad ogni rilascio per forzare l'aggiornamento.
const CACHE = 'facile-preventivo-v42';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './preventivo.js',
  './pianta.js',
  './manifest.json',
  './privacy.html',
  './termini.html',
  './icon-192.png',
  './icon-512.png'
];

// Installazione — mette in cache i file dell'app. cache:'reload' scavalca la
// cache HTTP del browser: altrimenti nella cache nuova poteva finire un
// app.js vecchio (GitHub Pages lo tiene in memoria per 10 minuti).
// Promise.all (non addAll) cosi' un asset mancante (es. icone non ancora
// presenti nel rilascio) non fa fallire il caching degli altri file.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(a => c.add(new Request(a, {cache:'reload'})).catch(()=>{})))
    )
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
      fetch(req, {cache:'no-cache'}).then(res => {
        // Cachiamo solo risposte OK: prima una 404/500 con HTML di errore
        // veniva cachata come index.html, mostrando pagine di errore offline.
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', clone));
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // File dell'app (stesso sito) → RETE PRIMA anche loro: pagina e programma
  // devono essere sempre della stessa versione (prima index.html arrivava
  // nuovo e app.js restava quello vecchio in cache → bottoni che non vanno).
  // La cache serve solo offline.
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, {cache:'no-cache'}).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || Response.error()))
    );
    return;
  }

  // Risorse esterne (es. Firebase, Three.js) → CACHE PRIMA, poi rete
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => Response.error());
    })
  );
});
