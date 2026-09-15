const CACHE = 'indie-catalog-8c384e7e';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.672009a5.enc","crawl-log.b641d32e.enc","store-history.2252e871.enc","shop-00.914d6ef6.enc","shop-01.a8d68490.enc","shop-02.30a82b99.enc","shop-03.13fc0aa2.enc","shop-04.f6894de0.enc","shop-05.93b729e3.enc","shop-06.711c8f61.enc","shop-07.4a9e4e29.enc","shop-08.83abe48a.enc","shop-09.b3a31357.enc","shop-10.60ea79ae.enc","shop-11.9b4435e2.enc","shop-12.e9ced7dc.enc","shop-13.99ff8875.enc","shop-14.3c0cfd09.enc","shop-15.fe6365d5.enc","shop-16.50ceb182.enc","shop-17.0451e2ba.enc","shop-18.2ceb2684.enc","shop-19.0181a2fa.enc","shop-20.4cf8be86.enc","shop-21.1fcfb485.enc","shop-22.a3c8b4b4.enc","shop-23.965e2a04.enc","shop-24.2fd5fe9a.enc","shop-25.414f8484.enc","shop-26.e3ebe019.enc","shop-27.d6503a04.enc","shop-28.00654d62.enc","shop-29.9ff1fe06.enc","shop-30.6aceb5cf.enc","shop-31.87ee8b97.enc","shop-32.39ed9a0c.enc","shop-33.4296e8e4.enc","shop-34.0f9e9150.enc","shop-35.b5a04b56.enc","shop-36.63f98bfb.enc","shop-37.7e74a2a2.enc","shop-38.deb6fb79.enc","shop-39.10aaa6a4.enc","shop-40.0fb234b4.enc","shop-41.d85c4ffb.enc","shop-42.650db2f0.enc","shop-43.0008b95f.enc","shop-44.27a36512.enc"];
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
