const CACHE = 'duty-deduction-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './campus/south/index.html',
  './campus/south/',
  './campus/south/manifest.webmanifest',
  './js/reasons.js',
  './js/campuses.js',
  './js/modules.js',
  './js/dates.js',
  './js/records.js',
  './js/storage.js',
  './js/summary.js',
  './js/rating.js',
  './js/image-export.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(ASSETS.map((asset) => cache.add(asset).catch(() => null)))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
