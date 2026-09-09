// Mô hình bàn cho luật "kiến gác kẹo" — thay puzzle.js khi lõi cũ được gỡ.
//
// Luật:
//   1. Mỗi vùng màu đúng một kiến.
//   2. Mỗi viên kẹo phải có ít nhất một kiến đứng cạnh (8 ô quanh).
//   3. Hai kiến không đứng cạnh nhau, kể cả chéo.
// Không luật hàng, không luật cột. Kẹo là manh mối duy nhất.
//
// Cố ý giữ đúng bề mặt của Puzzle/Board cũ (regionAt, colourOf, get, apply,
// undo, conflicts, isSolved, cats) để BoardView dùng lại được nguyên si; chỗ
// khác biệt duy nhất là `blockedCells`, thứ BoardView hỏi trước khi tự tắt đèn.
// Nhờ vậy game cũ và luật mới sống chung tới khi thay hẳn.

import { EMPTY, MARK, CAT, unpackRegions, packRegions } from "./puzzle.js";

export { EMPTY, MARK, CAT, unpackRegions, packRegions };
// Trong luật này CAT là con kiến gác; giữ tên hằng cũ để BoardView khỏi phân nhánh.
export const ANT = CAT;

/** Tám ô quanh (r,c) còn nằm trong bàn — đúng tầm gác của một con kiến. */
export function around(r, c, size) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const i = r + dr, j = c + dc;
      if (i >= 0 && j >= 0 && i < size && j < size) out.push([i, j]);
    }
  return out;
}

/**
 * Một màn: lưới vùng, chỗ đặt kẹo, và lời giải.
 *
 * Bản ghi `{ m, k, a, r, st, cm }` — `m` lưới vùng nén base36, `k` chỉ số ô có
 * kẹo, `a` chỉ số ô đặt kiến của từng vùng (a[g] là kiến vùng g), `r`/`st` là
 * bậc khó và số bước suy luận do bộ giải chấm, `cm` gán màu riêng cho màn vẽ hình.
 */
export class CandyPuzzle {
  constructor(record, size) {
    this.size = size;
    this.regions = unpackRegions(record.m, size);
    this.regionCount = Math.max(...this.regions.flat()) + 1;
    this.candies = [...record.k];
    this.candySet = new Set(this.candies);
    this.ants = [...record.a];
    // Lời giải theo vùng: solution[g] = [hàng, cột] của kiến vùng g. Khác lời
    // giải cũ (một cột cho mỗi hàng) vì luật mới không ràng buộc theo hàng.
    this.solution = this.ants.map((i) => [Math.floor(i / size), i % size]);
    this.antSet = new Set(this.ants);
    this.rating = record.r || 1;
    this.steps = record.st || 0;
    this.colours = record.cm || null;
    this.record = record;
  }

  regionAt(r, c) {
    return this.regions[r][c];
  }

  colourOf(region) {
    return this.colours ? this.colours[region] : region % 12;
  }

  isCandy(r, c) {
    return this.candySet.has(r * this.size + c);
  }

  /** Ô có kẹo, dạng [hàng, cột]. */
  candyCells() {
    return this.candies.map((i) => [Math.floor(i / this.size), i % this.size]);
  }

  /** Ô trong tầm gác của một kiến đứng ở (r,c). */
  zone(r, c) {
    return around(r, c, this.size);
  }

  /** Vùng nào có thể gác được viên kẹo ở ô `i` (bỏ qua ô đã bị loại nếu truyền `open`). */
  reachers(i, open = null) {
    const r = Math.floor(i / this.size), c = i % this.size;
    const found = new Set();
    for (const [y, x] of this.zone(r, c)) {
      if (this.isCandy(y, x)) continue;
      if (open && !open(y, x)) continue;
      found.add(this.regionAt(y, x));
    }
    return [...found];
  }

  /** Ô của một vùng, dạng [hàng, cột]. */
  cellsOf(region) {
    const out = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.regions[r][c] === region) out.push([r, c]);
    return out;
  }
}

export class CandyBoard {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.size = puzzle.size;
    this.cells = Array.from({ length: this.size }, () => new Array(this.size).fill(EMPTY));
    this.history = [];
  }

  get(r, c) {
    return this.cells[r][c];
  }

  apply(changes) {
    const undo = [];
    for (const [r, c, value] of changes) {
      if (this.cells[r][c] === value) continue;
      undo.push([r, c, this.cells[r][c]]);
      this.cells[r][c] = value;
    }
    if (undo.length) this.history.push(undo);
    return undo.length > 0;
  }

  undo() {
    const step = this.history.pop();
    if (!step) return false;
    for (const [r, c, value] of step) this.cells[r][c] = value;
    return true;
  }

  reset() {
    for (const row of this.cells) row.fill(EMPTY);
    this.history.length = 0;
  }

  ants() {
    const out = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.cells[r][c] === CAT) out.push([r, c]);
    return out;
  }

  /** Tên cũ của `ants()`; BoardView và game.js còn gọi tới. */
  cats() {
    return this.ants();
  }

  /**
   * Đặt kiến ở (r,c) thì loại hẳn những ô nào. Luật cũ loại cả hàng và cột;
   * ở đây chỉ còn hai nguồn: cùng vùng (luật 1) và trong tầm gác (luật 3).
   * BoardView gọi hàm này để tự tắt đèn, nên đổi luật chỉ phải sửa một chỗ.
   */
  blockedCells(r, c) {
    const region = this.puzzle.regionAt(r, c);
    const near = new Set(this.puzzle.zone(r, c).map(([i, j]) => `${i},${j}`));
    const out = [];
    for (let i = 0; i < this.size; i++)
      for (let j = 0; j < this.size; j++) {
        if (i === r && j === c) continue;
        if (this.puzzle.isCandy(i, j)) continue; // ô kẹo không đặt kiến được, cũng không tắt đèn
        if (this.puzzle.regionAt(i, j) === region || near.has(`${i},${j}`)) out.push([i, j]);
      }
    return out;
  }

  /** Viên kẹo ở (r,c) có kiến đứng cạnh chưa. */
  guarded(r, c) {
    return this.puzzle.zone(r, c).some(([i, j]) => this.cells[i][j] === CAT);
  }

  /** Kẹo còn chưa ai gác. */
  unguarded() {
    return this.puzzle.candyCells().filter(([r, c]) => !this.guarded(r, c));
  }

  /**
   * Vi phạm giữa các kiến đang đặt: hai con cùng vùng, hoặc hai con đứng cạnh
   * nhau. Kẹo chưa ai gác KHÔNG tính là vi phạm — đó chỉ là bàn chưa xong, tô
   * đỏ thì người chơi tưởng mình vừa làm sai.
   */
  conflicts() {
    const ants = this.ants();
    const found = [];
    const byRegion = new Map();
    for (const [r, c] of ants) {
      const g = this.puzzle.regionAt(r, c);
      if (!byRegion.has(g)) byRegion.set(g, []);
      byRegion.get(g).push([r, c]);
    }
    for (const group of byRegion.values()) if (group.length > 1) found.push({ kind: "region", cells: group });

    for (let i = 0; i < ants.length; i++)
      for (let j = i + 1; j < ants.length; j++) {
        const [ar, ac] = ants[i], [br, bc] = ants[j];
        if (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1)
          found.push({ kind: "adjacent", cells: [ants[i], ants[j]] });
      }
    return found;
  }

  isSolved() {
    return this.ants().length === this.puzzle.regionCount &&
      this.conflicts().length === 0 &&
      this.unguarded().length === 0;
  }

  /** Số kiến đặt đúng chỗ — thanh tiến độ và điểm thưởng dùng tới. */
  correctCount() {
    return this.ants().filter(([r, c]) => this.puzzle.antSet.has(r * this.size + c)).length;
  }
}
