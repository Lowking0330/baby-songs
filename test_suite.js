/**
 * test_suite.js - 自動化邏輯與資料完整度測試
 */

const assert = require('assert');
const fs = require('fs');

// Mock browser globals
global.window = {
  MediaMetadata: class { constructor(opts) { Object.assign(this, opts); } },
  speechSynthesis: { speak: () => {}, cancel: () => {} }
};
const mockMediaSession = {
  playbackState: 'none',
  metadata: null,
  setActionHandler: (type, fn) => { mockMediaSession[type] = fn; }
};

Object.defineProperty(globalThis, 'navigator', {
  value: {
    mediaSession: mockMediaSession,
    wakeLock: {
      request: async () => ({ addEventListener: () => {}, release: async () => {} })
    }
  },
  configurable: true,
  writable: true
});
global.document = {
  createElement: (tag) => ({
    play: async () => {},
    pause: () => {},
    setAttribute: () => {},
    addEventListener: () => {}
  }),
  addEventListener: () => {}
};
global.Audio = class {
  constructor() {
    this.src = '';
    this.playbackRate = 1.0;
    this.currentTime = 0;
    this.paused = true;
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  setAttribute() {}
  removeAttribute() {}
};

// Load datasets
global.TRUKU_DATA = eval(fs.readFileSync('js/data/truku_data.js', 'utf-8') + '; TRUKU_DATA;');
global.AMIS_DATA = eval(fs.readFileSync('js/data/amis_data.js', 'utf-8') + '; AMIS_DATA;');
global.AudioEngine = eval(fs.readFileSync('js/audio_engine.js', 'utf-8') + '; AudioEngine;');
global.CommutePlayer = eval(fs.readFileSync('js/commute_player.js', 'utf-8') + '; CommutePlayer;');

console.log("=== 1. 檢驗資料集完整性 ===");
assert(TRUKU_DATA.wawa_songs.length >= 29, "太魯閣語 WaWa 兒歌 >= 29 首");
assert(TRUKU_DATA.chart_songs.length === 20, "太魯閣語 掛圖歌謠 === 20 首");
assert(TRUKU_DATA.dialogues.length === 60, "太魯閣語 生活例句 === 60 句");
assert(TRUKU_DATA.vocab.length === 60, "太魯閣語 基礎詞彙 === 60 字");
assert(TRUKU_DATA.lima.length === 150, "太魯閣語 LIMA 詞彙 === 150 字");

assert(AMIS_DATA.langName === "秀姑巒阿美語", "阿美語方言設定為秀姑巒阿美語");
assert(AMIS_DATA.wawa_songs.length === 30, "秀姑巒阿美語 WaWa 兒歌 === 30 首");
assert(AMIS_DATA.chart_songs.length === 20, "秀姑巒阿美語 掛圖歌謠 === 20 首");
assert(AMIS_DATA.classic_songs.length === 36, "秀姑巒阿美語 經典歌謠 === 36 首");
assert(AMIS_DATA.dialogues.length === 60, "秀姑巒阿美語 生活例句 === 60 句");
assert(AMIS_DATA.vocab.length === 60, "秀姑巒阿美語 基礎詞彙 === 60 字");
assert(AMIS_DATA.lima.length === 150, "秀姑巒阿美語 LIMA 詞彙 === 150 字");
console.log("✅ 資料集完整性檢驗通過！");

console.log("=== 2. 檢驗 CommutePlayer 初始化與分類切換 ===");
let pl = CommutePlayer.init("song_wawa", "truku");
assert.strictEqual(pl.length, TRUKU_DATA.wawa_songs.length, "初始化清單長度正確");

// 切換至例句篇
CommutePlayer.switchCategory("dialogues");
pl = CommutePlayer.getPlaylist();
assert.strictEqual(pl.length, 60, "例句篇長度應為 60 句");
assert.strictEqual(pl[0].unit, "幼兒日常生活-我長大了", "第一單元名稱相符");

// 切換至詞彙專題分類檢驗
CommutePlayer.switchCategory("vocab_all");
pl = CommutePlayer.getPlaylist();
assert.strictEqual(pl.length, 210, "全部詞彙長度應為 210 字");

CommutePlayer.switchCategory("vocab_body");
assert.strictEqual(CommutePlayer.getPlaylist().length, 17, "身體部位應為 17 字");

CommutePlayer.switchCategory("vocab_family");
assert.strictEqual(CommutePlayer.getPlaylist().length, 20, "親屬稱謂應為 20 字");

CommutePlayer.switchCategory("vocab_daily");
assert.strictEqual(CommutePlayer.getPlaylist().length, 40, "家庭起居應為 40 字");

CommutePlayer.switchCategory("vocab_number");
assert.strictEqual(CommutePlayer.getPlaylist().length, 21, "數字計數應為 21 字");

CommutePlayer.switchCategory("vocab_animal");
assert.strictEqual(CommutePlayer.getPlaylist().length, 26, "動物世界應為 26 字");

CommutePlayer.switchCategory("vocab_nature");
assert.strictEqual(CommutePlayer.getPlaylist().length, 28, "自然飲食應為 28 字");

CommutePlayer.switchCategory("vocab_color");
assert.strictEqual(CommutePlayer.getPlaylist().length, 11, "顏色形狀應為 11 字");

CommutePlayer.switchCategory("vocab_place");
assert.strictEqual(CommutePlayer.getPlaylist().length, 25, "場所交通應為 25 字");

CommutePlayer.switchCategory("vocab_time");
assert.strictEqual(CommutePlayer.getPlaylist().length, 22, "時間月份應為 22 字");

// 切換語言至秀姑巒阿美語
CommutePlayer.switchLang("amis");
assert.strictEqual(CommutePlayer.getCurrentLang(), "amis", "語言切換至阿美語");
assert.strictEqual(CommutePlayer.getPlaylist().length, 22, "阿美語時間月份亦為 22 字");

CommutePlayer.switchCategory("dialogues");
pl = CommutePlayer.getPlaylist();
assert.strictEqual(pl.length, 60, "阿美語例句篇亦為 60 句");

console.log("✅ 播放清單、主題詞彙分類與語言切換通過！");

console.log("=== 3. 檢驗幼兒磨耳朵播放模式與參數設定 ===");
CommutePlayer.setPlayMode("repeat2_zh1");
assert.strictEqual(CommutePlayer.getPlayMode(), "repeat2_zh1");

CommutePlayer.setPlayMode("indigenous_only");
assert.strictEqual(CommutePlayer.getPlayMode(), "indigenous_only");

CommutePlayer.setSpeed(0.8);
assert.strictEqual(CommutePlayer.getSpeed(), 0.8);

CommutePlayer.setSentenceGap(2.0);
assert.strictEqual(CommutePlayer.getSentenceGap(), 2.0);

const isShuffle = CommutePlayer.toggleShuffle();
assert.strictEqual(CommutePlayer.getIsShuffle(), true);

const isLoop = CommutePlayer.toggleLoop();
assert.strictEqual(CommutePlayer.getIsLoopAll(), false);

console.log("✅ 播放模式與參數設定通過！");

console.log("=== 4. 檢驗睡眠定時器 ===");
const endTime = CommutePlayer.setSleepTimer(15);
assert(endTime > Date.now(), "定時器結束時間應在未來");
assert(CommutePlayer.getSleepTimeRemaining() > 0, "剩餘秒數應大於 0");
CommutePlayer.setSleepTimer(0);
assert.strictEqual(CommutePlayer.getSleepTimeRemaining(), 0, "關閉定時器剩餘 0 秒");
console.log("✅ 睡眠定時器測試通過！");

console.log("=== 5. 檢驗 MediaSession 聯動 ===");
AudioEngine.updateMediaSessionMetadata({
  title: "Alang mu",
  artist: "太魯閣語",
  album: "幼兒啟蒙"
});
assert.strictEqual(mockMediaSession.metadata.title, "Alang mu");
console.log("✅ MediaSession 聯動測試通過！");

console.log("=== 6. 檢驗幼兒情境歌單與寶寶最愛收藏 ===");
// 測試太魯閣語情境
CommutePlayer.switchLang("truku");
CommutePlayer.switchCategory("scenario_morning");
const trukuMorning = CommutePlayer.getPlaylist().length;
assert(trukuMorning >= 15, `太魯閣語晨間歌單數量應 >= 15 (實際: ${trukuMorning})`);

CommutePlayer.switchCategory("scenario_travel");
const trukuTravel = CommutePlayer.getPlaylist().length;
assert(trukuTravel >= 30, `太魯閣語外出兜風歌單數量應 >= 30 (實際: ${trukuTravel})`);

CommutePlayer.switchCategory("scenario_bedtime");
const trukuBedtime = CommutePlayer.getPlaylist().length;
assert(trukuBedtime >= 10, `太魯閣語睡前歌單數量應 >= 10 (實際: ${trukuBedtime})`);

// 測試秀姑巒阿美語情境
CommutePlayer.switchLang("amis");
CommutePlayer.switchCategory("scenario_morning");
const amisMorning = CommutePlayer.getPlaylist().length;
assert(amisMorning >= 15, `秀姑巒阿美語晨間歌單數量應 >= 15 (實際: ${amisMorning})`);

CommutePlayer.switchCategory("scenario_travel");
const amisTravel = CommutePlayer.getPlaylist().length;
assert(amisTravel >= 30, `秀姑巒阿美語外出兜風歌單數量應 >= 30 (實際: ${amisTravel})`);

CommutePlayer.switchCategory("scenario_bedtime");
const amisBedtime = CommutePlayer.getPlaylist().length;
assert(amisBedtime >= 10, `秀姑巒阿美語睡前歌單數量應 >= 10 (實際: ${amisBedtime})`);

// 測試寶寶最愛收藏邏輯
const allAmis = CommutePlayer.switchCategory("all");
const sample1Key = CommutePlayer.getItemKey(allAmis[0], "amis");
const sample2Key = CommutePlayer.getItemKey(allAmis[1], "amis");
CommutePlayer.setFavorites([sample1Key, sample2Key]);

const favList = CommutePlayer.switchCategory("favorites");
assert.strictEqual(favList.length, 2, "最愛清單應篩選出 2 首收藏項目");
assert.strictEqual(CommutePlayer.getItemKey(favList[0], "amis"), sample1Key, "第一首收藏項目相符");

console.log("✅ 幼兒情境歌單與寶寶最愛收藏測試通過！");

console.log("\n🎉 全部 6 項測試皆完美通過！");
