/**
 * sw.js - 寶寶族語隨身聽 Service Worker
 * 支援：
 * 1. 核心 App Shell 靜態離線快取（斷網秒開）
 * 2. 族語官方 MP3 與微軟中文 MP3 智慧快取（Cache First with Network Fallback）
 * 3. 完美支援 iOS Safari / Android 音訊 Range Request (HTTP 206 Partial Content)
 * 4. 支援背景批次預先快取指令
 */

const STATIC_CACHE = "baby-songs-static-v2";
const AUDIO_CACHE = "baby-songs-audio-v2";

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

// 安裝階段：預先快取核心 App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// 啟動階段：清理舊版本快取
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== AUDIO_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 判斷是否為音訊請求
function isAudioRequest(url) {
  return url.endsWith(".mp3") ||
         url.includes("/sound/") ||
         url.includes("/wawa/") ||
         url.includes("/audio/") ||
         url.includes("klokah.tw");
}

// 構造 HTTP 206 Partial Content Response（支援 Safari Range 請求）
async function createRangeResponse(response, rangeHeader) {
  const arrayBuffer = await response.arrayBuffer();
  const totalLength = arrayBuffer.byteLength;
  
  // 解析 Range: bytes=start-end
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

  if (start >= totalLength || end >= totalLength) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${totalLength}` }
    });
  }

  const slicedBuffer = arrayBuffer.slice(start, end + 1);
  return new Response(slicedBuffer, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${totalLength}`,
      "Content-Length": slicedBuffer.byteLength,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000"
    }
  });
}

// 處理音訊請求：Cache First with Network Fallback
async function handleAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = request.url;
  let cachedResponse = await cache.match(cacheKey, { ignoreSearch: true });

  const rangeHeader = request.headers.get("range");

  // 快取中有完整音訊
  if (cachedResponse) {
    if (rangeHeader && cachedResponse.status === 200) {
      return createRangeResponse(cachedResponse.clone(), rangeHeader);
    }
    return cachedResponse;
  }

  // 快取中沒有，透過網路獲取完整音訊並寫入快取
  try {
    // 發起不帶 Range 的普通請求以取得完整音訊
    const netResponse = await fetch(request.url, {
      method: "GET",
      headers: { Accept: "*/*" },
      mode: "cors"
    });

    if (netResponse && netResponse.status === 200) {
      // 複製一份存入快取
      cache.put(cacheKey, netResponse.clone());

      if (rangeHeader) {
        return createRangeResponse(netResponse.clone(), rangeHeader);
      }
      return netResponse;
    }

    return netResponse;
  } catch (err) {
    // 斷網且無快取
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

// 請求攔截
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = request.url;

  // 1. 音訊請求
  if (isAudioRequest(url)) {
    event.respondWith(handleAudio(request));
    return;
  }

  // 2. 靜態資產：Cache First, Network Fallback
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
      // 離線回退
      if (request.mode === "navigate") {
        return caches.match("./index.html");
      }
    })
  );
});

// 支援來自主頁面的批次預載訊息
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "PRECACHE_AUDIO_LIST" && Array.isArray(data.urls)) {
    caches.open(AUDIO_CACHE).then(async (cache) => {
      let cachedCount = 0;
      for (const url of data.urls) {
        const match = await cache.match(url, { ignoreSearch: true });
        if (!match) {
          try {
            const resp = await fetch(url, { mode: "cors" });
            if (resp && resp.status === 200) {
              await cache.put(url, resp);
              cachedCount++;
            }
          } catch (e) {}
        } else {
          cachedCount++;
        }
      }
      // 回報進度給 client
      event.source.postMessage({
        type: "PRECACHE_PROGRESS",
        total: data.urls.length,
        cached: cachedCount
      });
    });
  }
});
