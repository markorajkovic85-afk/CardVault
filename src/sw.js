// CardVault — Service Worker

const CACHE_NAME = 'cardvault-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/sync.js',
  './js/ocr.js',
  './js/qr.js',
  './js/camera.js',
  './js/sheets-api.js',
  './js/utils.js',
  './pages/my-card.js',
  './pages/scan.js',
  './pages/contacts.js',
  './pages/contact-detail.js',
  './pages/settings.js',
  './components/nav-bar.js',
  './components/toast.js',
  './components/card-preview.js',
  './components/search-bar.js',
  './manifest.json',
  '../assets/placeholder-avatar.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8/build/index.js'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache local assets (ignore failures for missing files during dev)
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('Failed to cache:', asset);
        }
      }
      // Cache CDN assets
      for (const url of CDN_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('Failed to cache CDN:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls (Google Apps Script)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache Tesseract model files on first use
  if (url.pathname.includes('tesseract') || url.pathname.includes('.traineddata')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        // Update cache in background
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
