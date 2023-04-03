const cacheName = "open-spelling-bee-0.5.0";
const cacheFiles = ["/index.html", "/words/en.json"];

self.addEventListener("install", (e) => {
  console.log("[Service Worker] Installed");
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
      const cachedResponse = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (cachedResponse) {
        return cachedResponse;
      }
      const response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      if (new URL(e.request.url).hostname === "cdn.jsdelivr.net") {
        // Cache CDN responses
        await cache.add(e.request);
      }
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
