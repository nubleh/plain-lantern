const CACHE = 'indie-catalog-4701b4aa';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.647e9c25.enc","crawl-log.8dfd5aba.enc","store-history.50340f0b.enc","shop-00.317dac1d.enc","shop-01.6664d34b.enc","shop-02.be2cd7d8.enc","shop-03.f2533a60.enc","shop-04.faae8df0.enc","shop-05.b6fac099.enc","shop-06.90b47184.enc","shop-07.ddcc8540.enc","shop-08.4055a34b.enc","shop-09.8061f2e5.enc","shop-10.29d1278c.enc","shop-11.06fb7391.enc","shop-12.f955b5f4.enc","shop-13.84eb0e20.enc","shop-14.0429b38b.enc","shop-15.f856c190.enc","shop-16.5e13587a.enc","shop-17.a9bab62f.enc","shop-18.7ef9f841.enc","shop-19.d879acbb.enc","shop-20.f9a9adb5.enc","shop-21.5ab19c3a.enc","shop-22.819fe135.enc","shop-23.4225cf48.enc","shop-24.bcf8fa49.enc","shop-25.f2ec987d.enc","shop-26.2d7a4135.enc","shop-27.a46a2e37.enc","shop-28.b132fd92.enc","shop-29.32634931.enc","shop-30.366e2de1.enc","shop-31.cdb37927.enc","shop-32.4296e8e4.enc","shop-33.bd7dad9e.enc","shop-34.1a2b06f4.enc","shop-35.406bfb79.enc","shop-36.a5876a5d.enc","shop-37.e7422ba7.enc","shop-38.faff8bf0.enc","shop-39.36a671f8.enc","shop-40.c7ca1bfa.enc","shop-41.358e94d5.enc","shop-42.64a89c37.enc"];
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
