const CACHE = 'indie-catalog-ba703951';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.647e9c25.enc","crawl-log.c8459823.enc","store-history.264b69f6.enc","shop-00.1d592d4b.enc","shop-01.d1fe01b2.enc","shop-02.3fa23fab.enc","shop-03.b977ad4e.enc","shop-04.1e484a8f.enc","shop-05.e075d864.enc","shop-06.44f1ae41.enc","shop-07.2ba16535.enc","shop-08.8b380bcd.enc","shop-09.8d1d9db4.enc","shop-10.e1c62d57.enc","shop-11.7fc7dcec.enc","shop-12.20968d82.enc","shop-13.b44e3198.enc","shop-14.0cdf1231.enc","shop-15.d37baed5.enc","shop-16.5a2f4d46.enc","shop-17.d6dbcef6.enc","shop-18.f6d78655.enc","shop-19.c9b1e313.enc","shop-20.498ee69f.enc","shop-21.0a83e883.enc","shop-22.3655b962.enc","shop-23.5bb9c190.enc","shop-24.34d33d7c.enc","shop-25.37fb5461.enc","shop-26.420205da.enc","shop-27.fb95c90c.enc","shop-28.33eb43fa.enc","shop-29.9c2620e3.enc","shop-30.6a885721.enc","shop-31.eed92220.enc","shop-32.4296e8e4.enc","shop-33.c7358cb0.enc","shop-34.749bcbb5.enc","shop-35.c8d04c8c.enc","shop-36.04326128.enc","shop-37.ec6aa535.enc","shop-38.4c383471.enc","shop-39.9b2c301f.enc","shop-40.904fbbe0.enc","shop-41.74045884.enc","shop-42.938f8a8a.enc"];
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
