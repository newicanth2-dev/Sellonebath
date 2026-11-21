// Service Worker สำหรับ คุ้มเว่อร์ 1 บาท (PWA)
const CACHE_NAME = "kumver1baht-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./product.html",
  "./category.html",
  "./manifest.json",
  "./Logo.png",
  "./assets/css/base.css",
  "./assets/css/desktop.css",
  "./assets/css/mobile.css",
  "./assets/js/store.js",
  "./assets/js/category.js",
  "./assets/js/product.js"
];

// 1. Install & pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Service Worker pre-cache error:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate & cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch with Network-First strategy for pages, Stale-While-Revalidate for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ข้ามคำขอที่ไม่ใช่ GET หรือเป็น Supabase API
  if (event.request.method !== "GET" || url.origin.includes("supabase.co")) {
    return;
  }

  // สำหรับ static assets ภายในเว็บ
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
            return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
          });
        })
    );
  }
});
