const cacheName = "open-spelling-bee-0.10.2";
const cacheFiles = ["/index.html", "/js/main.mjs"];

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
      const parsedRequestURL = new URL(e.request.url);
      if (
        parsedRequestURL.hostname === "cdn.jsdelivr.net" ||
        parsedRequestURL.pathname.startsWith("/words/")
      ) {
        // Cache CDN and word set responses
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
