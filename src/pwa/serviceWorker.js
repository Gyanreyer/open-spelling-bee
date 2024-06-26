const cacheName = "open-spelling-bee-1.4.3";

const wordDataPathname = "/words/en";

self.addEventListener("install", (e) => {
  // The promise that skipWaiting() returns can be safely ignored.
  self.skipWaiting();

  e.waitUntil(
    caches.open(cacheName).then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        // 3rd party libraries
        "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js/+esm",
        "https://cdn.jsdelivr.net/npm/@tsparticles/confetti@3.0.3/tsparticles.confetti.bundle.min.js/+esm",
      ])
    )
  );
});

/**
 * @param {Date} date
 */
const getDateTimestamp = (date) =>
  `${date.getFullYear()}${date.getMonth().toString().padStart(2, "0")}${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;

self.addEventListener("activate", (e) => {
  // Claim all clients immediately, so the service worker can control
  // initial requests
  self.clients.claim();

  // Clean up cached requests from previous versions
  e.waitUntil(
    Promise.all([
      caches.keys().then((keyList) =>
        Promise.all(
          keyList.map((key) => {
            if (key !== cacheName) {
              caches.delete(key);
            }
          })
        )
      ),
      caches.open(cacheName).then((cache) =>
        cache.keys().then((requests) => {
          // Delete all cached word data requests from days other than today and yesterday
          const date = new Date();
          const todayTimestampString = getDateTimestamp(date);

          date.setDate(date.getDate() - 1);
          const yesterdayTimestampString = getDateTimestamp(date);

          return Promise.all(
            requests.map((request) => {
              const requestURL = new URL(request.url);
              if (requestURL.pathname === wordDataPathname) {
                const requestTimestamp = requestURL.searchParams.get("t");
                if (
                  requestTimestamp === todayTimestampString ||
                  requestTimestamp === yesterdayTimestampString
                ) {
                  return;
                }

                return cache.delete(request);
              }
            })
          );
        })
      ),
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const requestURL = new URL(e.request.url);

  // Skip requests that aren't http(s)
  if (requestURL.protocol !== "http:" && requestURL.protocol !== "https:") {
    return;
  }

  if (requestURL.pathname === wordDataPathname) {
    return e.respondWith(handleWordDataRequest(requestURL));
  }

  // Auto-cache all other requests
  e.respondWith(
    caches.open(cacheName).then((cache) =>
      cache.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((response) => {
          cache.put(e.request, response.clone());
          return response;
        });
      })
    )
  );
});

/**
 * @param {Event} e
 * @param {URL} requestURL
 */
async function handleWordDataRequest(requestURL) {
  /** @type {number} */
  let date = new Date();

  if (requestURL.searchParams.get("d") === "yesterday") {
    date.setDate(date.getDate() - 1);
  }

  requestURL.searchParams.delete("d");

  // Set the timestamp to midnight of the current day, in UTC
  // to make sure everyone gets the same words for the day regardless of timezone
  const dateTimestamp = getDateTimestamp(date);

  requestURL.searchParams.set("t", dateTimestamp);

  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(requestURL);
  if (cachedResponse) {
    return cachedResponse;
  }

  let cachedWordDataCompressedResponse = await cache.match("/words/en.json.gz");

  if (!cachedWordDataCompressedResponse) {
    cachedWordDataCompressedResponse = await fetch("/words/en.json.gz");
    await cache.put(
      "/words/en.json.gz",
      cachedWordDataCompressedResponse.clone()
    );
  }

  /** @type {string} */
  let fullWordDataJSONString = "";

  await cachedWordDataCompressedResponse.body
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream())
    .pipeTo(
      new WritableStream({
        write(chunk) {
          fullWordDataJSONString += chunk;
        },
      })
    );

  const fullWordData = JSON.parse(fullWordDataJSONString);

  const [allWords, letterSets, letterSetWordIndices] = fullWordData;

  /**
   * @param {number} seed
   * @returns {number}
   */
  const seededRandom = (seed) => {
    var t = seed + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const letterSetIndex = Math.floor(
    seededRandom(Number(dateTimestamp)) * letterSets.length
  );

  /** @type {string} */
  const letterSetString = letterSets[letterSetIndex];

  /** @type {string | null} */
  let centerLetter = null;

  /**
   * @type {string[]}
   */
  const outerLetters = new Array(6);
  let outerLetterIndex = 0;

  for (let i = 0; i < 7; ++i) {
    const letter = letterSetString[i];
    const charCode = letter.charCodeAt(0);
    if (charCode >= 65 && charCode <= 90) {
      // If the letter is uppercase, it's the center letter
      centerLetter = letter.toLowerCase();
    } else {
      outerLetters[outerLetterIndex++] = letter;
    }
  }

  if (centerLetter === null) {
    return Response.error();
  }

  const validWordIndices = letterSetWordIndices[letterSetIndex];

  const validWords = new Array(validWordIndices.length);
  for (let i = 0; i < validWordIndices.length; ++i) {
    validWords[i] = allWords[validWordIndices[i]];
  }

  const todayWordData = {
    ts: dateTimestamp,
    centerLetter,
    outerLetters,
    validWords,
  };

  const response = new Response(JSON.stringify(todayWordData));

  cache.put(requestURL, response.clone());
  return response;
}
