const CACHE_NAME = "station-signage-v8";
const APP_SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./book.json", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/maskable.svg", "./icons/apple-touch-icon.svg",
  "./images/ic-voice.png", "./images/ic-guide-01.png", "./images/ic-guide-02.png",
  "./images/dadada-01.jpg", "./images/dadada-02.jpg", "./images/dadada-03.jpg",
  "./images/dadada-04.jpg", "./images/dadada-05.jpg", "./images/dadada-06.jpg",
  "./images/dadada-07.jpg", "./images/dadada-08.jpg", "./images/dadada-09.jpg",
  "./images/dadada-10.jpg", "./images/dadada-11.jpg", "./images/dadada-12.jpg",
  "./images/dadada-13.jpg", "./images/dadada-14.jpg", "./images/dadada-15.jpg",
  "./images/dadada-16.jpg", "./images/dadada-17.jpg", "./images/dadada-18.jpg",
  "./images/dadada-19.jpg", "./images/dadada-20.jpg", "./images/dadada-21.jpg"
];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});
