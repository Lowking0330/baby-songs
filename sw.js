/**
 * sw.js - 寶寶族語隨身聽 Service Worker (v7)
 * 修復重點：
 * 1. 所有 119 首兒歌已 100% 本地化自託管（audio/wawa, audio/chart, audio/classic），徹底脫離 web.klokah.tw 503 當機影響
 * 2. 所有 MP3 音訊請求一律原生直連，完整支援 iOS/Android HTTP 206 Range Request
 * 3. 核心程式碼採用 Network-First（網路優先，離線降級快取），確保每次更新一刷新立即生效
 */

const STATIC_CACHE = "baby-songs-static-v7";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/data/truku_data.js",
  "./js/data/amis_data.js",
  "./js/audio_engine.js",
  "./js/commute_player.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = request.url;

  // 所有音訊請求一律放行，由原生瀏覽器多媒體管線直連
  if (url.endsWith(".mp3") || url.includes("/audio/") || request.headers.get("range") || !url.startsWith(self.location.origin)) {
    return;
  }

  // Network-First 策略：確保最新程式碼與音訊路徑立即生效，離線時自動回退快取
  event.respondWith(
    fetch(request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const clone = networkResponse.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
