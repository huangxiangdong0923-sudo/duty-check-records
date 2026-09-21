// 每次改动前端文件都要把 CACHE 版本号加一，否则手机上的离线缓存不会更新。
const CACHE = 'duty-check-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './campus/south/',
  './campus/south/index.html',
  './campus/south/manifest.webmanifest',
  './js/version.js',
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
  // 新版本立刻生效，不等用户关掉所有页面。
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(
      ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })).catch(() => null)),
    )),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (!response || !response.ok || request.method !== 'GET') return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // 只处理本站文件。云同步用的 api.github.com 不能被缓存，否则会把旧的 sha 发给 GitHub，
  // 每次上传都被判定为冲突。
  if (new URL(request.url).origin !== self.location.origin) return;

  // 页面本身走网络优先，保证拿到最新版本；断网时回退到缓存。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
    );
    return;
  }

  // 静态资源走缓存优先，断网可用。
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      putInCache(request, response);
      return response;
    })),
  );
});
