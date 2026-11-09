// Dudestreet service worker: uygulama dosyaları anında önbellekten açılır, yeni sürüm arkada indirilip bir sonraki açılışta gelir.
// Google, Gemini ve /api istekleri asla önbelleğe alınmaz.
const CACHE = 'dudestreet-v8';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './core.js', './ui.js', './tema.js', './hesap.js', './plan.js', './ozet.js', './gelirgider.js', './notlar.js', './varliklar.js', './borclar.js', './hedef.js', './dude.js', './ai.js', './yedek.js', './paylas.js', './google.js', './gemini.js', './schema.js', './persona.js', './localdb.js', './manifest.webmanifest', './img/wordmark.png', './img/icon-32.png', './img/icon-180.png', './img/icon-192.png', './img/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Önbellekten hemen ver, ağdan tazesini arkada al (stale-while-revalidate); önbellekte yoksa ağı bekle
  const ag = fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(onb => {
      if (onb) { e.waitUntil(ag.catch(() => {})); return onb; }
      return ag.catch(() => caches.match('./index.html'));
    })
  );
});
