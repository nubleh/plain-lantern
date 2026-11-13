const CACHE = 'indie-catalog-537e7ad1';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.647e9c25.enc","crawl-log.0c646c0e.enc","store-history.c735c2fb.enc","shop-00.d9f8ea0b.enc","shop-01.20cfda1d.enc","shop-02.6ded98a0.enc","shop-03.9227242e.enc","shop-04.6e1bcf47.enc","shop-05.9aac7b0f.enc","shop-06.231e3a6b.enc","shop-07.b1be3860.enc","shop-08.0f465772.enc","shop-09.dde89f00.enc","shop-10.da81a57f.enc","shop-11.d4c08ba0.enc","shop-12.93edec51.enc","shop-13.f4dba8a0.enc","shop-14.cdd559fa.enc","shop-15.3968aced.enc","shop-16.bc9b0e2c.enc","shop-17.b4c815be.enc","shop-18.d6967cf0.enc","shop-19.618de1b9.enc","shop-20.b81315a8.enc","shop-21.7ead7fa8.enc","shop-22.656eaa90.enc","shop-23.936ff307.enc","shop-24.90c662d3.enc","shop-25.bae1fdec.enc","shop-26.4eb4aeb7.enc","shop-27.cae2a07b.enc","shop-28.17636f95.enc","shop-29.3a372b3f.enc","shop-30.5dbb7016.enc","shop-31.41436bbb.enc","shop-32.4296e8e4.enc","shop-33.fb035cd0.enc","shop-34.94017aa0.enc","shop-35.3de2a286.enc","shop-36.176ad7d1.enc","shop-37.a3b55937.enc","shop-38.acf4ef5d.enc","shop-39.60cbfefb.enc","shop-40.8756a7d6.enc","shop-41.e989b2e4.enc","shop-42.2be8ace5.enc"];
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
