const CACHE_NAME = "goldencar-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Keep network behavior unchanged. The service worker exists to provide
// the PWA lifecycle/install capability without caching dynamic Supabase data.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
