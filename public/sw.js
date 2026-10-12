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

// Intentionally no fetch handler: let the browser handle requests normally.
// This avoids unhandled "Failed to fetch" rejections and does not cache dynamic
// Supabase data or interfere with APIs, uploads, microphone, or external sites.
