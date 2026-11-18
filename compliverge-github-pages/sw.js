/* CompliVerge service worker — PWA install + offline shell + web-push notifications.
   Deploy this file to the SITE ROOT alongside index.html (so it is served at /sw.js). */
var CV_CACHE = 'compliverge-shell-v1';

self.addEventListener('install', function(event){
  self.skipWaiting();
  // Pre-cache the app shell so the installed app opens even offline.
  event.waitUntil(
    caches.open(CV_CACHE).then(function(c){ return c.add('/'); }).catch(function(){})
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // drop old shell caches on version bump
      caches.keys().then(function(keys){
        return Promise.all(keys.map(function(k){ if (k !== CV_CACHE) return caches.delete(k); }));
      })
    ])
  );
});

/* Network-first for page navigations: always try the live site (so deploys are picked up
   immediately), and fall back to the cached shell only when offline. Everything else is
   left to the browser's own handling. */
self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function(res){
        try { var copy = res.clone(); caches.open(CV_CACHE).then(function(c){ c.put('/', copy); }); } catch (e) {}
        return res;
      }).catch(function(){ return caches.match('/'); })
    );
  }
});

self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'CompliVerge', body: event.data ? event.data.text() : '' }; }
  var title = data.title || 'CompliVerge';
  var opts = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',   // CompliVerge logo on the notification
    badge: '/icon-192.png',
    tag: data.tag || undefined,          // same tag replaces an earlier notification
    data: { url: data.url || '/' },
    requireInteraction: !!data.important  // keep critical alerts on screen
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++){ if ('focus' in list[i]) { list[i].focus(); return; } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
