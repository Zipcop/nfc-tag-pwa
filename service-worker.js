const CACHE_NAME = "nfc-aktionen-v10";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./setup.html",
  "./style.css",
  "./icons.js",
  "./theme-generator.js",
  "./native.js",
  "./app.js",
  "./dashboard.js",
  "./action.js",
  "./setup.js",
  "./nfc-tools.js",
  "./lock.js",
  "./push.js",
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

  // Nur eigene GET-Requests behandeln - Benachrichtigungen (nfc-push-worker)
  // und sonstige externe/POST-Requests laufen unverändert direkt ans Netzwerk.
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

self.addEventListener("push", (event) => {
  let data = { title: "NFC Aktionen", body: "" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    /* Unerwartetes Format - bei den Default-Werten bleiben statt abzustürzen */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "NFC Aktionen", {
      body: data.body || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }
    })
  );
});
