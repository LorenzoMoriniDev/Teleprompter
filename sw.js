const CACHE_NAME = 'teleprompter-cache-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/themes.css',
    '/script.js',
    '/fonts/ibm-plex-sans-var.woff2',
    '/fonts/ibm-plex-mono-500.woff2',
    '/fonts/ibm-plex-mono-700.woff2',
    '/fonts/atkinson-hyperlegible-700-latin.woff2',
    '/fonts/atkinson-hyperlegible-700-latin-ext.woff2',
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

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
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