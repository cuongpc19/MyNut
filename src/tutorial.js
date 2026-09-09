// Hướng dẫn cho người mới. Nhịp dạy học theo Meowdoku, nhưng bàn cờ là của
// mình (tools/pick_tutorial.mjs chọn) và có **hai** lượt tập vuốt thay vì một:
//
//   1. Đặt con kiến đầu vào vùng chỉ có một ô
//   2. Thẻ "Mỗi màu đúng một con" + nút Hiểu rồi
//   3. Nhấn từng ô để gạch cả hàng và cột của con đó
//   4. Một vùng giờ chỉ còn một ô — đặt con thứ hai
//   5. Vuốt để gạch các ô kề con thứ hai      ← tập vuốt lần 1
//   6. Vùng khác chỉ còn một ô — đặt con thứ ba
//   7. Vuốt để gạch các ô kề con thứ ba       ← tập vuốt lần 2
//   8. Tự tìm con cuối
//   9. "Đủ ba luật rồi"
//
// Không toạ độ nào bị ghi cứng: planTutorial() suy ra cả trình tự lẫn từng ô
// từ chính luật chơi, nên đổi bàn cờ là hướng dẫn tự khớp theo. flow_test.mjs
// kiểm lại rằng bàn đang dùng thật sự dạy đủ và đúng nhịp đó.

import { CAT, MARK, Puzzle } from "./puzzle.js";
import { TUTORIAL, PALETTE } from "./levels.js";
import { T } from "./strings.js";


export function tutorialPuzzle() {
  return new Puzzle(TUTORIAL.record, TUTORIAL.size);
}

const cellsWhere = (puzzle, test) => {
  const out = [];
  for (let r = 0; r < puzzle.size; r++)
    for (let c = 0; c < puzzle.size; c++) if (test(r, c)) out.push([r, c]);
  return out;
};

const regionOf = (puzzle, [r, c]) => cellsWhere(puzzle, (i, j) => puzzle.regions[i][j] === puzzle.regionAt(r, c));

const key = ([r, c]) => `${r},${c}`;

/**
 * Tên màu vùng, tô đúng màu đó — Meowdoku cũng gắn [color] vào tên màu.
 * Tên lấy từ bảng chữ nên đổi theo ngôn ngữ; PALETTE trong levels.js giữ tên
 * tiếng Anh làm bản gốc để đối chiếu với video.
 */
const colourTag = (region) => {
  const index = region % PALETTE.length;
  return `<b class="key" style="color: var(--k${index})">${T.colors[index]}</b>`;
};

/** Ô cùng hàng hoặc cùng cột với một con mèo (không tính chính nó). */
const linesOf = (puzzle, [r, c]) =>
  cellsWhere(puzzle, (i, j) => (i === r || j === c) && !(i === r && j === c));

/** Ô chạm cạnh hoặc góc một con kiến, bỏ những ô các bước trước đã xử lý rồi. */
const touching = (puzzle, [r, c], used) =>
  cellsWhere(
    puzzle,
    (i, j) => Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1 && !(i === r && j === c) && !used.has(`${i},${j}`),
  );

/**
 * Xếp dãy ô thành một đường vuốt liền: bắt đầu từ ô thấp nhất (trái nhất nếu
 * hoà), rồi mỗi bước nhảy sang ô gần nhất còn lại. Với ba ô kề con thứ hai, ra
 * đúng đường "từ dưới đi lên rồi sang phải" mà bàn tay minh hoạ cần vẽ.
 */
function swipePath(cells) {
  const left = [...cells].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const path = [left.shift()];
  while (left.length) {
    const [r, c] = path[path.length - 1];
    left.sort((a, b) => Math.hypot(a[0] - r, a[1] - c) - Math.hypot(b[0] - r, b[1] - c));
    path.push(left.shift());
  }
  return path;
}

/**
 * Suy ra kịch bản dạy từ chính bàn cờ, không ghi cứng toạ độ nào:
 *
 *   1. `first`  — con kiến nằm trong vùng chỉ có một ô (nhìn là hiểu vì sao)
 *   2. `lines`  — cả hàng và cột của nó, dạy nhấn từng ô
 *   3. `second` — vùng nào nhờ đó mà chỉ còn đúng một ô trống
 *   4. `swipeOne` — các ô kề con thứ hai, dạy vuốt lần đầu
 *   5. `third`  — lại một vùng chỉ còn một ô
 *   6. `swipeTwo` — các ô kề con thứ ba, tập vuốt lần hai
 *   7. `last`   — con còn lại, để người chơi tự tìm
 *
 * Trả về null nếu bàn cờ không dạy được theo nhịp này; tools/pick_tutorial.mjs
 * dùng đúng hàm này để lọc, nên bàn đã chọn thì chắc chắn chạy được.
 */
export function planTutorial(puzzle) {
  const ants = puzzle.solution.map((c, r) => [r, c]);
  const used = new Set(); // ô đã đặt kiến hoặc đã gạch
  const take = (cells) => {
    for (const cell of cells) used.add(key(cell));
    return cells;
  };
  const open = (cell) => regionOf(puzzle, cell).filter((c2) => !used.has(key(c2)));
  /** Con kiến kế tiếp mà người chơi suy ra được: vùng của nó chỉ còn một ô. */
  const forced = () => ants.find((cell) => !used.has(key(cell)) && open(cell).length === 1);

  const first = ants.find((cell) => regionOf(puzzle, cell).length === 1);
  if (!first) return null;
  take([first]);

  const lines = take(linesOf(puzzle, first).filter((cell) => !used.has(key(cell))));

  const second = forced();
  if (!second) return null;
  take([second]);
  const swipeOne = take(swipePath(touching(puzzle, second, used)));

  const third = forced();
  if (!third) return null;
  take([third]);
  const swipeTwo = take(swipePath(touching(puzzle, third, used)));

  const last = ants.find((cell) => !used.has(key(cell)));
  if (!last) return null;
  return { first, second, third, last, lines, swipeOne, swipeTwo };
}

/**
 * Kịch bản 9 bước. Mỗi bước có thể:
 *   focus  — chỉ những ô này sáng, phần còn lại của bàn bị làm tối
 *   ring   — ô được khoanh vòng, nơi cần bấm hai lần
 *   needs  — điều kiện hoàn thành: các ô phải mang giá trị này
 *   button — chờ bấm nút thay vì chờ thao tác trên bàn cờ
 *   free   — mở khoá cả bàn, chờ người chơi giải nốt
 */
export function buildSteps(puzzle) {
  // Đọc `T.tut` ngay tại đây chứ không giữ sẵn ở đầu file: đổi ngôn ngữ là ruột
  // của `T` bị thay mới, giữ sẵn thì câu chữ sẽ đứng nguyên ở thứ tiếng cũ.
  const { tut } = T;
  const plan = planTutorial(puzzle);
  if (!plan) throw new Error("bàn hướng dẫn không dạy được theo nhịp 9 bước");
  const { first, second, third, lines, swipeOne, swipeTwo } = plan;

  return [
    {
      id: "place-first",
      top: tut.placeFirst,
      focus: [first],
      ring: first,
      needs: { cells: [first], value: CAT },
    },
    {
      id: "rule-colour",
      title: tut.wellDone,
      top: tut.onePerColour,
      rule: "region",
      highlight: regionOf(puzzle, first),
      button: tut.gotIt,
    },
    {
      id: "exclude-lines",
      title: tut.nice,
      top: tut.rowCol,
      bottom: tut.tapToExclude,
      rule: "line",
      focus: lines,
      needs: { cells: lines, value: MARK },
    },
    {
      id: "place-second",
      top: `${tut.onlyLast(colourTag(puzzle.regionAt(...second)))}<br />${tut.doubleTapPlace}`,
      rule: "region",
      focus: regionOf(puzzle, second),
      ring: second,
      needs: { cells: [second], value: CAT },
    },
    {
      id: "exclude-touching",
      top: tut.adjacent,
      bottom: tut.swipeToExclude,
      rule: "touch",
      gesture: "swipe",
      focus: swipeOne,
      needs: { cells: swipeOne, value: MARK },
    },
    {
      id: "place-third",
      top: `${tut.onlyLast(colourTag(puzzle.regionAt(...third)))}<br />${tut.doubleTapPlace}`,
      rule: "region",
      focus: regionOf(puzzle, third),
      ring: third,
      needs: { cells: [third], value: CAT },
    },
    // Lượt vuốt thứ hai: cùng luật, nhưng giờ người chơi tự làm chứ không được
    // nhắc lại từ đầu — một lần nữa để quen tay.
    {
      id: "exclude-touching-2",
      top: tut.adjacentAgain,
      bottom: tut.swipeAgain,
      rule: "touch",
      gesture: "swipe",
      focus: swipeTwo,
      needs: { cells: swipeTwo, value: MARK },
    },
    {
      id: "find-last",
      top: tut.findLast,
      bottom: tut.tapForHint,
      free: true,
    },
    { id: "done", done: true },
  ];
}

export class Tutorial {
  constructor(puzzle, board) {
    this.puzzle = puzzle;
    this.board = board;
    this.steps = buildSteps(puzzle);
    this.index = 0;
  }

  /** Dựng lại câu chữ sau khi đổi ngôn ngữ, giữ nguyên bước đang học. */
  relocalize() {
    this.steps = buildSteps(this.puzzle);
  }

  get step() {
    return this.steps[this.index];
  }

  get done() {
    return Boolean(this.step.done);
  }

  /** Bước này đang chờ người chơi động vào bàn cờ (chứ không phải bấm nút). */
  get waiting() {
    return Boolean(this.step.needs || this.step.free);
  }

  /** Ô của bước hiện tại còn chưa đánh đúng — dùng để khoanh vòng và đếm tiến độ. */
  pending() {
    const needs = this.step.needs;
    if (!needs) return [];
    return needs.cells.filter(([r, c]) => this.board.get(r, c) !== needs.value);
  }

  /** Chỉ nhận đúng ô và đúng thao tác bước hiện tại yêu cầu. */
  allows(r, c, kind) {
    const step = this.step;
    if (step.free || step.done) return true;
    if (!step.needs) return false;
    const wanted = step.needs.value === CAT ? "cat" : "mark";
    return kind === wanted && step.needs.cells.some(([i, j]) => i === r && j === c);
  }

  /** Gọi sau mỗi thay đổi bàn cờ; true nếu bước hiện tại vừa xong. */
  checkProgress() {
    const step = this.step;
    if (step.free) return this.board.isSolved();
    return Boolean(step.needs) && this.pending().length === 0;
  }

  advance() {
    if (!this.done) this.index++;
    return this.step;
  }
}
