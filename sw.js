const CACHE = 'indie-catalog-13e5d65c';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.1843558d.enc","crawl-log.241fa3b2.enc","store-history.0c6ae9fd.enc","shop-00.a1914c9c.enc","shop-01.0f08b7b0.enc","shop-02.d3ebaf77.enc","shop-03.88f4aa65.enc","shop-04.5943206d.enc","shop-05.cd80a712.enc","shop-06.6cc7ed68.enc","shop-07.78e9268f.enc","shop-08.9761b090.enc","shop-09.2c09f23d.enc","shop-10.5c3d3212.enc","shop-11.f8e7853a.enc","shop-12.a3bff71d.enc","shop-13.a04daad3.enc","shop-14.2268c6b2.enc","shop-15.7297f5e8.enc","shop-16.7d5cee5e.enc","shop-17.7f30399a.enc","shop-18.fd8397df.enc","shop-19.cf159562.enc","shop-20.ec77d62d.enc","shop-21.84800228.enc","shop-22.935583f7.enc","shop-23.95e1332e.enc","shop-24.cb4688e0.enc","shop-25.eea8297e.enc","shop-26.88970d43.enc","shop-27.d34d7404.enc","shop-28.96280a63.enc","shop-29.66c29e9f.enc","shop-30.514427eb.enc","shop-31.eadcd4f9.enc","shop-32.4296e8e4.enc","shop-33.71979c6e.enc","shop-34.94ac8265.enc","shop-35.d64342a7.enc","shop-36.10bd71b0.enc","shop-37.d9cd1dd5.enc","shop-38.23f42eaa.enc","shop-39.0e65668f.enc","shop-40.1b21ec2c.enc","shop-41.5e9b611a.enc","shop-42.bef05e45.enc"];
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
