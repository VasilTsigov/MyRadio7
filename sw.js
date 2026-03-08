const CACHE_NAME = 'myradio7-v4';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/nowplaying.js',
  '/js/api.js',
  '/js/favorites.js',
  '/js/player.js',
  '/js/app.js',
  '/icons/icon.svg',
  '/manifest.json'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - App shell assets: cache-first
// - API requests (radio-browser.info): network-only (always live data)
// - Station logos: stale-while-revalidate
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API calls: network only
  if (url.hostname.includes('radio-browser.info')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Audio streams: never intercept — let browser handle natively
  // Detect by request destination (works for all stream URLs, not just by extension)
  if (event.request.destination === 'audio') return;
  const audioExtensions = ['.mp3', '.aac', '.ogg', '.m3u8', '.pls', '.asx', '.xspf'];
  if (audioExtensions.some(ext => url.pathname.endsWith(ext))) return;

  // Station logos: stale-while-revalidate (external images only)
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fetched = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
          return cached || fetched;
        })
      )
    );
    return;
  }

  // App shell: cache-first, fallback to network, fallback to index.html
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
