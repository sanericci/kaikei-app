/* sanericci cafe 経理 — 圏外でも開けるようにする裏方(Service Worker)。版を変えたら VER を変える */
var VER = 'keiri-v17';
var CORE = ['keiri.html', 'manifest.json', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('keiri-') === 0 && k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isFont(u) { return /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname); }

self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.hostname === 'script.google.com' || u.hostname.indexOf('googleusercontent.com') >= 0) return;   // 保存・メールは、いつも通信で
  if (isFont(u)) {   // 字: 一度取れたらしまっておく(圏外でも同じ字で紙が出る)
    e.respondWith(caches.open(VER).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) { c.put(req, r.clone()); return r; });
      });
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  var page = req.mode === 'navigate' || /keiri\.html$/.test(u.pathname);
  e.respondWith(caches.open(VER).then(function (c) {
    var key = page ? 'keiri.html' : req;
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req, { cache: 'no-store' }).then(function (r) {
        if (r && r.ok) {
          if (page) {   // 新しい版が出ていたら、しまい直して画面に知らせる(作業中に入れ替えはしない)
            r.clone().text().then(function (t) {
              var m = t.match(/id="kVer">(v[0-9.]+)</), cur = m ? m[1] : '';
              if (hit) hit.clone().text().then(function (o) { var m0 = o.match(/id="kVer">(v[0-9.]+)</); if (m0 && cur && m0[1] !== cur) tell(cur); });
            });
            c.put('keiri.html', r.clone());
          } else c.put(req, r.clone());
        }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
function tell(v) { self.clients.matchAll({ includeUncontrolled: true }).then(function (cs) { cs.forEach(function (cl) { cl.postMessage({ type: 'newver', ver: v }); }); }); }
