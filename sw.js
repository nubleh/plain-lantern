const CACHE = 'indie-catalog-e06f0646';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.b0d7f524.enc","crawl-log.313788c8.enc","store-history.bb6c21d7.enc","shop-00.7614a8da.enc","shop-01.16a2b921.enc","shop-02.d09a6d81.enc","shop-03.25226e2d.enc","shop-04.06947d16.enc","shop-05.1255c593.enc","shop-06.2e2af2e0.enc","shop-07.6d343ee3.enc","shop-08.8f5bf35e.enc","shop-09.d64a7f37.enc","shop-10.536ab489.enc","shop-11.a5eb2866.enc","shop-12.bdb482f2.enc","shop-13.ad3aa312.enc","shop-14.0967df85.enc","shop-15.68c2edbd.enc","shop-16.939a967a.enc","shop-17.3cacbf14.enc","shop-18.7d0ec7f2.enc","shop-19.8770d628.enc","shop-20.42251de5.enc","shop-21.bd854ec0.enc","shop-22.ac335a9b.enc","shop-23.adc5e786.enc","shop-24.4f032fb8.enc","shop-25.25144941.enc","shop-26.bf7b3964.enc","shop-27.3b358d96.enc","shop-28.de06c596.enc","shop-29.b77f80d6.enc","shop-30.c1db760e.enc","shop-31.af5e5df8.enc","shop-32.d4ba71ae.enc","shop-33.4296e8e4.enc","shop-34.a0eb92f5.enc","shop-35.da328dc3.enc","shop-36.8392b749.enc","shop-37.b097a0b8.enc","shop-38.a1535d73.enc","shop-39.4b666fc2.enc","shop-40.001d1876.enc","shop-41.ce327579.enc","shop-42.583aa505.enc","shop-43.06b8820a.enc","shop-44.a1566f27.enc","shop-45.2bba6481.enc"];
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
