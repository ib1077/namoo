const CACHE_NAME = "station-signage-v7";
const APP_SHELL = ["./", "./index.html", "./style.css", "./app.js", "./book.json", "./manifest.webmanifest", "./icons/icon.svg", "./icons/maskable.svg", "./icons/apple-touch-icon.svg", "./images/ic-voice.png", "./images/ic-guide-01.png", "./images/ic-guide-02.png", "./images/dadada.jpg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});
