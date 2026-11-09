// Minimal service worker so the phone can install the app to the home screen.
// No offline cache: the assistant needs the network anyway.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
