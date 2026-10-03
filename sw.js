importScripts('./version.js');
const CACHE_PREFIX = 'ehon-pwa-';
const CACHE_NAME = CACHE_PREFIX + EHON_VERSION;
const SHELL = ['./', './index.html', './version.js', './update.js', './app.js', './style.css', './manifest.webmanifest', './catalog.json', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
const READY = new URL('./__offline_ready__', self.registration.scope).href;
self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  async function save(path) {
   const url = new URL(path, self.registration.scope);
   if (!url.href.startsWith(self.registration.scope)) throw new Error('Out of scope');
   const response = await fetch(new Request(url.href, {cache:'reload'}));
   if (!response.ok) throw new Error('Fetch failed: ' + path);
   await cache.put(url.href, response.clone());
   return response;
  }
  try {
   for (const file of SHELL) await save(file);
   const catalog = await (await cache.match(new URL('./catalog.json', self.registration.scope).href)).json();
   for (const item of catalog) {
    if (!item.data) continue;
    const data = await (await save(item.data)).json();
    for (const image of new Set((data.pages || data).map(p => p.image).filter(Boolean))) await save(image);
   }
   await cache.put(READY, new Response(EHON_VERSION));
  } catch (error) {
   await caches.delete(CACHE_NAME);
   throw error;
  }
 })());
});
self.addEventListener('message', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  const ready = !!(await cache.match(READY));
  if (event.data?.type === 'STATUS') event.ports[0]?.postMessage({version:EHON_VERSION, ready});
  if (event.data?.type === 'ACTIVATE' && ready) await self.skipWaiting();
 })());
});
self.addEventListener('activate', event => {
 // Retain previous working caches; never touch user data or another app.
 event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
 event.respondWith((async () => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  if (event.request.mode === 'navigate') return (await cache.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
  try { return await fetch(event.request); } catch (_) { return Response.error(); }
 })());
});
