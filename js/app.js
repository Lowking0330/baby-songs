/**
 * app.js - 寶寶族語隨身聽主應用邏輯
 */

const App = (function() {
  const STORAGE_KEY = "indigenous_baby_done_v3";
  const STORAGE_FAV_KEY = "indigenous_baby_favs_v2";

  let doneMap = {};
  try {
    doneMap = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    doneMap = {};
  }

  let favMap = {};
  try {
    favMap = JSON.parse(localStorage.getItem(STORAGE_FAV_KEY)) || {};
  } catch (e) {
    favMap = {};
  }

  function saveDone() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doneMap));
    } catch (e) {}
  }

  function saveFavs() {
    try {
      localStorage.setItem(STORAGE_FAV_KEY, JSON.stringify(favMap));
    } catch (e) {}
    updateFavUI();
  }

  function updateFavUI() {
    const curLang = CommutePlayer.getCurrentLang ? CommutePlayer.getCurrentLang() : "truku";
    const curLangFavKeys = Object.keys(favMap).filter(k => !!favMap[k] && k.startsWith(`${curLang}_`));
    CommutePlayer.setFavorites(Object.keys(favMap).filter(k => !!favMap[k]));
    const count = curLangFavKeys.length;
    const badge = document.getElementById('favCount');
    if (badge) badge.textContent = count;
  }

  function getItemKey(item) {
    return CommutePlayer.getItemKey ? CommutePlayer.getItemKey(item) : `${CommutePlayer.getCurrentLang()}_${item.id || item.url || item.title}`;
  }

  // DOM 節點快取
  const el = {
    heroCard: document.getElementById('heroCard'),
    heroTag: document.getElementById('heroTag'),
    heroTitle: document.getElementById('heroTitle'),
    heroSub: document.getElementById('heroSub'),
    playBtn: document.getElementById('playBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    loopBtn: document.getElementById('loopBtn'),
    playlist: document.getElementById('playlist'),
    searchInput: document.getElementById('searchInput'),
    doneCount: document.getElementById('doneCount'),
    totalCount: document.getElementById('totalCount'),
    progressFill: document.getElementById('progressFill'),
    miniPlayer: document.getElementById('miniPlayer'),
    miniTitle: document.getElementById('miniTitle'),
    miniSub: document.getElementById('miniSub'),
    miniPlayBtn: document.getElementById('miniPlayBtn'),
    miniPrevBtn: document.getElementById('miniPrevBtn'),
    miniNextBtn: document.getElementById('miniNextBtn')
  };

  let searchQuery = "";

  function init() {
    // 讀取 URL 初始參數（若有指定情境或最愛）
    const urlParams = new URLSearchParams(window.location.search);
    const initialCat = urlParams.get('cat') || "song_wawa";
    const initialLang = urlParams.get('lang') || "truku";

    // 初始化最愛狀態
    updateFavUI();

    // 初始化播放清單
    CommutePlayer.init(initialCat, initialLang);

    // 註冊播放器回呼
    CommutePlayer.onTrackChange(onTrackChange);
    CommutePlayer.onStateChange(onStateChange);

    // 語言切換
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        CommutePlayer.switchLang(lang);
        updateFavUI();
        renderPlaylist();
      });
    });

    // 統一分類切換處理（支援主分類、情境歌單與詞彙專區連動）
    function setActiveCategory(cat) {
      document.querySelectorAll('.cat-pill').forEach(p => {
        if (cat.startsWith('vocab_')) {
          p.classList.toggle('active', p.dataset.cat === 'vocab_all');
        } else {
          p.classList.toggle('active', p.dataset.cat === cat);
        }
      });

      document.querySelectorAll('.scenario-pill').forEach(sp => {
        sp.classList.toggle('active', sp.dataset.cat === cat);
      });

      document.querySelectorAll('.topic-pill').forEach(tp => {
        tp.classList.toggle('active', tp.dataset.cat === cat);
      });

      // 睡前哄睡模式自動微調語速為 0.8x 溫柔慢速
      if (cat === 'scenario_bedtime') {
        CommutePlayer.setSpeed(0.8);
        document.querySelectorAll('.speed-pill').forEach(p => {
          p.classList.toggle('active', p.dataset.speed === '0.8');
        });
      }

      CommutePlayer.switchCategory(cat);
      renderPlaylist();
    }

    // 綁定主分類切換
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        setActiveCategory(pill.dataset.cat);
      });
    });

    // 綁定情境歌單切換
    document.querySelectorAll('.scenario-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        setActiveCategory(pill.dataset.cat);
      });
    });

    // 綁定詞彙主題專區切換
    document.querySelectorAll('.topic-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        setActiveCategory(pill.dataset.cat);
      });
    });

    // PWA 安裝引導
    let deferredPrompt = null;
    const pwaBanner = document.getElementById('pwaBanner');
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    const pwaCloseBtn = document.getElementById('pwaCloseBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (!sessionStorage.getItem('pwa_dismissed') && pwaBanner) {
        pwaBanner.style.display = 'flex';
      }
    });

    if (pwaInstallBtn) {
      pwaInstallBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const choiceResult = await deferredPrompt.userChoice;
          if (choiceResult.outcome === 'accepted') {
            if (pwaBanner) pwaBanner.style.display = 'none';
          }
          deferredPrompt = null;
        } else {
          alert('如要在手機上安裝此 App：\n\n• iOS Safari：點擊底部分享按鈕 ➔ 選擇「加入主畫面」\n• Android Chrome：點擊右上角三點選單 ➔ 選擇「安裝應用程式」或「加到主螢幕」');
        }
      });
    }

    if (pwaCloseBtn && pwaBanner) {
      pwaCloseBtn.addEventListener('click', () => {
        pwaBanner.style.display = 'none';
        sessionStorage.setItem('pwa_dismissed', '1');
      });
    }

    // 若初始有自訂分類，同步高亮
    if (initialCat !== "song_wawa") {
      setActiveCategory(initialCat);
    }

    // 綁定磨耳朵模式切換
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        CommutePlayer.setPlayMode(mode);
      });
    });

    // 語速調節
    document.querySelectorAll('.speed-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const speed = parseFloat(pill.dataset.speed);
        CommutePlayer.setSpeed(speed);
      });
    });

    // 句間停頓調節
    document.querySelectorAll('.gap-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.gap-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const gap = parseFloat(pill.dataset.gap);
        CommutePlayer.setSentenceGap(gap);
      });
    });

    // 睡眠定時器
    document.querySelectorAll('.sleep-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.sleep-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const mins = parseInt(pill.dataset.sleep, 10);
        CommutePlayer.setSleepTimer(mins);
      });
    });

    // 主播放按鈕控制
    el.playBtn.addEventListener('click', () => CommutePlayer.togglePlay());
    el.prevBtn.addEventListener('click', () => CommutePlayer.prev());
    el.nextBtn.addEventListener('click', () => CommutePlayer.next());
    if (el.miniPlayBtn) el.miniPlayBtn.addEventListener('click', () => CommutePlayer.togglePlay());
    if (el.miniPrevBtn) el.miniPrevBtn.addEventListener('click', () => CommutePlayer.prev());
    if (el.miniNextBtn) el.miniNextBtn.addEventListener('click', () => CommutePlayer.next());

    // 洗牌與循環
    el.shuffleBtn.addEventListener('click', () => {
      const isShuffle = CommutePlayer.toggleShuffle();
      el.shuffleBtn.classList.toggle('active', isShuffle);
      renderPlaylist();
    });

    el.loopBtn.addEventListener('click', () => {
      const isLoop = CommutePlayer.toggleLoop();
      el.loopBtn.classList.toggle('active', isLoop);
    });

    // 搜尋過濾
    el.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderPlaylist();
    });

    // 滾動時浮現迷你播放列
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        el.miniPlayer.style.display = 'flex';
      } else {
        el.miniPlayer.style.display = 'none';
      }
    });

    // 初始渲染
    const initialList = CommutePlayer.getPlaylist();
    if (initialList.length > 0) {
      onTrackChange(initialList[0], 0, initialList.length);
    }
    renderPlaylist();
  }

  // 播放歌曲更新
  function onTrackChange(item, index, total) {
    if (!item) {
      el.heroTag.textContent = "⭐ 寶寶隨身聽";
      el.heroTitle.textContent = "目前清單尚無項目";
      el.heroSub.textContent = "請切換其他分類或點選 ☆ 加入最愛";
      if (el.miniTitle) el.miniTitle.textContent = "尚無項目";
      if (el.miniSub) el.miniSub.textContent = "-";
      highlightPlayingItem(-1);
      return;
    }

    // 標籤解析
    let tag = "🎵 兒歌";
    if (item.catType === "dialogue" || item.unit) {
      tag = `💬 ${item.unit || "生活會話"}`;
    } else if (item.catType === "vocab") {
      tag = `${item.categoryIcon || '🔤'} ${item.categoryName || '幼兒詞彙'}`;
    } else if (item.catType === "classic") {
      tag = "📻 經典兒歌";
    }

    el.heroTag.textContent = tag;
    el.heroTitle.textContent = item.title;
    el.heroSub.textContent = item.sub || "";

    if (el.miniTitle) el.miniTitle.textContent = item.title;
    if (el.miniSub) el.miniSub.textContent = item.sub || "";

    highlightPlayingItem(index);
  }

  // 播放狀態更新
  function onStateChange(isPlaying) {
    if (isPlaying) {
      el.playBtn.innerHTML = "⏸";
      if (el.miniPlayBtn) el.miniPlayBtn.innerHTML = "⏸";
      el.heroCard.classList.add('playing');
    } else {
      el.playBtn.innerHTML = "▶";
      if (el.miniPlayBtn) el.miniPlayBtn.innerHTML = "▶";
      el.heroCard.classList.remove('playing');
    }
  }

  // 渲染清單
  function renderPlaylist() {
    const list = CommutePlayer.getPlaylist();
    const currentIdx = CommutePlayer.getCurrentIndex();

    el.playlist.innerHTML = "";

    let filtered = list.map((item, originalIndex) => ({ item, originalIndex }));
    if (searchQuery) {
      filtered = filtered.filter(({ item }) => {
        const t = (item.title || "").toLowerCase();
        const s = (item.sub || "").toLowerCase();
        const u = (item.unit || "").toLowerCase();
        const c = (item.categoryName || "").toLowerCase();
        return t.includes(searchQuery) || s.includes(searchQuery) || u.includes(searchQuery) || c.includes(searchQuery);
      });
    }

    let doneCount = 0;
    list.forEach(it => {
      if (doneMap[getItemKey(it)]) doneCount++;
    });

    el.doneCount.textContent = doneCount;
    el.totalCount.textContent = list.length;
    el.progressFill.style.width = list.length > 0 ? `${Math.round((doneCount / list.length) * 100)}%` : '0%';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.padding = '30px 16px';
      empty.style.color = '#a0aec0';
      empty.style.fontSize = '13px';
      if (searchQuery) {
        empty.textContent = "找不到相符的歌謠或例句";
      } else if (CommutePlayer.getCurrentCategory() === "favorites") {
        empty.innerHTML = "⭐ 尚未加入任何最愛項目<br><span style='font-size:12px; color:#718096; margin-top:6px; display:inline-block;'>點擊曲目右側的 ☆ 星星，就能隨時為寶寶建立專屬磨耳朵清單！</span>";
      } else {
        empty.textContent = "目前分類尚無項目";
      }
      el.playlist.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(({ item, originalIndex }) => {
      const key = getItemKey(item);
      const isDone = !!doneMap[key];
      const isCur = originalIndex === currentIdx;

      const row = document.createElement('div');
      row.className = `track-item ${isDone ? 'done' : ''} ${isCur ? 'playing' : ''}`;
      row.dataset.idx = originalIndex;

      // 打卡確認框
      const check = document.createElement('div');
      check.className = 'track-check';
      check.textContent = isDone ? '✔' : '';
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        doneMap[key] = !doneMap[key];
        saveDone();
        renderPlaylist();
      });

      // 編號
      const num = document.createElement('div');
      num.className = 'track-num';
      num.textContent = originalIndex + 1;

      // 內容
      const info = document.createElement('div');
      info.className = 'track-info';

      const title = document.createElement('div');
      title.className = 'track-title';
      title.textContent = item.title;

      const sub = document.createElement('div');
      sub.className = 'track-sub';
      const catBadge = item.categoryName ? `[${item.categoryIcon || ''}${item.categoryName}] ` : (item.unit ? `[${item.unit}] ` : '');
      sub.textContent = `${catBadge}${item.sub || ''}`;

      info.appendChild(title);
      info.appendChild(sub);

      // ⭐ 寶寶最愛收藏按鈕
      const isFav = !!favMap[key];
      const favBtn = document.createElement('div');
      favBtn.className = `track-fav ${isFav ? 'active' : ''}`;
      favBtn.textContent = isFav ? '⭐' : '☆';
      favBtn.title = isFav ? '取消收藏' : '加入寶寶最愛';
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        favMap[key] = !favMap[key];
        if (!favMap[key]) delete favMap[key];
        saveFavs();
        CommutePlayer.updateFavoritesList(Object.keys(favMap).filter(k => !!favMap[k]));
        if (CommutePlayer.getCurrentCategory() === 'favorites') {
          renderPlaylist();
        } else {
          const nowFav = !!favMap[key];
          favBtn.className = `track-fav ${nowFav ? 'active' : ''}`;
          favBtn.textContent = nowFav ? '⭐' : '☆';
          favBtn.title = nowFav ? '取消收藏' : '加入寶寶最愛';
        }
      });

      // 圖示
      const icon = document.createElement('div');
      icon.className = 'track-play-icon';
      icon.textContent = isCur ? '🔊' : '▶';

      row.appendChild(check);
      row.appendChild(num);
      row.appendChild(info);
      row.appendChild(favBtn);
      row.appendChild(icon);

      row.addEventListener('click', () => {
        CommutePlayer.playIndex(originalIndex);
      });

      fragment.appendChild(row);
    });

    el.playlist.appendChild(fragment);
  }

  function highlightPlayingItem(currentIdx) {
    const items = el.playlist.querySelectorAll('.track-item');
    items.forEach(it => {
      const idx = parseInt(it.dataset.idx, 10);
      const isCur = idx === currentIdx;
      it.classList.toggle('playing', isCur);
      const icon = it.querySelector('.track-play-icon');
      if (icon) icon.textContent = isCur ? '🔊' : '▶';
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
