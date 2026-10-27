/**
 * 麻将规则引擎（浏览器版）
 * 万 1-9(0-8) · 筒 1-9(9-17) · 条 1-9(18-26) · 东南西北中发白(27-33)
 */

const SUIT_NAMES = ['万', '筒', '条'];
const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白'];

export const KINDS = 34;

export function kindName(k) {
  if (k >= 27) return HONOR_NAMES[k - 27];
  return ((k % 9) + 1) + SUIT_NAMES[Math.floor(k / 9)];
}

export function emptyCounts() {
  const c = new Array(KINDS).fill(0);
  return c;
}

export function countsFromTiles(tiles) {
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

export function canWinHand(counts, meldCount, wild) {
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

export function waitingTiles(counts, meldCount, wild) {
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

export function makeWall() {
  const wall = [];
  for (let k = 0; k < KINDS; k++) {
    for (let i = 0; i < 4; i++) wall.push(k);
  }
  return wall;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
