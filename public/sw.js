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


self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "" }; }
  const title = typeof data.title === "string" ? data.title : "GOLDENCAR";
  const options = {
    body: typeof data.body === "string" ? data.body : "Hai una nuova notifica.",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: typeof data.tag === "string" ? data.tag : "goldencar-notification",
    data: { url: typeof data.url === "string" ? data.url : "/" },
    renotify: false,
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target.href);
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
