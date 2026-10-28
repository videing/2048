/* 四人麻将 · 单文件版（兼容微信内置浏览器） */
/**
 * 麻将规则引擎（浏览器版）
 * 万 1-9(0-8) · 筒 1-9(9-17) · 条 1-9(18-26) · 东南西北中发白(27-33)
 */

const SUIT_NAMES = ['万', '筒', '条'];
const HONOR_NAMES = ['东', '南', '西', '北', '中', '發', '白'];

const KINDS = 34;

function kindName(k) {
  if (k >= 27) return HONOR_NAMES[k - 27];
  return ((k % 9) + 1) + SUIT_NAMES[Math.floor(k / 9)];
}

function emptyCounts() {
  const c = new Array(KINDS).fill(0);
  return c;
}

function countsFromTiles(tiles) {
  const c = emptyCounts();
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] >= 0) c[tiles[i]]++;
  }
  return c;
}

function checkMelds(c, need, wild) {
  if (need === 0) {
    for (let i = 0; i < KINDS; i++) if (c[i] !== 0) return false;
    return wild === 0;
  }
  let i = 0;
  while (i < KINDS && c[i] === 0) i++;
  if (i === KINDS) return wild === need * 3;

  if (c[i] >= 3) {
    c[i] -= 3;
    if (checkMelds(c, need - 1, wild)) {
      c[i] += 3;
      return true;
    }
    c[i] += 3;
  }
  if (c[i] === 2 && wild >= 1) {
    c[i] -= 2;
    if (checkMelds(c, need - 1, wild - 1)) {
      c[i] += 2;
      return true;
    }
    c[i] += 2;
  }
  if (c[i] === 1 && wild >= 2) {
    c[i] -= 1;
    if (checkMelds(c, need - 1, wild - 2)) {
      c[i] += 1;
      return true;
    }
    c[i] += 1;
  }

  if (i < 27 && i % 9 <= 6) {
    const has1 = c[i + 1] > 0;
    const has2 = c[i + 2] > 0;
    const needW = (has1 ? 0 : 1) + (has2 ? 0 : 1);
    if (needW <= wild) {
      c[i]--;
      if (has1) c[i + 1]--;
      if (has2) c[i + 2]--;
      const ok = checkMelds(c, need - 1, wild - needW);
      c[i]++;
      if (has1) c[i + 1]++;
      if (has2) c[i + 2]++;
      if (ok) return true;
    }
  }
  return false;
}

function checkSevenPairs(counts, wild) {
  let pairs = 0;
  let singles = 0;
  for (let i = 0; i < KINDS; i++) {
    const c = counts[i];
    pairs += Math.floor(c / 2);
    if (c % 2) singles++;
  }
  const useForSingles = Math.min(singles, wild);
  pairs += useForSingles;
  const left = wild - useForSingles;
  pairs += Math.floor(left / 2);
  return singles - useForSingles === 0 && pairs === 7;
}

function canWinHand(counts, meldCount, wild) {
  wild = wild || 0;
  const need = 4 - meldCount;
  if (need < 0) return false;

  let total = 0;
  for (let i = 0; i < KINDS; i++) total += counts[i];
  if (total + wild !== need * 3 + 2) return false;

  if (meldCount === 0 && total + wild === 14 && checkSevenPairs(counts, wild)) {
    return true;
  }

  const c = counts.slice();

  for (let j = 0; j < KINDS; j++) {
    if (c[j] >= 2) {
      c[j] -= 2;
      const ok = checkMelds(c, need, wild);
      c[j] += 2;
      if (ok) return true;
    }
  }
  for (let j = 0; j < KINDS; j++) {
    if (c[j] === 1 && wild >= 1) {
      c[j] -= 1;
      const ok = checkMelds(c, need, wild - 1);
      c[j] += 1;
      if (ok) return true;
    }
  }
  if (wild >= 2 && checkMelds(c, need, wild - 2)) return true;

  return false;
}

function waitingTiles(counts, meldCount, wild) {
  wild = wild || 0;
  const res = [];
  for (let k = 0; k < KINDS; k++) {
    if (k === 31) {
      // 红中是癞子，只能作为万能牌加进去，不能写进 counts
      if (canWinHand(counts, meldCount, wild + 1)) res.push(k);
      continue;
    }
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (canWinHand(counts, meldCount, wild)) res.push(k);
    counts[k]--;
  }
  return res;
}

function makeWall() {
  const wall = [];
  for (let k = 0; k < KINDS; k++) {
    for (let i = 0; i < 4; i++) wall.push(k);
  }
  return wall;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/* ================= 画布 ================= */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W = 0, H = 0;
let rotated = false;
let TABLE_X, TABLE_W, TABLE_Y, TABLE_H, HAND_Y, HAND_H, HAND_W, BTN_Y, BTN_H, TILE_W, TILE_H, M;

function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 竖屏时 #stage 被 CSS 旋转 90°，画布的实际布局尺寸就是横屏尺寸
  const cw = canvas.clientWidth || (vh > vw ? vh : vw);
  const ch = canvas.clientHeight || (vh > vw ? vw : vh);

  W = cw;
  H = ch;
  rotated = vh > vw;

  canvas.width = Math.round(cw * DPR);
  canvas.height = Math.round(ch * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const portrait = false; // 旋转后永远按横屏布局
  void portrait;

  {
    M = Math.round(W * 0.009);
    TABLE_X = Math.round(W * 0.155);
    TABLE_W = W - TABLE_X * 2;
    TABLE_Y = Math.round(H * 0.11);
    TABLE_H = Math.round(H * 0.585);
    HAND_Y = Math.round(H * 0.805);
    HAND_H = Math.round(H * 0.145);
    HAND_W = Math.round(W * 0.047);
    BTN_Y = Math.round(H * 0.715);
    BTN_H = Math.round(H * 0.07);
    TILE_W = Math.round(W * 0.021);
    TILE_H = Math.round(H * 0.062);
  }
}

/* ================= 状态 ================= */

/* ---------- 牌面贴图（真实牌面，9x4 精灵图） ---------- */
const ASSET_V = '23'; // 每次更新资源都要改，防缓存
const TILE_COLS = 9;
const TILE_ROWS = 4;
let tileSheet = null;

// 行0=万1-9 行1=条1-9 行2=筒1-9 行3=北白南中發東西
const HONOR_CELL = {
  27: [3, 5], // 东
  28: [3, 2], // 南
  29: [3, 6], // 西
  30: [3, 0], // 北
  31: [3, 3], // 中
  32: [3, 4], // 發
  33: [3, 1]  // 白
};

function tileCell(k) {
  if (k >= 27) return HONOR_CELL[k] || [3, 0];
  const suit = Math.floor(k / 9); // 0=万 1=筒 2=条
  const num = k % 9;
  // 图片行序：第1行万、第2行条、第3行筒
  const row = suit === 0 ? 0 : suit === 1 ? 2 : 1;
  return [row, num];
}

function loadTiles() {
  try {
    const img = new Image();
    img.onload = function () { tileSheet = img; };
    img.onerror = function () { tileSheet = null; };
    img.src = './tiles.jpg?v=' + ASSET_V;
  } catch (e) {}
}

const NAMES = ['你', '下家', '对家', '上家'];const COLORS = ['#f2b179', '#6fb2f2', '#b58cf2', '#5fd0a8'];
const SEAT_TINT = ['#8a5a33', '#2b4f7a', '#4a3a6b', '#2b6b52'];
const NUM_CN = ['一', '二', '三', '四', '伍', '六', '七', '八', '九'];

let seats = [];
let wall = [];
let active = [0, 1, 2, 3];
let turn = 0;
let phase = 'lobby'; // lobby | hostWait | joinWait | playing | over
let lastDiscard = null;
let pendingClaims = [];
let winner = null;
let winInfo = null;
let message = '';
let hits = [];
let lastDiscardT = 0;
let discardSeq = 0;
let ttsWarmed = false;
let speakText = '';
let speakT0 = 0;
let roundNo = 1;
let turnT0 = Date.now();
let claimT0 = 0;
const TURN_LIMIT = 5000;
let firstDiscard = null;
let followSeats = {};
let lastProgressT = Date.now();
let winT = 0;
let dealT0 = 0;
let drewT0 = 0;
let showExit = false;
let wildMode = true; // 红中是否当癞子

let me = 0;
let isHost = false;
let isOnline = false;
let peer = null;
let conn = null;
let conns = [];       // [{conn, seat}]
let joinAttempt = 0;
let lobbySeats = [0];
let roomCode = '';
let debugLog = [];
let stateVersion = 0;
let lastSentVersion = -1;
let hostReady = false;

/* ================= 音效 ================= */

let actx = null;
let muted = false;

function audio() {
  if (muted) return null;
  if (!actx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    } catch (e) {
      actx = null;
      return null;
    }
  }
  if (actx.state === 'suspended') {
    try { actx.resume(); } catch (e) {}
  }
  return actx;
}

function unlockAudio() {
  // iOS / 微信：必须在用户手势里创建并 resume
  const c = audio();
  if (c && c.state === 'suspended') {
    try { c.resume(); } catch (e) {}
  }
  ttsUnlock();
  loadVoices();
  // iOS 还需要一个 HTMLAudio 解锁
  try {
    if (!window.__silentUnlocked) {
      window.__silentUnlocked = true;
      const a = document.createElement('audio');
      a.setAttribute('playsinline', '');
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      a.volume = 0.01;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
}

function beep(freq, dur, type, vol) {  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    const v = vol == null ? 0.05 : vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  } catch (e) {}
}

const VOICE_RATE=8000;const VOICE_SEG=[[0,2053],[2453,2283],[5136,4036],[9572,3737],[13709,3381],[17490,3590],[21480,3696],[25576,3511],[29487,3651],[33538,3641],[37579,3852],[41831,4357],[46588,4225],[51213,3710],[55323,3992],[59715,4113],[64228,3716],[68344,4143],[72887,4022],[77309,4268],[81977,4785],[87162,4561],[92123,4187],[96710,4400],[101510,4534],[106444,4243],[111087,4586],[116073,3850],[120323,3952],[124675,4307],[129382,3910],[133692,4114],[138206,4324],[142930,3554]];

let voiceBuf = null;
let voiceLoading = false;

function loadVoices() {
  if (voiceBuf || voiceLoading) return;
  const c = audio();
  if (!c) return;
  voiceLoading = true;
  try {
    fetch('./voices.wav?v=' + ASSET_V)
      .then(r => r.arrayBuffer())
      .then(b => c.decodeAudioData(b))
      .then(buf => { voiceBuf = buf; })
      .catch(() => {})
      .then(() => { voiceLoading = false; });
  } catch (e) {
    voiceLoading = false;
  }
}

function playVoice(k) {
  if (!voiceBuf) return false;
  const c = audio();
  if (!c) return false;
  const seg = VOICE_SEG[k];
  if (!seg || !seg[1]) return false;
  try {
    const src = c.createBufferSource();
    src.buffer = voiceBuf;
    src.connect(c.destination);
    src.start(0, seg[0] / VOICE_RATE, seg[1] / VOICE_RATE);
    return true;
  } catch (e) {
    return false;
  }
}

/* 报牌：出什么牌念什么 */
const SPEAK_HONOR = ['东', '南', '西', '北', '红中', '发财', '白板'];
const SPEAK_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SPEAK_SUIT = ['万', '筒', '条'];

function speakName(k) {
  if (k >= 27) return SPEAK_HONOR[k - 27];
  return SPEAK_CN[k % 9] + SPEAK_SUIT[Math.floor(k / 9)];
}

function ttsUnlock() {
  if (ttsWarmed || !window.speechSynthesis) return;
  ttsWarmed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = 'zh-CN';
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

function speakTile(k) {
  if (k == null || k < 0) return;
  // 视觉报牌（听不到声音时也能看到）
  speakText = speakName(k);
  speakT0 = Date.now();

  if (muted) return;

  // 优先用内置语音包（真机最可靠）
  if (playVoice(k)) return;

  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(speakName(k));
    u.lang = 'zh-CN';
    u.rate = 1.3;
    u.pitch = 1.05;
    u.volume = 0.95;
    s.speak(u);
  } catch (e) {}
}

const sfx = {
  tile() {
    const c = audio();
    if (!c) return;
    try {
      // 出牌：木质"啪"——短噪声经带通 + 低频撞击
      const dur = 0.07;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 0.85;
      const g = c.createGain();
      g.gain.value = 0.5;
      src.connect(bp);
      bp.connect(g);
      g.connect(c.destination);
      src.start(c.currentTime);
    } catch (e) {}
    beep(190, 0.05, 'triangle', 0.06);
  },
  draw() { beep(520, 0.03, 'triangle', 0.02); },
  peng() { beep(520, 0.08, 'square', 0.045); setTimeout(() => beep(680, 0.09, 'square', 0.04), 70); },
  gang() { beep(420, 0.1, 'sawtooth', 0.04); setTimeout(() => beep(620, 0.12, 'sawtooth', 0.035), 90); },
  win() { [660, 880, 1046, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.055), i * 110)); },
  shuffle() { for (let i = 0; i < 8; i++) setTimeout(() => beep(300 + Math.random() * 500, 0.025, 'square', 0.02), i * 45); }
};

/* ================= 游戏逻辑 ================= */

function nextSeat(i) {
  const idx = active.indexOf(i);
  if (idx < 0) return active[0];
  return active[(idx + 1) % active.length];
}

function sortHand(i) {
  seats[i].hand.sort((a, b) => a - b);
}

function newGame(keepScores) {
  const oldScores = keepScores && seats.length === 4 ? seats.map(s => s.score) : null;

  seats = [];
  for (let i = 0; i < 4; i++) {
    seats.push({
      hand: [], melds: [], discards: [],
      score: oldScores ? (oldScores[i] || 0) : 0,
      ai: i !== 0,
      name: NAMES[i]
    });
  }
  active = [0, 1, 2, 3];
  wall = shuffle(makeWall());
  turn = 0;
  phase = 'playing';
  turnT0 = Date.now();
  claimT0 = 0;
  firstDiscard = null;
  followSeats = {};
  lastProgressT = Date.now();
  winner = null;
  winInfo = null;
  lastDiscard = null;
  pendingClaims = [];
  message = '你的回合';
  me = 0;
  sfx.shuffle();

  for (let round = 0; round < 13; round++) active.forEach(i => seats[i].hand.push(wall.pop()));
  seats[0].hand.push(wall.pop());
  seats.forEach((s, i) => sortHand(i));
  dealT0 = Date.now();
  drewT0 = 0;
  stateVersion++;
}

function drawFor(i) {
  if (!wall.length) {
    phase = 'over';
    winner = -1;
    message = '牌墙摸完，流局';
    return false;
  }
  seats[i].hand.push(wall.pop());
  if (seats[i].ai) sortHand(i);
  else if (i === me) drewT0 = Date.now();
  return true;
}

function splitWild(tiles) {
  const counts = countsFromTiles(tiles);
  if (!wildMode) return { counts, wild: 0 };
  const wild = counts[31] || 0;
  counts[31] = 0;
  return { counts, wild };
}

function canSelfWin(i) {
  const w = splitWild(seats[i].hand);
  return canWinHand(w.counts, seats[i].melds.length, w.wild);
}

function claimOptions(p, tile) {
  const s = seats[p];
  const w = splitWild(s.hand);
  const counts = w.counts;
  const opts = [];

  // 只能自摸：别人打的牌不能胡
  if (tile === 31 && wildMode) {
    return opts;
  }

  counts[tile]++;
  counts[tile]--;
  if (counts[tile] >= 2) opts.push({ type: 'peng' });
  if (counts[tile] >= 3) opts.push({ type: 'gang' });
  return opts;
}

function discardTile(i, idx) {
  const s = seats[i];
  const tile = s.hand.splice(idx, 1)[0];
  sortHand(i);
  s.discards.push(tile);
  lastDiscard = { tile, from: i, seq: ++discardSeq };
  lastDiscardT = Date.now();
  sfx.tile();
  speakTile(tile);

  // 跟打规则：首张牌被其余三家跟打，首家人各赔 1 分
  if (!firstDiscard) {
    firstDiscard = { tile: tile, from: i };
  } else if (firstDiscard && i !== firstDiscard.from && tile === firstDiscard.tile && !followSeats[i]) {
    followSeats[i] = 1;
    message = seatLabel(i) + ' 跟打 ' + kindName(tile);
    const cnt = Object.keys(followSeats).length;
    if (cnt >= 3) {
      const f = firstDiscard.from;
      active.forEach(function (p) {
        if (p === f) return;
        seats[f].score -= 1;
        seats[p].score += 1;
      });
      message = seatLabel(f) + ' 首牌 ' + kindName(tile) + ' 被三家跟打，各赔 1 分';
      firstDiscard = null;
      followSeats = {};
      stateVersion++;
    }
  }

  const claims = [];
  const base = active.indexOf(i);
  for (let k = 1; k < active.length; k++) {
    const p = active[(base + k) % active.length];
    const opts = claimOptions(p, tile);
    if (opts.length) claims.push({ seat: p, opts });
  }

  const aiClaims = claims.filter(c => seats[c.seat].ai);
  const humanClaims = claims.filter(c => !seats[c.seat].ai);

  if (aiClaims.length) {
    const order = { win: 0, gang: 1, peng: 2 };
    let best = null;
    aiClaims.forEach(c => c.opts.forEach(o => {
      if (o.type === 'chi') return;
      if (!best || order[o.type] < order[best.opt.type]) best = { seat: c.seat, opt: o };
    }));
    if (best) {
      applyClaim(best.seat, best.opt, tile, i);
      return;
    }
  }

  if (humanClaims.length) {
    pendingClaims = humanClaims;
    phase = 'claim';
    claimT0 = Date.now();
    message = '等待玩家操作…';
    stateVersion++;
    return;
  }

  pendingClaims = [];
  nextTurn(i);
}

function applyClaim(seat, opt, tile, from) {
  const s = seats[seat];
  if (opt.type === 'win') { doWin(seat, from, false); return; }

  if (opt.type === 'peng') {
    s.hand.splice(s.hand.indexOf(tile), 1);
    s.hand.splice(s.hand.indexOf(tile), 1);
    s.melds.push({ type: 'peng', tiles: [tile, tile, tile], from });
    seats[from].discards.pop();
    sfx.peng();
    message = seatLabel(seat) + ' 碰 ' + kindName(tile);
  } else if (opt.type === 'gang') {
    for (let k = 0; k < 3; k++) s.hand.splice(s.hand.indexOf(tile), 1);
    s.melds.push({ type: 'gang', tiles: [tile, tile, tile, tile], from });
    seats[from].discards.pop();
    sfx.gang();
    // 明杠：放杠的人赔 1 分
    seats[from].score -= 1;
    s.score += 1;
    message = seatLabel(seat) + ' 杠 ' + kindName(tile) + '（' + seatLabel(from) + ' 赔 1 分）';
    drawFor(seat);
  }

  lastDiscard = null;
  sortHand(seat);
  turn = seat;
  phase = 'playing';
  turnT0 = Date.now();
  stateVersion++;

  if (s.ai) setTimeout(() => aiDiscard(seat), 450);
}

function doWin(seat, from, selfDraw) {
  phase = 'over';
  winner = seat;
  const s = seats[seat];
  const info = fanOf(seat, selfDraw);

  const deltas = {};
  active.forEach(i => { deltas[i] = 0; });

  // 1. 底分结算
  active.forEach(i => {
    if (i === seat) return;
    const pay = selfDraw ? info.fan : i === from ? info.fan * 2 : info.fan;
    deltas[i] -= pay;
    deltas[seat] += pay;
  });

  // 2. 胡后摸牌：带红中摸 4 张，不带红中摸 6 张；摸到 1/5/9/东/红中，每家赔 1 分
  const allTiles = s.hand.slice();
  s.melds.forEach(m => m.tiles.forEach(t => allTiles.push(t)));
  const hasRed = allTiles.indexOf(31) >= 0;
  const drawCount = hasRed ? 4 : 6;

  const bonusTiles = [];
  for (let i = 0; i < drawCount && wall.length; i++) bonusTiles.push(wall.pop());

  let bonusHits = 0;
  bonusTiles.forEach(k => {
    if (k === 27 || k === 31) bonusHits++;
    else if (k < 27 && (k % 9 === 0 || k % 9 === 4 || k % 9 === 8)) bonusHits++;
  });

  if (bonusHits) {
    active.forEach(i => {
      if (i === seat) return;
      deltas[i] -= bonusHits;
      deltas[seat] += bonusHits;
    });
  }

  // 3. 落分（强制零和：赢家得分 = 其他三家扣分之和的相反数）
  let othersSum = 0;
  active.forEach(i => { if (i !== seat) othersSum += deltas[i]; });
  deltas[seat] = -othersSum;
  active.forEach(i => { seats[i].score += deltas[i]; });

  winInfo = {
    fan: info.fan,
    name: info.name,
    selfDraw,
    deltas,
    hasRed,
    drawCount,
    bonusTiles,
    bonusHits
  };
  message = selfDraw
    ? (seat === me ? '你自摸！' : seatLabel(seat) + ' 自摸')
    : seatLabel(seat) + ' 胡了 ' + (lastDiscard ? kindName(lastDiscard.tile) : '');
  winT = Date.now();
  sfx.win();
  stateVersion++;
}

function fanOf(seat, selfDraw) {
  const s = seats[seat];
  const tiles = s.hand.slice();
  s.melds.forEach(m => m.tiles.forEach(t => tiles.push(t)));

  const honors = tiles.filter(k => k >= 27 && k !== 31).length;
  const suitSet = {};
  tiles.forEach(k => { if (k < 27) suitSet[Math.floor(k / 9)] = 1; });
  const pure = honors === 0 && Object.keys(suitSet).length === 1;

  const w = splitWild(s.hand);
  let sevenPairs = false;
  if (!s.melds.length) {
    let pairs = 0;
    let singles = 0;
    for (let i = 0; i < 34; i++) {
      const c = w.counts[i];
      pairs += Math.floor(c / 2);
      if (c % 2) singles++;
    }
    const use = Math.min(singles, w.wild);
    pairs += use;
    singles -= use;
    pairs += Math.floor((w.wild - use) / 2);
    sevenPairs = singles === 0 && pairs === 7;
  }

  let pengPeng = false;
  if (w.wild === 0) {
    let tripletOk = true;
    let pairCount = 0;
    for (let i = 0; i < 34; i++) {
      const c = w.counts[i];
      if (c === 0) continue;
      if (c === 2) pairCount++;
      else if (c !== 3) tripletOk = false;
    }
    const allPeng = s.melds.every(m => m.type !== 'chi');
    pengPeng = tripletOk && pairCount === 1 && allPeng;
  }

  let fan = 1;
  let name = '平胡';
  if (pure) { fan = 3; name = '清一色'; }
  else if (sevenPairs) { fan = 2; name = '七对'; }
  else if (pengPeng) { fan = 2; name = '碰碰胡'; }
  if (!s.melds.length) { fan += 1; name += '·门清'; }
  if (selfDraw) { fan += 1; name += '·自摸'; }
  return { fan, name };
}

function nextTurn(from) {
  turn = nextSeat(from);
  lastDiscard = null;
  phase = 'playing';
  const s = seats[turn];
  if (!drawFor(turn)) return;
  turnT0 = Date.now();
  stateVersion++;
  if (s.ai) {
    message = seatLabel(turn) + ' 摸牌…';
    setTimeout(() => aiTurn(turn), 340);
  } else {
    message = turn === me ? '你的回合' : seatLabel(turn) + ' 回合';
  }
}

function aiTurn(i) {
  if (phase === 'over') return;
  if (canSelfWin(i)) { doWin(i, i, true); return; }
  const counts = countsFromTiles(seats[i].hand);
  for (let k = 0; k < 34; k++) {
    if (k === 31 && wildMode) continue;
    if (counts[k] === 4) { concealedGang(i, k); return; }
  }
  aiDiscard(i);
}

function concealedGang(i, k) {
  const s = seats[i];
  for (let n = 0; n < 4; n++) s.hand.splice(s.hand.indexOf(k), 1);
  s.melds.push({ type: 'gang', tiles: [k, k, k, k], from: -1, concealed: true });
  sfx.gang();
  // 暗杠：其他三家各赔 2 分
  let income = 0;
  active.forEach(j => {
    if (j === i) return;
    seats[j].score -= 2;
    income += 2;
  });
  s.score += income;
  message = seatLabel(i) + ' 暗杠 ' + kindName(k) + '（每家赔 2 分）';
  drawFor(i);
  turn = i;
  phase = 'playing';
  turnT0 = Date.now();
  stateVersion++;
  if (s.ai) setTimeout(() => aiDiscard(i), 420);
}

function aiDiscard(i) {
  if (phase === 'over') return;
  const s = seats[i];
  if (!s.hand.length) return;
  discardTile(i, pickAiDiscard(s));
}

function pickAiDiscard(s) {
  const counts = countsFromTiles(s.hand);
  let bestIdx = 0, bestScore = Infinity;
  for (let idx = 0; idx < s.hand.length; idx++) {
    const k = s.hand[idx];
    let score = (counts[k] - 1) * 4;
    if (k < 27) {
      const r = k % 9;
      if (r >= 1 && counts[k - 1]) score += 2;
      if (r <= 7 && counts[k + 1]) score += 2;
      if (r >= 2 && counts[k - 2]) score += 1;
      if (r <= 6 && counts[k + 2]) score += 1;
      if (r === 0 || r === 8) score -= 1;
    } else if (counts[k] === 1) score -= 2;
    score += Math.random() * 0.4;
    if (score < bestScore) { bestScore = score; bestIdx = idx; }
  }
  return bestIdx;
}

/* ================= 联机 ================= */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 国内可用的 STUN（Google 的在国内基本不通）
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.chat.bilibili.com:3478' },
    { urls: 'stun:stun.hitv.com:3478' },
    { urls: 'stun:stun.cdnbye.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 4
};

function peerOpts(id) {
  const o = { debug: 0, config: ICE_CONFIG };
  if (id) o.id = id;
  return o;
}

function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function log(msg) {
  const d = new Date();
  const t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  debugLog.push(t + ' ' + msg);
  if (debugLog.length > 5) debugLog.shift();
}

function inviteLink() {
  return location.origin + location.pathname + '?room=' + roomCode;
}

function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function bindHostEvents() {
  peer.on('open', () => {
    isHost = true;
    isOnline = true;
    me = 0;
    hostReady = true;
    phase = phase === 'lobby' ? 'hostWait' : phase;
    log('房间 ' + roomCode + ' 已就绪');
  });

  peer.on('connection', (c) => {
    c.on('open', () => {
      if (conns.length >= 3) { c.send({ t: 'full' }); return; }
      const seat = conns.length + 1;
      conns.push({ conn: c, seat });
      c.send({ t: 'welcome', seat });
      log('玩家加入 → ' + NAMES[seat]);
      broadcastLobby();

      // 已经开局了：把当前牌局补发给新连上的人
      if (phase === 'playing' || phase === 'over') {
        c.send({ t: 'start', seat, wild: wildMode });
        c.send({ t: 'state', v: viewFor(seat) });
      }
    });
    c.on('data', (msg) => onHostData(c, msg));
    c.on('close', () => {
      conns = conns.filter(x => x.conn !== c);
      log('玩家离开');
    });
  });

  peer.on('error', (e) => {
    const map = {
      network: '网络错误：信令服务器连不上',
      'server-error': '信令服务器异常',
      'browser-incompatible': '浏览器不支持 WebRTC',
      'unavailable-id': '房间号冲突'
    };
    log('错误: ' + (map[e.type] || e.type));
    if (e.type === 'unavailable-id') {
      roomCode = makeCode();
      setTimeout(recreateHostPeer, 400);
    }
  });

  peer.on('disconnected', () => {
    log('信令断开，重连…');
    setTimeout(() => {
      if (!peer || peer.destroyed) return;
      try { peer.reconnect(); } catch (err) {}
      setTimeout(() => {
        if (isHost && peer && peer.disconnected) {
          log('重连失败，重新注册房间');
          recreateHostPeer();
        }
      }, 2500);
    }, 800);
  });

  peer.on('close', () => log('连接已关闭'));
}

function recreateHostPeer() {
  if (!isHost || !roomCode) return;
  if (peer && !peer.destroyed) {
    try { peer.destroy(); } catch (e) {}
  }
  peer = new Peer('mj4-' + roomCode, peerOpts());
  bindHostEvents();
}

function startHost(fixedCode) {
  roomCode = fixedCode || makeCode();
  conns = [];
  peer = new Peer('mj4-' + roomCode, peerOpts());
  bindHostEvents();
}

function broadcastLobby() {
  const seatsArr = [0].concat(conns.map(function (c) { return c.seat; }));
  conns.forEach(function (c) {
    c.conn.send({ t: 'lobby', seats: seatsArr, wild: wildMode });
  });
}

function onHostData(conn, msg) {
  const c = conns.find(x => x.conn === conn);
  if (!c) return;
  if (msg.t === 'act') hostApply(c.seat, msg);
}

function hostApply(seat, msg) {
  if (phase === 'over') return;
  if (msg.a === 'discard') {
    if (phase !== 'playing' || turn !== seat) return;
    const idx = seats[seat].hand.indexOf(msg.k);
    if (idx >= 0) discardTile(seat, idx);
  } else if (msg.a === 'pass') {
    if (phase === 'claim') { pendingClaims = []; nextTurn(lastDiscard.from); }
  } else {
    if (phase !== 'claim' || !lastDiscard) return;
    const mine = pendingClaims.find(c => c.seat === seat);
    if (!mine) return;
    const opt = mine.opts.find(o => o.type === msg.a);
    if (!opt) return;
    if (opt.type === 'win') doWin(seat, lastDiscard.from, false);
    else applyClaim(seat, opt, lastDiscard.tile, lastDiscard.from);
  }
}

function startHostGame() {
  roundNo = 1;
  newGame();
  conns.forEach(c => {
    if (seats[c.seat]) { seats[c.seat].ai = false; seats[c.seat].name = '玩家' + c.seat; }
  });
  phase = 'playing';
  conns.forEach(c => c.conn.send({ t: 'start', seat: c.seat, wild: wildMode }));
  stateVersion++;
  log('开局 · 真人 ' + (conns.length + 1) + ' 人');
}

function startJoin(code) {
  roomCode = (code || '').toUpperCase();
  joinAttempt = 0;
  phase = 'joinWait';
  tryJoin();
}

function tryJoin() {
  if (conn && conn.open) return;
  if (peer && !peer.destroyed) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  conn = null;

  peer = new Peer(peerOpts());

  peer.on('open', () => {
    conn = peer.connect('mj4-' + roomCode, { reliable: true });
    if (!conn) {
      log('创建连接失败');
      return;
    }

    conn.on('open', () => {
      isOnline = true;
      isHost = false;
      joinAttempt = 0;
      log('✅ 已连接房间 ' + roomCode);
    });

    // 直连超时提示
    setTimeout(() => {
      if (conn && !conn.open) {
        log('直连失败：双方网络可能互不可达');
      }
    }, 12000);

    conn.on('data', (msg) => onClientData(msg));

    conn.on('close', () => {
      log('与房主断开');
      if (phase === 'playing') {
        phase = 'lobby';
        seats = [];
      }
    });
  });

  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable') {
      joinAttempt++;
      if (joinAttempt <= 60) {
        log('等待房主上线…' + joinAttempt + '/60');
        setTimeout(tryJoin, 3000);
      } else {
        log('连接失败：房主页面已关闭');
        phase = 'lobby';
      }
      return;
    }
    const map2 = {
      network: '网络错误：信令服务器连不上',
      'server-error': '信令服务器异常',
      'browser-incompatible': '浏览器不支持 WebRTC'
    };
    log('错误: ' + (map2[e.type] || e.type));
  });
}

function onClientData(msg) {
  if (msg.t === 'welcome') { me = msg.seat; log('入座 ' + NAMES[me]); return; }
  if (msg.t === 'lobby') {
    if (msg.seats) lobbySeats = msg.seats;
    if (msg.wild !== undefined) wildMode = msg.wild;
    return;
  }
  if (msg.t === 'start') {
    if (msg.seat) me = msg.seat;
    if (msg.wild === false) wildMode = false;
    phase = 'playing';
    log('开局！' + (wildMode ? '红中癞子' : '普通模式'));
    return;
  }
  if (msg.t === 'state') { applyView(msg.v); return; }
  if (msg.t === 'full') { log('房间已满'); phase = 'lobby'; return; }
}

function viewFor(seat) {
  return {
    seats: seats.map(s => ({
      name: s.name, score: s.score, melds: s.melds, discards: s.discards,
      handCount: s.hand.length, ai: s.ai
    })),
    hand: seat >= 0 && seats[seat] ? seats[seat].hand : [],
    turn, phase, wallCount: wall.length, lastDiscard, message, winner, winInfo, active
  };
}

function broadcastState() {
  if (!isHost || !isOnline) return;
  conns.forEach(c => c.conn.send({ t: 'state', v: viewFor(c.seat) }));
  lastSentVersion = stateVersion;
}

function applyView(v) {
  if (v.turn !== turn) turnT0 = Date.now();
  if (v.phase === 'claim' && phase !== 'claim') claimT0 = Date.now();
  const prevSeq = lastDiscard && lastDiscard.seq;
  if (v.lastDiscard && v.lastDiscard.seq !== prevSeq) {
    speakTile(v.lastDiscard.tile);
  }
  seats = v.seats.map(s => ({
    name: s.name, score: s.score, melds: s.melds, discards: s.discards,
    hand: new Array(s.handCount).fill(-1), ai: s.ai
  }));
  if (seats[me]) seats[me].hand = v.hand;
  turn = v.turn;
  phase = v.phase;
  wall = new Array(v.wallCount).fill(-1);
  lastDiscard = v.lastDiscard;
  message = v.message;
  winner = v.winner;
  winInfo = v.winInfo;
  active = v.active;
}

/* ================= 绘制工具 ================= */

function rr(c, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function pipLayout(n) {
  switch (n) {
    case 1: return [[0, 0]];
    case 2: return [[0, -1], [0, 1]];
    case 3: return [[-1, -1], [0, 0], [1, 1]];
    case 4: return [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    case 5: return [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];
    case 6: return [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]];
    case 7: return [[-1, -1.35], [1, -1.35], [0, -0.6], [-1, 0.25], [1, 0.25], [-1, 1.1], [1, 1.1]];
    case 8: return [[-1, -1.4], [1, -1.4], [-1, -0.47], [1, -0.47], [-1, 0.47], [1, 0.47], [-1, 1.4], [1, 1.4]];
    default: return [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  }
}

const faceGradCache = {};
function faceGrad(w, h) {
  const key = Math.round(w) + '_' + Math.round(h);
  if (!faceGradCache[key]) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fffefb');
    g.addColorStop(0.42, '#fdf7e8');
    g.addColorStop(1, '#efe2c6');
    faceGradCache[key] = g;
  }
  return faceGradCache[key];
}

function inkText(txt, x, y, size, color) {
  ctx.font = 'bold ' + Math.round(size) + 'px "Songti SC", "SimSun", "STSong", serif';
  ctx.fillStyle = 'rgba(92,54,32,0.20)';
  ctx.fillText(txt, x + 1, y + 1.6);
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
}

function drawDots(cx, cy, w, h, n) {
  const pts = pipLayout(n);
  const base = Math.min(w, h);
  const rad = base * (n === 1 ? 0.3 : n <= 2 ? 0.19 : n <= 6 ? 0.126 : 0.1);

  pts.forEach((p, i) => {
    const x = cx + p[0] * w * 0.215;
    const y = cy + p[1] * h * 0.255;

    // 参考实体牌：绿外环 + 白圈 + 红心 + 深色圆心
    const navy = n >= 4 && i % 2 === 1;
    const outer = navy ? '#20304a' : '#1b7a45';

    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = outer; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rad * 0.74, 0, Math.PI * 2); ctx.fillStyle = '#fdfaf0'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rad * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#c2352b'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rad * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#1b7a45'; ctx.fill();
  });
}

function drawBird(cx, cy, w, h) {
  const s = Math.min(w, h) * 0.3;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#1b7a45';
  ctx.lineWidth = Math.max(1.5, s * 0.17);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.75, s * 0.55); ctx.lineTo(s * 0.3, -s * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.2); ctx.lineTo(s * 0.25, -s * 0.45); ctx.stroke();

  ctx.fillStyle = '#c2352b';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.42, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.35, s * 0.27, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#1b7a45';
  ctx.beginPath(); ctx.ellipse(-s * 0.05, s * 0.05, s * 0.34, s * 0.18, -0.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#141414';
  ctx.beginPath(); ctx.arc(s * 0.64, -s * 0.4, s * 0.075, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#d99a2b';
  ctx.beginPath();
  ctx.moveTo(s * 0.79, -s * 0.36);
  ctx.lineTo(s * 1.06, -s * 0.27);
  ctx.lineTo(s * 0.79, -s * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBamboo(cx, cy, w, h, n) {
  if (n === 1) { drawBird(cx, cy, w, h); return; }

  const pts = pipLayout(n);
  const bw = w * 0.135, bh = h * 0.195;

  const redIdx = (n === 3 || n === 7) ? 0 : (n === 5 ? 2 : -1);

  pts.forEach((p, i) => {
    const x = cx + p[0] * w * 0.22;
    const y = cy + p[1] * h * 0.25;
    const color = i === redIdx ? '#b8302a' : '#1b7a45';

    ctx.fillStyle = color;
    rr(ctx, x - bw / 2, y - bh / 2, bw, bh, bw * 0.42);
    ctx.fill();

    // 中间浅色竹芯
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    rr(ctx, x - bw * 0.2, y - bh / 2 + 1.5, bw * 0.4, bh - 3, bw * 0.2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, bw * 0.14);
    ctx.beginPath(); ctx.moveTo(x - bw / 2 + 1, y - bh * 0.2); ctx.lineTo(x + bw / 2 - 1, y - bh * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - bw / 2 + 1, y + bh * 0.2); ctx.lineTo(x + bw / 2 - 1, y + bh * 0.2); ctx.stroke();
  });
}

function drawTileFace(x, y, w, h, k, opt) {
  opt = opt || {};
  const r = Math.max(2.5, Math.min(w, h) * 0.12);
  const faceH = h - Math.max(2, h * 0.05);

  ctx.fillStyle = '#c2ab82';
  rr(ctx, x, y + 2, w, faceH, r);
  ctx.fill();

  // 有贴图就直接用真牌图片
  if (tileSheet && k >= 0) {
    const cell = tileCell(k);
    const cw = tileSheet.width / TILE_COLS;
    const chh = tileSheet.height / TILE_ROWS;

    ctx.save();
    rr(ctx, x, y, w, faceH, r);
    ctx.clip();
    ctx.drawImage(tileSheet, cell[1] * cw, cell[0] * chh, cw, chh, x, y, w, faceH);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, 1.5, 1.5, w - 3, Math.max(2, faceH * 0.09), r * 0.6);
    ctx.fill();
    ctx.restore();

    if (opt.hl) {
      ctx.strokeStyle = '#ffb64d';
      ctx.lineWidth = 2;
      rr(ctx, x + 1, y + 1, w - 2, faceH - 1, r);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(90,80,60,0.32)';
      ctx.lineWidth = 1;
      rr(ctx, x + 0.5, y + 0.5, w - 1, faceH - 1, r);
      ctx.stroke();
    }
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = faceGrad(w, faceH);
  rr(ctx, 0, 0, w, faceH, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(198,176,132,0.5)';
  ctx.lineWidth = 1;
  rr(ctx, 2.5, 2.5, w - 5, faceH - 5, r * 0.72);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  rr(ctx, 1.5, 1.5, w - 3, Math.max(2, faceH * 0.1), r * 0.6);
  ctx.fill();
  ctx.restore();

  if (opt.hl) {
    ctx.strokeStyle = '#ffb64d';
    ctx.lineWidth = 2;
    rr(ctx, x + 1, y + 1, w - 2, faceH - 1, r);
    ctx.stroke();
  }

  const cx = x + w / 2;
  const cy = y + faceH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (k < 0) return;

  if (k >= 27) {
    const names = ['东', '南', '西', '北', '中', '發', '白'];
    const nm = names[k - 27];
    if (nm === '白') {
      const s = Math.min(w, faceH) * 0.62;
      ctx.strokeStyle = '#1f2d3d';
      ctx.lineWidth = Math.max(1.6, w * 0.055);
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      ctx.lineWidth = Math.max(1, w * 0.028);
      const g2 = s * 0.1;
      ctx.strokeRect(cx - s / 2 + g2, cy - s / 2 + g2, s - g2 * 2, s - g2 * 2);
    } else {
      const honorColor = nm === '中' ? '#b3261e' : nm === '發' ? '#14703f' : '#1f2d3d';
      inkText(nm, cx, cy + 1, faceH * 0.6, honorColor);
    }
    return;
  }

  const suit = Math.floor(k / 9);
  const num = (k % 9) + 1;
  if (suit === 0) {
    // 传统牌：数字和「萬」都是红色
    inkText(NUM_CN[num - 1], cx, y + faceH * 0.29, faceH * 0.37, '#b3261e');
    inkText('萬', cx, y + faceH * 0.71, faceH * 0.39, '#b3261e');
  } else if (suit === 1) {
    drawDots(cx, cy, w, faceH, num);
  } else {
    drawBamboo(cx, cy, w, faceH, num);
  }
}

function drawTileBack(x, y, w, h) {
  ctx.fillStyle = '#2f6b4f';
  rr(ctx, x, y, w, h, Math.max(2, w * 0.12));
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(2, w * 0.12));
  ctx.stroke();
}

/* ================= 绘制：牌桌 ================= */

function getGrad(key, factory) {
  if (!window.__grads) window.__grads = {};
  if (!window.__grads[key]) window.__grads[key] = factory();
  return window.__grads[key];
}

function drawTable() {
  const x = TABLE_X, y = TABLE_Y, w = TABLE_W, h = TABLE_H;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, x + 2, y + 12, w, h, 18);
  ctx.fill();

  const side = getGrad('side', () => {
    const g = ctx.createLinearGradient(0, y + h - 6, 0, y + h + 10);
    g.addColorStop(0, '#4a3018');
    g.addColorStop(1, '#1d1207');
    return g;
  });
  ctx.fillStyle = side;
  rr(ctx, x, y + 8, w, h, 18);
  ctx.fill();

  const wood = getGrad('wood', () => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#8a6339');
    g.addColorStop(0.12, '#69492a');
    g.addColorStop(0.55, '#432d18');
    g.addColorStop(1, '#2a1a0c');
    return g;
  });
  ctx.fillStyle = wood;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,226,182,0.35)';
  ctx.lineWidth = 2;
  rr(ctx, x + 2, y + 2, w - 4, h - 4, 16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212,175,110,0.45)';
  ctx.lineWidth = 1;
  rr(ctx, x + 7, y + 7, w - 14, h - 14, 13);
  ctx.stroke();

  const cx = x + w / 2, cy = y + h / 2;
  const felt = getGrad('felt', () => {
    const g = ctx.createRadialGradient(cx, cy - 14, 24, cx, cy, w * 0.6);
    g.addColorStop(0, '#2f855f');
    g.addColorStop(0.5, '#1d5c43');
    g.addColorStop(1, '#0d3022');
    return g;
  });
  ctx.fillStyle = felt;
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 12);
  ctx.fill();

  ctx.save();
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 12);
  ctx.clip();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * H);
    ctx.stroke();
  }
  const gloss = getGrad('gloss', () => {
    const g = ctx.createRadialGradient(cx, cy - h * 0.42, 8, cx, cy, w * 0.48);
    g.addColorStop(0, 'rgba(255,255,255,0.13)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    return g;
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function relOf(i) {
  return ((i - me) % 4 + 4) % 4;
}

function seatLabel(i) {
  if (i === me) return '你';
  return ['你', '下家', '对家', '上家'][relOf(i)];
}

function seatZone(i) {
  const left = TABLE_X + 10;
  const right = TABLE_X + TABLE_W - 10;
  const top = TABLE_Y + 8;
  const bottom = TABLE_Y + TABLE_H - 8;
  const r = relOf(i);
  if (r === 2) return { x: W / 2, y: top, anchor: 'top', perRow: 8 };
  if (r === 3) return { x: left, y: (top + bottom) / 2, anchor: 'left', perRow: 4 };
  if (r === 1) return { x: right, y: (top + bottom) / 2, anchor: 'right', perRow: 4 };
  return { x: W / 2, y: bottom, anchor: 'bottom', perRow: 8 };
}

function seatAnchor(i) {
  const r = relOf(i);
  if (r === 2) return { x: W / 2, y: 6 };
  if (r === 3) return { x: 50, y: TABLE_Y + TABLE_H / 2 };
  if (r === 1) return { x: W - 50, y: TABLE_Y + TABLE_H / 2 };
  return { x: W / 2, y: HAND_Y + 10 };
}

function drawDiscards(now) {
  const tw = TILE_W, th = TILE_H, gap = 2;
  const animT = now - lastDiscardT;

  active.forEach(i => {
    const s = seats[i];
    if (!s || !s.discards.length) return;
    const z = seatZone(i);
    const rows = Math.ceil(s.discards.length / z.perRow);

    s.discards.forEach((k, idx) => {
      const row = Math.floor(idx / z.perRow);
      const col = idx % z.perRow;
      const rowCount = Math.min(z.perRow, s.discards.length - row * z.perRow);
      let x, y;

      if (z.anchor === 'top') {
        const totalW = rowCount * (tw + gap) - gap;
        x = z.x - totalW / 2 + col * (tw + gap);
        y = z.y + row * (th + gap);
      } else if (z.anchor === 'bottom') {
        const totalW = rowCount * (tw + gap) - gap;
        x = z.x - totalW / 2 + col * (tw + gap);
        y = z.y - (rows - row) * (th + gap);
      } else if (z.anchor === 'left') {
        x = z.x + row * (tw + gap);
        y = z.y - (Math.min(z.perRow, s.discards.length) * (th + gap) - gap) / 2 + col * (th + gap);
      } else {
        x = z.x - row * (tw + gap) - tw;
        y = z.y - (Math.min(z.perRow, s.discards.length) * (th + gap) - gap) / 2 + col * (th + gap);
      }

      const isLast = lastDiscard && lastDiscard.from === i && idx === s.discards.length - 1;
      let scale = 1;
      if (isLast && animT < 190) {
        const p = 1 - Math.pow(1 - animT / 190, 3);
        const a = seatAnchor(i);
        const f = (1 - p) * 0.5;
        x += (a.x - x) * f;
        y += (a.y - y) * f;
        scale = 0.82 + 0.18 * p;
      }

      ctx.save();
      ctx.translate(x + tw / 2, y + th / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      rr(ctx, -tw / 2 + 1, -th / 2 + 2, tw, th, 3);
      ctx.fill();
      drawTileFace(-tw / 2, -th / 2, tw, th, k, { hl: isLast });
      ctx.restore();
    });
  });
}

function drawWall() {
  const remain = wall.length;
  const cx = W / 2;
  const cy = TABLE_Y + TABLE_H / 2 + 6;
  const stacks = Math.min(14, Math.ceil(remain / 4));
  const bw = Math.round(W * 0.0105), bh = Math.round(H * 0.036);
  const startX = cx - (stacks * (bw + 1)) / 2;

  for (let i = 0; i < stacks; i++) {
    drawTileBack(startX + i * (bw + 1), cy - bh - 2, bw, bh);
    drawTileBack(startX + i * (bw + 1), cy + 2, bw, bh);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e9e3d4';
  ctx.font = 'bold ' + Math.round(H * 0.033) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('第 ' + roundNo + ' 局 · 剩 ' + remain + ' 张', cx, cy + bh + 8);

  if (message) {
    ctx.fillStyle = '#9fd8b8';
    ctx.font = Math.round(H * 0.028) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(message, cx, cy + bh + 26);
  }

  // 报牌（听不到声音也能看到念的是什么）
  const dt2 = Date.now() - speakT0;
  if (speakText && dt2 < 1400) {
    const a2 = dt2 < 1000 ? 1 : (1400 - dt2) / 400;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a2);
    ctx.fillStyle = '#ffd08a';
    ctx.font = 'bold ' + Math.round(H * 0.042) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('📢 ' + speakText, cx, cy + bh + 48);
    ctx.restore();
  }
}

function drawAvatar(x, y, r, seat) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, COLORS[seat]);
  g.addColorStop(1, SEAT_TINT[seat]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.22, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + r * 0.55, r * 0.45, Math.PI, 0);
  ctx.fill();

  if (turn === seat && phase === 'playing' && seat !== me) {
    const t = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(t / 260);
    ctx.beginPath();
    ctx.arc(x, y, r + 3 + pulse * 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,208,138,' + (0.35 + 0.55 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawHandBacks(c, n) {
  if (c.pos === 'top') {
    const bw = 5, bh = 9, gap = 1;
    const count = Math.min(n, 14);
    const startX = c.x + c.w - 14 - count * (bw + gap);
    for (let i = 0; i < count; i++) {
      drawTileBack(startX + i * (bw + gap), c.y + 9, bw, bh);
    }
  } else {
    const bw = 5, bh = 7, gap = 1;
    const maxN = Math.max(0, Math.floor((c.h - 52) / (bh + gap)));
    const count = Math.min(n, maxN, 14);
    for (let i = 0; i < count; i++) {
      drawTileBack(c.x + 7, c.y + 46 + i * (bh + gap), bw, bh);
    }
  }
}

function drawSeats() {
  const topSeat = (me + 2) % 4;
  const rightSeat = (me + 1) % 4;
  const leftSeat = (me + 3) % 4;

  const cards = [
    { i: topSeat, x: W / 2 - W * 0.12, y: 2, w: W * 0.24, h: H * 0.1, v: false, pos: 'top' },
    { i: leftSeat, x: W * 0.05, y: TABLE_Y + 34, w: W * 0.098, h: H * 0.26, v: true, pos: 'left' },
    { i: rightSeat, x: W - W * 0.148, y: TABLE_Y + 34, w: W * 0.098, h: H * 0.26, v: true, pos: 'right' }
  ];

  cards.forEach(c => {
    if (active.indexOf(c.i) < 0 || !seats[c.i]) return;
    const s = seats[c.i];
    const isTurn = turn === c.i && phase === 'playing';

    ctx.fillStyle = isTurn ? 'rgba(242,177,121,0.22)' : 'rgba(255,255,255,0.06)';
    rr(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fill();
    ctx.strokeStyle = isTurn ? 'rgba(255,208,138,0.6)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    rr(ctx, c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, 10);
    ctx.stroke();

    drawHandBacks(c, s.hand.length);

    if (c.v) {
      drawAvatar(c.x + c.w / 2, c.y + 20, 13, c.i);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS[c.i];
      ctx.font = 'bold 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(seatLabel(c.i), c.x + c.w / 2, c.y + 40);
      ctx.fillStyle = '#e7e2d6';
      ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(s.hand.length + ' 张', c.x + c.w / 2, c.y + 57);
      ctx.fillText((s.score > 0 ? '+' : '') + s.score + ' 分', c.x + c.w / 2, c.y + 72);
    } else {
      drawAvatar(c.x + 19, c.y + 19, 12, c.i);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS[c.i];
      ctx.font = 'bold 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(seatLabel(c.i), c.x + 36, c.y + 8);
      ctx.fillStyle = '#e7e2d6';
      ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(s.hand.length + ' 张 · ' + (s.score > 0 ? '+' : '') + s.score + ' 分', c.x + 36, c.y + 24);
    }
  });
}

function drawHumanArea() {
  const s = seats[me];
  if (!s) return;
  hits = hits.filter(h => h.action !== 'tile');

  const now = Date.now();

  // 副露
  let mx = W * 0.01;
  const my = BTN_Y + 2;
  s.melds.forEach(m => {
    m.tiles.forEach((k, i) => {
      if (m.concealed && (i === 0 || i === 3)) drawTileBack(mx, my, TILE_W * 0.85, TILE_H * 0.9);
      else drawTileFace(mx, my, TILE_W * 0.85, TILE_H * 0.9, k, {});
      mx += TILE_W * 0.9;
    });
    mx += 5;
  });

  // 发牌动画：逐张亮出
  const dealing = now - dealT0 < 1000;
  const total = s.hand.length;
  const reveal = dealing ? Math.min(total, Math.floor((now - dealT0) / 68)) : total;

  // 手牌布局（摸到的牌留出更大的缝）
  // 手牌数为 3n+2 说明还捏着一张摸到的牌：一直留缝，直到打出才合并
  const drawnIdx = (s.hand.length % 3 === 2) ? total - 1 : -1;
  const flyIn = !dealing && drewT0 && now - drewT0 < 1500;
  const gapExtra = drawnIdx >= 0 ? Math.round(HAND_W * 0.55) : 0;
  const lift = Math.round(HAND_H * 0.08);
  const totalW = total * (HAND_W + 2) + gapExtra;
  const hx0 = (W - totalW) / 2;

  const wallX = W / 2;
  const wallY = TABLE_Y + TABLE_H / 2;

  for (let i = 0; i < reveal; i++) {
    let x = hx0 + i * (HAND_W + 2) + (drawnIdx >= 0 && i >= drawnIdx ? gapExtra : 0);
    let y = HAND_Y - (drawnIdx >= 0 && i === drawnIdx ? lift : 0);
    let scale = 1;

    // 发牌：最新一张从牌墙飞入
    if (dealing && i === reveal - 1) {
      const p = 1 - Math.pow(1 - Math.min(1, (now - dealT0 - (reveal - 1) * 68) / 140), 3);
      x = wallX + (x - wallX) * p;
      y = wallY + (y - wallY) * p;
      scale = 0.7 + 0.3 * p;
    }

    // 摸牌：从牌墙飞入
    if (flyIn && i === drawnIdx) {
      const p = 1 - Math.pow(1 - Math.min(1, (now - drewT0) / 240), 3);
      x = wallX + (x - wallX) * p;
      y = wallY + (y - wallY) * p;
      scale = 0.8 + 0.2 * p;
    }

    if (scale !== 1) {
      ctx.save();
      ctx.translate(x + HAND_W / 2, y + HAND_H / 2);
      ctx.scale(scale, scale);
      drawTileFace(-HAND_W / 2, -HAND_H / 2, HAND_W, HAND_H, s.hand[i], {});
      ctx.restore();
    } else {
      drawTileFace(x, y, HAND_W, HAND_H, s.hand[i], {});
    }
    hits.push({ x, y, w: HAND_W, h: HAND_H, action: 'tile', idx: i });
  }

  drawAvatar(26, HAND_Y + 26, 15, me);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS[me];
  ctx.font = 'bold 12px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('你', 46, HAND_Y + 10);
  ctx.fillStyle = '#e7e2d6';
  ctx.font = 'bold 12px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText((s.score > 0 ? '+' : '') + s.score + ' 分', 46, HAND_Y + 26);

  if (phase === 'playing' && turn === me && !canSelfWin(me)) {
    const w = splitWild(s.hand);
    const waits = waitingTiles(w.counts, s.melds.length, w.wild);
    if (waits.length) {
      ctx.fillStyle = '#7fd6a0';
      ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText('听 ' + waits.map(kindName).join('/'), 46, HAND_Y + 42);
    }
  }
}

function drawControls() {
  const bw = 46, bh = 24, y = 6;
  const exitX = W - bw - 8;
  const muteX = exitX - bw - 8;

  const soundOk = !muted && actx && actx.state === 'running';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = soundOk ? 'rgba(255,255,255,0.10)' : 'rgba(217,74,52,0.75)';
  rr(ctx, muteX, y, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = '#e7e2d6';
  ctx.font = '13px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(soundOk ? '🔊' : '🔇', muteX + bw / 2, y + bh / 2 + 1);
  hits.push({ x: muteX, y, w: bw, h: bh, action: 'mute' });

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  rr(ctx, exitX, y, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = '#e7e2d6';
  ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('退出', exitX + bw / 2, y + bh / 2 + 1);
  hits.push({ x: exitX, y, w: bw, h: bh, action: 'exit' });

  ctx.textBaseline = 'top';
}

function drawButtons() {
  const btns = [];
  const canAct = !isOnline || isHost || !isHost;

  if (phase === 'playing' && turn === me) {
    if (canSelfWin(me)) btns.push({ label: '自摸胡', action: 'win', color: '#d94a34', w: 76 });
    const counts = countsFromTiles(seats[me].hand);
    for (let k = 0; k < 34; k++) {
      if (counts[k] === 4) { btns.push({ label: '暗杠 ' + kindName(k), action: 'angang', color: '#7a4fd0', w: 84, payload: k }); break; }
    }
  }

  if (phase === 'claim' && lastDiscard) {
    const opts = isHost ? (pendingClaims.find(c => c.seat === me) || { opts: [] }).opts
                        : claimOptions(me, lastDiscard.tile);
    opts.forEach(o => {
      // 只能自摸，没有点炮胡
      if (o.type === 'peng') btns.push({ label: '碰', action: 'peng', color: '#2f7dd0', w: 56 });
      if (o.type === 'gang') btns.push({ label: '杠', action: 'gang', color: '#7a4fd0', w: 56 });
    });
    if (btns.length) btns.push({ label: '过', action: 'pass', color: '#4a4a4a', w: 56 });
  }

  const gap = 8;
  let total = btns.reduce((a, b) => a + b.w + gap, 0);
  if (total) total -= gap;
  let x = (W - total) / 2;

  btns.forEach(b => {
    ctx.fillStyle = b.color;
    rr(ctx, x, BTN_Y, b.w, BTN_H, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(b.label, x + b.w / 2, BTN_Y + BTN_H / 2);
    ctx.textBaseline = 'top';
    hits.push({ x, y: BTN_Y, w: b.w, h: BTN_H, action: b.action, payload: b.payload });
    x += b.w + gap;
  });
}

function drawOver(now) {
  const t = Math.min(1, (now - winT) / 280);
  const ease = 1 - Math.pow(1 - t, 3);
  ctx.fillStyle = 'rgba(8,10,12,' + (0.85 * ease).toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);

  const slide = (1 - ease) * 14;
  const f = Math.min(H * 0.062, 34);
  const f2 = Math.min(H * 0.038, 21);
  const f3 = Math.min(H * 0.032, 18);

  let y = H * 0.05 + slide;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = winner === me ? '#f2b179' : '#f3f1ea';
  ctx.font = 'bold ' + Math.round(f) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(winner === me ? '你胡了 🎉' : winner > 0 ? seatLabel(winner) + ' 胡了' : '流局', W / 2, y);
  y += f + 14;

  if (winInfo) {
    ctx.fillStyle = '#ffd08a';
    ctx.font = 'bold ' + Math.round(f2) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(winInfo.name + ' · ' + winInfo.fan + ' 番', W / 2, y);
    y += f2 + 10;
  }

  if (winInfo && winInfo.bonusTiles) {
    const list = winInfo.bonusTiles.map(kindName).join(' ');
    ctx.fillStyle = '#9fd8b8';
    ctx.font = Math.round(f3) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('胡后摸 ' + winInfo.drawCount + ' 张（' + (winInfo.hasRed ? '带红中' : '无红中') + '）：' + list, W / 2, y);
    y += f3 + 8;

    if (winInfo.bonusHits > 0) {
      ctx.fillStyle = '#ffd08a';
      ctx.fillText('命中 1/5/9/东/中 ' + winInfo.bonusHits + ' 张 · 每家再赔 ' + winInfo.bonusHits + ' 分', W / 2, y);
    } else {
      ctx.fillStyle = '#7f8c85';
      ctx.fillText('没有命中，无额外得分', W / 2, y);
    }
    y += f3 + 12;
  }

  ctx.fillStyle = '#c9c3b7';
  ctx.font = Math.round(f3) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(message, W / 2, y);
  y += f3 + 12;

  active.forEach((i) => {
    const s = seats[i];
    if (!s) return;
    const d = winInfo && winInfo.deltas ? winInfo.deltas[i] : 0;
    ctx.fillStyle = i === me ? '#f2b179' : '#9b968b';
    ctx.font = (i === me ? 'bold ' : '') + Math.round(f3) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(seatLabel(i) + '  ' + (d > 0 ? '+' : '') + d + '  （总 ' + s.score + '）', W / 2, y);
    y += f3 + 8;
  });

  y += H * 0.02;
  const boss = isHost || !isOnline;
  const bw = Math.min(W * 0.17, 190);
  const bh = Math.min(H * 0.095, 50);
  const gap = 14;
  const total = boss ? bw * 2 + gap : bw;
  let bx = (W - total) / 2;

  ctx.textBaseline = 'middle';
  if (boss) {
    ctx.fillStyle = '#f2b179';
    rr(ctx, bx, y, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = '#241a10';
    ctx.font = 'bold ' + Math.round(f3) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('再来一局', bx + bw / 2, y + bh / 2);
    hits.push({ x: bx, y, w: bw, h: bh, action: 'nextRound' });
    bx += bw + gap;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, bx, y, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = '#e7e2d6';
  ctx.font = 'bold ' + Math.round(f3) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(boss ? '退出' : '返回大厅', bx + bw / 2, y + bh / 2);
  hits.push({ x: bx, y, w: bw, h: bh, action: 'back' });
  ctx.textBaseline = 'top';

  if (!boss) {
    ctx.fillStyle = '#9b968b';
    ctx.font = Math.round(f3 * 0.85) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('等待房主开始下一局…（分数会累加）', W / 2, y + bh + 10);
  }
}

/* ================= 大厅 ================= */

let inputCode = '';
let showInput = false;

function previewVoices() {
  unlockAudio();
  if (!voiceBuf) {
    log('语音包加载中…');
    setTimeout(previewVoices, 900);
    return;
  }
  let k = 0;
  const tick = function () {
    if (k >= 34) {
      log('试听结束');
      return;
    }
    log('试听 ' + (k + 1) + '/34 → ' + speakName(k));
    const c = audio();
    if (c && voiceBuf) {
      try {
        const src = c.createBufferSource();
        src.buffer = voiceBuf;
        src.connect(c.destination);
        src.start(0, VOICE_SEG[k][0] / VOICE_RATE, VOICE_SEG[k][1] / VOICE_RATE);
      } catch (e) {}
    }
    k++;
    setTimeout(tick, 850);
  };
  tick();
}

function drawLobby(now) {
  ctx.fillStyle = '#0b1410';
  ctx.fillRect(0, 0, W, H);

  const titleSize = Math.min(H * 0.115, 50);
  const subSize = Math.min(H * 0.042, 18);
  const codeSize = Math.min(H * 0.13, 52);
  const btnH = Math.min(H * 0.11, 56);
  const btnW = Math.min(W * 0.16, 180);
  const btnFont = Math.min(H * 0.045, 20);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2b179';
  ctx.font = 'bold ' + Math.round(titleSize) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('四人麻将', W / 2, H * 0.1);

  ctx.fillStyle = '#9b968b';
  ctx.font = Math.round(subSize) + 'px -apple-system, "PingFang SC", sans-serif';
  let sub;
  if (phase === 'hostWait') {
    sub = '已加入 ' + (conns.length + 1) + '/4 人 · 人齐了再点「开始游戏」';
  } else if (phase === 'joinWait') {
    sub = isOnline
      ? ('已加入 ' + lobbySeats.length + '/4 人 · 等待房主开始')
      : ('正在连接 ' + roomCode + '…');
  } else {
    sub = '同一房间 4 人 · 空位自动补电脑';
  }
  ctx.fillText(sub, W / 2, H * 0.1 + titleSize + 14);

  const inRoom = phase === 'hostWait' || phase === 'joinWait';

  if (inRoom) {
    ctx.fillStyle = '#6f8a7c';
    ctx.font = Math.round(subSize * 0.9) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('房间号', W / 2, H * 0.255);

    ctx.fillStyle = '#ffd08a';
    ctx.font = 'bold ' + Math.round(codeSize) + 'px monospace';
    ctx.fillText(roomCode, W / 2, H * 0.285);

    const seatList = isHost ? [0].concat(conns.map(function (c) { return c.seat; })) : lobbySeats;
    const chipW = Math.min(W * 0.235, 210);
    const chipH = Math.min(H * 0.085, 36);
    const gapX = 12;
    const gapY = 8;
    const startX = (W - (chipW * 2 + gapX)) / 2;
    const startY = H * 0.44;

    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx2 = startX + (i % 2) * (chipW + gapX);
      const cy2 = startY + Math.floor(i / 2) * (chipH + gapY);
      const joined = seatList.indexOf(i) >= 0;
      const mine = i === me;
      const tag = i === 0 ? '房主' : joined ? '真人' : '电脑';

      ctx.fillStyle = joined ? 'rgba(47,125,90,0.28)' : 'rgba(255,255,255,0.05)';
      rr(ctx, cx2, cy2, chipW, chipH, 8);
      ctx.fill();
      ctx.strokeStyle = mine ? 'rgba(242,177,121,0.9)' : joined ? 'rgba(127,214,160,0.65)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = mine ? 2 : 1;
      rr(ctx, cx2 + 0.5, cy2 + 0.5, chipW - 1, chipH - 1, 8);
      ctx.stroke();

      ctx.fillStyle = mine ? '#f2b179' : joined ? '#9fd8b8' : '#6f8a7c';
      ctx.font = 'bold ' + Math.round(Math.min(H * 0.04, 15)) + 'px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(seatLabel(i) + ' · ' + tag, cx2 + chipW / 2, cy2 + chipH / 2);
    }
    ctx.textBaseline = 'top';
  }
  // 试听按钮（大厅）
  if (phase === 'lobby') {
    const pw = Math.min(W * 0.3, 200);
    const phh = Math.min(H * 0.085, 38);
    const px = (W - pw) / 2;
    const py = H * 0.44;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    rr(ctx, px, py, pw, phh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,177,121,0.4)';
    ctx.lineWidth = 1;
    rr(ctx, px + 0.5, py + 0.5, pw - 1, phh - 1, 8);
    ctx.stroke();
    ctx.fillStyle = '#f2b179';
    ctx.font = 'bold ' + Math.round(Math.min(H * 0.04, 15)) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 试听牌名', px + pw / 2, py + phh / 2);
    ctx.textBaseline = 'top';
    hits.push({ x: px, y: py, w: pw, h: phh, action: 'preview' });
  }

  // 红中癞子开关
  if (phase === 'lobby' || inRoom) {
    const tw = Math.min(W * 0.24, 200);
    const thh = Math.min(H * 0.075, 38);
    const tx = (W - tw) / 2;
    const ty = H * 0.63;
    ctx.fillStyle = wildMode ? 'rgba(242,177,121,0.18)' : 'rgba(255,255,255,0.06)';
    rr(ctx, tx, ty, tw, thh, 8);
    ctx.fill();
    ctx.strokeStyle = wildMode ? '#f2b179' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    rr(ctx, tx + 0.5, ty + 0.5, tw - 1, thh - 1, 8);
    ctx.stroke();
    ctx.fillStyle = wildMode ? '#f2b179' : '#9b968b';
    ctx.font = 'bold ' + Math.round(Math.min(H * 0.042, 16)) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('红中当癞子：' + (wildMode ? '开' : '关'), tx + tw / 2, ty + thh / 2);
    ctx.textBaseline = 'top';
    if (isHost || !isOnline) hits.push({ x: tx, y: ty, w: tw, h: thh, action: 'wild' });
  }

  const btns = [];
  if (phase === 'lobby') {
    btns.push({ label: '创建房间', action: 'host', color: '#f2b179', dark: true });
    btns.push({ label: '加入房间', action: 'joinInput', color: '#2f7dd0' });
  } else if (phase === 'hostWait') {
    btns.push({ label: '开始游戏', action: 'startGame', color: '#f2b179', dark: true });
    btns.push({ label: '返回', action: 'back', color: '#3a3a3a' });
  } else if (phase === 'joinWait') {
    btns.push({ label: '取消', action: 'back', color: '#3a3a3a' });
  }

  const gap = 16;
  const total = btns.length * btnW + (btns.length - 1) * gap;
  let x = (W - total) / 2;
  const y = H * 0.72;

  btns.forEach(b => {
    ctx.fillStyle = b.color;
    rr(ctx, x, y, btnW, btnH, 10);
    ctx.fill();
    ctx.fillStyle = b.dark ? '#241a10' : '#fff';
    ctx.font = 'bold ' + Math.round(btnFont) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, x + btnW / 2, y + btnH / 2);
    ctx.textBaseline = 'top';
    hits.push({ x, y, w: btnW, h: btnH, action: b.action });
    x += btnW + gap;
  });

  // 邀请链接
  if (phase === 'hostWait') {
    const lw = Math.min(W * 0.62, 460);
    const lh = Math.min(H * 0.085, 40);
    const lx = (W - lw) / 2;
    const ly = y + btnH + 16;

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(ctx, lx, ly, lw, lh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,177,121,0.55)';
    ctx.lineWidth = 1;
    rr(ctx, lx + 0.5, ly + 0.5, lw - 1, lh - 1, 8);
    ctx.stroke();
    ctx.fillStyle = '#f2b179';
    ctx.font = 'bold ' + Math.round(Math.min(H * 0.042, 16)) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('📋 复制邀请链接', lx + lw / 2, ly + lh / 2);
    ctx.textBaseline = 'top';
    hits.push({ x: lx, y: ly, w: lw, h: lh, action: 'copyLink' });

    ctx.fillStyle = '#6f8a7c';
    ctx.font = Math.round(Math.min(H * 0.03, 11)) + 'px monospace';
    ctx.fillText(inviteLink(), W / 2, ly + lh + 8);
  }

  // 调试日志
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(160,200,175,0.7)';
  ctx.font = Math.round(Math.min(H * 0.028, 13)) + 'px monospace';
  debugLog.forEach((line, i) => ctx.fillText(line, W * 0.02, H * 0.86 + i * 16));
}

/* ================= 主绘制 ================= */

function draw(now) {
  hits = [];

  if (phase === 'lobby' || phase === 'hostWait' || phase === 'joinWait') {
    drawLobby(now);
    return;
  }

  const bg = getGrad('bg', () => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#11201a');
    g.addColorStop(1, '#0a120e');
    return g;
  });
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (seats.length) {
    drawTable();
    drawDiscards(now);
    drawWall();
    drawSeats();
    drawHumanArea();
    drawControls();
    drawButtons();
    if (phase === 'over') drawOver(now);
  }

  const vig = getGrad('screenVig', () => {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    return g;
  });
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawRotateHint(now);
}

let hintT0 = Date.now();

function drawRotateHint(now) {
  if (!rotated) return;
  const t = now - hintT0;
  if (t > 3000) return;
  const a = t < 2400 ? 1 : (3000 - t) / 600;

  ctx.save();
  ctx.globalAlpha = Math.max(0, a) * 0.9;
  const hw = Math.min(W * 0.5, 320);
  const hh = Math.min(H * 0.115, 52);
  rr(ctx, (W - hw) / 2, 12, hw, hh, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fill();
  ctx.fillStyle = '#f2b179';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(Math.min(H * 0.05, 16)) + 'px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('📱 请把手机横过来', W / 2, 12 + hh / 2);
  ctx.restore();
  ctx.textBaseline = 'top';
}

/* ================= 输入 ================= */

function onTap(x, y) {
  for (const h of hits) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      handle(h);
      return;
    }
  }
}

function handle(h) {
  if (h.action === 'mute') {
    const soundOk = !muted && actx && actx.state === 'running';
    if (soundOk) {
      muted = true;
    } else {
      muted = false;
      unlockAudio();
      beep(880, 0.12, 'sine', 0.06);
    }
    return;
  }
  if (h.action === 'wild') {
    wildMode = !wildMode;
    log('红中癞子：' + (wildMode ? '开' : '关'));
    return;
  }
  if (h.action === 'preview') {
    previewVoices();
    return;
  }
  if (h.action === 'copyLink') {
    const ok = copyText(inviteLink());
    log(ok ? '✅ 邀请链接已复制' : '复制失败，请长按下方链接');
    return;
  }
  if (h.action === 'exit') {
    if (window.confirm('确定退出本局？')) window.location.reload();
    return;
  }
  if (h.action === 'tile') {
    if (phase !== 'playing' || turn !== me) return;
    const k = seats[me].hand[h.idx];
    if (isHost || !isOnline) discardTile(me, h.idx);
    else sendAct('discard', { k });
    return;
  }
  if (h.action === 'host') { startHost(); return; }
  if (h.action === 'joinInput') {
    const code = prompt('输入 4 位房间号');
    if (code && code.trim().length >= 3) startJoin(code.trim());
    return;
  }
  if (h.action === 'startGame') { startHostGame(); return; }
  if (h.action === 'nextRound') {
    roundNo++;
    newGame(true);
    if (isOnline && isHost) {
      conns.forEach(c => {
        if (seats[c.seat]) {
          seats[c.seat].ai = false;
          seats[c.seat].name = '玩家' + c.seat;
        }
        c.conn.send({ t: 'start', seat: c.seat, wild: wildMode });
      });
      stateVersion++;
    }
    return;
  }
  if (h.action === 'back') {
    if (isOnline) {
      phase = 'lobby';
      isOnline = false;
      isHost = false;
      conns = [];
      seats = [];
      roundNo = 1;
      return;
    }
    window.location.reload();
    return;
  }

  if (!isHost && isOnline) {
    if (h.action === 'win') return;
    if (h.action === 'angang') return;
    sendAct(h.action === 'discardWin' ? 'win' : h.action);
    return;
  }

  if (h.action === 'win') doWin(me, me, true);
  // 只能自摸，无点炮胡
  else if (h.action === 'peng') applyClaim(me, { type: 'peng' }, lastDiscard.tile, lastDiscard.from);
  else if (h.action === 'gang') applyClaim(me, { type: 'gang' }, lastDiscard.tile, lastDiscard.from);
  else if (h.action === 'angang') concealedGang(me, h.payload);
  else if (h.action === 'pass') { pendingClaims = pendingClaims.filter(c => c.seat !== me); if (!pendingClaims.length) nextTurn(lastDiscard.from); }
}

function sendAct(a, extra) {
  if (!conn || !conn.open) return;
  const msg = { t: 'act', a };
  if (extra) Object.assign(msg, extra);
  conn.send(msg);
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const r = canvas.getBoundingClientRect();
  let x, y;
  if (rotated) {
    // 竖屏时画布被旋转了 90°，需要把屏幕坐标换算回画布坐标
    x = e.clientY - r.top;
    y = r.width - (e.clientX - r.left);
  } else {
    x = e.clientX - r.left;
    y = e.clientY - r.top;
  }
  onTap(x, y);
});

// 任何点击/触摸都尝试解锁（覆盖顶部按钮、页面空白处）
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('touchstart', unlockAudio, true);
window.addEventListener('click', unlockAudio, true);

// 尺寸变化：resize 不一定触发（手机转屏/微信内嵌），再加轮询兜底
let lastVW = window.innerWidth;
let lastVH = window.innerHeight;

function onViewportChange() {
  const wasRotated = rotated;
  layout();
  if (wasRotated !== rotated) hintT0 = Date.now();
}

window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', () => setTimeout(onViewportChange, 150));

setInterval(() => {
  if (window.innerWidth !== lastVW || window.innerHeight !== lastVH) {
    lastVW = window.innerWidth;
    lastVH = window.innerHeight;
    onViewportChange();
  }
}, 400);

// 从后台切回来时重连（去微信发链接会切走，回来必须自动恢复）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;

  if (isHost && isOnline) {
    if (!peer || peer.destroyed || peer.disconnected) {
      log('回到前台，恢复房间…');
      recreateHostPeer();
    }
    return;
  }

  if (!isOnline) return;

  if (peer && !peer.destroyed && peer.disconnected) {
    try { peer.reconnect(); } catch (e) {}
  }
  if (!isHost && (!conn || !conn.open)) {
    log('回到前台，重连房间…');
    tryJoin();
  }
});

/* ================= 启动 ================= */

layout();
phase = 'lobby';
loadTiles();
loadVoices();

if (!window.Peer) {
  document.body.innerHTML =
    '<div style="display:flex;height:100%;align-items:center;justify-content:center;' +
    'color:#f2b179;font:600 16px -apple-system,sans-serif;text-align:center;padding:24px;">' +
    '联机组件加载失败<br><span style="font-size:13px;color:#9b968b;font-weight:400">' +
    '请刷新页面重试（网络问题）</span></div>';
  throw new Error('PeerJS missing');
}

// 调试用：?auto=1 直接开一局单机（?wild=0 关闭癞子）
if (location.search.indexOf('auto') >= 0) {
  if (location.search.indexOf('wild=0') >= 0) wildMode = false;
  startHostGame();
}

// ?room=XXXX 直接加入房间
const roomMatch = location.search.match(/[?&]room=([A-Za-z0-9]{3,8})/);
if (roomMatch) {
  startJoin(roomMatch[1]);
}

// ?host=1 直接建房（?host=ABCD 指定房间号，调试用）
const hostMatch = location.search.match(/[?&]host=([A-Za-z0-9]{1,8})/);
if (hostMatch) {
  startHost(hostMatch[1] === '1' ? null : hostMatch[1]);
}

// 只有人机有强制出牌时间，玩家不限时
let lastWatchVersion = -1;

function enforceStall(now) {
  if (!(isHost || !isOnline)) return;

  // 状态变了说明有进展
  if (stateVersion !== lastWatchVersion) {
    lastWatchVersion = stateVersion;
    lastProgressT = now;
  }

  // 等牌阶段：可能是远程玩家掉线，超时就自动过牌
  if (phase === 'claim' && pendingClaims.length && now - claimT0 > 8000) {
    const allRemote = pendingClaims.every(function (c) {
      return c.seat !== me && !seats[c.seat].ai;
    });
    if (allRemote) {
      log('等牌超时，自动过牌');
      pendingClaims = [];
      nextTurn(lastDiscard ? lastDiscard.from : turn);
      stateVersion++;
    }
    return;
  }

  if (phase !== 'playing') return;
  const s = seats[turn];
  if (!s || !s.ai) return;
  if (now - turnT0 <= TURN_LIMIT) return;

  log('人机超时，强制出牌');
  discardTile(turn, s.hand.length - 1);
}

function enforceAiTimer(now) {
  if (phase !== 'playing') return;
  const s = seats[turn];
  if (!s || !s.ai) return;
  if (now - turnT0 <= TURN_LIMIT) return;
  if (!isHost && isOnline) return; // 由房主推进

  log('人机超时 5s，强制出牌');
  discardTile(turn, s.hand.length - 1);
}

function loop() {
  const now = Date.now();
  try {
    enforceAiTimer(now);
    enforceStall(now);
    if (isHost && isOnline && phase === 'playing' && stateVersion !== lastSentVersion) {
      broadcastState();
    }
    draw(now);
  } catch (err) {
    const stack = (err && err.stack ? String(err.stack) : '').split('\n').slice(0, 4).join(' | ');
    log('渲染错误: ' + (err && err.message ? err.message : err));
    try {
      ctx.fillStyle = 'rgba(200,40,40,0.92)';
      ctx.fillRect(0, 0, W, 56);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '13px monospace';
      ctx.fillText('ERR: ' + (err && err.message ? err.message : String(err)), 10, 6);
      ctx.fillText(stack.slice(0, 170), 10, 24);
      ctx.fillText(stack.slice(170, 340), 10, 40);
    } catch (e2) {}
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
