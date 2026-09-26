const CACHE = 'indie-catalog-4143064d';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.b0d7f524.enc","crawl-log.64fcd8ff.enc","store-history.f37adab9.enc","shop-00.df343eda.enc","shop-01.67410a21.enc","shop-02.67a8a786.enc","shop-03.1c23d2cc.enc","shop-04.3f374f1a.enc","shop-05.08cc3e5e.enc","shop-06.4a340ca2.enc","shop-07.b7a38bda.enc","shop-08.833b2582.enc","shop-09.168fb6cf.enc","shop-10.540218ca.enc","shop-11.d8683d87.enc","shop-12.6253657b.enc","shop-13.fa30b276.enc","shop-14.0404a7d1.enc","shop-15.7586718c.enc","shop-16.83dd86d2.enc","shop-17.fb2ab5dc.enc","shop-18.1a8f830e.enc","shop-19.d39de921.enc","shop-20.217e1f9f.enc","shop-21.2ca0f507.enc","shop-22.9415415d.enc","shop-23.0c20856b.enc","shop-24.327f203f.enc","shop-25.68c7a6d6.enc","shop-26.2e078e49.enc","shop-27.2ff17c88.enc","shop-28.259788ac.enc","shop-29.be3f84fa.enc","shop-30.8f024364.enc","shop-31.e9c35ebc.enc","shop-32.5c63b75a.enc","shop-33.4296e8e4.enc","shop-34.83c7b4c9.enc","shop-35.01ab83da.enc","shop-36.60791b96.enc","shop-37.8987e589.enc","shop-38.e13d3ef6.enc","shop-39.cf14febd.enc","shop-40.e9db32b3.enc","shop-41.41f4b2f1.enc","shop-42.7f2e213e.enc","shop-43.30b50c7c.enc","shop-44.b360bd76.enc","shop-45.726fc830.enc"];
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
