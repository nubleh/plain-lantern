const CACHE = 'indie-catalog-5ca58ac8';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.a6c19c96.enc","crawl-log.1bce3fe6.enc","store-history.21cc063e.enc","shop-00.fa31c083.enc","shop-01.c818a368.enc","shop-02.0d441611.enc","shop-03.f17a48f8.enc","shop-04.38ac2b65.enc","shop-05.4ebc38b9.enc","shop-06.c24c9d43.enc","shop-07.5c6d2234.enc","shop-08.1272c0f6.enc","shop-09.3633d476.enc","shop-10.afe6d375.enc","shop-11.e5900db0.enc","shop-12.5e5a47e2.enc","shop-13.be8bc351.enc","shop-14.4fa65948.enc","shop-15.da8582df.enc","shop-16.3a1dc65d.enc","shop-17.d0567f79.enc","shop-18.949fa7dd.enc","shop-19.3bf565c3.enc","shop-20.5466eb90.enc","shop-21.df1f1899.enc","shop-22.70e67720.enc","shop-23.afc2b1ef.enc","shop-24.f82404ca.enc","shop-25.b8ff1592.enc","shop-26.3bce4f5c.enc","shop-27.03de88d1.enc","shop-28.ca2946f5.enc","shop-29.288a548b.enc","shop-30.0cbe2798.enc","shop-31.f2be334e.enc","shop-32.871065a6.enc","shop-33.4296e8e4.enc","shop-34.8eecac1c.enc","shop-35.a5371ec0.enc","shop-36.1e545dc7.enc","shop-37.032cbcde.enc","shop-38.c5003a65.enc","shop-39.4b91fd1a.enc","shop-40.5c5d4e09.enc","shop-41.62dc5fde.enc","shop-42.5df542cc.enc","shop-43.7c7317ed.enc","shop-44.954d8ddd.enc","shop-45.e7f9cbfa.enc"];
function isModuleUrl(url) {
  return /\/(shell|crawl-log|store-history)\.[a-f0-9]+\.enc$/.test(url) || /\/shop-[^/]+\.[a-f0-9]+\.enc$/.test(url);
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // A newer SW version can install+activate (skipWaiting/clients.claim make this happen fairly
  // eagerly) WHILE a page's own backgroundCheckForUpdate is mid-download, independent of and
  // unsynchronized with that in-page process — the browser's own SW update lifecycle doesn't know
  // or care what a page script is doing. Blindly evicting anything not in THIS deploy's own
  // CURRENT_MODULES would risk deleting files an in-flight, not-yet-committed update still
  // depends on for its fallback — leaving a client with neither the old (now partially deleted)
  // nor the new (not yet fully downloaded) complete file set. So eviction also reads
  // 'known-good-manifest.json' (the page's own deliberately-managed "last fully confirmed good"
  // pointer, written only on a fully successful update — see deploy-indie-catalog.js's own
  // writeKnownGoodManifest) and keeps every file IT references too, not just CURRENT_MODULES —
  // even if that means keeping an older deploy's files around a little longer than strictly
  // necessary. Those only become eligible for cleanup once a later activate finds a NEWER
  // known-good-manifest that has since superseded them.
  e.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== MODULES_CACHE).map(k => caches.delete(k)))),
    caches.open(MODULES_CACHE).then(cache => cache.match('known-good-manifest.json')
      .then(r => r ? r.json().catch(() => null) : null)
      .then(knownGood => {
        const keep = CURRENT_MODULES.slice();
        if (knownGood) {
          keep.push(knownGood.shell.file, knownGood.crawlLog.file, knownGood.storeHistory.file);
          (knownGood.shopFragments || []).forEach(f => keep.push(f.file));
        }
        return cache.keys().then(reqs => Promise.all(
          reqs.filter(r => !r.url.endsWith('known-good-manifest.json') && !keep.some(m => r.url.endsWith(m))).map(r => cache.delete(r))
        ));
      })),
  ]).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  // Cross-origin (every hotlinked shop product image) always passes straight through — never
  // captured into Cache Storage. See deploy-catalog.js's own fetch handler for the same rule and
  // why it matters (an unbounded permanent cache of third-party content nobody asked to keep).
  if (new URL(e.request.url).origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (isModuleUrl(e.request.url)) {
    e.respondWith(caches.open(MODULES_CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(r) { cache.put(e.request, r.clone()); return r; });
      });
    }));
    return;
  }
  if (/\/build-manifest\.json$/.test(e.request.url)) {
    e.respondWith(caches.open(CACHE).then(function(cache) {
      return fetch(e.request).then(function(r) { cache.put(e.request, r.clone()); return r; })
        .catch(function() { return cache.match(e.request); });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function(cache) {
    return cache.match(e.request).then(function(cached) {
      var network = fetch(e.request).then(function(r) { cache.put(e.request, r.clone()); return r; }).catch(function() { return cached; });
      return cached || network;
    });
  }));
});
