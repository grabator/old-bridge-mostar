/* Mostarly admin service worker: phone notifications for new enquiries and tomorrow's tours.
   It does not cache anything, so the admin always shows fresh data. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: 'Mostarly', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Mostarly', {
    body: d.body || '', icon: '/img/admin-192.png', badge: '/img/admin-badge.png', tag: d.tag || 'mostarly', renotify: true,
    data: { url: d.url || '/admin/#/planer' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin/#/planer';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { var c = list[i]; if (c.url.indexOf('/admin/') > -1 && 'focus' in c) { c.navigate(url).catch(function () {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
