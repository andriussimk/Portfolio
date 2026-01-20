// Bump version to force clients to refresh cached assets after deployments.
const VERSION = "v4";
const CORE = [
  "/",
  "/index.html",
  "/galleries.html",
  "/collection.html",
  "/src/styles/base.css",
  "/src/styles/layout.css",
  "/src/main.js"
];
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)));
});
self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))
    ))
  );
});
self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);
  // Never cache admin UI/assets.
  if (url.pathname.startsWith('/adminPanel') || url.pathname.startsWith('/assets/adminPanel')) return;
  if(url.pathname.includes("/photo-collections/")){
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(VERSION).then(c=>c.put(e.request, copy));
        return res;
      }))
    );
  }
});