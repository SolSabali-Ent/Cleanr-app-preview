/* One-time cleanup worker for the GitHub Pages migration.
 * Removes stale Cleanr PWA caches, unregisters itself, and reloads open clients.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      await self.clients.claim();
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      await self.registration.unregister();

      for (const client of windows) {
        try {
          await client.navigate(client.url);
        } catch {
          // A manual refresh will complete cleanup if navigation is unavailable.
        }
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
