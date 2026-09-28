const CACHE_NAME = "ehon-signage-v10";
const APP_SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest",
  "./data/station.json", "./data/dadada.json",
  "./icons/icon.svg", "./icons/apple-touch-icon.svg", "./icons/maskable.svg",
  "./images/station/ic-staff.png", "./images/station/ic-guide-01.png", "./images/station/ic-guide-02.png",
  "./images/dadada/01.jpg"
];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // 内蔵絵本に追加したページも初回インストールで保存する。
    for (const path of ["./data/station.json", "./data/dadada.json"]) {
      const response = await cache.match(path);
      const data = await response.json();
      const pages = data.pages || data;
      const images = pages.map(page => page.image).filter(Boolean);
      await cache.addAll([...new Set(images)]);
    }
  })());
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match("./index.html")))
  );
});

