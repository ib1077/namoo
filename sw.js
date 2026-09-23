const CACHE = "kossori-daddaa-v1";
const FILES = [
  "./", "./index.html", "./style.css", "./app.js", "./book.json", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/maskable.svg", "./icons/apple-touch-icon.svg",
  "./images/01.svg", "./images/02.svg", "./images/03.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html"))));
});
