const CACHE_NAME = 'church-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/bible.html',
  '/bible.json',
  '/bible_plan.json',
  '/sheets_list.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  // استرجاع البيانات من الكاش أثناء انقطاع الإنترنت
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
