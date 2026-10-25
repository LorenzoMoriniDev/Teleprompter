const CACHE_NAME = 'teleprompter-cache-v12';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/themes.css',
    '/fonts.css',
    '/script.js',
    /* The written pages: their own two files, and each page by the address
       everything links to - the canonical, the sitemap and the home's list all
       use the directory form, and a match here is by exact URL. */
    '/pages.css',
    '/theme.js',
    '/how-to-use-a-teleprompter/',
    '/mirror-teleprompter/',
    '/words-per-minute/',
    '/fonts/ibm-plex-sans-var.woff2',
    '/fonts/atkinson-hyperlegible-next-700-latin.woff2',
    '/fonts/atkinson-hyperlegible-next-700-latin-ext.woff2',
    '/favicon.png',
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