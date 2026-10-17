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
assert(TRUKU_DATA.classic_songs.length === 10, "太魯閣語 經典歌謠 === 10 首完整兒歌");
assert(TRUKU_DATA.dialogues.length === 60, "太魯閣語 生活例句 === 60 句");
assert(TRUKU_DATA.vocab.length === 60, "太魯閣語 基礎詞彙 === 60 字");
assert(TRUKU_DATA.lima.length === 150, "太魯閣語 LIMA 詞彙 === 150 字");

assert(AMIS_DATA.langName === "秀姑巒阿美語", "阿美語方言設定為秀姑巒阿美語");
assert(AMIS_DATA.wawa_songs.length === 30, "秀姑巒阿美語 WaWa 兒歌 === 30 首");
assert(AMIS_DATA.chart_songs.length === 20, "秀姑巒阿美語 掛圖歌謠 === 20 首");
assert(AMIS_DATA.classic_songs.length === 10, "秀姑巒阿美語 經典歌謠 === 10 首完整兒歌");
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
const isShuffleOff = CommutePlayer.toggleShuffle();
assert.strictEqual(isShuffleOff, false, "洗牌功能已關閉以利後續排序檢驗");

// 測試三段式循環切換 (all -> one -> off -> all)
CommutePlayer.setLoopMode("all");
assert.strictEqual(CommutePlayer.getLoopMode(), "all");
assert.strictEqual(CommutePlayer.getIsLoopAll(), true);

let mode = CommutePlayer.toggleLoop();
assert.strictEqual(mode, "one", "切換至單曲循環");
assert.strictEqual(CommutePlayer.getLoopMode(), "one");
assert.strictEqual(CommutePlayer.getIsLoopAll(), false);

mode = CommutePlayer.toggleLoop();
assert.strictEqual(mode, "off", "切換至順序播放到底");
assert.strictEqual(CommutePlayer.getLoopMode(), "off");
assert.strictEqual(CommutePlayer.getIsLoopAll(), false);

mode = CommutePlayer.toggleLoop();
assert.strictEqual(mode, "all", "切換回整輪循環");
assert.strictEqual(CommutePlayer.getLoopMode(), "all");
assert.strictEqual(CommutePlayer.getIsLoopAll(), true);

// 測試立即重播當前曲目
assert(typeof CommutePlayer.replayCurrent === "function", "replayCurrent 函數應存在");
CommutePlayer.replayCurrent();

console.log("✅ 播放模式、三段式循環與即時重播測試通過！");

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
// 測試太魯閣語情境（必須 100% 為純兒歌，絕無短例句與單詞）
CommutePlayer.switchLang("truku");
CommutePlayer.switchCategory("scenario_morning");
const trukuMorning = CommutePlayer.getPlaylist();
assert(trukuMorning.length >= 15, `太魯閣語晨間歌單數量應 >= 15 (實際: ${trukuMorning.length})`);
assert(trukuMorning.every(s => s.catType === 'song' || s.catType === 'classic'), "晨間歌單必須 100% 為純兒歌");

CommutePlayer.switchCategory("scenario_travel");
const trukuTravel = CommutePlayer.getPlaylist();
assert(trukuTravel.length >= 15, `太魯閣語外出兜風歌單數量應 >= 15 (實際: ${trukuTravel.length})`);
assert(trukuTravel.every(s => s.catType === 'song' || s.catType === 'classic'), "外出歌單必須 100% 為純兒歌");

CommutePlayer.switchCategory("scenario_bedtime");
const trukuBedtime = CommutePlayer.getPlaylist();
assert(trukuBedtime.length >= 15, `太魯閣語睡前歌單數量應 >= 15 (實際: ${trukuBedtime.length})`);
assert(trukuBedtime.every(s => s.catType === 'song' || s.catType === 'classic'), "睡前歌單必須 100% 為純兒歌");

// 測試秀姑巒阿美語情境（必須 100% 為純兒歌，絕無短例句與單詞）
CommutePlayer.switchLang("amis");
CommutePlayer.switchCategory("scenario_morning");
const amisMorning = CommutePlayer.getPlaylist();
assert(amisMorning.length >= 15, `秀姑巒阿美語晨間歌單數量應 >= 15 (實際: ${amisMorning.length})`);
assert(amisMorning.every(s => s.catType === 'song' || s.catType === 'classic'), "阿美語晨間歌單必須 100% 為純兒歌");

CommutePlayer.switchCategory("scenario_travel");
const amisTravel = CommutePlayer.getPlaylist();
assert(amisTravel.length >= 15, `秀姑巒阿美語外出兜風歌單數量應 >= 15 (實際: ${amisTravel.length})`);
assert(amisTravel.every(s => s.catType === 'song' || s.catType === 'classic'), "阿美語外出歌單必須 100% 為純兒歌");

CommutePlayer.switchCategory("scenario_bedtime");
const amisBedtime = CommutePlayer.getPlaylist();
assert(amisBedtime.length >= 15, `秀姑巒阿美語睡前歌單數量應 >= 15 (實際: ${amisBedtime.length})`);
assert(amisBedtime.every(s => s.catType === 'song' || s.catType === 'classic'), "阿美語睡前歌單必須 100% 為純兒歌");

// 測試寶寶最愛收藏邏輯
const allAmis = CommutePlayer.switchCategory("all");
const sample1Key = CommutePlayer.getItemKey(allAmis[0], "amis");
const sample2Key = CommutePlayer.getItemKey(allAmis[1], "amis");
CommutePlayer.setFavorites([sample1Key, sample2Key]);

const favList = CommutePlayer.switchCategory("favorites");
assert.strictEqual(favList.length, 2, "最愛清單應篩選出 2 首收藏項目");
assert.strictEqual(CommutePlayer.getItemKey(favList[0], "amis"), sample1Key, "第一首收藏項目相符");

console.log("✅ 幼兒情境歌單與寶寶最愛收藏測試通過！");

console.log("=== 7. 檢驗全庫 119 首兒歌 100% 本地自託管與時長（絕無低於 10 秒之歌，徹底免疫 klokah 503 當機）===");
function getMp3Duration(buffer) {
  let offset = 0;
  if (buffer.slice(0, 3).toString() === 'ID3') {
    const id3Size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + id3Size;
  }
  let totalDuration = 0;
  const bitratesV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const bitratesV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const srV1 = [44100, 48000, 32000, 0];
  const srV2 = [22050, 24000, 16000, 0];
  const srV25 = [11025, 12000, 8000, 0];

  while (offset < buffer.length - 4) {
    if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
      const b1 = buffer[offset + 1];
      const b2 = buffer[offset + 2];
      const mpegVersion = (b1 >> 3) & 0x03;
      const layer = (b1 >> 1) & 0x03;
      const bitrateIdx = (b2 >> 4) & 0x0F;
      const sampleRateIdx = (b2 >> 2) & 0x03;
      const padding = (b2 >> 1) & 0x01;
      if (mpegVersion !== 1 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
        const isV1 = mpegVersion === 3;
        const bitrate = (isV1 ? bitratesV1[bitrateIdx] : bitratesV2[bitrateIdx]) * 1000;
        const sampleRate = isV1 ? srV1[sampleRateIdx] : (mpegVersion === 2 ? srV2[sampleRateIdx] : srV25[sampleRateIdx]);
        const samplesPerFrame = isV1 ? 1152 : 576;
        const frameLength = Math.floor(((isV1 ? 144 : 72) * bitrate) / sampleRate) + padding;
        if (frameLength > 4) {
          totalDuration += samplesPerFrame / sampleRate;
          offset += frameLength;
          continue;
        }
      }
    }
    offset++;
  }
  return totalDuration;
}

const allSongItems = [
  ...TRUKU_DATA.wawa_songs,
  ...TRUKU_DATA.chart_songs,
  ...TRUKU_DATA.classic_songs,
  ...AMIS_DATA.wawa_songs,
  ...AMIS_DATA.chart_songs,
  ...AMIS_DATA.classic_songs
];

assert.strictEqual(allSongItems.length, 119, "全庫兒歌總數應為 119 首 (太魯閣語 59 首 + 秀姑巒阿美語 60 首)");

allSongItems.forEach((song) => {
  assert(!song.url.startsWith('http'), `兒歌 ${song.title} 必須為本地自託管路徑，不可依賴外部主機 (${song.url})`);
  assert(fs.existsSync(song.url), `兒歌本地音檔必須存在: ${song.url}`);
  const buf = fs.readFileSync(song.url);
  const dur = getMp3Duration(buf);
  assert(dur >= 10.0, `${song.title} (${song.url}) 時長應 >= 10s (實際: ${dur.toFixed(2)}s)`);
});

console.log("✅ 全庫 119 首兒歌 100% 本地自託管與時長校驗通過（每首皆 >= 10 秒，0 外部斷線風險）！");

console.log("\n🎉 全部 7 項測試皆完美通過！");
