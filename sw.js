const CACHE_NAME = 'teleprompter-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/themes.css',
    '/script.js',
    '/favicon-32x32.png',
    '/favicon-192x192.png',
    '/favicon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});