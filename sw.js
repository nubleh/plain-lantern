const CACHE = 'indie-catalog-7c9796e4';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.b0d7f524.enc","crawl-log.342332a2.enc","store-history.9d76b410.enc","shop-00.03794c63.enc","shop-01.3c5a3414.enc","shop-02.2a3bbf48.enc","shop-03.a799d2f4.enc","shop-04.ff466605.enc","shop-05.16f73be1.enc","shop-06.7ea75554.enc","shop-07.8eeb1f35.enc","shop-08.5cac0102.enc","shop-09.727d4b20.enc","shop-10.5c6ed4e2.enc","shop-11.0fea4825.enc","shop-12.0c844b3c.enc","shop-13.fe69bc9b.enc","shop-14.3f5d92c9.enc","shop-15.23e1d4da.enc","shop-16.2f053f21.enc","shop-17.bd0058e6.enc","shop-18.d9a2b4b8.enc","shop-19.e55a293c.enc","shop-20.97d7f0d6.enc","shop-21.70bb7c9f.enc","shop-22.932bbc29.enc","shop-23.eae0c690.enc","shop-24.80ddc056.enc","shop-25.c499843e.enc","shop-26.ac2398de.enc","shop-27.0e4cc85f.enc","shop-28.8dd0efca.enc","shop-29.08dfa188.enc","shop-30.1134e316.enc","shop-31.93c62fad.enc","shop-32.d6412791.enc","shop-33.4296e8e4.enc","shop-34.41846f32.enc","shop-35.966eefaa.enc","shop-36.dad93da6.enc","shop-37.0434276e.enc","shop-38.f2a26d75.enc","shop-39.8e6151b6.enc","shop-40.b58e8e44.enc","shop-41.6d3fe974.enc","shop-42.09bd0a2a.enc","shop-43.1d9b7b9f.enc","shop-44.ae1ee55c.enc"];
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
