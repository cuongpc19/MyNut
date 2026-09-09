// Kiến gác kẹo — thử nghiệm luật mới, chưa nối vào game.
//
// Luật:
//   1. Mỗi vùng màu đúng một kiến.
//   2. Mỗi viên kẹo phải có kiến đứng gác — kiến gác các ô quanh nó.
//   3. Kiến không đứng trong tầm gác của kiến khác.
// Không có luật hàng, luật cột. Kẹo là manh mối duy nhất — không con số nào.
//
// Hai cách hiểu luật 2, đo cạnh nhau (xem tools/probe_candy.mjs):
//   "atLeast" — kẹo có ÍT NHẤT một kiến gác (luật gọn, dễ nói)
//   "exact"   — kẹo có ĐÚNG MỘT kiến gác (chặt hơn, thêm một phép suy luận)
// và một cờ độc lập, `needy`: KIẾN NÀO CŨNG PHẢI có kẹo trong tầm. Không có cờ
// này thì kiến ở vùng một ô có thể đứng trơ giữa đất trống — máy thấy hợp lệ
// mà người thấy sai: lính gác mà chẳng gác gì.
//
// Tầm gác tuỳ loại kiến; vùng nào nuôi loại nào thì ghi ở `types`. Bản gọn
// chỉ dùng một loại (gác 8 ô quanh).

import { unpackRegions } from "./puzzle.js";

export const TYPES = {
  // kiến lính: 8 ô quanh
  ring: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  // kiến thợ: 4 ô kề
  plus: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  // kiến trinh sát: xa hai bước theo hình thoi
  diamond: [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
};

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const shuffled = (list, rand) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Bàn: lưới vùng + loại kiến từng vùng. Tính sẵn ô của từng vùng và tầm gác của từng ô. */
export function makeBoard(regions, types) {
  const h = regions.length, w = regions[0].length;
  const count = Math.max(...regions.flat()) + 1;
  const cells = Array.from({ length: count }, () => []);
  regions.forEach((row, r) => row.forEach((g, c) => cells[g].push(r * w + c)));
  const zone = [];
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const offs = TYPES[types[regions[r][c]]];
      const out = [];
      for (const [dr, dc] of offs) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < h && cc < w) out.push(rr * w + cc);
      }
      zone.push(out);
    }
  const regionOf = regions.flat();
  return { h, w, count, regions, types, cells, zone, regionOf };
}

/** Hai kiến ở i và j có phạm luật 3 không: một con đứng trong tầm con kia. */
const clash = (B, i, j) => B.zone[i].includes(j) || B.zone[j].includes(i);

/** Một cách rải kiến hợp luật 1 và 3, theo thứ tự ngẫu nhiên. */
export function placeAnts(B, rand) {
  const order = shuffled([...Array(B.count).keys()], rand);
  const ants = new Array(B.count).fill(-1);
  const walk = (k) => {
    if (k === B.count) return true;
    const g = order[k];
    for (const i of shuffled(B.cells[g], rand)) {
      if (ants.some((j) => j >= 0 && clash(B, i, j))) continue;
      ants[g] = i;
      if (walk(k + 1)) return true;
      ants[g] = -1;
    }
    return false;
  };
  return walk(0) ? ants : null;
}

/** Số kiến gác từng ô. */
export function coverage(B, ants) {
  const cov = new Int32Array(B.h * B.w);
  for (const i of ants) if (i >= 0) for (const j of B.zone[i]) cov[j]++;
  return cov;
}

/**
 * Tìm tối đa `limit` lời giải, bỏ qua `skip`. Vét cạn theo vùng, cắt sớm khi
 * một viên kẹo đã bị hai kiến gác hoặc không còn ai với tới được.
 */
export function search(B, candies, limit = 2, skip = null, mode = "atLeast", needy = false) {
  const exact = mode === "exact";
  const skipKey = skip ? skip.join() : null;
  const isCandy = new Uint8Array(B.h * B.w);
  for (const i of candies) isCandy[i] = 1;
  const cov = new Int32Array(B.h * B.w);
  const ants = new Array(B.count).fill(-1);
  const found = [];
  // Vùng ít ô thử trước — cây tìm kiếm hẹp hơn hẳn.
  const order = [...Array(B.count).keys()].sort((a, b) => B.cells[a].length - B.cells[b].length);

  const canStillReach = (candy) => {
    for (let k = 0; k < B.count; k++) {
      if (ants[k] >= 0) continue;
      for (const i of B.cells[k]) if (B.zone[i].includes(candy)) return true;
    }
    return false;
  };

  const walk = (k) => {
    if (found.length >= limit) return;
    if (k === B.count) {
      for (const c of candies) if (exact ? cov[c] !== 1 : cov[c] < 1) return;
      if (ants.join() !== skipKey) found.push(ants.slice());
      return;
    }
    const g = order[k];
    for (const i of B.cells[g]) {
      if (isCandy[i]) continue;
      if (needy && !B.zone[i].some((j) => isCandy[j])) continue;
      if (ants.some((j) => j >= 0 && clash(B, i, j))) continue;
      let bad = false;
      if (exact) for (const j of B.zone[i]) if (isCandy[j] && cov[j] === 1) { bad = true; break; }
      if (bad) continue;
      ants[g] = i;
      for (const j of B.zone[i]) cov[j]++;
      // Kẹo chưa ai gác mà mọi vùng còn lại đều không với tới thì nhánh này chết.
      let dead = false;
      for (const c of candies) if (cov[c] === 0 && !canStillReach(c)) { dead = true; break; }
      if (!dead) walk(k + 1);
      for (const j of B.zone[i]) cov[j]--;
      ants[g] = -1;
      if (found.length >= limit) return;
    }
  };
  walk(0);
  return found;
}

/**
 * Rải kẹo cho tới khi lời giải là duy nhất. Kẹo chỉ được đặt ở ô mà lời giải
 * của mình gác đúng một lần; mỗi viên thêm vào chọn sao cho lời giải đối thủ
 * đang tìm được bị phá (nó gác viên đó 0 hoặc 2 lần).
 */
export function addCandies(B, ants, rand, mode = "atLeast", needy = false, maxCandies = 40) {
  const exact = mode === "exact";
  const mine = coverage(B, ants);
  const antAt = new Uint8Array(B.h * B.w);
  for (const i of ants) antAt[i] = 1;
  const candies = [];
  // Kiến nào cũng phải có kẹo: rải trước cho mỗi con một viên trong tầm, rồi
  // mới rải tiếp để ép duy nhất.
  if (needy)
    for (const i of ants) {
      if (B.zone[i].some((j) => candies.includes(j))) continue;
      const spots = B.zone[i].filter((j) => !antAt[j] && !candies.includes(j) && (exact ? mine[j] === 1 : true));
      if (!spots.length) return null;
      candies.push(spots[Math.floor(rand() * spots.length)]);
    }
  for (;;) {
    const rival = search(B, candies, 1, ants, mode, needy)[0];
    if (!rival) return candies;
    if (candies.length >= maxCandies) return null;
    const theirs = coverage(B, rival);
    const options = [];
    // Viên kẹo hợp lệ với lời giải của mình mà lời giải đối thủ bỏ ngỏ (hoặc,
    // ở luật chặt, gác sai số lần) — thêm vào là phá đúng đối thủ đó.
    for (let i = 0; i < mine.length; i++) {
      if (antAt[i] || candies.includes(i)) continue;
      if (exact ? mine[i] !== 1 : mine[i] < 1) continue;
      if (exact ? theirs[i] !== 1 : theirs[i] === 0) options.push(i);
    }
    if (!options.length) return null;
    candies.push(options[Math.floor(rand() * options.length)]);
  }
}

// ------------------------------------------------------------------ bộ giải

/** Trạng thái suy luận: ô còn khả dĩ của từng vùng. */
export class Solve {
  constructor(B, candies, mode = "atLeast", needy = false) {
    this.B = B;
    this.mode = mode;
    this.needy = needy;
    this.candies = candies;
    this.isCandy = new Uint8Array(B.h * B.w);
    for (const i of candies) this.isCandy[i] = 1;
    // Kiến phải có kẹo thì ngay từ đầu chỉ xét ô sát kẹo — người chơi cũng nghĩ thế.
    this.cand = B.cells.map((list) =>
      list.filter((i) => !this.isCandy[i] && (!needy || B.zone[i].some((j) => this.isCandy[j]))));
  }
  fixed(g) {
    return this.cand[g].length === 1 ? this.cand[g][0] : -1;
  }
  complete() {
    return this.cand.every((list) => list.length === 1);
  }
  /** Vùng g chắc chắn gác kẹo c: mọi ô khả dĩ của nó đều với tới c. */
  surelyCovers(g, c) {
    return this.cand[g].length > 0 && this.cand[g].every((i) => this.B.zone[i].includes(c));
  }
}

/** Cấp 1: kẹo chỉ còn một vùng với tới => kiến vùng đó phải đứng trong tầm kẹo. */
function rank1(S) {
  for (const c of S.candies) {
    const reach = [];
    for (let g = 0; g < S.B.count; g++)
      if (S.cand[g].some((i) => S.B.zone[i].includes(c))) reach.push(g);
    if (reach.length === 0) return null;
    if (reach.length === 1) {
      const g = reach[0];
      const keep = S.cand[g].filter((i) => S.B.zone[i].includes(c));
      if (keep.length < S.cand[g].length)
        return { rank: 1, action: "narrow", region: g, cells: keep, candy: c };
    }
  }
  return null;
}

/** Cấp 2 (chỉ luật "đúng một"): vùng g chắc chắn gác kẹo c => vùng khác không được với tới c nữa. */
function rank2(S) {
  if (S.mode !== "exact") return null;
  for (const c of S.candies)
    for (let g = 0; g < S.B.count; g++) {
      if (!S.surelyCovers(g, c)) continue;
      for (let k = 0; k < S.B.count; k++) {
        if (k === g) continue;
        const keep = S.cand[k].filter((i) => !S.B.zone[i].includes(c));
        if (keep.length < S.cand[k].length)
          return { rank: 2, action: "narrow", region: k, cells: keep, candy: c, by: g };
      }
    }
  return null;
}

/** Cấp 2b: kiến đã chắc chỗ => vùng khác không đứng trong tầm nó, và ngược lại. */
function rank2b(S) {
  for (let g = 0; g < S.B.count; g++) {
    const i = S.fixed(g);
    if (i < 0) continue;
    for (let k = 0; k < S.B.count; k++) {
      if (k === g) continue;
      const keep = S.cand[k].filter((j) => !clash(S.B, i, j));
      if (keep.length < S.cand[k].length) return { rank: 2, action: "narrow", region: k, cells: keep, by: g };
    }
  }
  return null;
}

/** Cấp 3: đặt thử một ô, thấy bế tắc ngay thì loại. */
function rank3(S) {
  for (let g = 0; g < S.B.count; g++) {
    if (S.cand[g].length < 2) continue;
    for (const i of S.cand[g]) {
      const trial = new Solve(S.B, S.candies, S.mode, S.needy);
      trial.cand = S.cand.map((list) => list.slice());
      trial.cand[g] = [i];
      let broken = false;
      for (let step = 0; step < 50 && !broken; step++) {
        const move = rank1(trial) || rank2(trial) || rank2b(trial);
        if (!move) break;
        trial.cand[move.region] = move.cells;
        if (!move.cells.length) broken = true;
      }
      // Bế tắc: một vùng hết ô, hoặc một viên kẹo không còn ai với tới.
      if (!broken) broken = trial.cand.some((list) => !list.length) ||
        trial.candies.some((c) => !trial.cand.some((list) => list.some((j) => trial.B.zone[j].includes(c))));
      if (broken) return { rank: 3, action: "narrow", region: g, cells: S.cand[g].filter((j) => j !== i) };
    }
  }
  return null;
}

export function nextDeduction(S) {
  return rank1(S) || rank2(S) || rank2b(S) || rank3(S);
}

/** Chấm bàn: bậc cao nhất phải dùng và số bước; null nếu bí. */
export function rate(B, candies, mode = "atLeast", needy = false) {
  const S = new Solve(B, candies, mode, needy);
  const counts = [0, 0, 0];
  let steps = 0;
  while (!S.complete()) {
    const move = nextDeduction(S);
    if (!move || steps > 400) return null;
    S.cand[move.region] = move.cells;
    if (!move.cells.length) return null;
    counts[move.rank - 1]++;
    steps++;
  }
  return { rating: counts.reduce((best, n, i) => (n ? i + 1 : best), 1), steps, counts };
}

/** Một màn hoàn chỉnh từ một lưới vùng có sẵn, hoặc null nếu mẻ hỏng. */
export function makePuzzle(regions, seed, { mixed = false, mode = "atLeast", needy = false } = {}) {
  const rand = rng(seed);
  const count = Math.max(...regions.flat()) + 1;
  const kinds = mixed ? ["ring", "ring", "plus", "diamond"] : ["ring"];
  const types = Array.from({ length: count }, () => kinds[Math.floor(rand() * kinds.length)]);
  const B = makeBoard(regions, types);
  const ants = placeAnts(B, rand);
  if (!ants) return null;
  const candies = addCandies(B, ants, rand, mode, needy);
  if (!candies) return null;
  const scored = rate(B, candies, mode, needy);
  if (!scored) return null;
  return { h: B.h, w: B.w, regions, types, ants, candies, mode, needy, ...scored };
}

/** Lưới vùng lấy từ kho bàn của game chính. */
export const regionsFromRecord = (record, size) => unpackRegions(record.m, size);
