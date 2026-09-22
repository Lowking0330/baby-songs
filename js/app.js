/**
 * app.js - 寶寶族語隨身聽主應用邏輯
 */

const App = (function() {
  const STORAGE_KEY = "indigenous_baby_done_v3";
  let doneMap = {};
  try {
    doneMap = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    doneMap = {};
  }

  function saveDone() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doneMap));
    } catch (e) {}
  }

  function getItemKey(item) {
    return `${CommutePlayer.getCurrentLang()}_${item.id || item.url || item.title}`;
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
    // 預設載入 WaWa 兒歌 + 太魯閣語
    CommutePlayer.init("song_wawa", "truku");

    // 註冊播放器回呼
    CommutePlayer.onTrackChange(onTrackChange);
    CommutePlayer.onStateChange(onStateChange);

    // 綁定語言切換
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        CommutePlayer.switchLang(lang);
        renderPlaylist();
      });
    });

    // 綁定分類切換
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.dataset.cat;
        CommutePlayer.switchCategory(cat);
        renderPlaylist();
      });
    });

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
    if (!item) return;

    // 標籤解析
    let tag = "🎵 兒歌";
    if (item.catType === "dialogue" || item.unit) {
      tag = `💬 ${item.unit || "生活會話"}`;
    } else if (item.catType === "vocab") {
      tag = "🔤 生活詞彙";
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
        return t.includes(searchQuery) || s.includes(searchQuery) || u.includes(searchQuery);
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
      empty.textContent = searchQuery ? "找不到相符的歌謠或例句" : "目前分類尚無項目";
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
      sub.textContent = `${item.unit ? '[' + item.unit + '] ' : ''}${item.sub || ''}`;

      info.appendChild(title);
      info.appendChild(sub);

      // 圖示
      const icon = document.createElement('div');
      icon.className = 'track-play-icon';
      icon.textContent = isCur ? '🔊' : '▶';

      row.appendChild(check);
      row.appendChild(num);
      row.appendChild(info);
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
