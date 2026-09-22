/**
 * audio_engine.js - 幼兒族語播放器：背景長效常駐音訊核心
 * 參考自 D:\Antigravity_plans_202609\tools\English 之隨身聽持久引擎
 * 核心特色：
 * 1. Persistent Primary Audio：單一 Audio 實例，手勢解鎖後重複換源播放，防止行動裝置中斷
 * 2. Silent Audio Anchor：0.0001 微弱靜音音軌循環，鎖定螢幕與間隔停頓時防止 JS 計時器遭系統凍結
 * 3. MediaSession API：支援手機鎖屏、通知列、藍牙耳機線控、手錶同步顯示曲名與切換
 * 4. Screen Wake Lock：螢幕點亮時防止休眠；息屏時無縫移交背景音訊管線
 */

const AudioEngine = (function() {
  let primaryAudio = null;
  let silentAudio = null;
  let wakeLock = null;
  let isUnlocked = false;

  // 初始化持久化主音訊實例
  function initPrimaryAudio() {
    if (!primaryAudio && typeof Audio !== "undefined") {
      primaryAudio = new Audio();
      primaryAudio.preload = "auto";
      primaryAudio.playsInline = true;
      primaryAudio.setAttribute("playsinline", "true");
      primaryAudio.setAttribute("webkit-playsinline", "true");
    }
  }

  // 初始化靜音背景錨定音訊（極微弱 volume 0.0001 循環，維持行動裝置 Audio Pipeline 活躍）
  function initSilentAudio() {
    if (!silentAudio && typeof document !== "undefined") {
      silentAudio = document.createElement("audio");
      silentAudio.loop = true;
      silentAudio.volume = 0.0001;
      silentAudio.playsInline = true;
      silentAudio.setAttribute("playsinline", "true");
      silentAudio.setAttribute("webkit-playsinline", "true");
      // 1-pixel silent WAV (data URI)
      silentAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w==";
    }
  }

  function startSilentAudio() {
    initSilentAudio();
    if (silentAudio) {
      try {
        silentAudio.currentTime = 0;
        const p = silentAudio.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (e) {}
    }
  }

  function stopSilentAudio() {
    if (silentAudio) {
      try {
        silentAudio.pause();
      } catch (e) {}
    }
  }

  // 螢幕保持喚醒（Wake Lock）
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch (e) {
      // 部分瀏覽器安全策略或未支援，忽略
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try {
        wakeLock.release().catch(() => {});
      } catch (e) {}
      wakeLock = null;
    }
  }

  // 頁面可見度變化時動態維護 Wake Lock
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && primaryAudio && !primaryAudio.paused) {
        requestWakeLock();
      }
    });
  }

  // 解鎖使用者手勢音訊權限（iOS / Android 規範）
  function unlockUserGesture() {
    if (isUnlocked) return;
    initPrimaryAudio();
    initSilentAudio();
    startSilentAudio();
    isUnlocked = true;
  }

  // 播放指定音訊 URL
  function playUrl(url, playbackRate, onEnded, onError) {
    initPrimaryAudio();
    startSilentAudio();
    requestWakeLock();

    let hasEnded = false;

    // 清理舊回呼
    primaryAudio.onended = null;
    primaryAudio.onerror = null;

    primaryAudio.onended = () => {
      if (hasEnded) return;
      hasEnded = true;
      primaryAudio.onended = null;
      primaryAudio.onerror = null;
      if (typeof onEnded === "function") onEnded();
    };

    primaryAudio.onerror = (err) => {
      if (hasEnded) return;
      hasEnded = true;
      primaryAudio.onended = null;
      primaryAudio.onerror = null;
      console.warn("AudioEngine playUrl error:", err, url);
      if (typeof onError === "function") onError(err);
      else if (typeof onEnded === "function") onEnded(); // 自動降級接續
    };

    try {
      primaryAudio.src = url;
      primaryAudio.playbackRate = playbackRate || 1.0;
      const playPromise = primaryAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
            // 使用者手動切換或暫停，非真實播放錯誤
            return;
          }
          if (hasEnded) return;
          hasEnded = true;
          if (typeof onError === "function") onError(err);
          else if (typeof onEnded === "function") onEnded();
        });
      }
    } catch (e) {
      if (!hasEnded && typeof onEnded === "function") onEnded();
    }
  }

  // 暫停主音訊
  function pause() {
    if (primaryAudio) {
      try {
        primaryAudio.pause();
      } catch (e) {}
    }
    stopSilentAudio();
    releaseWakeLock();
    updateMediaSessionState(false);
  }

  // 停止主音訊
  function stop() {
    if (primaryAudio) {
      try {
        primaryAudio.onended = null;
        primaryAudio.onerror = null;
        primaryAudio.pause();
        primaryAudio.currentTime = 0;
        primaryAudio.removeAttribute("src");
        primaryAudio.src = "";
        try { primaryAudio.load(); } catch (e) {}
      } catch (e) {}
    }
    stopSilentAudio();
    releaseWakeLock();
    updateMediaSessionState(false);
  }

  // 取得目前主音訊是否播放中
  function isPlaying() {
    return primaryAudio && !primaryAudio.paused && !primaryAudio.ended && primaryAudio.currentTime > 0;
  }

  // 設定語速
  function setPlaybackRate(rate) {
    if (primaryAudio) {
      primaryAudio.playbackRate = rate;
    }
  }

  // 繁體中文語音合成朗讀（針對例句與詞彙翻譯，若不支援則降級直接完成）
  function speakChinese(text, onEnded) {
    if (!text || typeof window === "undefined" || !('speechSynthesis' in window)) {
      if (typeof onEnded === "function") onEnded();
      return;
    }

    // 啟動靜音音軌以防在 TTS 過程中被系統掛起
    startSilentAudio();

    try {
      window.speechSynthesis.cancel();
      const pureText = text.replace(/[\(\)（）\[\]【】]/g, "").trim();
      if (!pureText) {
        if (typeof onEnded === "function") onEnded();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(pureText);
      utterance.lang = "zh-TW";
      utterance.rate = 0.92; // 幼兒聽力溫和清晰語速

      // 優先尋找正港台灣女聲（微軟 HsiaoChen/Mei-Jia, 漢漢, 雅婷等），避免機械音或非台灣腔調
      if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.getVoices) {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const twVoice = voices.find(v => (v.lang === 'zh-TW' || v.lang === 'zh_TW') && /HsiaoChen|Mei-Jia|Hanhan|Yating|Zhiwei|Taiwan|臺灣|台灣/i.test(v.name))
            || voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW');
          if (twVoice) {
            utterance.voice = twVoice;
          }
        }
      }

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        utterance.onend = null;
        utterance.onerror = null;
        if (typeof onEnded === "function") onEnded();
      };

      utterance.onend = done;
      utterance.onerror = done;

      // 防呆計時器（語音合成若在鎖屏時被特定系統掛起，最多 4 秒後自動推進）
      setTimeout(done, 4000);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (typeof onEnded === "function") onEnded();
    }
  }

  // 設置手機原生鎖定畫面 MediaSession 控制項
  function setupMediaSession(handlers) {
    if (typeof navigator === "undefined" || !('mediaSession' in navigator)) return;
    try {
      if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
    } catch (e) {}
  }

  // 更新手機鎖定畫面資訊（標題、族群語言、中文意涵、封面）
  function updateMediaSessionMetadata(meta) {
    if (typeof navigator === "undefined" || !('mediaSession' in navigator)) return;
    const MediaMeta = (typeof window !== "undefined" && window.MediaMetadata) ? window.MediaMetadata : (typeof MediaMetadata !== "undefined" ? MediaMetadata : null);
    if (!MediaMeta) return;
    try {
      navigator.mediaSession.metadata = new MediaMeta({
        title: meta.title || "族語歌謠聽力播放",
        artist: meta.artist || meta.sub || "幼兒族語啟蒙",
        album: meta.album || "太魯閣語 ＆ 海岸阿美語",
        artwork: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      });
      navigator.mediaSession.playbackState = "playing";
    } catch (e) {}
  }

  function updateMediaSessionState(isPlaying) {
    if (typeof navigator === "undefined" || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch (e) {}
  }

  return {
    unlockUserGesture,
    playUrl,
    pause,
    stop,
    isPlaying,
    setPlaybackRate,
    speakChinese,
    setupMediaSession,
    updateMediaSessionMetadata,
    updateMediaSessionState,
    startSilentAudio,
    stopSilentAudio,
    requestWakeLock,
    releaseWakeLock
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AudioEngine;
}
