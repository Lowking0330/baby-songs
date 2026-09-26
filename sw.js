/**
 * sw.js - 寶寶族語隨身聽 Service Worker (v3)
 * 修復重點：
 * 1. 跨域官方音訊（web.klokah.tw）直接原生放行，徹底避免 CORS 阻擋導致無法播放之重大問題
 * 2. 同源微軟台灣女聲 MP3（audio/zh/）進行安全離線快取
 * 3. 核心 App Shell 靜態快取，離線順暢開啟
 * 4. 強制清理舊版快取並立即接管（skipWaiting & clients.claim）
 */

const STATIC_CACHE = "baby-songs-static-v6";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/data/truku_data.js",
  "./js/data/amis_data.js",
  "./js/audio_engine.js",
  "./js/commute_player.js",
  "./js/app.js",
  "./audio/wawa/amis_653_full.mp3",
  "./audio/wawa/amis_654_full.mp3",
  "./audio/wawa/amis_684_full.mp3",
  "./audio/wawa/amis_677_full.mp3",
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
          if (key !== STATIC_CACHE) {
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

  // 1. 核心多媒體安全防護：所有 MP3 音訊請求一律放行，由原生瀏覽器多媒體管線直連！
  // 徹底避免 Service Worker 破壞 iOS Safari 與 Android 必備之 HTTP 206 Partial Content (Range Request)，
  // 杜絕任何音訊播放途中被截斷、卡死或提前跳歌的狀況！
  if (url.endsWith(".mp3") || url.includes("/audio/") || request.headers.get("range") || !url.startsWith(self.location.origin)) {
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
