/* Offline support: cache the app shell, serve cache first, refresh in the background. */
var CACHE = "msl-v3";
var FILES = [
  "./",
  "index.html",
  "tool.html",
  "src/site.css",
  "src/site.js",
  "findings.html",
  "src/calc.js",
  "src/app.js",
  "src/findings.js",
  "src/styles.css",
  "manifest.webmanifest",
  "icon.svg",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request, { ignoreSearch: true }).then(function (hit) {
        var network = fetch(e.request).then(function (res) {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || network;
      });
    })
  );
});
