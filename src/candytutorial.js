// Hướng dẫn cho luật "kiến gác kẹo". Viết lại từ đầu; bản cũ (tutorial.js) dạy
// luật hàng/cột và sẽ bỏ khi index.html chuyển sang lõi mới.
//
// Giữ đúng nhịp chín bước mà chủ dự án đã duyệt ở bản cũ — ba lần đặt kiến, một
// thẻ luật có nút, một lượt nhấn lẻ, HAI lượt vuốt, rồi thả tay cho tự giải:
//
//   1. Đặt kiến đầu vào màu chỉ có một ô          (luật 1, nhìn là hiểu)
//   2. Vuốt các ô quanh con đầu                   (luật 3)   ← tập vuốt lần 1
//   3. Thẻ "Kẹo nào cũng phải có kiến gác" + nút  (luật 2 — luật lõi của trò)
//   4. Viên kẹo chỉ còn một ô gác được — đặt con thứ hai (luật 2 lúc làm thật)
//   5. Nhấn nốt các ô còn lại của màu đó          (luật 1 lúc làm thật)
//   6. Vuốt các ô quanh con thứ hai                          ← tập vuốt lần 2
//   7. Một màu chỉ còn một ô — đặt con thứ ba
//   8. Tự tìm những con còn lại
//   9. "Đủ ba luật rồi"
//
// Hai chỗ đáng nói trong thứ tự này:
//
// Thẻ luật kẹo đứng ngay TRƯỚC nước đi dùng tới nó, chứ không ngay sau nước mở
// màn. Con kiến mở màn nằm ở màu một ô, mà kiểu ô ấy gần như không bao giờ có
// kẹo bên cạnh: bộ sinh chỉ rải kẹo để phá lời giải đối thủ, còn kiến ở màu một
// ô thì lời giải nào cũng đứng đúng chỗ đó nên chẳng cần viên kẹo nào canh nó.
// Đọc thẻ xong là dùng được ngay, và viên kẹo loé sáng ở bước 4 chính là câu
// trả lời cho dòng "kẹo có người gác thì loé sáng" của thẻ.
//
// Bước 4 cố ý ép bằng LUẬT KẸO chứ không bằng luật màu. Ép bằng luật màu thì
// màu ấy đã chỉ còn đúng một ô, nên bước 5 không còn ô nào để nhấn — nhịp dạy
// tự mâu thuẫn.
//
// Vì sao thứ tự này: luật 2 là thứ duy nhất người chơi chưa gặp ở trò nào khác,
// nên nó phải được gọi tên ngay sau nước đi đầu tiên, đúng lúc con kiến vừa đặt
// làm viên kẹo cạnh nó loé sáng — chỉ vào được thì khỏi giải thích dài. Luật 1
// và 3 quen thuộc hơn nên dạy bằng thao tác, không tốn thẻ.
//
// Không toạ độ nào ghi cứng: planTutorial() suy cả trình tự lẫn từng ô từ luật
// chơi, nên đổi bàn hướng dẫn là kịch bản tự khớp theo. Bộ chọn bàn
// (tools/pick_candy_tutorial.mjs) dùng chính hàm này để lọc, và
// tools/candy_flow_test.mjs kiểm lại nhịp dạy trên bàn đã chọn.

import { CandyPuzzle, CAT, MARK } from "./candyboard.js";
import { CANDY_TUTORIAL, PALETTE } from "./candylevels.js";
import { T } from "./strings.js";

export function tutorialPuzzle() {
  return new CandyPuzzle(CANDY_TUTORIAL.record, CANDY_TUTORIAL.size);
}

const key = ([r, c]) => `${r},${c}`;

/**
 * Tên màu vùng, tô đúng màu đó. Bảng chữ giữ tên nên đổi ngôn ngữ là đổi theo;
 * PALETTE trong candylevels.js giữ bản tiếng Anh làm gốc đối chiếu.
 */
const colourTag = (puzzle, region) => {
  const index = puzzle.colourOf(region) % PALETTE.length;
  return `<b class="key" style="color: var(--k${index})">${T.colors[index]}</b>`;
};

/**
 * Xếp một dãy ô thành đường vuốt liền tay: bắt đầu từ ô thấp nhất (trái nhất
 * nếu hoà), rồi mỗi bước nhảy sang ô gần nhất còn lại. Bàn tay minh hoạ vẽ theo
 * đúng đường này nên nó phải đi được bằng một ngón, không nhảy cóc.
 */
export function swipePath(cells) {
  const left = [...cells].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  if (!left.length) return [];
  const path = [left.shift()];
  while (left.length) {
    const [r, c] = path[path.length - 1];
    left.sort((a, b) => Math.hypot(a[0] - r, a[1] - c) - Math.hypot(b[0] - r, b[1] - c));
    path.push(left.shift());
  }
  return path;
}

/**
 * Suy kịch bản dạy từ bàn cờ. Trả null nếu bàn không dạy được theo nhịp trên —
 * bộ chọn bàn dựa vào đúng chỗ null này để loại.
 *
 * Trả về:
 *   first / second / third / last — bốn con kiến theo thứ tự dạy
 *   swipeOne    — ô quanh con đầu, đường vuốt lần 1
 *   secondCandy — viên kẹo ép ra con thứ hai
 *   tapRegion   — ô còn lại của màu con thứ hai, dạy nhấn lẻ
 *   swipeTwo    — ô quanh con thứ hai, đường vuốt lần 2
 *   thirdBy     — "region" hay "candy": con thứ ba bị ép bởi luật nào
 */
export function planTutorial(puzzle) {
  const ants = puzzle.solution; // [hàng, cột] theo vùng
  const used = new Set(); // ô đã đặt kiến hoặc đã tắt đèn
  const placed = []; // kiến đã đứng trên bàn
  const take = (cells) => { for (const cell of cells) used.add(key(cell)); return cells; };
  // Ô kẹo không bao giờ vào kịch bản: không đặt kiến lên được, cũng không tắt đèn.
  const spare = ([r, c]) => !used.has(`${r},${c}`) && !puzzle.isCandy(r, c);
  const openOf = (region) => puzzle.cellsOf(region).filter(spare);
  const regionOf = ([r, c]) => puzzle.regionAt(r, c);
  const near = (cell) => puzzle.zone(...cell).filter(spare);
  const put = (cell) => { placed.push(cell); take([cell]); return cell; };

  /** Luật 1 ép ra: màu của con này chỉ còn đúng một ô. */
  const forcedByRegion = () => ants.find((cell) => spare(cell) && openOf(regionOf(cell)).length === 1);

  /**
   * Luật 2 ép ra: một viên kẹo chưa ai gác mà quanh nó chỉ còn đúng một ô sáng.
   * Phải kiểm "chưa ai gác" — kẹo đã có kiến đứng cạnh thì chẳng ép được gì.
   */
  const forcedByCandy = () => {
    for (const [r, c] of puzzle.candyCells()) {
      const zone = puzzle.zone(r, c);
      if (zone.some(([y, x]) => placed.some(([i, j]) => i === y && j === x))) continue;
      const open = zone.filter(spare);
      if (open.length !== 1) continue;
      const cell = ants.find(([i, j]) => i === open[0][0] && j === open[0][1]);
      if (cell) return { cell, candy: [r, c] };
    }
    return null;
  };

  // 1. Màu chỉ có đúng một ô: kiến của nó không thể ở đâu khác. Nước mở màn
  //    phải không đòi biết luật nào trước đó, nếu không thì đây là câu đố chứ
  //    không phải bài dạy.
  const first = ants.find((cell) => puzzle.cellsOf(regionOf(cell)).length === 1);
  if (!first) return null;
  put(first);

  // 2. Ô quanh con đầu: luật 3, và cũng là lượt vuốt đầu tiên.
  const swipeOne = take(swipePath(near(first)));
  if (swipeOne.length < 2) return null;

  // 4. Vuốt xong thì một viên kẹo bị dồn còn đúng một chỗ gác được.
  const forcedSecond = forcedByCandy();
  if (!forcedSecond) return null;
  const second = put(forcedSecond.cell);
  const secondCandy = forcedSecond.candy;

  // 5. Phần còn lại của màu ấy: luật 1 lúc làm thật, dạy nhấn từng ô.
  const tapRegion = take(openOf(regionOf(second)));
  if (!tapRegion.length) return null;

  // 6. Ô quanh con thứ hai: vuốt lần hai, lần này không nhắc lại từ đầu.
  const swipeTwo = take(swipePath(near(second)));
  if (swipeTwo.length < 2) return null;

  // 7. Con thứ ba: ưu tiên luật màu vì câu giải thích ngắn hơn, không có thì
  //    lại nhờ luật kẹo.
  const byRegion = forcedByRegion();
  const byCandy = byRegion ? null : forcedByCandy();
  const third = byRegion || byCandy?.cell;
  if (!third) return null;
  put(third);

  const last = ants.find((cell) => spare(cell));
  if (!last) return null;
  return {
    first, second, third, last,
    secondCandy, swipeOne, tapRegion, swipeTwo,
    thirdBy: byRegion ? "region" : "candy",
    thirdCandy: byCandy?.candy || null,
  };
}

/**
 * Kịch bản chín bước. Mỗi bước có thể mang:
 *   focus  — chỉ những ô này sáng, phần bàn còn lại bị làm tối
 *   ring   — ô được khoanh vòng, chỗ cần bấm hai lần
 *   needs  — điều kiện xong bước: các ô phải mang đúng giá trị này
 *   button — chờ bấm nút thay vì chờ thao tác trên bàn
 *   free   — mở khoá cả bàn, chờ người chơi giải nốt
 */
export function buildSteps(puzzle) {
  // Đọc `T.guard` ngay tại đây chứ không giữ sẵn ở đầu file: đổi ngôn ngữ là
  // ruột của `T` bị thay mới, giữ sẵn thì chữ đứng nguyên ở thứ tiếng cũ.
  const g = T.guard;
  const plan = planTutorial(puzzle);
  if (!plan) throw new Error("bàn hướng dẫn không dạy được theo nhịp chín bước");
  const { first, second, third, secondCandy, swipeOne, tapRegion, swipeTwo } = plan;
  const firstColour = colourTag(puzzle, puzzle.regionAt(...first));
  const thirdColour = colourTag(puzzle, puzzle.regionAt(...third));
  const thirdWhy = plan.thirdBy === "region" ? g.onlyLeft(thirdColour) : g.candyCornered;

  return [
    {
      id: "place-first",
      top: `${g.onlyCell(firstColour)}<br />${g.doubleTap}`,
      focus: [first],
      ring: first,
      needs: { cells: [first], value: CAT },
    },
    {
      id: "swipe-around",
      title: g.posted,
      top: g.adjacent,
      bottom: g.swipeToExclude,
      gesture: "swipe",
      focus: swipeOne,
      needs: { cells: swipeOne, value: MARK },
    },
    {
      id: "rule-candy",
      title: g.nice,
      // Câu về kẹo loé sáng nằm chung thẻ trên chứ không xuống thẻ dưới: ô dưới
      // bàn cờ dùng chung cho thẻ nhắc và nút "Hiểu rồi", bước nào có nút thì
      // thẻ dưới bị nút đè lên.
      top: `${g.candyRule}<br />${g.sparkles}`,
      // Khoanh mọi viên kẹo: luật nói về tất cả, và người chơi cần nhìn ra còn
      // bao nhiêu viên chưa ai trông.
      highlight: puzzle.candyCells(),
      button: g.gotIt,
    },
    {
      id: "place-second",
      top: `${g.candyCornered}<br />${g.doubleTap}`,
      // Sáng cả viên kẹo lẫn ô phải đặt: người chơi thấy được cái cớ, chứ không
      // phải chỉ thấy chỗ bấm.
      focus: [second, secondCandy],
      ring: second,
      needs: { cells: [second], value: CAT },
    },
    {
      id: "tap-region",
      title: g.wellDone,
      top: g.onePerColour,
      bottom: g.tapToExclude,
      focus: tapRegion,
      needs: { cells: tapRegion, value: MARK },
    },
    {
      id: "swipe-around-2",
      top: g.adjacentAgain,
      bottom: g.swipeAgain,
      gesture: "swipe",
      focus: swipeTwo,
      needs: { cells: swipeTwo, value: MARK },
    },
    {
      id: "place-third",
      top: `${thirdWhy}<br />${g.doubleTap}`,
      focus: [third],
      ring: third,
      needs: { cells: [third], value: CAT },
    },
    {
      id: "find-last",
      top: g.findLast,
      bottom: g.tapForHint,
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

  /** Bước này đang chờ người chơi động vào bàn cờ chứ không phải bấm nút. */
  get waiting() {
    return Boolean(this.step.needs || this.step.free);
  }

  /** Ô của bước hiện tại còn chưa đúng — để khoanh vòng và đếm tiến độ. */
  pending() {
    const needs = this.step.needs;
    if (!needs) return [];
    return needs.cells.filter(([r, c]) => this.board.get(r, c) !== needs.value);
  }

  /** Chỉ nhận đúng ô và đúng thao tác mà bước hiện tại yêu cầu. */
  allows(r, c, kind) {
    const step = this.step;
    if (step.free || step.done) return true;
    if (!step.needs) return false;
    const wanted = step.needs.value === CAT ? "cat" : "mark";
    return kind === wanted && step.needs.cells.some(([i, j]) => i === r && j === c);
  }

  /** Gọi sau mỗi thay đổi trên bàn; true nếu bước hiện tại vừa xong. */
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
