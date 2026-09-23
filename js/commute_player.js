/**
 * commute_player.js - 幼兒族語「磨耳朵」自動連播核心控制器
 * 專為 1.5～3 歲幼兒打造：
 * 1. 支援「沉浸磨耳朵 (族語2次+中文1次)」、「純母語環境 (純族語2次)」、「歌謠連播」
 * 2. 整合 AudioEngine，具備靜音音軌循環錨定，即使關閉螢幕、開啟螢幕保護仍順暢連播
 * 3. 具備世代權杖安全排程器，切換或暫停絕不重疊
 * 4. 支援睡眠定時器（15分/30分/45分/60分）、隨機洗牌、間隔停頓時間
 */

const CommutePlayer = (function() {
  let currentLang = "truku"; // 'truku' 或 'amis'
  let currentCategory = "song_wawa"; // 'all', 'song_wawa', 'song_chart', 'dialogues', 'vocab_wawa', 'vocab_lima', 'song_classic'
  let playlist = [];
  let originalPlaylist = [];
  let currentIndex = 0;
  let isPlaying = false;

  // 播放模式：
  // 'repeat2_zh1': 族語 2 次 ＋ 中文 1 次（沉浸磨耳朵）
  // 'indigenous_only': 純族語 2 次（純母語環境，適合背景音或睡前）
  // 'repeat1_zh1': 族語 1 次 ＋ 中文 1 次
  // 'song_continuous': 兒歌整曲連播
  let playMode = "repeat2_zh1";

  let playbackRate = 0.9; // 預設 0.9x 溫和慢速，方便寶寶聽清發音細節
  let sentenceGap = 1.5; // 句子間隔停頓秒數 (1.0s, 1.5s, 2.0s, 3.0s)
  let isShuffle = false;
  let isLoopAll = true; // 預設整輪無限循環播放

  // 寶寶最愛收藏清單 (Set)
  let favoritesSet = new Set();

  function getItemKey(item, lang) {
    const l = lang || currentLang;
    return `${l}_${item.id || item.url || item.title}`;
  }

  // 睡眠定時器
  let sleepTimerMinutes = 0;
  let sleepTimerId = null;
  let sleepEndTime = null;

  // 播放世代排程管理器
  let playbackSessionId = 0;
  let activeTimers = [];

  // 外部回呼
  let onTrackChangeCb = null;
  let onStateChangeCb = null;

  function clearAllTimers() {
    activeTimers.forEach(id => clearTimeout(id));
    activeTimers = [];
  }

  function scheduleTask(delayMs, callback) {
    const thisSession = playbackSessionId;
    const timerId = setTimeout(() => {
      activeTimers = activeTimers.filter(t => t !== timerId);
      if (thisSession !== playbackSessionId || !isPlaying) return;
      callback();
    }, delayMs);
    activeTimers.push(timerId);
    return timerId;
  }

  // 取得目前語言資料庫
  function getLangData(lang) {
    if (lang === "amis") {
      return typeof AMIS_DATA !== "undefined" ? AMIS_DATA : null;
    }
    return typeof TRUKU_DATA !== "undefined" ? TRUKU_DATA : null;
  }

  // 建置播放清單
  function buildPlaylist(category, lang) {
    if (category) currentCategory = category;
    if (lang) currentLang = lang;

    const data = getLangData(currentLang);
    if (!data) return [];

    let list = [];
    const allVocab = [
      ...data.vocab.map(s => ({ ...s, catType: "vocab" })),
      ...data.lima.map(s => ({ ...s, catType: "vocab" }))
    ];

    const allItems = [
      ...data.wawa_songs.map(s => ({ ...s, catType: "song" })),
      ...data.chart_songs.map(s => ({ ...s, catType: "song" })),
      ...data.classic_songs.map(s => ({ ...s, catType: "classic" })),
      ...data.dialogues.map(s => ({ ...s, catType: "dialogue" })),
      ...allVocab
    ];

    switch (currentCategory) {
      case "song_wawa":
        list = data.wawa_songs.map(s => ({ ...s, catType: "song" }));
        break;
      case "song_chart":
        list = data.chart_songs.map(s => ({ ...s, catType: "song" }));
        break;
      case "song_classic":
        list = data.classic_songs.map(s => ({ ...s, catType: "classic" }));
        break;
      case "dialogues":
        list = data.dialogues.map(s => ({ ...s, catType: "dialogue" }));
        break;
      case "vocab_all":
        list = allVocab;
        break;
      case "vocab_body":
        list = allVocab.filter(s => s.category === "body");
        break;
      case "vocab_family":
        list = allVocab.filter(s => s.category === "family");
        break;
      case "vocab_daily":
        list = allVocab.filter(s => s.category === "daily");
        break;
      case "vocab_number":
        list = allVocab.filter(s => s.category === "number");
        break;
      case "vocab_animal":
        list = allVocab.filter(s => s.category === "animal");
        break;
      case "vocab_nature":
        list = allVocab.filter(s => s.category === "nature");
        break;
      case "vocab_color":
        list = allVocab.filter(s => s.category === "color");
        break;
      case "vocab_place":
        list = allVocab.filter(s => s.category === "place");
        break;
      case "vocab_time":
        list = allVocab.filter(s => s.category === "time");
        break;
      case "vocab_wawa":
        list = data.vocab.map(s => ({ ...s, catType: "vocab" }));
        break;
      case "vocab_lima":
        list = data.lima.map(s => ({ ...s, catType: "vocab" }));
        break;
      case "scenario_morning": {
        const kw = ['起床', '刷牙', '洗臉', '洗手', '早餐', '吃飽', '早安', '長大', '相見歡', '衣服', '鞋子', '太陽'];
        list = allItems.filter(it => kw.some(k => ((it.title || '') + ' ' + (it.sub || '') + ' ' + (it.unit || '')).includes(k)));
        break;
      }
      case "scenario_travel": {
        const kw = ['車', '火車', '飛機', '捷運', '公車', '動物', '山豬', '飛鼠', '鳥', '狗', '貓', '走', '跑', '彩虹', '公園', '學校', '玩'];
        list = allItems.filter(it => it.category === 'place' || it.category === 'animal' || kw.some(k => ((it.title || '') + ' ' + (it.sub || '') + ' ' + (it.unit || '')).includes(k)));
        break;
      }
      case "scenario_bedtime": {
        const kw = ['睡覺', '睡', '床', '月亮', '星星', '天黑', '安靜', '夜晚', '晚安', '摸摸頭', '搖籃', '休息', '收拾', '玩具'];
        list = allItems.filter(it => kw.some(k => ((it.title || '') + ' ' + (it.sub || '') + ' ' + (it.unit || '')).includes(k)));
        break;
      }
      case "favorites":
        list = allItems.filter(it => favoritesSet.has(getItemKey(it, currentLang)));
        break;
      case "song_all":
        list = [
          ...data.wawa_songs.map(s => ({ ...s, catType: "song" })),
          ...data.chart_songs.map(s => ({ ...s, catType: "song" })),
          ...data.classic_songs.map(s => ({ ...s, catType: "classic" }))
        ];
        break;
      case "all":
      default:
        list = allItems;
        break;
    }

    originalPlaylist = [...list];
    if (isShuffle) {
      playlist = shuffleArray([...list]);
    } else {
      playlist = [...list];
    }

    if (currentIndex >= playlist.length) {
      currentIndex = 0;
    }
    return playlist;
  }

  // Fisher-Yates 隨機洗牌
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 播放當前索引曲目排程
  function playCurrentSequence() {
    if (!isPlaying || !playlist.length) return;

    const thisSession = ++playbackSessionId;
    clearAllTimers();

    const item = playlist[currentIndex];
    if (!item) return;

    // 通知外部 UI 更新
    if (onTrackChangeCb) {
      onTrackChangeCb(item, currentIndex, playlist.length);
    }

    // 更新原生鎖定畫面 MediaSession
    const langLabel = currentLang === "truku" ? "太魯閣語" : "秀姑巒阿美語";
    const catLabel = item.categoryName ? `[${item.categoryIcon || ''}${item.categoryName}] ` : '';
    AudioEngine.updateMediaSessionMetadata({
      title: item.title,
      artist: `${catLabel}${item.sub ? item.sub + '・' : ''}${langLabel}`,
      album: `幼兒族語啟蒙 (${langLabel})`
    });

    // 判斷是否為兒歌全曲模式（若本身就是 full_song 或當前處於 song_continuous 模式）
    const isSong = item.catType === "song" || item.catType === "classic" || item.type === "full_song" || playMode === "song_continuous";

    if (isSong) {
      // === 兒歌全曲連續播放邏輯 ===
      AudioEngine.playUrl(item.url, playbackRate, () => {
        if (thisSession !== playbackSessionId || !isPlaying) return;
        // 間隔停頓後跳下一首
        const gapMs = Math.max(800, Math.round(sentenceGap * 1000));
        scheduleTask(gapMs, () => {
          if (thisSession !== playbackSessionId || !isPlaying) return;
          goNextAuto();
        });
      }, (err) => {
        // 出現連線錯誤自動跳下一首
        scheduleTask(1000, () => {
          if (thisSession !== playbackSessionId || !isPlaying) return;
          goNextAuto();
        });
      });
      return;
    }

    // === 幼兒例句與詞彙排程邏輯 ===
    if (playMode === "indigenous_only") {
      // 模式：純母語洗腦（族語 2 次，無中文）
      playIndigenousTwice(item, thisSession, () => {
        if (thisSession !== playbackSessionId || !isPlaying) return;
        const gapMs = Math.max(800, Math.round(sentenceGap * 1000));
        scheduleTask(gapMs, () => {
          if (thisSession !== playbackSessionId || !isPlaying) return;
          goNextAuto();
        });
      });
    } else if (playMode === "repeat1_zh1") {
      // 模式：單次精聽（族語 1 次 ＋ 中文 1 次）
      AudioEngine.playUrl(item.url, playbackRate, () => {
        if (thisSession !== playbackSessionId || !isPlaying) return;
        scheduleTask(500, () => {
          if (thisSession !== playbackSessionId || !isPlaying) return;
          playChineseTranslation(item, thisSession, () => {
            if (thisSession !== playbackSessionId || !isPlaying) return;
            const gapMs = Math.max(800, Math.round(sentenceGap * 1000));
            scheduleTask(gapMs, () => {
              if (thisSession !== playbackSessionId || !isPlaying) return;
              goNextAuto();
            });
          });
        });
      });
    } else {
      // 模式：沉浸磨耳朵（預設：族語 2 次 ＋ 中文 1 次）
      playIndigenousTwice(item, thisSession, () => {
        if (thisSession !== playbackSessionId || !isPlaying) return;
        scheduleTask(500, () => {
          if (thisSession !== playbackSessionId || !isPlaying) return;
          playChineseTranslation(item, thisSession, () => {
            if (thisSession !== playbackSessionId || !isPlaying) return;
            const gapMs = Math.max(800, Math.round(sentenceGap * 1000));
            scheduleTask(gapMs, () => {
              if (thisSession !== playbackSessionId || !isPlaying) return;
              goNextAuto();
            });
          });
        });
      });
    }
  }

  // 輔助：播放中文意涵（優先播放預製微軟曉臻高品質台灣幼教女聲 MP3，其次平滑降級至瀏覽器語音）
  function playChineseTranslation(item, sessionToken, onComplete) {
    if (!item) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const next = () => {
      if (sessionToken !== playbackSessionId || !isPlaying) return;
      if (typeof onComplete === "function") onComplete();
    };

    if (item.zh_url) {
      AudioEngine.playUrl(item.zh_url, 1.0, next, (err) => {
        console.warn("Chinese audio fallback to speech synthesis:", err);
        AudioEngine.speakChinese(item.sub, next);
      });
    } else if (item.sub) {
      AudioEngine.speakChinese(item.sub, next);
    } else {
      next();
    }
  }

  // 輔助：連續播放族語 2 次（中間微停頓 450ms）
  function playIndigenousTwice(item, sessionToken, onComplete) {
    AudioEngine.playUrl(item.url, playbackRate, () => {
      if (sessionToken !== playbackSessionId || !isPlaying) return;
      scheduleTask(450, () => {
        if (sessionToken !== playbackSessionId || !isPlaying) return;
        AudioEngine.playUrl(item.url, playbackRate, () => {
          if (sessionToken !== playbackSessionId || !isPlaying) return;
          onComplete();
        });
      });
    });
  }

  // 自動進入下一首
  function goNextAuto() {
    if (!playlist.length) return;
    let nextIdx = currentIndex + 1;
    if (nextIdx >= playlist.length) {
      if (isLoopAll) {
        nextIdx = 0;
      } else {
        pause();
        return;
      }
    }
    currentIndex = nextIdx;
    playCurrentSequence();
  }

  // 控制指令
  function play() {
    AudioEngine.unlockUserGesture();
    if (!playlist.length) {
      buildPlaylist(currentCategory, currentLang);
    }
    if (!playlist.length) {
      isPlaying = false;
      if (onStateChangeCb) onStateChangeCb(false);
      return;
    }
    isPlaying = true;
    AudioEngine.updateMediaSessionState(true);
    if (onStateChangeCb) onStateChangeCb(true);
    playCurrentSequence();
  }

  function pause() {
    isPlaying = false;
    playbackSessionId++;
    clearAllTimers();
    AudioEngine.pause();
    if (onStateChangeCb) onStateChangeCb(false);
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function next() {
    AudioEngine.unlockUserGesture();
    playbackSessionId++;
    clearAllTimers();
    if (!playlist.length) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    if (isPlaying) {
      playCurrentSequence();
    } else {
      const item = playlist[currentIndex];
      if (onTrackChangeCb && item) onTrackChangeCb(item, currentIndex, playlist.length);
    }
  }

  function prev() {
    AudioEngine.unlockUserGesture();
    playbackSessionId++;
    clearAllTimers();
    if (!playlist.length) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    if (isPlaying) {
      playCurrentSequence();
    } else {
      const item = playlist[currentIndex];
      if (onTrackChangeCb && item) onTrackChangeCb(item, currentIndex, playlist.length);
    }
  }

  function playIndex(idx) {
    AudioEngine.unlockUserGesture();
    if (idx >= 0 && idx < playlist.length) {
      currentIndex = idx;
      isPlaying = true;
      AudioEngine.updateMediaSessionState(true);
      if (onStateChangeCb) onStateChangeCb(true);
      playCurrentSequence();
    }
  }

  function switchLang(lang) {
    currentLang = lang;
    const wasPlaying = isPlaying;
    pause();
    buildPlaylist(currentCategory, currentLang);
    currentIndex = 0;
    if (wasPlaying && playlist.length > 0) {
      play();
    } else {
      const item = playlist[0];
      if (onTrackChangeCb) onTrackChangeCb(item || null, 0, playlist.length);
    }
    return playlist;
  }

  function switchCategory(cat) {
    currentCategory = cat;
    const wasPlaying = isPlaying;
    pause();
    buildPlaylist(currentCategory, currentLang);
    currentIndex = 0;
    if (wasPlaying && playlist.length > 0) {
      play();
    } else {
      const item = playlist[0];
      if (onTrackChangeCb) onTrackChangeCb(item || null, 0, playlist.length);
    }
    return playlist;
  }

  function setPlayMode(mode) {
    playMode = mode;
  }

  function setSpeed(rate) {
    playbackRate = rate;
    AudioEngine.setPlaybackRate(rate);
  }

  function setSentenceGap(sec) {
    sentenceGap = sec;
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    const currentItem = playlist[currentIndex];
    if (isShuffle) {
      playlist = shuffleArray([...originalPlaylist]);
    } else {
      playlist = [...originalPlaylist];
    }
    if (currentItem) {
      const newIdx = playlist.findIndex(it => it.id === currentItem.id || (it.url === currentItem.url && it.title === currentItem.title));
      currentIndex = newIdx !== -1 ? newIdx : 0;
    }
    return isShuffle;
  }

  function toggleLoop() {
    isLoopAll = !isLoopAll;
    return isLoopAll;
  }

  // 睡眠定時器
  function setSleepTimer(minutes) {
    sleepTimerMinutes = minutes;
    if (sleepTimerId) {
      clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }
    if (minutes <= 0) {
      sleepEndTime = null;
      return null;
    }
    sleepEndTime = Date.now() + minutes * 60 * 1000;
    sleepTimerId = setTimeout(() => {
      pause();
      sleepTimerMinutes = 0;
      sleepEndTime = null;
      console.log("睡眠定時器觸發：自動暫停播放");
    }, minutes * 60 * 1000);
    return sleepEndTime;
  }

  function getSleepTimeRemaining() {
    if (!sleepEndTime) return 0;
    const remainMs = sleepEndTime - Date.now();
    return Math.max(0, Math.ceil(remainMs / 1000));
  }

  // 註冊鎖定螢幕 MediaSession
  AudioEngine.setupMediaSession({
    onPlay: () => play(),
    onPause: () => pause(),
    onNext: () => next(),
    onPrev: () => prev()
  });

  return {
    init: (cat, lang) => buildPlaylist(cat, lang),
    play,
    pause,
    togglePlay,
    next,
    prev,
    playIndex,
    switchLang,
    switchCategory,
    setPlayMode,
    setSpeed,
    setSentenceGap,
    toggleShuffle,
    toggleLoop,
    setSleepTimer,
    getSleepTimeRemaining,
    getPlaylist: () => playlist,
    getCurrentIndex: () => currentIndex,
    getCurrentLang: () => currentLang,
    getCurrentCategory: () => currentCategory,
    getIsPlaying: () => isPlaying,
    getPlayMode: () => playMode,
    getSpeed: () => playbackRate,
    getSentenceGap: () => sentenceGap,
    getIsShuffle: () => isShuffle,
    getIsLoopAll: () => isLoopAll,
    setFavorites: (arr) => { favoritesSet = new Set(arr || []); },
    getFavorites: () => Array.from(favoritesSet),
    getItemKey: (item, lang) => getItemKey(item, lang),
    updateFavoritesList: (arr) => {
      favoritesSet = new Set(arr || []);
      if (currentCategory === "favorites") {
        return buildPlaylist("favorites");
      }
      return playlist;
    },
    onTrackChange: (cb) => { onTrackChangeCb = cb; },
    onStateChange: (cb) => { onStateChangeCb = cb; }
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = CommutePlayer;
}
