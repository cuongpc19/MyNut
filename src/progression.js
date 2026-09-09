// Tuyến chơi: màn số mấy thì cỡ nào, khó bao nhiêu, lấy bàn nào — và ghi nhớ
// tiến trình người chơi.
//
// Bộ máy này chép lại đúng cách Meowdoku chọn màn (đọc từ GDScript đã giải mã,
// xem data/reference/meowdoku-gdscript/): cỡ lưới cố định theo số màn; bậc khó
// là một "chiến lược" tự lên xuống theo thắng sạch / thua; từ bậc 3 mỗi màn rút
// ngẫu nhiên trong [2, bậc]; cứ 10 màn một màn khó; một số màn là màn đặc biệt
// vẽ hình; màn 1-10 tặng sẵn một con. Điểm khác duy nhất là chủ ý của mình:
// hai màn đầu là 4×4 chọn tay cho dễ vào, từ màn 3 y hệt họ.

import { SCRIPTED } from "./levels.js";
import { T } from "./strings.js";
import { unpackRegions, packRegions } from "./puzzle.js";

// ------------------------------------------------------------- cỡ lưới

// Meowdoku: 10 màn đầu cố định, từ màn 11 lặp chu kỳ 10. Mình chỉ đổi màn 2
// (họ 5×5) thành 4×4 chọn tay; từ màn 3 y hệt.
const FIRST = [4, 4, 6, 6, 8, 6, 7, 8, 9, 7];
const CYCLE = [8, 10, 10, 9, 10, 10, 9, 10, 10, 10];

/** Từ màn này trở đi khó y hệt Meowdoku. */
export const AS_HARD_FROM = 3;

export function sizeFor(n) {
  if (n < 1) return 0;
  return n <= 10 ? FIRST[n - 1] : CYCLE[(n - 11) % 10];
}

/** Màn khó định kỳ: bậc 5, chẵn chục từ màn 30 — y Meowdoku; màn đặc biệt đè lên nếu có. */
export const isHardLevel = (n) => n >= 21 && n % 10 === 0;

// Màn đặc biệt vẽ hình — đúng số màn Meowdoku đặt, hình thì mình tự vẽ
// (tools/build_specials.mjs). Màn 200/250/314 của họ là bàn kiểu LinkedIn, không có hình.
export const SPECIAL_LEVELS = {
  10: "1", 20: "2", 30: "30", 40: "window", 50: "50", 55: "wave", 60: "60", 62: "bar",
  70: "70", 75: "pi", 80: "IQ", 90: "90", 100: "100", 123: "123", 456: "456",
};

// Game không đánh ✕ hộ ở màn nào — bản ghi màn hình cho thấy Meowdoku bắt tự
// loại ô ngay từ màn 1, vì đó chính là thao tác chính của trò này.
export const AUTO_MARK_UNTIL = 0;
export const autoMarksFor = (level) => level <= AUTO_MARK_UNTIL;

// ------------------------------------------------------------ chiến lược

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** Trần bậc theo số màn — Meowdoku cũng chốt 4 cho tuyến thường, bậc 5 chỉ ở màn khó. */
const strategyCap = (n) => (n >= 51 ? 4 : n >= 21 ? 3 : 2);

/**
 * Định cỡ và bậc cho màn n theo trạng thái chiến lược hiện tại. Có rút ngẫu
 * nhiên, nên kết quả được ghi vào tiến trình để chơi lại vẫn ra đúng màn đó.
 */
export function planLevel(progress, n) {
  const size = sizeFor(n);
  if (isHardLevel(n)) return { level: n, size, rank: 5, strategy: 5, hard: true };

  // Meowdoku chỉ ép sàn bậc 2 từ màn 51; mình ép ngay từ màn 6 vì 6-10 ở bậc 1
  // quá nhàn (thua thì vẫn tụt về 1 được, vì máy trạng thái không đổi).
  let strategy = n <= 5 ? 1 : n >= 6 ? Math.max(progress.strategy || 1, 2) : progress.strategy || 1;
  strategy = Math.min(strategy, strategyCap(n));
  const rank = strategy >= 3 ? randInt(2, strategy) : strategy;
  return { level: n, size, rank, strategy, hard: false };
}

/**
 * Kết màn thắng — chép nguyên máy trạng thái của Meowdoku:
 *   - từ màn 6 mới tính; thắng sạch (không trợ giúp, không thua, không chơi
 *     lại) đủ 2 lần (từ màn 51: 1 lần) thì lên một bậc, tới trần thì thôi;
 *   - thua đủ 1 lần (màn <21) hay 2 lần (≥21) thì xuống một bậc, mỗi màn tối đa
 *     một lần; từ màn 101 không xuống dưới bậc 2;
 *   - từ màn 21, hai màn liền phải chơi lại ở cùng bậc cũng xuống một bậc.
 */
export function onLevelWon(progress, n) {
  const next = { ...progress };
  next.cleared = Math.max(next.cleared || 0, n);
  next.winStreak = (next.winStreak || 0) + 1;
  next.bestWin = Math.max(next.bestWin || 0, next.winStreak);
  if (n >= 6) {
    const max = strategyCap(n);
    const min = n >= 101 ? 2 : 1;
    const winThreshold = n >= 51 ? 1 : 2;
    const failThreshold = n >= 21 ? 2 : 1;
    let demoted = false;

    if (!next.dirty) {
      next.cleanWins = (next.cleanWins || 0) + 1;
      if (next.cleanWins >= winThreshold && next.strategy < max) {
        next.strategy++;
        next.cleanWins = 0;
      }
    } else next.cleanWins = 0;

    if ((next.fails || 0) >= failThreshold && next.strategy > min) {
      next.strategy--;
      next.fails = 0;
      demoted = true;
    }

    if (n >= 21) {
      if (next.retried) {
        if (next.strategy === next.retryStrategy) {
          next.retryLevels = (next.retryLevels || 0) + 1;
          if (next.retryLevels >= 2 && next.strategy > min && !demoted) {
            next.strategy--;
            next.retryLevels = 0;
            next.retryStrategy = 0;
          }
        } else {
          next.retryLevels = 1;
          next.retryStrategy = next.strategy;
        }
      } else {
        next.retryLevels = 0;
        next.retryStrategy = 0;
      }
    }
  }
  next.dirty = false;
  next.retried = false;
  next.current = null;
  saveProgress(next);
  return next;
}

/** Hết mạng: màn này không còn sạch, và tính là một lần thua (từ màn 6). */
export function onLevelFailed(progress, n) {
  const next = { ...progress, dirty: true, retried: true, winStreak: 0 };
  if (n >= 6) {
    next.cleanWins = 0;
    next.fails = (next.fails || 0) + 1;
  }
  saveProgress(next);
  return next;
}

/** Dùng trợ giúp: màn này hết sạch. */
export function markDirty(progress) {
  if (progress.dirty) return progress;
  const next = { ...progress, dirty: true };
  saveProgress(next);
  return next;
}

/** Bỏ dở màn để chơi lại: hết sạch, và chuỗi thắng liên tiếp đứt như khi thua. */
export function onLevelRestarted(progress) {
  const next = { ...progress, dirty: true, winStreak: 0 };
  saveProgress(next);
  return next;
}

// ------------------------------------------------------------- kho bàn

let poolsPromise = null;
let specialsPromise = null;

function fetchJson(path, fallback) {
  return fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`không tải được ${path} (HTTP ${r.status})`);
      return r.json();
    })
    .catch((error) => {
      console.error(error);
      return fallback;
    });
}

/** Kho bàn theo "cỡxbậc" (tools/build_pools.mjs). Bản một file nhúng sẵn vào global. */
function loadPools() {
  if (globalThis.__COLODOKU_POOLS) return Promise.resolve(globalThis.__COLODOKU_POOLS);
  if (!poolsPromise) poolsPromise = fetchJson("data/pools.json", null).then((p) => { if (!p) poolsPromise = null; return p; });
  return poolsPromise;
}

function loadSpecials() {
  if (globalThis.__COLODOKU_SPECIALS) return Promise.resolve(globalThis.__COLODOKU_SPECIALS);
  if (!specialsPromise) specialsPromise = fetchJson("data/specials.json", {});
  return specialsPromise;
}

/** Số vùng chỉ có một ô. */
export function singleRegions(m) {
  const counts = {};
  for (const ch of m) counts[ch] = (counts[ch] || 0) + 1;
  return Object.values(counts).filter((n) => n === 1).length;
}

/** Meowdoku: tối đa 2 vùng 1 ô, từ màn 21 tối đa 1 — để không quá lộ. */
export const singleLimit = (n) => (n >= 21 ? 1 : 2);

/**
 * Xoay/lật một bản ghi: t = 0..7, t/4 là lật (1 ngang, 2 dọc), t%4 là số lần
 * xoay 90°. Đúng thứ tự phép biến đổi của Meowdoku, nên hết kho thì bàn cũ
 * quay lại dưới dạng khác.
 */
export function transformRecord(record, size, t) {
  let rm = unpackRegions(record.m, size);
  let sol = [...record.s];
  const mirror = Math.floor(t / 4);
  const rot = t % 4;
  if (mirror === 1) {
    rm = rm.map((row) => [...row].reverse());
    sol = sol.map((c) => size - 1 - c);
  } else if (mirror === 2) {
    rm = [...rm].reverse();
    sol = [...sol].reverse();
  }
  for (let i = 0; i < rot; i++) {
    const next = Array.from({ length: size }, (_, r2) => Array.from({ length: size }, (_, c2) => rm[size - 1 - c2][r2]));
    const nextSol = new Array(size);
    for (let r2 = 0; r2 < size; r2++) nextSol[sol[r2]] = size - 1 - r2;
    rm = next;
    sol = nextSol;
  }
  return { ...record, m: packRegions(rm), s: sol };
}

/**
 * Con tặng sẵn ở màn 1-10, đúng luật Meowdoku: màn 1-6 tặng con nằm trong vùng
 * nhiều ô (để người chơi tự tìm vùng 1 ô), màn 7-10 tặng đúng con ở vùng 1 ô.
 */
export function prefillFor(n, record, size) {
  if (n < 1 || n > 10) return [];
  const area = {};
  for (const ch of record.m) area[ch] = (area[ch] || 0) + 1;
  const wantSingle = n >= 7;
  for (let r = 0; r < size; r++) {
    const c = record.s[r];
    const cells = area[record.m[r * size + c]];
    if (wantSingle ? cells === 1 : cells > 1) return [[r, c]];
  }
  return [[0, record.s[0]]];
}

/** Bậc gần nhất có trong kho cho cỡ này: ưu tiên thấp hơn, rồi mới cao hơn. */
function nearestRank(pools, size, rank) {
  for (const r of [rank, rank - 1, rank - 2, rank - 3, rank + 1, rank + 2, rank + 3, rank + 4])
    if (r >= 1 && r <= 5 && pools[`${size}x${r}`]?.length) return r;
  return null;
}

/**
 * Rút bàn kế tiếp trong kho "cỡxbậc": đi tuần tự từ con trỏ, bỏ qua bàn có quá
 * nhiều vùng 1 ô (nếu quét hết kho mà không có thì lấy đại). Hết kho thì quay
 * về đầu với phép xoay/lật kế tiếp.
 */
function drawFromPool(pool, cursor, limit) {
  const total = pool.length;
  let picked = cursor.idx % total;
  for (let k = 0; k < total; k++) {
    const i = (cursor.idx + k) % total;
    if (singleRegions(pool[i].m) <= limit) { picked = i; break; }
  }
  let idx = picked + 1, transform = cursor.transform || 0;
  if (idx >= total) { idx = 0; transform = (transform + 1) % 8; }
  return { index: picked, transform: cursor.transform || 0, next: { idx, transform } };
}

/**
 * Bàn cho màn n. Lần đầu vào màn thì định cỡ/bậc, rút bàn và ghi lại; chơi lại
 * màn đó thì trả đúng bàn cũ. Trả về cả tiến trình đã cập nhật.
 */
export async function levelRecord(n, progress) {
  const scripted = SCRIPTED[n - 1];
  if (scripted) {
    const spec = { level: n, size: scripted.size, rank: scripted.record.r, hard: false, special: null };
    return { spec: withLabel(spec), record: scripted.record, size: scripted.size, given: scripted.given || [], progress };
  }

  let current = progress.current && progress.current.level === n ? progress.current : null;
  let next = progress;

  if (!current) {
    const plan = planLevel(progress, n);
    const specials = await loadSpecials();
    const special = SPECIAL_LEVELS[n] && specials?.[n] ? specials[n] : null;
    if (special) current = { ...plan, size: special.size, rank: special.record.r, special: n };
    else {
      const pools = await loadPools();
      if (!pools) return null;
      const rank = nearestRank(pools, plan.size, plan.rank);
      if (!rank) return null;
      const key = `${plan.size}x${rank}`;
      const cursors = { ...(progress.cursors || {}) };
      const draw = drawFromPool(pools[key], cursors[key] || { idx: 0, transform: 0 }, singleLimit(n));
      cursors[key] = draw.next;
      current = { ...plan, rank, key, index: draw.index, transform: draw.transform, special: null };
      next = { ...next, cursors };
    }
    next = { ...next, current };
    saveProgress(next);
  }

  let record, size = current.size;
  if (current.special) {
    const specials = await loadSpecials();
    record = specials?.[current.special]?.record;
  } else {
    const pools = await loadPools();
    const entry = pools?.[current.key]?.[current.index];
    record = entry && transformRecord(entry, size, current.transform);
  }
  if (!record) return null;

  const spec = withLabel({ level: n, size, rank: current.rank, hard: current.hard, special: current.special ? SPECIAL_LEVELS[n] : null });
  return { spec, record, size, given: prefillFor(n, record, size), progress: next };
}

const withLabel = (spec) => ({ ...spec, label: `R${spec.rank} ${T.ratings[spec.rank]}` });

// ------------------------------------------------------------- tiến trình

const PROGRESS_KEY = "colodoku.progress.v2";

// Kẹo là đơn vị duy nhất: vừa là mạng trong màn, vừa là tiền mua trợ giúp.
// Mỗi màn phát ba viên, còn dư bao nhiêu mang về kho bấy nhiêu; trợ giúp trừ
// thẳng vào kho đó. Nên mọi lựa chọn quy về một câu hỏi: tiêu viên kẹo này bây
// giờ, hay để dành mang về tổ?
export const CANDY_COST = { reveal: 2, hint: 1 };

// Quà nhập môn, trao khi học xong bài hướng dẫn: đủ để thử cả hai nút trợ giúp
// mà không phải nhịn kẹo của đêm đầu tiên.
export const WELCOME_CANDY = 3;

// Vốn mở màn: ngần này lượt miễn phí cho mỗi nút, tiêu hết mới phải trả xu.
// Đây là kho dùng chung cả game chứ không phải hạn mức mỗi màn.
export const FREE_USES = 10;

const BLANK = {
  cleared: 0, tutorialDone: false, stars: {}, streak: 0, lastPlayed: null, best: 0,
  free: { reveal: FREE_USES, hint: FREE_USES },
  // máy chiến lược
  strategy: 1, cleanWins: 0, fails: 0, retryLevels: 0, retryStrategy: 0,
  // Chuỗi thắng liên tiếp: thắng thì +1, hết mạng thì về 0. Khác hẳn `streak`
  // bên trên — cái đó đếm ngày điểm danh, cả ngày chơi bao nhiêu ván vẫn là 1.
  winStreak: 0, bestWin: 0,
  dirty: false, retried: false, current: null, cursors: {},
  // Chiến lợi phẩm mang về tổ: kiến đã cứu, và kẹo còn dư sau mỗi màn.
  ants: 0, candy: 0,
};

export function loadProgress() {
  try {
    return { ...BLANK, ...JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") };
  } catch {
    return { ...BLANK };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* chế độ riêng tư chặn localStorage — chơi vẫn được, chỉ là không nhớ. */
  }
}

/** Xoá sạch tiến trình — chơi lại từ hướng dẫn như người mới. */
export function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* không xoá được thì thôi, bản sao trong bộ nhớ đã bị thay rồi */
  }
  return { ...BLANK, free: { ...BLANK.free }, cursors: {} };
}

/** Màn đang mở khoá: màn kế tiếp sau màn cao nhất đã qua. Tuyến chơi không có màn cuối. */
export function currentLevel(progress) {
  return (progress.cleared || 0) + 1;
}

export function markCleared(progress, n, stars) {
  const next = { ...progress, stars: { ...progress.stars } };
  next.cleared = Math.max(next.cleared, n);
  next.stars[n] = Math.max(next.stars[n] || 0, stars);
  saveProgress(next);
  return next;
}

/** Tiêu một lượt miễn phí. Hết lượt thì trả về null để bên gọi chuyển sang trả xu. */
export function useFree(progress, kind) {
  const free = progress.free || {};
  if (!free[kind]) return null;
  const next = { ...progress, free: { ...free, [kind]: free[kind] - 1 } };
  saveProgress(next);
  return next;
}

/**
 * Mỗi màn phát ngần này viên kẹo. Đặt sai một con kiến là mất một viên; hết
 * kẹo thì thua màn. Còn dư bao nhiêu thì mang về tổ bấy nhiêu — thua thì không
 * mang được viên nào, vì đã ăn hết cả ba.
 */
export const CANDY_PER_LEVEL = 3;

/** Cất chiến lợi phẩm một màn vào kho: số kiến đã đặt, và số kẹo còn dư. */
export function bankSpoils(progress, { ants = 0, candy = 0 }) {
  const next = {
    ...progress,
    ants: (progress.ants || 0) + ants,
    candy: (progress.candy || 0) + candy,
  };
  saveProgress(next);
  return next;
}

/** Lấy kẹo trong kho ra tiêu. Không đủ thì trả null, kho giữ nguyên. */
export function spendCandy(progress, amount) {
  if ((progress.candy || 0) < amount) return null;
  const next = { ...progress, candy: progress.candy - amount };
  saveProgress(next);
  return next;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Chuỗi ngày: chơi xong một màn thì tính là đã "điểm danh" hôm nay. Chơi tiếp
 * ngày kế thì chuỗi +1, nghỉ một ngày là chuỗi về 1.
 */
export function touchStreak(progress) {
  const now = today();
  if (progress.lastPlayed === now) return progress;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = progress.lastPlayed === yesterday ? progress.streak + 1 : 1;
  const next = { ...progress, streak, lastPlayed: now, best: Math.max(progress.best || 0, streak) };
  saveProgress(next);
  return next;
}

/** Hôm nay đã điểm danh chưa — để vẽ dấu ✓ trên thẻ Streak. */
export function streakDoneToday(progress) {
  return progress.lastPlayed === today();
}

/**
 * Sao: 3 nếu tự giải không cần gợi ý, 2 nếu dùng 1-2 lần, 1 nếu dùng nhiều hơn.
 */
export function starsFor(hintsUsed) {
  if (hintsUsed === 0) return 3;
  return hintsUsed <= 2 ? 2 : 1;
}
