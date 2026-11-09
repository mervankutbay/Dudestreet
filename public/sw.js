// Dudestreet service worker: kod güncellemeleri sessizce gelsin (önce ağ, çevrimdışıysa önbellek).
// Google, Gemini ve /api istekleri asla önbelleğe alınmaz.
const CACHE = 'dudestreet-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './google.js', './gemini.js', './schema.js', './persona.js', './localdb.js', './manifest.webmanifest', './img/logo.svg', './img/icon-192.png', './img/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
