// Minimal service worker — just enough to satisfy PWA installability.
// No offline caching: config.js/index.html should always come from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
