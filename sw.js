const CACHE = 'indie-catalog-a9d021a7';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.a6c19c96.enc","crawl-log.833ff424.enc","store-history.18265ba8.enc","shop-00.c421f2e2.enc","shop-01.a840c2c2.enc","shop-02.f705d289.enc","shop-03.38c6732f.enc","shop-04.9263c754.enc","shop-05.b3cd9bdd.enc","shop-06.a97007f4.enc","shop-07.32ba5b17.enc","shop-08.5d623a05.enc","shop-09.3e56ea27.enc","shop-10.23a5ba47.enc","shop-11.29e9a1a5.enc","shop-12.0a312492.enc","shop-13.3c3b92a2.enc","shop-14.ed384cf5.enc","shop-15.49f3317c.enc","shop-16.d4b704b8.enc","shop-17.08524ab1.enc","shop-18.c74bb50f.enc","shop-19.071066ad.enc","shop-20.1cccb676.enc","shop-21.dbf96cae.enc","shop-22.140e8a68.enc","shop-23.295659dc.enc","shop-24.83c53241.enc","shop-25.ba6337c9.enc","shop-26.c923998e.enc","shop-27.9e16fab5.enc","shop-28.874d054c.enc","shop-29.078e9c1d.enc","shop-30.7466edc3.enc","shop-31.4def23b2.enc","shop-32.e4aa0285.enc","shop-33.4296e8e4.enc","shop-34.d84346e3.enc","shop-35.744c56a7.enc","shop-36.ea9fbc16.enc","shop-37.0eee5051.enc","shop-38.e7e4781d.enc","shop-39.d66eb57e.enc","shop-40.68401de3.enc","shop-41.5fd6cffb.enc","shop-42.d6568b03.enc","shop-43.d1afdfec.enc","shop-44.8560775c.enc","shop-45.37815c84.enc"];
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
