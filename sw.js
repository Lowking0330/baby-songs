/**
 * sw.js - 寶寶族語隨身聽 Service Worker (v3)
 * 修復重點：
 * 1. 跨域官方音訊（web.klokah.tw）直接原生放行，徹底避免 CORS 阻擋導致無法播放之重大問題
 * 2. 同源微軟台灣女聲 MP3（audio/zh/）進行安全離線快取
 * 3. 核心 App Shell 靜態快取，離線順暢開啟
 * 4. 強制清理舊版快取並立即接管（skipWaiting & clients.claim）
 */

const STATIC_CACHE = "baby-songs-static-v4";
const AUDIO_CACHE = "baby-songs-audio-v4";

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

// 安裝階段：預先快取核心 App Shell 並立即生效
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

// 啟動階段：徹底清理所有舊版本快取並立即接管控制權
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== AUDIO_CACHE) {
            console.log("清理舊版快取:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 請求攔截
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = request.url;

  // 1. 關鍵防護：非同源請求（如原民會 web.klokah.tw 官方音訊）直接放行！
  // 絕對不呼叫 respondWith，讓瀏覽器原生多媒體管道直連，完全不受跨域 CORS 阻擋限制。
  if (!url.startsWith(self.location.origin)) {
    return;
  }

  // 2. 本機同源 MP3 音訊快取 (audio/)
  if (url.includes("/audio/") && url.endsWith(".mp3")) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // 3. 靜態資產：Cache First with Network Fallback
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      if (request.mode === "navigate") {
        return caches.match("./index.html");
      }
    })
  );
});
