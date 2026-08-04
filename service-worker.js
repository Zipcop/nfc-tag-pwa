const CACHE_NAME = "nfc-aktionen-v4";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./setup.html",
  "./style.css",
  "./icons.js",
  "./app.js",
  "./dashboard.js",
  "./action.js",
  "./setup.js",
  "./nfc-tools.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur eigene GET-Requests behandeln - Benachrichtigungen (ntfy.sh) und
  // sonstige externe/POST-Requests laufen unverändert direkt ans Netzwerk.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).catch(() => cached);
    })
  );
});
