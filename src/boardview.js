// Phần hiển thị bàn cờ và xử lý thao tác, dùng chung cho cả game lẫn trang phân tích.

import { EMPTY, MARK, CAT } from "./puzzle.js";

// Bấm một lần = ✕, bấm đúp = đặt con vật.
//
// Dấu ✕ được ghi NGAY ở cú bấm đầu, không chờ xem có cú thứ hai hay không —
// chờ thì mỗi lần bấm đều khựng đúng chừng ấy mili-giây, rất rõ khi loại nhiều
// ô liên tiếp. Cú thứ hai trong khoảng dưới đây ghi đè ✕ thành con vật, nên
// người chơi chỉ thấy ✕ loé lên rồi thành kiến — đúng như bản gốc.
const DOUBLE_TAP_MS = 260;

// Kiến vui bao lâu rồi về mặt thường.
const HAPPY_MS = 900;

export class BoardView {
  constructor(container, options = {}) {
    this.el = container;
    this.board = null;
    this.cells = [];
    this.autoX = true;
    this.locked = false;
    // Ô game đặt sẵn khi vào màn — người chơi không được sửa, như bản gốc.
    this.fixed = new Set();
    // Ô người chơi đã đặt sai: mang ✕ đỏ và khoá luôn.
    this.wrong = new Set();
    // Trả về false để từ chối một con vật đặt sai chỗ.
    this.validate = options.validate || (() => true);
    this.onReject = options.onReject || (() => {});
    this.onChange = options.onChange || (() => {});
    // Âm thanh: đặt kiến / đánh ✕ — game.js nối vào sound.js.
    this.onPlace = options.onPlace || (() => {});
    this.onMark = options.onMark || (() => {});
    // Trả về false để chặn một nước đi — tutorial dùng cái này để ép đúng thao tác.
    this.allowMove = options.allowMove || (() => true);

    // pending/single: ô đang chờ hết nhịp bấm đúp, và hành động sẽ chạy khi hết nhịp.
    // lastAt/lastCell: mốc của cú bấm trước, để nhận bấm đúp ngay lập tức thay vì
    // phải chờ timer của cú bấm đơn chạy xong.
    this.tap = { dragging: false, last: null, lastAt: 0, lastCell: null };

    // Bàn tay minh hoạ thao tác trong lúc hướng dẫn. Lớp ngoài lo vị trí, lớp
    // trong lo nhịp nhấn/trượt, để hai transform không giẫm chân nhau.
    this.handEl = document.createElement("div");
    this.handEl.className = "hand";
    this.handEl.hidden = true;
    this.handEl.innerHTML = "<i>👆</i>";
    this.handAnim = null;
    this.el.append(this.handEl);
    this.el.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.el.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.el.addEventListener("pointerup", () => this.onPointerUp());
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Dựng lại lưới DOM cho một bàn cờ mới. */
  mount(board, fixed = []) {
    this.board = board;
    this.fixed = new Set(fixed.map(([r, c]) => `${r},${c}`));
    this.wrong = new Set();
    const n = board.size;
    const regions = board.puzzle.regions;
    this.el.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    // CSS lấy --n để tính cỡ mèo/✕ theo cạnh ô thật.
    this.el.style.setProperty("--n", n);
    this.hideHand();
    this.el.innerHTML = "";
    this.el.append(this.handEl);
    this.cells = [];

    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        // Dấu ✕ là SVG hai nét chứ không phải chữ: bản gốc *vẽ* từng nét ra chứ
        // không phóng to một ký tự có sẵn, mà nét chỉ vẽ được bằng stroke-dashoffset.
        cell.innerHTML =
          '<svg class="x" viewBox="0 0 100 100" aria-hidden="true">' +
          '<line x1="27" y1="27" x2="73" y2="73" /><line x1="73" y1="27" x2="27" y2="73" /></svg>';
        cell.style.background = `var(--g${board.puzzle.colourOf(regions[r][c])})`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        this.el.append(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
    // Ảnh chụp trạng thái lần vẽ trước. Vào màn thì chép nguyên thế cờ hiện có,
    // để con vật đặt sẵn không nổ hiệu ứng như vừa mới được đặt.
    this.shown = this.cells.map((row, r) => row.map((_, c) => board.get(r, c)));
    this.origin = null;
    this.render();
  }

  render() {
    const board = this.board;
    if (!board) return;
    const clashing = new Set();
    for (const conflict of board.conflicts())
      for (const [r, c] of conflict.cells) clashing.add(`${r},${c}`);

    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const node = this.cells[r][c];
        const value = board.get(r, c);
        if (this.shown && this.shown[r][c] !== value) {
          this.playChange(node, this.shown[r][c], value, r, c);
          this.shown[r][c] = value;
        }
        node.classList.toggle("mark", value === MARK);
        node.classList.toggle("cat", value === CAT);
        node.classList.toggle("conflict", clashing.has(`${r},${c}`));
        node.classList.toggle("wrong", this.wrong.has(`${r},${c}`));
      }
    }
  }

  /**
   * Nhịp cho một ô vừa đổi trạng thái. Đo từ bản ghi màn hình của game tham
   * chiếu: ô loé trắng lan từ giữa ra hết 0.44s, dấu ✕ bung quá cỡ 1.34× rồi
   * lắng về — hai lớp chồng lên nhau nên thấy liền một hơi.
   *
   * Loạt ✕ do tự đánh hộ thì lệch pha theo khoảng cách tới ô vừa đặt, lan ra như
   * sóng; nổ cùng lúc cả chục ô thì thành nháy đèn.
   */
  playChange(node, before, after, r, c) {
    const step = this.origin
      ? Math.abs(r - this.origin[0]) + Math.abs(c - this.origin[1])
      : 0;
    node.style.setProperty("--delay", `${Math.min(step, 6) * 0.035}s`);

    // Gỡ rồi ép reflow, nếu không đổi liên tiếp cùng một ô sẽ không chạy lại.
    node.classList.remove("flash", "unmark");
    void node.offsetWidth;
    // Vệt loé chỉ dành cho lúc đặt con vật. Bản gốc không loé khi đánh ✕ —
    // ở đó nét vẽ đã đủ nói rồi.
    if (after === CAT) node.classList.add("flash");
    if (before === MARK && after === EMPTY) node.classList.add("unmark");
    // Chờ *mọi* nhịp trên ô xong mới dọn class. Nghe animationend đơn lẻ thì
    // nhịp ngắn nhất về đích trước và cắt ngang mấy nhịp còn dang dở.
    Promise.allSettled(node.getAnimations({ subtree: true }).map((a) => a.finished))
      .then(() => node.classList.remove("flash", "unmark"));
  }

  clearHighlights() {
    for (const row of this.cells) for (const node of row) node.classList.remove("hint", "spot", "lit", "ring", "preview", "cause");
  }

  /**
   * Chế độ hướng dẫn: làm tối cả bàn cờ, chỉ chừa lại các ô đang được nói tới.
   * Meowdoku dùng đúng cách này thay vì viền sáng — nhìn là biết phải bấm đâu.
   */
  setFocus(cells, ring = null) {
    this.el.classList.toggle("dim", Boolean(cells));
    if (cells) this.highlight(cells, "lit");
    if (ring) this.cells[ring[0]][ring[1]]?.classList.add("ring");
  }

  editable(r, c) {
    return !this.fixed.has(`${r},${c}`);
  }

  /**
   * Bàn tay hướng dẫn: `tap` thì đứng nhấn nhịp trên một ô, `swipe` thì trượt
   * lặp qua dãy ô — đúng hai kiểu Meowdoku dùng trong tutorial.
   */
  showHand(cells, mode) {
    if (!cells.length || !this.cells.length) return this.hideHand();
    const hand = this.handEl;
    const first = this.cells[cells[0][0]][cells[0][1]];
    // Ngón tay chạm vào giữa ô, nên gốc bàn tay đặt hơi thấp hơn tâm một chút.
    const spot = ([r, c]) => {
      const cell = this.cells[r][c];
      return `translate(${cell.offsetLeft + cell.offsetWidth / 2}px, ${cell.offsetTop + cell.offsetHeight * 0.45}px)`;
    };

    this.handAnim?.cancel();
    this.handAnim = null;
    hand.style.fontSize = `${first.offsetWidth * 0.62}px`;
    hand.classList.toggle("tapping", mode === "tap");
    hand.hidden = false;

    if (mode === "tap") {
      hand.style.transform = spot(cells[0]);
      return;
    }
    // Dừng một nhịp ở ô đầu và ô cuối cho người chơi kịp nhìn hướng trượt.
    const path = cells.map((cell) => ({ transform: spot(cell) }));
    hand.style.transform = path[0].transform;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.handAnim = hand.animate([path[0], ...path, path[path.length - 1]], {
        duration: 420 * (path.length + 1),
        iterations: Infinity,
        easing: "ease-in-out",
      });
  }

  hideHand() {
    this.handAnim?.cancel();
    this.handAnim = null;
    this.handEl.hidden = true;
  }

  highlight(cellList, className = "hint") {
    for (const [r, c] of cellList) this.cells[r][c]?.classList.add(className);
  }

  // ------------------------------------------------------------- nước đi

  /** Đặt mèo, kèm tự đánh ✕ mọi ô bị con mèo đó loại nếu bật tuỳ chọn. */
  placeCat(r, c) {
    const board = this.board;
    this.origin = [r, c]; // tâm sóng cho loạt ✕ tự đánh kèm theo
    if (!this.validate(r, c)) return this.onReject(r, c);
    const changes = [[r, c, CAT]];
    if (this.autoX) {
      const n = board.size;
      const region = board.puzzle.regionAt(r, c);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === r && j === c) continue;
          const blocked = i === r || j === c || board.puzzle.regionAt(i, j) === region ||
            (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1);
          if (blocked && board.get(i, j) === EMPTY) changes.push([i, j, MARK]);
        }
      }
    }
    this.commit(changes);
    this.origin = null; // sóng đã phát xong, mấy ô bấm lẻ sau đó không lệch pha
    this.pop(r, c);
  }

  /** Nhịp bung của con kiến vừa đặt, kèm ảnh kiến vui một lát rồi về ảnh
   *  thường. Gỡ class trước rồi ép reflow, nếu không đặt hai con liên tiếp thì
   *  con sau không chạy lại animation. */
  pop(r, c) {
    const node = this.cells[r]?.[c];
    if (!node || this.board.get(r, c) !== CAT) return;
    node.classList.remove("pop", "happy");
    void node.offsetWidth;
    node.classList.add("pop", "happy");
    node.addEventListener("animationend", () => node.classList.remove("pop"), { once: true });
    clearTimeout(node.happyTimer);
    node.happyTimer = setTimeout(() => node.classList.remove("happy"), HAPPY_MS);
  }

  /** Giữ mặt vui lâu hơn thường lệ — dùng khi người chơi vừa gỡ được ngách khó. */
  holdHappy(r, c, ms) {
    const node = this.cells[r]?.[c];
    if (!node || this.board.get(r, c) !== CAT) return;
    node.classList.add("happy");
    clearTimeout(node.happyTimer);
    node.happyTimer = setTimeout(() => node.classList.remove("happy"), ms);
  }

  /** Ghi một ô là đặt sai: ✕ đỏ, khoá lại, không hoàn tác được. */
  markWrong(r, c) {
    this.wrong.add(`${r},${c}`);
    this.fixed.add(`${r},${c}`);
    this.board.apply([[r, c, MARK]]);
    this.board.history.length = 0;
    this.render();
  }

  toggleMark(r, c) {
    this.commit([[r, c, this.board.get(r, c) === EMPTY ? MARK : EMPTY]]);
  }

  commit(changes) {
    if (this.board.apply(changes)) {
      this.render();
      const cat = changes.find(([, , v]) => v === CAT);
      if (cat) this.onPlace(cat[0], cat[1]);
      else this.onMark();
      this.onChange();
    }
  }

  // -------------------------------------------------------------- thao tác

  cellAt(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
    return node && this.el.contains(node) ? [+node.dataset.r, +node.dataset.c] : null;
  }

  onPointerDown(event) {
    // Chặn cử chỉ mặc định của trình duyệt cho MỌI cú chạm lên bàn cờ — kể cả
    // cú rơi vào ô đã khoá hay lúc cả bàn đang khoá. Mấy nhánh thoát sớm bên
    // dưới từng bỏ qua preventDefault, và Safari lập tức coi hai cú chạm nhanh
    // vào đó là "bấm đúp để phóng to" — chỗ rò khiến lỗi lúc bị lúc không.
    if (event.pointerType !== "mouse") event.preventDefault();
    if (this.locked || !this.board) return;
    const at = this.cellAt(event);
    if (!at || !this.editable(at[0], at[1])) return;
    event.preventDefault(); // với chuột: chặn bôi đen khi kéo qua nhiều ô
    const [r, c] = at;
    this.pressCell(r, c);
    this.tap.last = at;
    this.tap.dragging = false;
    this.el.setPointerCapture?.(event.pointerId);

    const putCat = () => {
      if (!this.allowMove(r, c, "cat")) return;
      this.board.get(r, c) === CAT ? this.commit([[r, c, EMPTY]]) : this.placeCat(r, c);
    };

    if (event.button === 2) { // chuột phải = đặt con vật luôn
      this.tap.lastCell = null;
      putCat();
      this.tap.last = null;
      return;
    }
    const now = performance.now();
    const sameAsLast = this.tap.lastCell &&
      this.tap.lastCell[0] === r && this.tap.lastCell[1] === c &&
      now - this.tap.lastAt < DOUBLE_TAP_MS;

    if (sameAsLast) { // cú thứ hai vào đúng ô đó — bấm đúp
      this.tap.lastAt = 0;
      this.tap.lastCell = null;
      putCat();
      this.tap.last = null;
      return;
    }
    this.tap.lastAt = now;
    this.tap.lastCell = at;
    if (this.allowMove(r, c, "mark")) this.toggleMark(r, c);
  }

  /** Kéo qua nhiều ô để đánh ✕ hàng loạt, đúng như thao tác vuốt trong Meowdoku. */
  onPointerMove(event) {
    if (this.locked || !this.tap.last || event.buttons === 0) return;
    const at = this.cellAt(event);
    if (!at) return;
    const [r, c] = at;
    if (r === this.tap.last[0] && c === this.tap.last[1]) return;

    if (!this.tap.dragging) { // vừa rời ô đầu tiên: chuyển hẳn sang chế độ kéo
      this.tap.dragging = true;
      // Kéo tiếp thì cú bấm này không còn là nửa đầu của một lần bấm đúp nữa.
      this.tap.lastCell = null;
      const [fr, fc] = this.tap.last;
      if (this.board.get(fr, fc) === EMPTY && this.allowMove(fr, fc, "mark"))
        this.commit([[fr, fc, MARK]]);
    }
    if (this.board.get(r, c) === EMPTY && this.editable(r, c) && this.allowMove(r, c, "mark"))
      this.commit([[r, c, MARK]]);
    this.tap.last = at;
  }

  onPointerUp() {
    this.unpress();
    if (this.tap.dragging) this.tap.last = null;
  }

  /** Ô lún xuống trong lúc ngón tay còn chạm — bản gốc co ô lại 2%. */
  pressCell(r, c) {
    this.unpress();
    this.pressed = this.cells[r]?.[c] ?? null;
    this.pressed?.classList.add("press");
  }

  unpress() {
    this.pressed?.classList.remove("press");
    this.pressed = null;
  }
}
