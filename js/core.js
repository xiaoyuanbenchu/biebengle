/* ============================================================
   别绷了 · 微信小游戏版 core (MP v1)
   同一份代码运行于: 微信小游戏(真 wx) / 浏览器(经 wx-shim)
   阶段A: 玩法迁移(全 canvas UI)  阶段B: 遗言/血仇链/复仇/绷狂60秒/迷走圈/皮肤/段位卡片
   ============================================================ */
;(() => {
"use strict";
const __G = (typeof globalThis !== "undefined") ? globalThis
          : (typeof GameGlobal !== "undefined") ? GameGlobal
          : (typeof window !== "undefined") ? window : {};

/* 老设备 polyfill（部分真机 JS 环境较旧） */
if (typeof String.prototype.padStart !== "function") {
  String.prototype.padStart = function (n, c) { c = c === undefined ? " " : String(c); let s = String(this); while (s.length < n) s = c.charAt(0) + s; return s; };
}
if (typeof Array.from !== "function") {
  Array.from = function (it) { const a = []; if (it && it.forEach) it.forEach(v => a.push(v)); return a; };
}
if (typeof String.prototype.repeat !== "function") {
  String.prototype.repeat = function (n) { n = n | 0; let s = String(this), r = ""; while (n-- > 0) r += s; return r; };
}
/* hsl 转 hex：部分真机 canvas 连逗号 hsl 都解析失败，hex 是唯一全平台安全色 */
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(255 * x).toString(16).padStart(2, "0");
  return "#" + to(f(0)) + to(f(8)) + to(f(4));
}

/* ================= 平台适配 ================= */
const isWx = (typeof wx !== "undefined") && !!wx.getSystemInfoSync;
let sys;
if (isWx) { try { sys = wx.getSystemInfoSync(); } catch (e) { sys = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }; } }
else sys = { windowWidth: __G.innerWidth, windowHeight: __G.innerHeight, pixelRatio: Math.min(__G.devicePixelRatio || 1, 2.5) };

const W = sys.windowWidth || 375, H = sys.windowHeight || 667;
const DPR = Math.min(sys.pixelRatio || 1, 3);
const canvas = isWx ? wx.createCanvas() : __G.document.getElementById("cv");
canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
if (!isWx) { canvas.style.width = W + "px"; canvas.style.height = H + "px"; }
const ctx = canvas.getContext("2d");
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

function makeCanvas(w, h) {
  if (isWx) { const c = wx.createCanvas(); c.width = w; c.height = h; return c; }
  const c = __G.document.createElement("canvas"); c.width = w; c.height = h; return c;
}
const store = {
  get(k, d) {
    try {
      const v = isWx ? wx.getStorageSync(k) : __G.localStorage.getItem(k);
      if (v === undefined || v === null || v === "") return d;
      try { return JSON.parse(v); } catch (e) { return v; }
    } catch (e) { return d; }
  },
  set(k, v) { try { const s = JSON.stringify(v); if (isWx) wx.setStorageSync(k, s); else __G.localStorage.setItem(k, s); } catch (e) {} }
};
function vib(p) {
  try {
    if (isWx) {
      if (Array.isArray(p)) { let t = 0; for (const seg of p) { if (seg > 0 && t > 0) t += seg; setTimeout(() => { try { wx.vibrateShort({ type: "light" }); } catch (e) {} }, t); t += 60; } }
      else if (p >= 60) wx.vibrateLong({});
      else wx.vibrateShort({ type: "light" });
    } else if (__G.navigator && navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}
let AC = null;
function ensureAC() {
  if (AC) return;
  try { AC = isWx ? (wx.createWebAudioContext ? wx.createWebAudioContext() : null) : new (__G.AudioContext || __G.webkitAudioContext)(); } catch (e) { AC = null; }
}
function beep(f0, f1, dur, type, vol) {
  if (muted || !AC) return;
  try {
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  perfect: () => beep(660, 990, 0.09, "square", 0.12),
  golden:  () => { beep(880, 1320, 0.09, "square", 0.12); setTimeout(() => beep(1100, 1650, 0.09, "square", 0.10), 70); },
  boss:    () => { beep(523, 784, 0.08, "square", 0.12); setTimeout(() => beep(659, 988, 0.08, "square", 0.12), 60); setTimeout(() => beep(784, 1175, 0.1, "square", 0.12), 120); },
  good:    () => beep(440, 520, 0.08, "triangle", 0.10),
  miss:    () => beep(200, 80, 0.28, "sawtooth", 0.14),
  over:    () => { beep(330, 110, 0.5, "sawtooth", 0.12); setTimeout(() => beep(220, 60, 0.6, "sawtooth", 0.10), 160); },
  revwin:  () => { beep(523, 1046, 0.12, "square", 0.13); setTimeout(() => beep(659, 1318, 0.12, "square", 0.13), 110); setTimeout(() => beep(784, 1568, 0.2, "square", 0.13), 220); }
};
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440];
let musicTimer = null, nextNote = 0, mStep = 0;
function playNote(f, t, d, vol, type) {
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.05);
  } catch (e) {}
}
function startMusic() {
  if (!MUSIC_ON || muted || !AC) return;
  stopMusic(); nextNote = AC.currentTime + 0.1; mStep = 0;
  musicTimer = setInterval(() => {
    if (muted || !AC) return;
    if (nextNote < AC.currentTime) nextNote = AC.currentTime + 0.05;
    while (nextNote < AC.currentTime + 0.25) {
      const inten = Math.min(1, combo / 20);
      if (mStep % 8 === 0) playNote(110, nextNote, 0.3, 0.05, "sine");
      if (mStep % 2 === 0 || Math.random() < inten * 0.7) {
        const n = SCALE[(mStep * 3 + ((mStep * 7) % 5)) % SCALE.length] * (combo >= 15 ? 2 : 1);
        playNote(n, nextNote, 0.14, 0.028 + inten * 0.03);
      }
      mStep++; nextNote += 0.165;
    }
  }, 100);
}
function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

/* 触摸 */
const touchCbs = { start: [], move: [], end: [] };
function normTouch(e) {
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  return { x: t ? t.clientX : 0, y: t ? t.clientY : 0, touches: e.touches, changed: e.changedTouches };
}
if (isWx) {
  wx.onTouchStart(e => { const p = normTouch(e); touchCbs.start.forEach(f => f(p)); });
  wx.onTouchMove(e => { const p = normTouch(e); touchCbs.move.forEach(f => f(p)); });
  wx.onTouchEnd(e => { const p = normTouch(e); touchCbs.end.forEach(f => f(p)); });
} else {
  const r = () => canvas.getBoundingClientRect();
  canvas.addEventListener("pointerdown", e => { e.preventDefault(); const b = r(); touchCbs.start.forEach(f => f({ x: e.clientX - b.left, y: e.clientY - b.top })); });
  canvas.addEventListener("pointermove", e => { const b = r(); touchCbs.move.forEach(f => f({ x: e.clientX - b.left, y: e.clientY - b.top })); });
  canvas.addEventListener("pointerup", e => { const b = r(); touchCbs.end.forEach(f => f({ x: e.clientX - b.left, y: e.clientY - b.top })); });
}
/* 分享 */
let passiveShareCb = null;
function doShare(payload) {
  if (isWx) { try { wx.shareAppMessage(payload); } catch (e) {} }
  else { __G.__LAST_SHARE__ = payload; __G.console && console.log("[SHARE] " + JSON.stringify(payload)); }
}
if (isWx) {
  try { wx.showShareMenu({ withShareTicket: false, menus: ["shareAppMessage", "shareTimeline"] }); } catch (e) {}
  try { wx.onShareAppMessage(() => passiveShareCb ? passiveShareCb() : defaultShare()); } catch (e) {}
}
function canvasToTemp(c, cb) {
  if (isWx && wx.canvasToTempFilePath) {
    try { wx.canvasToTempFilePath({ canvas: c, success: r => cb(r.tempFilePath), fail: () => cb(null) }); return; } catch (e) {}
  }
  cb(null);
}
/* 遗言键盘 */
function editText(defVal, maxLen, cb) {
  if (isWx && wx.showKeyboard) {
    try {
      let val = defVal, done = false;
      const fin = () => { if (done) return; done = true; cb((val || "").slice(0, maxLen)); };
      wx.onKeyboardInput(r => { val = r.value; });
      wx.onKeyboardConfirm(() => { try { wx.hideKeyboard({}); } catch (e) {} fin(); });
      wx.onKeyboardHide(fin);
      wx.showKeyboard({ defaultValue: defVal, maxLength: maxLen, multiple: false, confirmHold: false });
      return;
    } catch (e) {}
  }
  if (!isWx) { const v = __G.prompt("遗言（" + maxLen + " 字内）:", defVal); cb(v === null ? null : (v || "").slice(0, maxLen)); return; }
  cb(null);
}

/* ================= 常量与文案 ================= */
const MUSIC_ON = true;
const VERSION = "MP-1.0";
const F_START = 0.42, T_FRAC = 0.125, BASE = (F_START - T_FRAC) / 1.5;
const PERFECT = ["泰裤辣！", "遥遥领先！", "稳如老狗", "6到飞起", "这就是天赋？", "绷住了！", "干净又卫生", "手速逆天", "有点东西"];
const GOOD = ["还行吧", "勉强及格", "就这？", "差点意思", "小赚一口", "马马虎虎"];
const MISS = ["蚌埠住了", "小丑竟是你自己", "急了急了", "手是脚踩的吧", "退！退！退！", "破防了", "指纹不服", "离谱到家"];
const TIMEOUT = ["人都麻了？", "你在等什么？", "圈都落地了！", "发什么呆呢"];
const LEVELS = ["绷门新手", "初级绷徒", "绷场常客", "绷界新星", "绷力惊人", "绷中之王", "绷神下凡", "抽象宗师", "手指成精", "绷学奇才"];
const INTROS = { trickster: "新圈型：它会突然减速，别上当", golden: "新圈型：金圈分数翻倍，窗口更窄", bouncer: "新圈型：缩过头会弹回来一次", reverse: "新圈型：这个圈从小长大，等它撞上白圈" };
const LW = {
  wild:   ["死于手滑", "这手不听使唤", "按歪了，绷死了", "手比脑快，遗憾离场"],
  timeout:["它落下来了，我没接住", "眼睁睁看圈落地", "差半秒，天塌了"],
  itch:   ["手痒是绝症", "第三下没忍住", "乱按一时爽，绷死火葬场"],
  fly:    ["圈飞了，我的心也飞了", "抓不住的圈，留不住的命"]
};
const ACH = [
  { id: "first", name: "绷界入门", desc: "完成第一次判定" },
  { id: "c10",   name: "十连绷神", desc: "单局 10 连绷" },
  { id: "c20",   name: "二十连绷", desc: "单局 20 连绷" },
  { id: "s30",   name: "小有名气", desc: "单局 30 分" },
  { id: "s60",   name: "绷界传奇", desc: "单局 60 分" },
  { id: "p10",   name: "精准打击", desc: "单局 10 次 Perfect" },
  { id: "gold",  name: "金手", desc: "命中一次金圈 Perfect" },
  { id: "back",  name: "回头是岸", desc: "在弹回圈第二段命中" },
  { id: "night", name: "夜猫子绷手", desc: "凌晨 0-5 点开绷" },
  { id: "p100",  name: "百分俱乐部", desc: "累计 100 次 Perfect" },
  { id: "d3",    name: "一日三绷", desc: "一天玩 3 局" },
  { id: "g5",    name: "金卷王", desc: "单局 5 次金圈 Perfect" },
  { id: "h12",   name: "丝滑天胡", desc: "单局 12 连 Perfect" },
  { id: "s100",  name: "绷学奇才", desc: "单局 100 分" },
  { id: "daily1",name: "每日打卡", desc: "完成一局每日挑战" },
  { id: "boss1", name: "绷王认证", desc: "绷王时刻 3 连全中" },
  { id: "rev1",  name: "有仇必报", desc: "首次复仇成功" },
  { id: "rev10", name: "十世之仇", desc: "血仇链传到第 10 手" },
  { id: "lw10",  name: "遗言大师", desc: "分享挑战卡 10 次" }
];
const CAREER_TITLES = [[0, "摸鱼选手"], [50, "绷门学徒"], [150, "绷场常客"], [300, "绷界新星"], [600, "绷力惊人"], [1000, "绷中之王"], [1600, "绷神下凡"], [2500, "抽象宗师"], [4000, "手指成精"], [6000, "绷学奇才"]];
const SKINS = [
  { id: "neon",  name: "霓虹", dyn: true,  unlock: null,   hint: "" },
  { id: "lava",  name: "熔岩", hue: 18,    unlock: "s30career", hint: "单局 30 分解锁" },
  { id: "pixel", name: "像素", hue: 130,   unlock: "c10career", hint: "单局 10 连绷解锁" },
  { id: "frost", name: "幽蓝", hue: 205,   unlock: "boss1",     hint: "绷王认证解锁" }
];

/* ================= 状态 ================= */
let mode = "menu", gmode = "classic";           // mode: menu|play|over|stats ; gmode: classic|sprint|daily
let score = 0, combo = 0, bestCombo = 0, lives = 3, hits = 0, perfectCount = 0, purePerfectStreak = 0, goldenPerfRun = 0;
let speed = BASE, ring = null, spawnTimer = null, lastFrame = 0, sprintLeft = 0;
let flash = 0, skullT = 0, shakeT = 0, particles = [], ghosts = [], hue = 260;
let daily = false, dailyKey = "", rng = Math.random;
let emptyStreak = 0, lastResolve = 0;
let bossQueue = 0, bossHits = 0;
let stars = [], vig = null;
let best = store.get("bb_best", 0);
let career = store.get("bb_career", { points: 0, games: 0, perfects: 0, bestScore: 0, bestCombo: 0, days: {} });
if (!career || typeof career !== "object" || !career.days) career = { points: 0, games: 0, perfects: 0, bestScore: best, bestCombo: 0, days: {} };
let unlocked = new Set(store.get("bb_achv", []));
let seenTypes = store.get("bb_seen", {});
let skinId = store.get("bb_skin", "neon");
let revStats = store.get("bb_revstats", { shares: 0, wins: 0 });
let maxChain = store.get("bb_maxchain", 0);
let muted = false;
let rev = { armed: false, score: 0, msg: "", chain: 0 };
let lwText = "", lastDeathCause = "wild";
let overPhase = "dead", overAt = 0, revWinFrag = null;
let shareImgPath = null;
let toastQ = [], toastBusy = false;
let btns = [];
let statsScroll = 0;
const toastEl = { txt: "", cls: "", t0: 0 };

/* ================= 工具 ================= */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function dkey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function hashSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function careerTitle(p) { let t = CAREER_TITLES[0][1]; for (const it of CAREER_TITLES) if (p >= it[0]) t = it[1]; return t; }
function roast(s) {
  if (s <= 4) return "这手是租的吧？建议退货";
  if (s <= 9) return "小丑竟是你自己 🤡";
  if (s <= 19) return "有点东西，但不多";
  if (s <= 29) return "手速可以，脑子很抽象";
  if (s <= 49) return "恭喜，你已是抽象区凡人";
  if (s <= 79) return "你不是普通人，你是抽象人";
  return "手指已成精，建议申报非遗";
}
function bandCopy(s) {
  if (s <= 9) return "我绷了 " + s + " 分，手感如脚";
  if (s <= 29) return "绷了 " + s + " 分，小有绷感，不服来战";
  if (s <= 59) return s + " 分！我怀疑这手不是我的";
  if (s <= 99) return "已入绷界 " + s + " 分，复仇请排队";
  return s + " 分。人类手指极限，建议认输";
}
function genLastWords(cause) {
  const pool = (LW[cause] || []).concat(LW.wild, ["绷生至此，告辞", "下辈子的圈我再按"]);
  return pick(pool).slice(0, 20);
}
function skinById(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
function skinUnlocked(sk) {
  if (!sk.unlock) return true;
  if (sk.unlock === "s30career") return career.bestScore >= 30;
  if (sk.unlock === "c10career") return career.bestCombo >= 10;
  return unlocked.has(sk.unlock);
}
function currentSkin() { return skinById(skinId); }
function ringColor() {
  const sk = currentSkin();
  if (ring && ring.type === "boss") return hsl2hex(18, 100, 60);
  if (ring && ring.type === "golden") return hsl2hex(46, 100, 60);
  if (ring && ring.type === "trickster") return hsl2hex(350, 95, 65);
  if (ring && ring.type === "bouncer") return hsl2hex(140, 80, 60);
  if (ring && ring.type === "reverse") return hsl2hex(205, 95, 66);
  if (sk.dyn) return hsl2hex(hue, 95, 62);
  return hsl2hex(sk.hue, 95, 62);
}

/* ================= UI 原语 ================= */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function button(id, x, y, w, h, label, kind, font) {
  btns.push({ id: id, x: x, y: y, w: w, h: h });
  const fs = font || W * 0.042;
  ctx.font = "800 " + fs + "px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (kind === "primary") {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#7c5cff"); g.addColorStop(1, "#ff5f9e");
    ctx.fillStyle = g; rr(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  } else if (kind === "ghost") {
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.5;
    rr(x, y, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  } else {
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = fs + "px sans-serif";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  }
}
function text(str, x, y, size, color, weight, align) {
  ctx.font = (weight || 400) + " " + size + "px sans-serif";
  ctx.fillStyle = color || "#fff";
  ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}
function toast(txt, cls) { toastQ.push({ txt: txt, cls: cls }); pumpToast(); }
function pumpToast() {
  if (toastEl.t0 && Date.now() - toastEl.t0 < 950) { setTimeout(pumpToast, 200); return; }
  if (!toastQ.length) { toastEl.t0 = 0; return; }
  const t = toastQ.shift();
  toastEl.txt = t.txt; toastEl.cls = t.cls; toastEl.t0 = Date.now();
  setTimeout(pumpToast, 960);
}
function unlockAch(id) {
  if (unlocked.has(id)) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  unlocked.add(id); store.set("bb_achv", Array.from(unlocked));
  toast("🏆 成就解锁：" + a.name, "#ffe08a");
}
function saveCareer() { store.set("bb_career", career); }

/* ================= 游戏流程 ================= */
function startGame(gm) {
  clearTimeout(spawnTimer);
  gmode = gm;
  daily = (gm === "daily");
  if (daily) { dailyKey = dkey(); rng = mulberry32(hashSeed("biebengle-" + dailyKey)); } else rng = Math.random;
  score = 0; combo = 0; bestCombo = 0; lives = 3; hits = 0; perfectCount = 0;
  purePerfectStreak = 0; goldenPerfRun = 0;
  emptyStreak = 0; lastResolve = 0;
  bossQueue = 0; bossHits = 0;
  speed = BASE; ring = null; particles = []; ghosts = []; skullT = 0;
  sprintLeft = 60;
  mode = "play";
  shareImgPath = null;
  toast(daily ? "每日挑战 · 绷住！" : (gm === "sprint" ? "绷狂 60 秒 · 冲！" : "绷住！"), "#ffd666");
  nextRing(500);
  ensureAC(); startMusic();
}
function poolFor(h) {
  const p = ["normal"];
  if (h >= 10) p.push("trickster");
  if (h >= 20) p.push("golden");
  if (h >= 30) p.push("bouncer");
  if (h >= 40) p.push("reverse");
  return p;
}
function spawn() {
  if (mode !== "play") return;
  const jitter = 1 + rng() * 0.06;
  let type = poolFor(hits)[Math.floor(rng() * poolFor(hits).length)];
  const slowAt = 1.3 + rng() * 0.5;
  const spdJit = 1 + rng() * 0.1;
  if (bossQueue > 0) type = "boss";
  if (type === "reverse") ring = { f: 0.045, type: type, dir: 1, bounced: false, slowAt: slowAt, spdJit: spdJit };
  else ring = { f: F_START * jitter, type: type, dir: -1, bounced: false, slowAt: slowAt, spdJit: spdJit };
  if (INTROS[type] && !seenTypes[type]) {
    seenTypes[type] = 1; store.set("bb_seen", seenTypes);
    toast(INTROS[type], "#ffd666");
  }
}
function nextRing(d) { clearTimeout(spawnTimer); spawnTimer = setTimeout(spawn, d); }
function center() {
  const amp = wanderAmp();
  return { x: W / 2 + Math.sin(performanceTs() * 1.3) * amp, y: H * 0.54 + Math.sin(performanceTs() * 1.7 + 1.3) * amp };
}
function wanderAmp() {
  if (score < 30) return 0;
  const a = Math.min(0.09, (score - 30) * 0.004) * Math.min(W, H);
  return gmode === "sprint" ? a / 2 : a;
}
let _ts = 0;
function performanceTs() { return _ts; }
function burst(h, n) {
  const c0 = center(), count = n || 16;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = rand(90, 300) * (Math.min(W, H) / 420);
    particles.push({ x: c0.x, y: c0.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.8), t: 0, size: rand(3, 7), hue: h });
  }
}
function finishRing(d) {
  ring = null; lastResolve = Date.now(); emptyStreak = 0;
  speed = Math.min(BASE * Math.pow(1.045, hits), BASE * 2.9);
  nextRing(d);
}
function onEmptyPress() {
  if (Date.now() - lastResolve < 250) return;
  emptyStreak++;
  if (emptyStreak >= 3) {
    emptyStreak = 0;
    if (gmode === "sprint") { combo = 0; toast("手痒是病！", "#ff6b81"); }
    else loseLife("itch", "手痒是病，得治");
  } else if (emptyStreak === 1) toast("别乱按！", "#ffd666");
  else toast("真急了？", "#ffd666");
}
function press() {
  if (mode !== "play") return;
  if (!ring) { onEmptyPress(); return; }
  const T = T_FRAC * Math.min(W, H), r = ring.f * Math.min(W, H), d = Math.abs(r - T);
  const boss = ring.type === "boss", gold = ring.type === "golden";
  const pw = boss ? T * 0.10 : (gold ? T * 0.09 : T * 0.16);
  const gw = boss ? T * 0.24 : (gold ? T * 0.22 : T * 0.40);
  const slowZone = ring.type === "trickster" && r <= ring.slowAt * T;
  unlockAch("first");
  if (d <= pw) {
    const prev = score;
    const inc = boss ? 6 : (gold ? 4 : 2);
    score += inc; combo++; hits++; perfectCount++;
    purePerfectStreak++; bestCombo = Math.max(bestCombo, combo);
    if (gold) { goldenPerfRun++; unlockAch("gold"); if (goldenPerfRun >= 5) unlockAch("g5"); }
    if (purePerfectStreak >= 12) unlockAch("h12");
    if (boss) {
      bossHits++; bossQueue--;
      sfx.boss(); vib(25); flash = 0.36; burst(30, 22);
      if (bossHits >= 3) { unlockAch("boss1"); toast("👑 绷王认证！", "#ffe08a"); bossQueue = 0; }
      else toast("👑 绷王 " + bossHits + "/3", "#ffe08a");
    } else {
      toast(slowZone ? "看穿你了！" : pick(PERFECT), "#7cffb2");
      (gold ? sfx.golden : sfx.perfect)(); vib(18); flash = 0.32;
      burst(gold ? 46 : (currentSkin().dyn ? hue : (currentSkin().hue || 260)));
    }
    ghosts.push({ r: r, life: 1, color: ringColor() });
    if (ring.type === "bouncer" && ring.bounced) unlockAch("back");
    finishRing(340);
    if (Math.floor(score / 50) > Math.floor(prev / 50) && bossQueue === 0) {
      bossQueue = 3; bossHits = 0; toast("👑 绷王时刻！", "#ffe08a");
    }
  } else if (d <= gw) {
    score += 1; hits++; combo = 0; purePerfectStreak = 0;
    toast(pick(GOOD), "#ffd666"); sfx.good(); vib(10);
    ghosts.push({ r: r, life: 1, color: "rgba(255,255,255,.7)" });
    finishRing(340);
  } else {
    if (gmode === "sprint") {
      combo = 0; purePerfectStreak = 0;
      toast(d <= gw * 1.35 ? "就差一点！" : pick(MISS), "#ff6b81");
      sfx.miss(); vib(15); shakeT = 0.25; skullT = 0.5;
      ring = null; lastResolve = Date.now(); emptyStreak = 0;
      nextRing(340);
      return;
    }
    loseLife("wild", d <= gw * 1.35 ? "就差一点！" : pick(MISS));
  }
  if (combo >= 10) unlockAch("c10");
  if (combo >= 20) unlockAch("c20");
  if (score >= 30) unlockAch("s30");
  if (score >= 60) unlockAch("s60");
  if (score >= 100) unlockAch("s100");
  if (perfectCount >= 10) unlockAch("p10");
}
function loseLife(cause, msg) {
  combo = 0; lives--; skullT = 0.7; purePerfectStreak = 0;
  lastResolve = Date.now(); emptyStreak = 0;
  shakeT = 0.35; sfx.miss(); vib([30, 40, 30]);
  toast(msg, "#ff6b81");
  ring = null; bossQueue = 0; clearTimeout(spawnTimer);
  if (lives <= 0) { lastDeathCause = cause; gameOver("dead"); return; }
  nextRing(650);
}
function gameOver(reason) {
  mode = "over"; ring = null; clearTimeout(spawnTimer); stopMusic();
  sfx.over(); vib([40, 60, 40]);
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) unlockAch("night");
  if (daily) unlockAch("daily1");
  career.points += score; career.games++; career.perfects += perfectCount;
  if (score > career.bestScore) career.bestScore = score;
  if (bestCombo > career.bestCombo) career.bestCombo = bestCombo;
  const tk = dkey(); career.days[tk] = (career.days[tk] || 0) + 1;
  if (career.days[tk] >= 3) unlockAch("d3");
  if (career.perfects >= 100) unlockAch("p100");
  if (score > best) { best = score; store.set("bb_best", best); }
  saveCareer();
  overPhase = reason; overAt = performanceTs();
  if (reason === "dead") {
    lastDeathCause = lastDeathCause || "wild";
    lwText = genLastWords(lastDeathCause);
    if (rev.armed) {
      if (score > rev.score) {
        overPhase = "revwin";
        revStats.wins++; store.set("bb_revstats", revStats);
        unlockAch("rev1");
        sfx.revwin(); vib(200);
        revWinFrag = [];
        const cx0 = W / 2, cy0 = H * 0.42;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, sp = rand(120, 340);
          revWinFrag.push({ x: cx0, y: cy0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, rot: Math.random() * 6, vr: rand(-6, 6), w: rand(16, 42), h: rand(8, 20) });
        }
        toast("⚔ 复仇成功！", "#ffe08a");
      } else {
        overPhase = "revfail";
        toast("复仇失败，差 " + (rev.score - score + 1) + " 分", "#ff6b81");
      }
    }
  }
  if (gmode === "daily" && score > (store.get("bb_daily_" + dailyKey, 0) || 0)) store.set("bb_daily_" + dailyKey, score);
  genShareImage();
}

/* ================= 复仇 & 分享 ================= */
function armRevenge(q) {
  if (!q || (q.t !== "rev" && q.t !== "ch")) return;
  rev = {
    armed: true,
    score: parseInt(q.s, 10) || 0,
    msg: q.m ? decodeURIComponent(q.m).slice(0, 20) : "",
    chain: parseInt(q.c, 10) || 0
  };
  if (rev.chain > maxChain) { maxChain = rev.chain; store.set("bb_maxchain", maxChain); }
  if (maxChain >= 10) unlockAch("rev10");
}
function buildQuery(scoreOut, chainOut, msgOut) {
  return "t=rev&c=" + chainOut + "&s=" + scoreOut + "&m=" + encodeURIComponent((msgOut || "").slice(0, 20));
}
function shareTitle(s, chain, isCounter) {
  let t = isCounter ? ("手刃了 " + rev.score + " 分的宿敌！") : bandCopy(s);
  if (!isCounter && careerTitle(career.points) !== "摸鱼选手") t = "『" + careerTitle(career.points) + "』" + t;
  if (chain >= 2) t += "（血仇第" + chain + "手）";
  return t.slice(0, 40);
}
function doChallengeShare() {
  const chainOut = rev.armed ? rev.chain + 1 : 0;
  revStats.shares++; store.set("bb_revstats", revStats);
  if (revStats.shares >= 10) unlockAch("lw10");
  const q = buildQuery(score, chainOut, lwText);
  const title = shareTitle(score, chainOut, false);
  doShare({ title: title, imageUrl: shareImgPath || undefined, query: q });
}
function doCounterShare() {
  const chainOut = rev.chain + 1;
  revStats.shares++; store.set("bb_revstats", revStats);
  if (revStats.shares >= 10) unlockAch("lw10");
  const q = buildQuery(score, chainOut, rev.msg || lwText);
  const title = ("⚔ " + shareTitle(score, chainOut, true)).slice(0, 40);
  doShare({ title: title, imageUrl: shareImgPath || undefined, query: q });
}
function defaultShare() {
  return { title: bandCopy(best) + " · 来复仇", query: buildQuery(best, 0, genLastWords("wild")) };
}
function genShareImage() {
  try {
    const c = makeCanvas(500, 400), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 500, 400);
    g.addColorStop(0, "#1a1030"); g.addColorStop(1, "#0b0b12");
    x.fillStyle = g; x.fillRect(0, 0, 500, 400);
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 4;
    x.beginPath(); x.arc(250, 190, 78, 0, 7); x.stroke();
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "900 84px sans-serif";
    x.fillText(String(score), 250, 195);
    x.font = "700 26px sans-serif"; x.fillStyle = "#ffd666";
    x.fillText(overPhase === "revwin" ? "⚔ 复仇成功" : bandCopy(score), 250, 320);
    if (lwText) { x.font = "400 22px sans-serif"; x.fillStyle = "rgba(255,255,255,.75)"; x.fillText("遗言：" + lwText, 250, 356); }
    x.font = "900 34px sans-serif";
    const tg = x.createLinearGradient(60, 0, 440, 0);
    tg.addColorStop(0, "#ff5f9e"); tg.addColorStop(1, "#ffb86b");
    x.fillStyle = tg; x.fillText("别 绷 了", 250, 52);
    if (rev.chain >= 2 || rev.armed) { x.font = "700 22px sans-serif"; x.fillStyle = "#ff6b81"; x.fillText("血仇第" + (overPhase === "revwin" ? rev.chain + 1 : Math.max(rev.chain, 0)) + "手", 250, 92); }
    canvasToTemp(c, p => { if (p) shareImgPath = p; });
  } catch (e) {}
}

/* ================= 主循环（结构 = 第一版，真机已验证可运行；只保留确认有效的修复） ================= */
function loop(ts) {
  const tms = (typeof ts === "number" && isFinite(ts)) ? ts : Date.now();
  const dt = lastFrame ? Math.min((tms - lastFrame) / 1000, 0.05) : 0.016;
  lastFrame = tms;
  _ts = _ts + dt;   // 动画时钟=帧累加：与系统时钟解耦，杜绝 Date.now() 级大数撑爆 canvas 角度精度
  const T = T_FRAC * Math.min(W, H);
  if (mode === "play") {
    if (gmode === "sprint") {
      sprintLeft -= dt;
      if (sprintLeft <= 0) { sprintLeft = 0; gameOver("timeup"); }
    }
    if (ring) {
      let sp = speed * ring.spdJit;
      if (ring.type === "golden") sp *= 1.15;
      if (ring.type === "boss") sp *= 1.2;
      if (ring.type === "trickster" && ring.f * Math.min(W, H) <= ring.slowAt * T) sp *= 0.32;
      ring.f += ring.dir * sp * dt * (ring.dir > 0 && ring.type !== "reverse" ? 1.6 : 1);
      const r = ring.f * Math.min(W, H);
      if (ring.dir < 0) {
        if (ring.type === "bouncer" && !ring.bounced && r <= T * 0.45) { ring.bounced = true; ring.dir = 1; toast("↩ 弹回来了！", "#7cffb2"); }
        else if (r <= T * 0.05) {
          if (gmode === "sprint") { combo = 0; toast(pick(TIMEOUT), "#ff6b81"); sfx.miss(); ring = null; lastResolve = Date.now(); nextRing(340); }
          else loseLife("timeout", pick(TIMEOUT));
        }
      } else {
        if (ring.type === "reverse" && r >= F_START * 1.12) {
          if (gmode === "sprint") { combo = 0; toast("圈都飞走了！", "#ff6b81"); ring = null; lastResolve = Date.now(); nextRing(340); }
          else loseLife("fly", "圈都飞走了！");
        }
        else if (ring.type !== "reverse" && r >= F_START * 0.72) ring.dir = -1;
      }
    }
    if (ring && !isFinite(ring.f)) ring.f = F_START;      // 半径自愈，坏值不再传染
  }
  const c0 = center();
  for (const st of stars) { st.y -= st.z * 14 * dt; if (st.y < -4) { st.y = H + 4; st.x = Math.random() * W; } }
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
  particles = particles.filter(p => p.t < p.life);
  for (const g of ghosts) g.life -= dt * 3.2;
  ghosts = ghosts.filter(g => g.life > 0);
  flash = Math.max(0, flash - dt * 1.6);
  skullT = Math.max(0, skullT - dt);
  shakeT = Math.max(0, shakeT - dt);
  draw(tms);
  requestAnimationFrame(loop);
}

/* ================= 绘制 ================= */
function draw(ts) {
  btns = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // 每帧重设：防部分真机重置画布变换
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shakeT > 0) ctx.translate(rand(-8, 8), rand(-6, 6));
  drawStars(ts);
  if (mode === "play") drawPlay(ts);
  else if (mode === "menu") drawMenu();
  else if (mode === "over") drawOver();
  else if (mode === "stats") drawStats();
  drawToast();
  if (vig) ctx.drawImage(vig, 0, 0, W, H);
  if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + flash + ")"; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function drawStars(ts) {
  ctx.fillStyle = "#fff";
  for (const st of stars) { ctx.globalAlpha = 0.12 + st.z * 0.2; ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawHUD() {
  const T = T_FRAC * Math.min(W, H);
  text("🤡".repeat(Math.max(lives, 0)) || (gmode === "sprint" ? "♾" : ""), 16, 34, 20, "#fff", 400, "left");
  text(String(score), W / 2, 40, W * 0.13, "#fff", 900);
  text((daily ? "每日 · " : "") + LEVELS[Math.min(Math.floor(score / 10), LEVELS.length - 1)], W / 2, 40 + W * 0.085, W * 0.032, "rgba(255,255,255,.7)", 400);
  if (combo >= 2) text("🔥 " + combo + " 连绷", W / 2, 40 + W * 0.125, W * 0.038, "#ffd666", 800);
  let rl = "", rc = "#fff";
  if (ring) {
    if (ring.type === "boss") { rl = "👑 绷王时刻 " + bossHits + "/3"; rc = "#ffb86b"; }
    else if (ring.type === "golden") { rl = "💰 金圈 ×2分"; rc = "#ffd666"; }
    else if (ring.type === "trickster") { rl = "⚠ 变速圈"; rc = "#ff6b81"; }
    else if (ring.type === "bouncer") { rl = "↩ 弹回圈"; rc = "#7cffb2"; }
    else if (ring.type === "reverse") { rl = "↑ 反向圈"; rc = "#8ecbff"; }
  }
  if (rl) text(rl, W / 2, 40 + W * 0.165, W * 0.032, rc, 800);
  if (gmode === "sprint") {
    const urgent = sprintLeft <= 10;
    text(urgent ? "⏰ " + Math.ceil(sprintLeft) : "⏱ " + Math.ceil(sprintLeft), W / 2, 40 + W * 0.205, W * 0.05, urgent ? "#ff6b81" : "#8ecbff", 900);
  }
  if (rev.armed && gmode === "classic") {
    text("⚔ 复仇目标 " + rev.score + " 分" + (rev.msg ? " ·『" + rev.msg + "』" : ""), W / 2, H * 0.955, W * 0.03, "#ff9db0", 700);
  }
  button("mute", W - 46, 16, 34, 34, muted ? "🔇" : "🔊", "link", 18);
}
function drawPlay(ts) {
  drawHUD();
  const T = T_FRAC * Math.min(W, H), c0 = center();
  const sk = currentSkin();
  if (sk.dyn) { hue = (260 + combo * 22) % 360; }
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(c0.x, c0.y, T, 0, 7); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c0.x, c0.y, T, 0, 7); ctx.stroke();
  for (const g of ghosts) {
    ctx.strokeStyle = g.color; ctx.globalAlpha = g.life * 0.8; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c0.x, c0.y, g.r + (1 - g.life) * T * 1.1, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (ring && isFinite(ring.f) && isFinite(_ts)) {
    const r = ring.f * Math.min(W, H), col = ringColor();
    const spin = (ring.type === "reverse" ? -1 : 1) * ((_ts * 1.667) % (Math.PI * 2));   // 对 2π 取模，角度永远小数值
    const trail = r - ring.dir * speed * ring.spdJit * Math.min(W, H) * 0.05;
    const cap = sk.id === "pixel" ? "butt" : "round";
    ctx.lineCap = cap;
    if (trail > 2) {
      ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = col; ctx.lineWidth = Math.max(4, Math.min(W, H) * 0.018);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(c0.x, c0.y, trail, spin + i * Math.PI / 2, spin + i * Math.PI / 2 + Math.PI / 2.6); ctx.stroke(); }
      ctx.restore();
    }
    const lw2 = Math.max(5, Math.min(W, H) * (sk.id === "pixel" ? 0.028 : 0.022));
    const arcSpan = sk.id === "pixel" ? Math.PI / 3.2 : Math.PI / 2.6;
    ctx.globalAlpha = 0.25; ctx.strokeStyle = col; ctx.lineWidth = lw2 * 2.3;   // 假辉光：双层描边，不用 shadowBlur（真机太贵）
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(c0.x, c0.y, r, spin + i * Math.PI / 2, spin + i * Math.PI / 2 + arcSpan); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = lw2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(c0.x, c0.y, r, spin + i * Math.PI / 2, spin + i * Math.PI / 2 + arcSpan); ctx.stroke(); }
  }
  for (const p of particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = hsl2hex(p.hue, 90, 65);
    if (sk.id === "pixel") ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  const e = skullT > 0 ? "💀" : tierEmoji();
  ctx.font = Math.round(T * 1.15) + "px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(e, c0.x, c0.y + T * 0.06);
}
function tierEmoji() {
  if (combo >= 30) return "🛸"; if (combo >= 20) return "👽"; if (combo >= 14) return "🤯";
  if (combo >= 9) return "😎"; if (combo >= 5) return "😏"; if (combo >= 2) return "😌";
  return "🙂";
}
function drawToast() {
  if (!toastEl.t0) return;
  const el = Date.now() - toastEl.t0;
  if (el > 950) return;
  const p = el / 950;
  let a = 1, s = 1, dy = 0;
  if (p < 0.18) { a = p / 0.18; s = 0.4 + 0.75 * a; }
  else if (p < 0.32) s = 1.15 - (p - 0.18) / 0.14 * 0.15;
  if (p > 0.72) a = 1 - (p - 0.72) / 0.28;
  if (p > 0.5) dy = (p - 0.5) * 40;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H * 0.33 - dy);
  ctx.scale(s, s);
  text(toastEl.txt, 0, 0, Math.min(W * 0.09, 42), toastEl.cls || "#fff", 900);
  ctx.restore();
}
function drawMenu() {
  let y = H * 0.16;
  const tg = ctx.createLinearGradient(W * 0.1, y - 40, W * 0.9, y + 40);
  tg.addColorStop(0, "#ff5f9e"); tg.addColorStop(0.5, "#ffb86b"); tg.addColorStop(1, "#7c5cff");
  ctx.font = "900 " + W * 0.155 + "px sans-serif";
  ctx.fillStyle = tg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("别 绷 了", W / 2, y + Math.sin(_ts * 2) * 5);
  y += W * 0.13;
  text("一个很抽象的反应力测试", W / 2, y, W * 0.038, "rgba(255,255,255,.85)", 400); y += W * 0.09;
  if (rev.armed) {
    const bh = W * 0.16;
    ctx.fillStyle = "rgba(255,107,129,.12)";
    rr(16, y - bh / 2, W - 32, bh, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,107,129,.5)"; ctx.lineWidth = 1; ctx.stroke();
    text("⚔ 复仇目标 " + rev.score + " 分 · 血仇第" + (rev.chain + 1) + "手", W / 2, y - bh / 2 + bh * 0.32, W * 0.035, "#ff9db0", 800);
    text("『" + (rev.msg || "没有遗言") + "』 · 经典模式生效", W / 2, y - bh / 2 + bh * 0.72, W * 0.031, "rgba(255,157,176,.8)", 400);
    y += bh + W * 0.035;
  }
  const bw = W * 0.64, bx = (W - bw) / 2, bh = W * 0.115;
  button("start", bx, y, bw, bh, rev.armed ? "⚔ 接受复仇" : "开 始 绷", "primary"); y += bh + W * 0.03;
  button("sprint", bx, y, bw, bh, "⏱ 绷狂 60 秒", "ghost"); y += bh + W * 0.03;
  button("daily", bx, y, bw, bh, "📅 每日挑战 · 全网同关", "ghost"); y += bh + W * 0.03;
  const half = (bw - 12) / 2;
  button("stats", bx, y, half, bh, "🏆 战绩", "ghost");
  button("share", bx + half + 12, y, half, bh, "📣 挑战好友", "ghost"); y += bh + W * 0.045;
  const sr = W * 0.032;
  let sx0 = W / 2 - (SKINS.length * (sr * 2 + 14) - 14) / 2 + sr;
  for (const sk of SKINS) {
    const okS = skinUnlocked(sk);
    ctx.globalAlpha = okS ? 1 : 0.3;
    ctx.beginPath(); ctx.arc(sx0, y, sr, 0, 7);
    ctx.fillStyle = hsl2hex(sk.dyn ? 280 : sk.hue, 95, 62);
    ctx.fill();
    if (sk.id === skinId) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx0, y, sr + 4, 0, 7); ctx.stroke(); }
    else if (!okS) { ctx.fillStyle = "#fff"; ctx.font = Math.round(sr) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔒", sx0, y); }
    button("skin_" + sk.id, sx0 - sr - 4, y - sr - 4, sr * 2 + 8, sr * 2 + 8, "", "link");
    sx0 += sr * 2 + 14;
  }
  ctx.globalAlpha = 1;
  y += sr + W * 0.05;
  text("🎯 彩圈缩向白圈，重合瞬间按", W / 2, y, W * 0.03, "rgba(255,255,255,.75)", 400); y += W * 0.055;
  text("⚠ 特殊圈型 · 👑 绷王时刻", W / 2, y, W * 0.03, "rgba(255,255,255,.75)", 400); y += W * 0.055;
  text("🤡 3 条命 · 按歪或手痒都扣命", W / 2, y, W * 0.03, "rgba(255,255,255,.75)", 400); y += W * 0.07;
  text("🏆 成就 " + unlocked.size + "/" + ACH.length + " · 累计绷力 " + career.points + " · " + careerTitle(career.points), W / 2, y, W * 0.028, "rgba(255,255,255,.5)", 400); y += W * 0.045;
  text(VERSION + " · 手指点按即玩", W / 2, y, W * 0.026, "rgba(255,255,255,.35)", 400);
  passiveShareCb = defaultShare;
}
function drawOver() {
  ctx.fillStyle = "rgba(10,10,18,.72)"; ctx.fillRect(0, 0, W, H);
  const animT = performanceTs() - overAt;
  const isRevWin = overPhase === "revwin";
  let y = H * 0.15;
  const bigTitle = isRevWin ? "⚔ 复仇成功" : (overPhase === "timeup" ? "⏱ 时间到！" : "绷 不 住 了");
  if (isRevWin && animT < 1.2) {
    if (revWinFrag) {
      for (const f of revWinFrag) {
        f.x += f.vx * 0.016; f.y += f.vy * 0.016; f.vy += 320 * 0.016; f.rot += f.vr * 0.016;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = "rgba(255,214,102,.8)"; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
        ctx.restore();
      }
    }
    const s = Math.min(1, animT / 0.5) * (1 + Math.max(0, 0.25 - animT) * 2);
    ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.scale(s, s);
    text("绷", 0, 0, W * 0.34, "#ffd666", 900);
    ctx.restore();
    return;
  }
  const tg = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0);
  tg.addColorStop(0, "#ff5f9e"); tg.addColorStop(1, "#ffb86b");
  ctx.font = "900 " + W * 0.11 + "px sans-serif";
  ctx.fillStyle = tg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(bigTitle, W / 2, y); y += W * 0.09;
  let roastLine = roast(score);
  if (overPhase === "revfail") roastLine = "复仇失败 · 目标 " + rev.score + " 分 · " + roast(score);
  if (overPhase === "timeup") roastLine = "60 秒刷出 " + score + " 分 · " + roast(score);
  if (daily) roastLine = "【每日挑战】" + roastLine;
  text(roastLine, W / 2, y, W * 0.033, "rgba(255,255,255,.85)", 400); y += W * 0.08;
  const pw = W * 0.78, px = (W - pw) / 2;
  const ph = W * 0.30 + (overPhase === "dead" ? W * 0.13 : 0) + (gmode === "daily" ? W * 0.05 : 0) + (rev.armed && !isRevWin ? W * 0.05 : 0);
  ctx.fillStyle = "rgba(255,255,255,.06)"; rr(px, y, pw, ph, 20); ctx.fill();
  text(String(score), W / 2, y + ph * 0.30, W * 0.16, "#ffd666", 900);
  text("最高连绷 " + bestCombo + " · 历史最佳 " + best, W / 2, y + ph * 0.52, W * 0.03, "rgba(255,255,255,.8)", 400);
  text("累计绷力 " + career.points + " · " + careerTitle(career.points), W / 2, y + ph * 0.62, W * 0.03, "rgba(255,255,255,.8)", 400);
  let ry = y + ph * 0.74;
  if (gmode === "daily") { text("今日最佳 " + Math.max(score, store.get("bb_daily_" + dailyKey, 0) || 0), W / 2, ry, W * 0.03, "#ffd666", 600); ry += W * 0.05; }
  if (rev.armed && !isRevWin) { text("⚔ 复仇目标 " + rev.score + " 分", W / 2, ry, W * 0.03, "#ff9db0", 600); ry += W * 0.05; }
  if (overPhase === "dead") {
    text("遗言：" + lwText, W / 2, ry + W * 0.012, W * 0.034, "rgba(255,255,255,.9)", 600);
    const bwd = pw * 0.42;
    button("lw_reroll", px + pw * 0.03, ry + W * 0.045, bwd, W * 0.07, "换一句", "ghost", W * 0.032);
    button("lw_edit", px + pw * 0.55, ry + W * 0.045, bwd, W * 0.07, "改一句", "ghost", W * 0.032);
  }
  y += ph + W * 0.05;
  const bw = W * 0.64, bx = (W - bw) / 2, bh = W * 0.105;
  if (isRevWin) { button("counter", bx, y, bw, bh, "⚔ 反击分享", "primary"); y += bh + W * 0.025; }
  button("again", bx, y, bw, bh, gmode === "sprint" ? "再 冲 一 次" : "再 绷 一 次", isRevWin ? "ghost" : "primary"); y += bh + W * 0.025;
  const half = (bw - 12) / 2;
  if (!isRevWin) { button("share", bx, y, half, bh, "📣 挑战好友", "ghost"); }
  else { button("stats", bx, y, half, bh, "🏆 战绩", "ghost"); }
  button("home", bx + half + 12, y, half, bh, "回主页", "ghost");
  passiveShareCb = () => ({ title: shareTitle(score, rev.armed ? rev.chain + 1 : 0, isRevWin), query: buildQuery(score, rev.armed ? rev.chain + 1 : 0, isRevWin ? (rev.msg || lwText) : lwText), imageUrl: shareImgPath || undefined });
}
function drawStats() {
  ctx.fillStyle = "rgba(10,10,18,.8)"; ctx.fillRect(0, 0, W, H);
  text("战 绩", W / 2, H * 0.07, W * 0.08, "#fff", 900);
  const cells = [
    ["累计绷力", career.points + " · " + careerTitle(career.points)],
    ["总局数", String(career.games)],
    ["最高分", String(Math.max(career.bestScore, best))],
    ["最高连绷", String(career.bestCombo)],
    ["累计 Perfect", String(career.perfects)],
    ["复仇胜场", String(revStats.wins)]
  ];
  const gw = W - 32, colw = (gw - 8) / 2, ch = W * 0.115;
  let gy = H * 0.12;
  for (let i = 0; i < cells.length; i++) {
    const cx0 = 16 + (i % 2) * (colw + 8), cy0 = gy + Math.floor(i / 2) * (ch + 8);
    ctx.fillStyle = "rgba(255,255,255,.06)"; rr(cx0, cy0, colw, ch, 12); ctx.fill();
    text(cells[i][0], cx0 + 12, cy0 + ch * 0.3, W * 0.028, "rgba(255,255,255,.55)", 400, "left");
    text(cells[i][1], cx0 + 12, cy0 + ch * 0.66, W * 0.035, "#fff", 800, "left");
  }
  gy += 3 * (ch + 8) + W * 0.03;
  const listTop = gy, listBottom = H - W * 0.17;
  const rowH = W * 0.135, colAchW = (gw - 8) / 2;
  const rows = Math.ceil(ACH.length / 2);
  const maxScroll = Math.max(0, rows * (rowH + 8) - (listBottom - listTop));
  statsScroll = Math.max(0, Math.min(maxScroll, statsScroll));
  ctx.save();
  ctx.beginPath(); ctx.rect(16, listTop, gw, listBottom - listTop); ctx.clip();
  for (let i = 0; i < ACH.length; i++) {
    const a = ACH[i];
    const cx0 = 16 + (i % 2) * (colAchW + 8);
    const cy0 = listTop + Math.floor(i / 2) * (rowH + 8) - statsScroll;
    if (cy0 > listBottom || cy0 + rowH < listTop) continue;
    const has = unlocked.has(a.id);
    ctx.globalAlpha = has ? 1 : 0.38;
    ctx.fillStyle = "rgba(255,255,255,.06)"; rr(cx0, cy0, colAchW, rowH, 10); ctx.fill();
    text((has ? "🏆 " : "🔒 ") + a.name, cx0 + 10, cy0 + rowH * 0.32, W * 0.031, has ? "#ffe08a" : "#fff", 800, "left");
    text(a.desc, cx0 + 10, cy0 + rowH * 0.68, W * 0.026, "rgba(255,255,255,.6)", 400, "left");
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  button("back", (W - W * 0.4) / 2, H - W * 0.13, W * 0.4, W * 0.10, "返 回", "ghost");
}

/* ================= 输入 ================= */
let touchStart = null;
touchCbs.start.push(p => {
  touchStart = { x: p.x, y: p.y, t: Date.now() };
  if (mode === "play") {
    for (const b of btns) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return;
    press();
  }
});
touchCbs.move.push(p => {
  if (mode === "stats" && touchStart) {
    statsScroll -= (p.y - touchStart.y) * 0.9;
    touchStart.y = p.y;
  }
});
touchCbs.end.push(p => {
  const st = touchStart; touchStart = null;
  if (!st) return;
  if (Math.abs(p.x - st.x) > 12 || Math.abs(p.y - st.y) > 24 || Date.now() - st.t > 500) return;
  for (const b of btns) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { handleAction(b.id); return; }
  }
});
function handleAction(id) {
  ensureAC();
  if (id === "start") startGame("classic");
  else if (id === "sprint") startGame("sprint");
  else if (id === "daily") startGame("daily");
  else if (id === "stats") { mode = "stats"; statsScroll = 0; }
  else if (id === "back") mode = "menu";
  else if (id === "home") { mode = "menu"; }
  else if (id === "mute") { muted = !muted; }
  else if (id === "again") startGame(gmode === "daily" ? "daily" : gmode);
  else if (id === "share") doChallengeShare();
  else if (id === "counter") doCounterShare();
  else if (id === "lw_reroll") lwText = genLastWords(lastDeathCause);
  else if (id === "lw_edit") editText(lwText, 20, v => { if (v) lwText = v; });
  else if (id.indexOf("skin_") === 0) {
    const sk = skinById(id.slice(5));
    if (skinUnlocked(sk)) { skinId = sk.id; store.set("bb_skin", skinId); toast("皮肤已切换：" + sk.name, "#7cffb2"); }
    else toast("未解锁 · " + sk.hint, "#ff6b81");
  }
}

/* ================= 初始化 ================= */
(function initStars() {
  for (let i = 0; i < 24; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8, s: 0.5 + Math.random() * 1.8 });
  vig = makeCanvas(Math.round(W * DPR), Math.round(H * DPR));
  const v = vig.getContext("2d");
  const g = v.createRadialGradient(vig.width / 2, vig.height / 2, Math.min(vig.width, vig.height) * 0.42, vig.width / 2, vig.height / 2, Math.max(vig.width, vig.height) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.5)");
  v.fillStyle = g; v.fillRect(0, 0, vig.width, vig.height);
})();
if (isWx && wx.onError) { try { wx.onError(msg => { try { wx.getRealtimeLogManager && wx.getRealtimeLogManager().error(msg); } catch (e) {} }); } catch (e) {} }

let launchQuery = {};
if (isWx) { try { launchQuery = (wx.getLaunchOptionsSync() || {}).query || {}; } catch (e) {} }
else if (__G.__QUERY__) launchQuery = __G.__QUERY__;
armRevenge(launchQuery);
if (isWx) { try { wx.onShow(res => { if (res && res.query && res.query.t) armRevenge(res.query); }); } catch (e) {} }

/* 测试钩子（仅浏览器 harness 生效） */
if (!isWx && __G.__TEST__) {
  const T = __G.__TEST__;
  if (T === "autotest" || T === "autolose" || T === "autodaily" || T === "autosprint" || T === "autorev" || T === "autorevlose") {
    setTimeout(() => {
      startGame(T === "autodaily" ? "daily" : (T === "autosprint" ? "sprint" : "classic"));
      setInterval(() => {
        if (mode !== "play" || !ring) return;
        const forceDie = T === "autolose" || (T === "autorev" && score > rev.score + 4) || (T === "autorevlose" && score > 6);
        ring.f = forceDie ? T_FRAC * 2.5 : T_FRAC;
        press();
      }, T === "autolose" ? 1300 : 300);
    }, 500);
  }
  if (T === "autostats") setTimeout(() => { mode = "stats"; }, 800);
  if (T === "autorev") armRevenge({ t: "rev", c: 2, s: 50, m: "死于阴阳缩放" });
  if (T === "autorevlose") armRevenge({ t: "rev", c: 1, s: 200, m: "遥遥领先永不服" });
}
requestAnimationFrame(loop);
})();
