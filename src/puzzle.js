// Mô hình bàn cờ Colodoku: luật chơi, trạng thái ô, phát hiện xung đột.
// Luật (giống Meowdoku / Star Battle 1 sao):
//   1. Mỗi vùng màu đúng 1 con mèo
//   2. Mỗi hàng đúng 1 con, mỗi cột đúng 1 con
//   3. Hai con mèo không được kề nhau, kể cả theo đường chéo

export const EMPTY = 0;
export const MARK = 1; // dấu X — ô đã bị loại
export const CAT = 2;

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Bung chuỗi base36 trong bank về lưới vùng màu NxN. */
export function unpackRegions(packed, size) {
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(DIGITS.indexOf(packed[r * size + c]));
    grid.push(row);
  }
  return grid;
}

/** Ngược lại: nén lưới vùng thành chuỗi base36 như trong bank. */
export function packRegions(grid) {
  return grid.flat().map((v) => DIGITS[v]).join("");
}

export class Puzzle {
  constructor(record, size) {
    this.size = size;
    this.regions = unpackRegions(record.m, size);
    this.solution = record.s; // solution[hàng] = cột đặt mèo
    this.rating = record.r; // độ khó 1-5 do chính họ chấm
    this.steps = record.st; // số bước suy luận tối thiểu
    this.techniques = record.rk; // [r1..r5] số lần dùng từng cấp kỹ thuật
    this.chained = !!record.ch;
    // Màn đặc biệt vẽ hình gán màu riêng cho từng vùng để nét vẽ nổi lên.
    this.colours = record.cm || null;
  }

  /** Chỉ số màu (--g0..--g11) của một vùng. */
  colourOf(region) {
    return this.colours ? this.colours[region] : region % 12;
  }

  regionAt(r, c) {
    return this.regions[r][c];
  }
}

export class Board {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.size = puzzle.size;
    this.cells = Array.from({ length: this.size }, () => new Array(this.size).fill(EMPTY));
    this.history = [];
  }

  get(r, c) {
    return this.cells[r][c];
  }

  /** Ghi một loạt thay đổi thành đúng một bước undo. */
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

  cats() {
    const out = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.cells[r][c] === CAT) out.push([r, c]);
    return out;
  }

  /**
   * Mọi vi phạm luật giữa các con mèo đang đặt.
   * Trả về [{ kind, cells }] để UI tô đỏ đúng cặp gây xung đột.
   */
  conflicts() {
    const cats = this.cats();
    const found = [];
    const buckets = { row: new Map(), col: new Map(), region: new Map() };

    for (const [r, c] of cats) {
      const keys = { row: r, col: c, region: this.puzzle.regionAt(r, c) };
      for (const kind of ["row", "col", "region"]) {
        const bucket = buckets[kind];
        const key = keys[kind];
        if (!bucket.has(key)) bucket.set(key, []);
        bucket.get(key).push([r, c]);
      }
    }
    for (const kind of ["row", "col", "region"])
      for (const group of buckets[kind].values())
        if (group.length > 1) found.push({ kind, cells: group });

    for (let i = 0; i < cats.length; i++)
      for (let j = i + 1; j < cats.length; j++) {
        const [ar, ac] = cats[i];
        const [br, bc] = cats[j];
        if (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1)
          found.push({ kind: "adjacent", cells: [cats[i], cats[j]] });
      }
    return found;
  }

  isSolved() {
    return this.cats().length === this.size && this.conflicts().length === 0;
  }

  /** Số mèo đặt trùng lời giải — dùng cho thanh tiến độ. */
  correctCount() {
    return this.cats().filter(([r, c]) => this.puzzle.solution[r] === c).length;
  }
}
