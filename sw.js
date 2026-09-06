// 别绷了 · 离线缓存 Service Worker（改资源列表后记得更新 CACHE 版本号）
const CACHE = "biebengle-v4";
const ASSETS = ["./", "./index.html", "./js/core.js", "./manifest.webmanifest", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
          })
          .catch(() => caches.match("./index.html"))
    )
  );
});
