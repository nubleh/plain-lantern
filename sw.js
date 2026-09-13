const CACHE = 'indie-catalog-af6c4a16';
const MODULES_CACHE = 'indie-catalog-modules';
const FILES = ['./index.html', './sw.js', './manifest.json', './icon.png'];
const CURRENT_MODULES = ["shell.672009a5.enc","crawl-log.9956c741.enc","store-history.d2b519ef.enc","shop-00.553b1afd.enc","shop-01.3f490ebb.enc","shop-02.512dbea5.enc","shop-03.43683ca2.enc","shop-04.2057b710.enc","shop-05.13182444.enc","shop-06.c92e2930.enc","shop-07.138a815c.enc","shop-08.6a91a423.enc","shop-09.e481f814.enc","shop-10.56b2ea29.enc","shop-11.a75342af.enc","shop-12.8f0f6a68.enc","shop-13.041d24b3.enc","shop-14.6c90acaf.enc","shop-15.05d2836f.enc","shop-16.e27dff55.enc","shop-17.3ce8f78e.enc","shop-18.66425dbb.enc","shop-19.5028eb85.enc","shop-20.3c578190.enc","shop-21.b3273bad.enc","shop-22.ae609c73.enc","shop-23.42ce6b26.enc","shop-24.45bb0eef.enc","shop-25.a971633a.enc","shop-26.7b84463d.enc","shop-27.4296e8e4.enc","shop-28.1b771df6.enc","shop-29.eb8c6089.enc","shop-30.c0696465.enc","shop-31.0689fa15.enc","shop-32.6816138c.enc","shop-33.fdaa6e74.enc","shop-34.f36ee247.enc","shop-35.d6ef26ad.enc","shop-36.63cfeae0.enc","shop-37.f3ac0db6.enc"];
function isModuleUrl(url) {
  return /\/(shell|crawl-log|store-history)\.[a-f0-9]+\.enc$/.test(url) || /\/shop-[^/]+\.[a-f0-9]+\.enc$/.test(url);
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== MODULES_CACHE).map(k => caches.delete(k)))),
    caches.open(MODULES_CACHE).then(cache => cache.keys().then(reqs => Promise.all(
      reqs.filter(r => !CURRENT_MODULES.some(m => r.url.endsWith(m))).map(r => cache.delete(r))
    ))),
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
