'use strict';
/* Service Worker for Return PWA
   Strategy: network-first for all requests.
   - Online: always fetch latest from network, update cache in background.
   - Offline: fall back to cached response.
   This ensures index.html edits pushed to GitHub Pages are visible
   immediately on next app open (no stale-cache trap). */

const CACHE = 'return-v1';

/* Assets to pre-cache on install (shell only — fonts/CDN loaded dynamically).
   manifest.json is intentionally NOT precached: the page writes a themed
   manifest into the cache at runtime, and precaching the static one here would
   clobber it on every SW update. */
const PRECACHE = [
  './',
  './index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  /* Only intercept same-origin GET requests. */
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  /* Theme-aware PWA assets: the page writes a themed manifest + 192/512 icons
     into this cache whenever the theme changes (themeStudioApplyPwaManifest).
     Serve them cache-first so the installed app's title-bar color and icon
     follow the active theme. (themed-icon-* are virtual — only ever in cache.) */
  if (/\/(manifest\.json|themed-icon-(?:192|512)\.png)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(function(c) { return c.match(e.request); })
        .then(function(r) { return r || fetch(e.request); })
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(function(res) {
      /* Clone before consuming — streams can only be read once. */
      const clone = res.clone();
      caches.open(CACHE).then(function(cache) {
        cache.put(e.request, clone);
      });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
