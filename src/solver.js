// Bộ giải theo kỹ thuật có phân cấp — dùng cho nút Hint và để chấm độ khó.
//
// Meowdoku chấm độ khó bằng cách đếm số lần phải dùng từng cấp kỹ thuật
// (trường r1..r5 trong bank của họ) rồi quy ra điểm 1-5. Bộ giải này tái lập
// đúng mô hình đó: mỗi bước suy luận đều mang một rank, rank càng cao nghĩa là
// người chơi phải nghĩ càng khó.

// Tên và mô tả năm bậc kỹ thuật nằm ở bảng chữ (`T.techniques`,
// `T.techniqueNotes`), dịch từ bản địa hoá của Meowdoku để thang điểm khớp với họ.
//
// Mỗi nước đi trả về `reason` dạng `{ id, kind?, k?, depth? }` chứ không phải câu
// tiếng Anh — `explain()` trong strings.js mới dựng thành chữ, theo đúng ngôn
// ngữ đang chọn. Bộ giải vì vậy không giữ một câu chữ nào.

const KINDS = ["row", "col", "region"];

/** Trạng thái suy luận: cand[r][c] = ô còn khả dĩ, placed = ô đã chắc chắn có mèo. */
export class State {
  constructor(size, regions) {
    this.size = size;
    this.regions = regions;
    this.cand = Array.from({ length: size }, () => new Array(size).fill(true));
    this.placed = Array.from({ length: size }, () => new Array(size).fill(false));
  }

  clone() {
    const copy = new State(this.size, this.regions);
    copy.cand = this.cand.map((row) => row.slice());
    copy.placed = this.placed.map((row) => row.slice());
    return copy;
  }

  belongs(kind, key, r, c) {
    if (kind === "row") return r === key;
    if (kind === "col") return c === key;
    return this.regions[r][c] === key;
  }

  /** Danh sách ô còn khả dĩ của một nhóm. */
  groupCells(kind, key) {
    const out = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.cand[r][c] && this.belongs(kind, key, r, c)) out.push([r, c]);
    return out;
  }

  groupHasCat(kind, key) {
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.placed[r][c] && this.belongs(kind, key, r, c)) return true;
    return false;
  }

  /** Đặt mèo và quét sạch hàng, cột, vùng, 8 ô kề. */
  place(r, c) {
    this.placed[r][c] = true;
    const region = this.regions[r][c];
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (i === r && j === c) continue;
        const blocked = i === r || j === c || this.regions[i][j] === region ||
          (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1);
        if (blocked) this.cand[i][j] = false;
      }
    }
  }

  /** Một nhóm hết ô khả dĩ mà chưa có mèo => bố trí mâu thuẫn. */
  isBroken() {
    for (const kind of KINDS)
      for (let key = 0; key < this.size; key++)
        if (!this.groupHasCat(kind, key) && this.groupCells(kind, key).length === 0) return true;
    return false;
  }

  isComplete() {
    let total = 0;
    for (const row of this.placed) for (const v of row) if (v) total++;
    return total === this.size;
  }
}

/** Cấp 1: một nhóm chỉ còn đúng một ô khả dĩ => ô đó chắc chắn là mèo. */
function rank1(state) {
  for (const kind of KINDS) {
    for (let key = 0; key < state.size; key++) {
      if (state.groupHasCat(kind, key)) continue;
      const cells = state.groupCells(kind, key);
      if (cells.length === 1)
        return {
          rank: 1, action: "place", cells, group: { kind, key },
          reason: { id: "onlyCell", kind, key },
        };
    }
  }
  return null;
}

/**
 * Cấp 2 — ràng buộc vùng ↔ hàng/cột, chạy cả hai chiều. Meowdoku xếp cả hai chiều
 * vào cùng một cấp; bằng chứng là bốn câu giải thích gợi ý của họ đi thành cặp:
 * "Ứng viên %s đều ở hàng %d" và "Ứng viên hàng %d đều thuộc %s".
 */
function rank2(state) {
  // Chiều thứ nhất: mọi ô khả dĩ của một vùng đều nằm trên cùng một hàng (hoặc cột).
  for (let region = 0; region < state.size; region++) {
    if (state.groupHasCat("region", region)) continue;
    const cells = state.groupCells("region", region);
    if (cells.length < 2) continue;
    for (const [axis, kind] of [[0, "row"], [1, "col"]]) {
      const line = cells[0][axis];
      if (!cells.every((cell) => cell[axis] === line)) continue;
      const remove = state.groupCells(kind, line).filter(([r, c]) => state.regions[r][c] !== region);
      if (remove.length)
        return {
          rank: 2, action: "eliminate", cells: remove, cause: cells,
          reason: { id: "regionInLine", kind, region, line },
        };
    }
  }
  // Chiều ngược lại: mọi ô khả dĩ của một hàng (hoặc cột) đều nằm trong cùng một vùng.
  for (const kind of ["row", "col"]) {
    for (let key = 0; key < state.size; key++) {
      if (state.groupHasCat(kind, key)) continue;
      const cells = state.groupCells(kind, key);
      if (cells.length < 2) continue;
      const region = state.regions[cells[0][0]][cells[0][1]];
      if (!cells.every(([r, c]) => state.regions[r][c] === region)) continue;
      const remove = state.groupCells("region", region)
        .filter(([r, c]) => (kind === "row" ? r : c) !== key);
      if (remove.length)
        return {
          rank: 2, action: "eliminate", cells: remove, cause: cells,
          reason: { id: "lineInRegion", kind, region, line: key },
        };
    }
  }
  // Hàng và cột cùng bị khoá vào một vùng thì ô giao của chúng chắc chắn có mèo.
  // Câu gốc của họ: "Hàng và cột thuộc cùng một vùng — ô giao phải có mèo".
  for (let row = 0; row < state.size; row++) {
    if (state.groupHasCat("row", row)) continue;
    const rowCells = state.groupCells("row", row);
    if (!rowCells.length) continue;
    const region = state.regions[rowCells[0][0]][rowCells[0][1]];
    if (!rowCells.every(([r, c]) => state.regions[r][c] === region)) continue;
    for (let col = 0; col < state.size; col++) {
      if (state.groupHasCat("col", col)) continue;
      const colCells = state.groupCells("col", col);
      if (!colCells.length || !colCells.every(([r, c]) => state.regions[r][c] === region)) continue;
      const cross = rowCells.find(([, c]) => c === col);
      if (cross)
        return {
          rank: 2, action: "place", cells: [cross], group: { kind: "region", key: region },
          cause: [...rowCells, ...colCells].filter(([r, c]) => !(r === cross[0] && c === cross[1])),
          reason: { id: "crossing", region, row, col },
        };
    }
  }
  return null;
}

/** Sinh mọi tổ hợp k phần tử từ danh sách. */
function* combinations(items, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < items.length; i++) {
    acc.push(items[i]);
    yield* combinations(items, k, i + 1, acc);
    acc.pop();
  }
}

/** Khoá tập hợp: k vùng chỉ trải trên đúng k hàng (hoặc cột) => k hàng đó bị chiếm trọn. */
function setLock(state, kMin, kMax, rank) {
  for (const [axis, kind] of [[0, "row"], [1, "col"]]) {
    const open = [];
    for (let region = 0; region < state.size; region++) {
      if (state.groupHasCat("region", region)) continue;
      const lines = new Set(state.groupCells("region", region).map((cell) => cell[axis]));
      if (lines.size) open.push({ region, lines });
    }
    for (let k = kMin; k <= Math.min(kMax, open.length); k++) {
      for (const combo of combinations(open, k)) {
        const union = new Set();
        for (const entry of combo) for (const line of entry.lines) union.add(line);
        if (union.size !== k) continue;
        const regions = new Set(combo.map((entry) => entry.region));
        const remove = [];
        for (const line of union)
          for (const [r, c] of state.groupCells(kind, line))
            if (!regions.has(state.regions[r][c])) remove.push([r, c]);
        if (remove.length)
          return {
            rank, action: "eliminate", cells: remove,
            cause: combo.flatMap((entry) => state.groupCells("region", entry.region)),
            reason: { id: "setLock", kind, k, regions: [...regions], lines: [...union] },
          };
      }
    }
  }
  return null;
}

/** Cấp 3 — khoá tập hợp cỡ nhỏ. */
function rank3(state) {
  return setLock(state, 2, 3, 3);
}

/** Chạy các cấp rẻ đến khi bí; trả về số bước đã lan truyền. */
function propagateCheap(state, basicOnly = false) {
  let steps = 0;
  for (;;) {
    const move = basicOnly ? rank1(state) : rank1(state) || rank2(state);
    if (!move) return steps;
    steps++;
    if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) state.cand[r][c] = false;
    if (state.isBroken()) return steps;
  }
}

/**
 * Thử đặt mèo rồi tìm mâu thuẫn. `maxDepth` là số bước lan truyền tối đa được
 * phép dùng: 0 nghĩa là chỉ nhận mâu thuẫn thấy ngay ("Đặt ở đây gây mâu thuẫn
 * trực tiếp"), Infinity nhận cả chuỗi dài ("Đặt ở đây gây mâu thuẫn (%d bước)").
 */
function hypothesis(state, maxDepth, rank, basicOnly = false) {
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (!state.cand[r][c] || state.placed[r][c]) continue;
      const trial = state.clone();
      trial.place(r, c);
      if (trial.isBroken())
        return {
          rank, action: "eliminate", cells: [[r, c]], depth: 0,
          reason: { id: "immediate" },
        };
      if (maxDepth === 0) continue;
      const depth = propagateCheap(trial, basicOnly);
      if (trial.isBroken())
        return {
          rank, action: "eliminate", cells: [[r, c]], depth,
          reason: { id: "chain", depth },
        };
    }
  }
  return null;
}

/** Cấp 4 — khoá tập hợp lớn hơn, hoặc giả định thấy mâu thuẫn ngay. */
function rank4(state) {
  return setLock(state, 4, state.size - 1, 4) || hypothesis(state, 0, 4, true);
}

/** Cấp 5 — chuỗi giả định nhiều bước. */
function rank5(state) {
  return hypothesis(state, Infinity, 5);
}

const LADDER = [rank1, rank2, rank3, rank4, rank5];

/** Bước suy luận rẻ nhất còn lại, hoặc null nếu bó tay. */
export function nextDeduction(state) {
  for (const technique of LADDER) {
    const move = technique(state);
    if (move) return move;
  }
  return null;
}

/**
 * Ô này phải suy tới bậc mấy mới ra?
 *
 * Chạy lại chính thang kỹ thuật nhưng chặn trần ở bậc `cap`, xem tới bậc nào
 * thì ô (r, c) bị ép — tức nó là ô cuối cùng còn khả dĩ của một nhóm, hoặc
 * chính thang đã đặt con vào đó. Bậc nhỏ nhất làm được việc ấy là "giá" của
 * nước đi. Cùng một thước với `analyse` chấm cả bàn, chỉ khác là hỏi về một ô.
 *
 * Dừng ở bậc 3: bậc 4 và 5 phải thử giả định trên từng ô còn trống rồi lan
 * truyền, quá đắt để chạy ngay giữa lúc chơi — mà cũng không cần, vì "quá tầm
 * ba bậc rẻ" đã đủ để kết luận nước này khó.
 */
export const EASY_RANKS = 3;

function forced(state, r, c) {
  if (state.placed[r][c]) return true;
  if (!state.cand[r][c]) return false;
  for (const kind of KINDS) {
    const key = kind === "row" ? r : kind === "col" ? c : state.regions[r][c];
    if (state.groupHasCat(kind, key)) continue;
    if (state.groupCells(kind, key).length === 1) return true;
  }
  return false;
}

export function placementRank(base, r, c, stepCap = 200) {
  for (let cap = 1; cap <= EASY_RANKS; cap++) {
    const state = base.clone();
    for (let steps = 0; steps <= stepCap; steps++) {
      if (forced(state, r, c)) return cap;
      let move = null;
      for (let i = 0; i < cap && !move; i++) move = LADDER[i](state);
      if (!move) break; // bí ở trần này, thử trần cao hơn
      if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
      else for (const [er, ec] of move.cells) state.cand[er][ec] = false;
    }
  }
  return EASY_RANKS + 1;
}

/**
 * Dựng trạng thái suy luận từ bàn cờ thật: con vật đã đặt coi như chắc chắn,
 * và **những ô người chơi tự đánh ✕ cũng phải nạp vào**.
 *
 * Con vật thì bộ giải tự suy ra được ô nào bị loại theo, còn dấu ✕ do người
 * chơi suy luận ra thì không — bỏ qua chúng là bộ giải quay lại mách đúng
 * những ô người ta vừa đánh xong.
 *
 * Chỉ nạp khi mọi dấu ✕ đều đúng. Dấu ✕ đặt nhầm vào ô của lời giải sẽ kéo cả
 * chuỗi suy luận sai theo, mà game không chặn người chơi đánh ✕ bừa — gặp thế
 * thì bỏ hết, chỉ tin mấy con vật đã đặt, đúng như trước đây.
 */
export function stateFromBoard(puzzle, cells) {
  const state = new State(puzzle.size, puzzle.regions);
  const marks = [];
  for (let r = 0; r < puzzle.size; r++)
    for (let c = 0; c < puzzle.size; c++)
      if (cells[r][c] === 2) state.place(r, c);
      else if (cells[r][c] === 1) marks.push([r, c]);

  if (marks.some(([r, c]) => puzzle.solution[r] === c)) return state;
  for (const [r, c] of marks) state.cand[r][c] = false;
  return state;
}

/**
 * Giải từ bàn cờ trống và trả về hồ sơ độ khó theo đúng mô hình của Meowdoku:
 * số bước suy luận, số lần dùng từng cấp, và cấp khó nhất đã phải dùng.
 */
export function analyse(puzzle) {
  const state = new State(puzzle.size, puzzle.regions);
  const counts = [0, 0, 0, 0, 0];
  let steps = 0;

  while (!state.isComplete()) {
    const move = nextDeduction(state);
    if (!move) return { solved: false, steps, counts, maxRank: 0 };
    counts[move.rank - 1]++;
    steps++;
    if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) state.cand[r][c] = false;
    if (steps > 400) return { solved: false, steps, counts, maxRank: 0 };
  }

  const solution = [];
  for (let r = 0; r < state.size; r++)
    for (let c = 0; c < state.size; c++) if (state.placed[r][c]) solution[r] = c;

  const maxRank = counts.reduce((best, n, i) => (n ? i + 1 : best), 0);
  return { solved: true, steps, counts, maxRank, solution };
}
