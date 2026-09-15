// Offline support. Only active over HTTPS (or localhost), so the game keeps
// working from the home screen with no server. Network-first with a cache
// fallback: you always get the newest version online, and the last version
// you loaded when offline.
const CACHE = 'roo-gun-v1';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/fonts/bangers.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/him/manifest.json',
  'src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => {}) // a missing file must not block installing
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Offline and unseen: a page request still gets the game shell.
        if (request.mode === 'navigate') {
          const shell = await caches.match('index.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
