const cacheName = "open-spelling-bee-1.2.3";
const cacheFiles = [
  "/",
  "/index.html",
  "/words/en.json.gz",
  // 3rd party libraries
  "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js/+esm",
  "https://cdn.jsdelivr.net/npm/idb@7/+esm",
  "https://cdn.jsdelivr.net/npm/tsparticles-confetti@2.9.3/tsparticles.confetti.bundle.min.js/+esm",
];

self.addEventListener("install", (e) => {
  // The promise that skipWaiting() returns can be safely ignored.
  self.skipWaiting();

  e.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.addAll(cacheFiles);
    })()
  );
});

self.addEventListener("fetch", (e) => {
  // Skip requests that aren't http(s)
  if (!(e.request.url.indexOf("http") === 0)) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(e.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      const response = await fetch(e.request);
      cache.put(e.request, response.clone());
      return response;
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== cacheName) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});
