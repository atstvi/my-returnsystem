'use strict';
/* Service Worker for Return PWA
   Strategy: network-first for all requests.
   - Online: always fetch latest from network, update cache in background.
   - Offline: fall back to cached response.
   This ensures index.html edits pushed to GitHub Pages are visible
   immediately on next app open (no stale-cache trap). */

const CACHE = 'return-v2';

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
      /* ignoreSearch so manifest.json?tv=<timestamp> (written by themeStudioApplyPwaManifest
         to force Chrome to re-read the themed manifest) matches the cache entry. */
      caches.open(CACHE).then(function(c) { return c.match(e.request, {ignoreSearch: true}); })
        .then(function(r) { return r || fetch(e.request); })
    );
    return;
  }

  /* HTML / navigation requests bypass the browser HTTP cache entirely
     ({cache:'no-store'}) so a fresh GitHub Pages deploy is visible on the very
     next app open — GitHub serves index.html with max-age=600, which otherwise
     lets a browser hold a stale shell for up to 10 minutes even under a
     network-first SW. Other assets keep the normal network-first flow. */
  const isHtml = e.request.mode === 'navigate'
    || /\/(index\.html)?$/.test(url.pathname)
    || (e.request.headers.get('accept') || '').indexOf('text/html') !== -1;

  e.respondWith(
    fetch(isHtml ? new Request(e.request, { cache: 'no-store' }) : e.request).then(function(res) {
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

/* ── Web Push (Phase 2) ──────────────────────────────────────────────────────
   Receives a push from the Return push worker and shows the notification, then
   focuses/opens the app on click. Payload shape (JSON):
     { title, body, tag, url } */
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { try { data = { title: 'Return', body: e.data && e.data.text() }; } catch (__) { data = {}; } }
  var title = data.title || 'Return';
  var opts = {
    body: data.body || '',
    tag: data.tag || 'return-push',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* 알림창 액션 핸드오프용 초경량 IndexedDB 큐 — 열린 창이 없을 때(닫힌 상태에서
   스누즈/완료를 눌렀을 때) 다음 앱 실행에서 처리하도록 남겨 둔다. */
function _swQueueAction(item) {
  return new Promise(function(resolve) {
    try {
      var r = indexedDB.open('return-notif', 1);
      r.onupgradeneeded = function() { try { r.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true }); } catch (_) {} };
      r.onsuccess = function() {
        try {
          var db = r.result, tx = db.transaction('pending', 'readwrite');
          tx.objectStore('pending').add(item);
          tx.oncomplete = function() { resolve(); };
          tx.onerror = function() { resolve(); };
        } catch (_) { resolve(); }
      };
      r.onerror = function() { resolve(); };
    } catch (_) { resolve(); }
  });
}

self.addEventListener('notificationclick', function(e) {
  var action = e.action || '';
  var data = (e.notification && e.notification.data) || {};
  e.notification.close();

  /* 틱틱식 알림창 액션: 미루기(스누즈)·완료. 열린 창이 있으면 즉시 전달, 없으면
     절대 시각(dueAt)을 담아 큐에 넣어 다음 실행에서 반영(스누즈가 사라지지 않게). */
  if (action === 'snooze-10' || action === 'snooze-60' || action === 'done') {
    var isDone = action === 'done';
    var minutes = action === 'snooze-60' ? 60 : 10;
    var payload = {
      type: 'notif-action',
      action: isDone ? 'done' : 'snooze',
      minutes: minutes,
      dueAt: isDone ? 0 : (Date.now() + minutes * 60000),
      data: data, ts: Date.now()
    };
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
        if (list && list.length) {
          list.forEach(function(c) { try { c.postMessage(payload); } catch (_) {} });
          return;
        }
        return _swQueueAction(payload); /* 창이 없으면 조용히 큐에만(앱을 강제로 열지 않음) */
      })
    );
    return;
  }

  /* 본문 클릭 → 앱 열기/포커스 */
  var url = (data && data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) { try { list[i].navigate && list[i].navigate(url); } catch (_) {} return list[i].focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
