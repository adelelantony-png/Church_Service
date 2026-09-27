const CACHE_NAME = 'church-app-v1';
const urlsToCache = [
  '/', '/index.html', '/login.html', '/admin_subjects.html', '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  // منع تخزين أي عمليات إرسال (POST) أو طلبات السيرفر (api)
  if (event.request.method === 'POST' || event.request.url.includes('/api/')) {
      return; 
  }
  event.respondWith(
    caches.match(event.request).then(response => {
        return response || fetch(event.request);
    })
  );
});
