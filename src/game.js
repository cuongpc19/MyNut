// Vòng chơi chính: trang chủ → hướng dẫn → chơi từng màn một, có lưu tiến trình.

import { Board, Puzzle, CAT, MARK, EMPTY } from "./puzzle.js";
import { BoardView } from "./boardview.js";
import { nextDeduction, stateFromBoard, placementRank, EASY_RANKS } from "./solver.js";
import { Tutorial, tutorialPuzzle } from "./tutorial.js";
import { T, explain, applyStatic, LANGUAGES, getLocale, setLocale } from "./strings.js";
import { sound } from "./sound.js";
import { chapterOf, roomNameIndex, endsChapter, floorRooms, renderNest } from "./nest.js";
import {
  levelRecord, autoMarksFor, onLevelWon, onLevelFailed, onLevelRestarted, markDirty,
  loadProgress, markCleared, clearProgress, currentLevel, starsFor,
  touchStreak, useFree,
  bankSpoils, spendCandy, CANDY_PER_LEVEL, CANDY_COST, WELCOME_CANDY,
} from "./progression.js";

// Nhịp nháy sáng cả bàn cờ sau khi làm xong một bước hướng dẫn, trước khi sang
// bước sau. Đủ để thấy mình vừa làm đúng, không đủ để thấy phải chờ; cũng vừa
// đủ dài để lớp phủ tối kịp mờ hết trước khi bước mới dựng lên.
const FLASH_MS = 360;

/** Chạy lại một animation CSS đang gắn sẵn trên phần tử. */
function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // ép trình duyệt tính lại, nếu không animation không chạy lại
  node.classList.add(className);
}

// Mỗi màn phát ba viên kẹo. Đặt sai một con kiến là mất một viên; hết kẹo thì
// thua màn. Còn dư bao nhiêu thì mang về kho bấy nhiêu, nên chơi cẩn thận có
// thưởng thật chứ không chỉ "đừng thua". Hai nút trợ giúp cũng trả bằng kẹo
// lấy từ chính kho đó (CANDY_COST) — một đơn vị duy nhất cho cả game.

// Điểm mỗi lần đặt đúng, đọc ngược từ video: 576 cho con đầu, mỗi con đúng liên
// tiếp sau đó cộng thêm 96, đặt sai thì chuỗi về 0.
// Màn 1: 576 → (sai) → 576 → 672 = 1824. Màn 2: 576 → 672 → 768 = 2016.
const SCORE_BASE = 576;
const SCORE_STEP = 96;

const $ = (id) => document.getElementById(id);
const screens = { home: $("screen-home"), play: $("screen-play") };

const ui = {
  nest: $("nest"), homeBank: $("home-bank"), playLabel: $("play-label"),
  kicker: $("play-kicker"), title: $("play-title"),
  chips: $("chips"), count: $("play-count"), candies: $("play-candy"),
  bank: $("play-bank"), candyFly: $("candy-fly"),
  status: $("play-status"), hintText: $("hint-text"),
  coachTop: $("coach-top"), coachTitle: $("coach-title"), coachText: $("coach-text"),
  coachBottom: $("coach-bottom"), coachHint: $("coach-hint"),
  // Một nút viên thuốc dưới bàn cờ, lúc là "Got it!" của hướng dẫn, lúc là Apply
  // của gợi ý — hai vai không bao giờ trùng nhau nên dùng chung được.
  coachNext: $("btn-apply"), apply: $("btn-apply"),
  boosters: $("boosters"), reveal: $("btn-reveal"), revealLeft: $("reveal-left"),
  hint: $("btn-hint"), hintLeft: $("hint-left"),
  win: $("win"), winTitle: $("win-title"), winNote: $("win-note"),
  winArt: $("win-art"), winBadge: $("win-badge"), winReward: $("win-reward"),
  winCandy: $("win-candy"),
  confetti: $("confetti"),
  next: $("btn-next"), replay: $("btn-replay"),
  settings: $("settings"), settingsNote: $("settings-note"), language: $("opt-language"),
  soundToggle: $("opt-sound"),
  confirm: $("confirm"), wipeLosing: $("wipe-losing"),
  restart: $("btn-restart"), howto: $("btn-howto"),
};

const state = {
  progress: loadProgress(),
  level: 1,
  spec: null,
  puzzle: null,
  board: null,
  score: 0,
  chain: 0,   // số lần đặt đúng liên tiếp, dùng để cộng dồn điểm
  scored: 0,  // số con đã tính điểm, để biết lần thay đổi nào là đặt thêm
  candy: CANDY_PER_LEVEL, // kẹo còn lại trong màn đang chơi
  hintsUsed: 0,
  offer: null, // nước đi thẻ gợi ý đang chỉ, chờ bấm Apply
  tutorial: null,
  flashing: false,
  shownStep: null, // id bước đang hiện, để biết lúc nào cần chạy lại hiệu ứng
  thinkStart: 0,   // mốc bắt đầu nghĩ nước hiện tại
  thinkHints: 0,   // số lượt trợ giúp tính tới lúc bắt đầu nghĩ, để biết có được chỉ chỗ không
  gaps: [],        // các quãng nghĩ đã đo trong màn — nhịp riêng của người chơi hôm nay
  sinceHard: 99,   // bao nhiêu nước kể từ lần ăn mừng lớn gần nhất
  rating: 0,       // bậc của bàn đang chơi — trần độ khó của chính nó
  prevCells: null, // bàn cờ ngay trước nước vừa rồi, để chấm nước đó khó tới đâu
  chapterOver: false, // vừa gác xong đêm cuối của một chương: nút Tiếp đưa về tổ
};

const view = new BoardView($("board"), {
  onChange: () => onBoardChange(),
  // Trong nhịp nháy sáng giữa hai bước thì khoá bàn cờ lại, tránh người chơi
  // bấm lại đúng ô vừa xong và làm bước đó "chưa hoàn thành" trở lại.
  allowMove: (r, c, kind) =>
    !state.tutorial || (!state.flashing && state.tutorial.allows(r, c, kind)),
  // Meowdoku bắt lỗi ngay lúc đặt chứ không để người chơi ôm một thế cờ sai.
  validate: (r, c) => Boolean(state.tutorial) || state.puzzle.solution[r] === c,
  onReject: (r, c) => onWrongPlacement(r, c),
  onPlace: (r, c) => { state.lastPlaced = [r, c]; sound.pop(); },
  onMark: () => sound.tick(),
});

// ------------------------------------------------------------- điều hướng

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
  if (name === "home") refreshHome();
}

/**
 * Trang chủ kể câu chuyện bằng hình: tầng nào, chương nào, buồng nào đang gác,
 * đã gác mấy đêm. Chữ chỉ có tên tầng và tên buồng.
 */
function refreshHome() {
  const current = currentLevel(state.progress);
  const chapter = chapterOf(current);
  const rooms = floorRooms(current);
  const names = rooms.map((room) => T.rooms[room.nameIndex]);

  // Không còn dòng chữ nào ở đây: tên buồng đã nằm ngay dưới mỗi buồng trong
  // hình, còn tiến độ năm đêm thì chính vòng quanh buồng đang gác vẽ ra.
  renderNest(ui.nest, rooms, names);

  ui.playLabel.textContent = state.progress.cleared ? T.playOn(current) : T.play;
  refreshBank();
}

for (const button of document.querySelectorAll("[data-goto]"))
  button.addEventListener("click", () => show(button.dataset.goto));

// --------------------------------------------------------------- vào màn

/** Đưa một bàn cờ lên màn chơi — dùng chung cho màn thường lẫn tutorial. */
function mountPlay({ puzzle, kicker, title, autoMark, given = [], note = "", rating = 0 }) {
  state.puzzle = puzzle;
  state.board = new Board(puzzle);
  state.score = 0;
  state.chain = 0;
  state.candy = CANDY_PER_LEVEL;
  state.hintsUsed = 0;
  buildCandyChip();
  state.flashing = false;
  state.gaps = [];
  state.sinceHard = 99;
  state.rating = rating;
  state.prevCells = null;
  resetThink();

  // Con vật game đặt sẵn: ghi thẳng vào bàn cờ rồi xoá lịch sử, để Hoàn tác
  // không gỡ được nó ra — bản gốc cũng khoá cứng con mở màn.
  if (given.length) {
    state.board.apply(given.map(([r, c]) => [r, c, CAT]));
    state.board.history.length = 0;
  }

  view.autoX = autoMark;
  view.locked = false;
  view.mount(state.board, given);
  closeOffer();

  ui.kicker.textContent = kicker;
  ui.title.textContent = title;
  ui.hintText.innerHTML = note;
  ui.win.hidden = true;
  show("play");
}

async function startLevel(n) {
  const loaded = await levelRecord(n, state.progress);
  if (!loaded) {
    ui.status.textContent = T.loadFailed;
    return;
  }
  state.progress = loaded.progress;
  state.level = n;
  state.spec = loaded.spec;
  state.tutorial = null;

  mountPlay({
    puzzle: new Puzzle(loaded.record, loaded.size),
    kicker: T.level,
    title: String(n),
    // Bánh xe phụ: chỉ hai màn đầu game mới đánh ✕ hộ, sau đó người chơi tự loại ô.
    autoMark: autoMarksFor(n),
    // Bậc của chính bàn này, để biết thế nào là "ngách khó" trên nó.
    rating: loaded.record.r || 0,
    given: loaded.given,
  });
  screens.play.classList.remove("tutorial");
  ui.chips.hidden = false;
  ui.boosters.hidden = false;
  ui.coachTop.hidden = true;
  ui.coachBottom.hidden = true;
  refreshHud();
}

function startTutorial() {
  const puzzle = tutorialPuzzle();
  state.level = 0;
  state.spec = null;
  // Tutorial dạy tự loại ô, nên tuyệt đối không đánh ✕ hộ.
  mountPlay({ puzzle, kicker: "", title: T.tutorialTitle, autoMark: false });
  screens.play.classList.add("tutorial");
  ui.chips.hidden = true;
  ui.boosters.hidden = true;
  state.tutorial = new Tutorial(puzzle, state.board);
  state.shownStep = null;
  ui.replay.hidden = true;
  renderCoach();
}

// ------------------------------------------------------------------- HUD

function refreshHud() {
  const board = state.board;
  ui.count.textContent = T.counter(board.cats().length, board.size);
  paintCandy();
  refreshBooster(ui.reveal, ui.revealLeft, "reveal");
  refreshBooster(ui.hint, ui.hintLeft, "hint");
  refreshBank();
}

/**
 * Ba viên kẹo dựng một lần mỗi màn rồi giữ nguyên phần tử. Không vẽ lại bằng
 * innerHTML ở mỗi nhịp HUD: làm thế là animation "vừa mất một viên" bị xoá
 * ngay giữa chừng, mà đó lại là lúc cần thấy nó nhất.
 */
function buildCandyChip() {
  ui.candies.innerHTML = Array.from(
    { length: CANDY_PER_LEVEL },
    () => `<i class="candy"></i>`,
  ).join("");
}

/** Tô lại ba viên kẹo trên chip theo số còn lại trong đêm nay. */
function paintCandy() {
  for (const [i, node] of [...ui.candies.children].entries())
    node.classList.toggle("gone", i >= state.candy);
}

/** Kho kẹo hiện có, vẽ ở cả trang chủ lẫn màn chơi. */
function refreshBank() {
  const candy = state.progress.candy || 0;
  ui.bank.textContent = candy;
  ui.homeBank.textContent = candy;
}

const freeLeft = (kind) => state.progress.free?.[kind] || 0;
const canAfford = (price) => (state.progress.candy || 0) >= price;
const canUse = (kind) => freeLeft(kind) > 0 || canAfford(CANDY_COST[kind]);

/**
 * Badge trên nút trợ giúp có hai vai: còn lượt miễn phí thì nó đếm lượt (viên
 * đỏ), hết rồi mới thành **giá kẹo** (viên vàng, có hình viên kẹo).
 */
function refreshBooster(button, badge, kind) {
  const free = freeLeft(kind);
  // Còn lượt free thì chỉ là con số; hết rồi thì kèm viên kẹo cho khỏi đọc nhầm
  // "2" thành "còn 2 lượt".
  badge.innerHTML = free ? String(free) : `<i class="candy"></i>${CANDY_COST[kind]}`;
  badge.classList.toggle("price", free === 0);
  button.disabled = Boolean(state.offer);
  // Không đủ tiền thì làm mờ nhưng vẫn bấm được, để còn báo được lý do.
  button.classList.toggle("broke", !canUse(kind));
}

/**
 * Thanh toán một lượt trợ giúp: tiêu lượt miễn phí trước, hết rồi mới trừ kẹo
 * trong kho. Gọi hàm này **sau** khi đã chắc chắn có gợi ý để đưa.
 */
function spend(kind) {
  const free = useFree(state.progress, kind);
  if (free) {
    state.progress = free;
    return true;
  }
  const price = CANDY_COST[kind];
  const next = spendCandy(state.progress, price);
  if (!next) {
    ui.hintText.textContent = T.notEnoughCandy(price);
    ui.chips.classList.remove("nudge");
    void ui.chips.offsetWidth;
    ui.chips.classList.add("nudge");
    return false;
  }
  state.progress = next;
  refreshBank();
  return true;
}

function onBoardChange() {
  if (state.tutorial) return onTutorialChange();
  // Số con vật tăng lên nghĩa là vừa đặt đúng thêm một con — cộng điểm theo chuỗi.
  const placed = state.board.cats().length;
  if (placed > state.scored) {
    state.score += SCORE_BASE + SCORE_STEP * state.chain;
    state.chain++;
    // Gỡ được ngách khó thì ăn mừng riêng, không chồng thêm lời khen chuỗi:
    // hai dòng chữ cùng bay lên từ một ô thì đè lên nhau, đọc không ra chữ nào.
    if (brokeThrough(rankOfLastMove())) eureka();
    else if (state.chain >= 2) praise(state.chain - 1);
  }
  state.scored = placed;
  // Bàn cờ lúc này là "bàn ngay trước" của nước sau. Con kiến và loạt ✕ tự đánh
  // kèm theo nó vào cùng một lần commit, nên bản chụp này không lẫn thông tin
  // do chính nước sắp tới sinh ra.
  state.prevCells = state.board.cells.map((row) => row.slice());
  refreshHud();
  if (state.board.isSolved()) finishLevel();
}

/** Nước vừa đặt phải suy tới bậc mấy mới ra, chấm trên bàn ngay trước nó. */
function rankOfLastMove() {
  const [r, c] = state.lastPlaced || [];
  if (r === undefined || !state.prevCells) return 1;
  return placementRank(stateFromBoard(state.puzzle, state.prevCells), r, c);
}

/**
 * Chữ khen bay lên từ ô vừa đặt: chuỗi 2 con là "Nice!", dài hơn thì lời khen
 * mạnh dần tới "Perfect!", kèm hợp âm càng dài càng cao. Bậc = số con đúng
 * liên tiếp trước con này. Lời khen để tiếng Anh ở mọi ngôn ngữ, như một
 * tiếng reo chứ không phải câu văn.
 */
function praise(tier) {
  const words = T.combo;
  const index = Math.min(tier - 1, words.length - 1);
  if (shout(words[index], `tier-${index}`)) sound.combo(index);
}

/** Thả một dòng chữ bay lên từ ô vừa đặt. Trả về chính ô đó, hoặc null. */
function shout(text, variant) {
  const [r, c] = state.lastPlaced || [0, 0];
  const cell = view.cells[r]?.[c];
  if (!cell) return null;
  const node = document.createElement("div");
  node.className = `combo ${variant}`;
  node.textContent = text;
  const board = view.el.getBoundingClientRect();
  const box = cell.getBoundingClientRect();
  // Kẹp vào trong bàn để chữ ở cột biên không văng ra ngoài màn hình.
  const margin = Math.min(70, board.width * 0.18);
  node.style.left = `${Math.max(margin, Math.min(board.width - margin, box.left - board.left + box.width / 2))}px`;
  node.style.top = `${box.top - board.top}px`;
  view.el.appendChild(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return cell;
}

// ------------------------------------------- gỡ được một ngách khó

/* Chuỗi đặt đúng thưởng cho tốc độ. Nhưng cái đáng thưởng hơn trong trò này là
   lúc người chơi bí, ngồi soi mãi một góc bàn rồi bật ra được một nước — nên
   nước đó được ăn mừng to hơn hẳn: chữ riêng, cỡ lớn hơn, pháo giấy bung ra từ
   chính ô vừa đặt, hợp âm dài hơn, và con kiến giữ mặt vui lâu hơn.

   Hai cửa phải qua, mỗi cửa trả lời một câu khác nhau.

   1. NƯỚC ĐÓ CÓ KHÓ THẬT KHÔNG — `placementRank` trong bộ giải trả lời, bằng
      đúng thang 5 bậc dùng để chấm cả bàn. Và "khó" phải tính theo *bàn này*:
      đo trên toàn bộ kho, trần độ khó của một bàn luôn đúng bằng bậc kho của
      nó, còn bàn bậc 1 thì 100% số nước là bậc 1 — chẳng có ngách nào để khoe.
      Nên mốc là bậc của chính bàn: trên bàn bậc 2 thì một nước bậc 2 đã là
      đỉnh của nó, còn trên bàn bậc 4 thì nước bậc 2 chỉ là việc thường ngày.

   2. NGƯỜI CHƠI CÓ THẬT SỰ PHẢI SĂN KHÔNG — đồng hồ trả lời. Nước khó mà liếc
      cái ra ngay thì không phải là gỡ được ngách; cùng lắm là mắt tinh. Mốc
      lấy trung vị sáu nước gần nhất — trung vị để một lần bí ba phút không kéo
      lệch cả cái thước, sáu nước gần nhất để thước bám theo màn khó dần.

   Hai cửa này ĐÁNH ĐỔI cho nhau chứ không phải hai chốt cứng. Một nước chỉ hơi
   khó — thấp hơn trần của bàn một bậc — nhưng người chơi phải soi hẳn nửa phút
   mới ra thì với họ nó cũng là một ngách, và đáng được khen y như vậy. Nên
   thiếu bao nhiêu bậc thì cửa đồng hồ đòi cao lên bấy nhiêu.

   Sàn tuyệt đối là bậc 2: bậc 1 nghĩa là "ô cuối cùng còn khả dĩ của một hàng /
   cột / vùng" — nhìn phát thấy. Ngồi lâu trên một ô như thế không phải là suy
   luận, chỉ là đang mải chỗ khác. */
const HARD_CEIL_MS = 240_000;  // quá ngần này là đứng dậy đi làm việc khác, không phải nghĩ
const HARD_WINDOW = 6;         // chỉ so với 6 nước gần nhất, để thước bám theo màn khó dần
const HARD_COOLDOWN = 1;       // hai nước liền nhau cùng bí thì chỉ khen nước đầu

/** Thiếu mấy bậc so với trần của bàn → phải bù lại bằng bấy nhiêu công sức. */
const HARD_TRADE = [
  { ratio: 1.5, floor: 8_000 },  // đúng tầm trần của bàn: chỉ cần không phải ăn may
  { ratio: 2.2, floor: 15_000 }, // thấp hơn trần một bậc: phải thật sự dừng lại nghĩ
  { ratio: 3.0, floor: 25_000 }, // thấp hơn hai bậc trở lên: phải soi rất lâu mới tính
];
const SPARK_PIECES = 18;
const EUREKA_HAPPY_MS = 2200; // kiến giữ mặt vui lâu hơn hẳn 900ms thường lệ

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Bấm giờ lại từ bây giờ cho nước tiếp theo. */
function resetThink() {
  state.thinkStart = performance.now();
  state.thinkHints = state.hintsUsed;
}

// Chuyển tab đi rồi quay lại thì quãng vừa rồi không phải thời gian nghĩ. Thà
// bỏ sót một lần đáng khen còn hơn khen nhầm lúc người ta đi pha cà phê.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resetThink();
});

/** Nước vừa rồi có phải là gỡ được một ngách khó không? */
function brokeThrough(rank) {
  const gap = performance.now() - state.thinkStart;
  const helped = state.hintsUsed > state.thinkHints;
  const recent = state.gaps.slice(-HARD_WINDOW);
  const since = state.sinceHard;
  resetThink();
  state.sinceHard++;
  // Quãng bỏ đi làm việc khác không được tính vào nhịp thường, không thì thước
  // đo trôi theo và lần bí thật sau đó lại thành "bình thường".
  if (gap <= HARD_CEIL_MS) state.gaps.push(gap);

  if (helped) return false;         // gợi ý chỉ tận nơi thì không phải họ tự tìm ra
  if (!recent.length) return false; // nước đầu màn phần lớn là thời gian đọc bàn
  if (since < HARD_COOLDOWN) return false;

  // Cửa 1 dựng mốc, cửa 2 gánh phần còn thiếu. `placementRank` dừng ở bậc 3 cho
  // kịp nhịp chơi, nên bàn bậc 4-5 cũng chỉ đòi tới mức đó.
  if (rank < 2) return false;
  const bar = Math.min(state.rating, EASY_RANKS + 1);
  const short = Math.min(Math.max(bar - rank, 0), HARD_TRADE.length - 1);
  const { ratio, floor } = HARD_TRADE[short];

  // Cửa 2: phải thật sự có ngồi săn. Chưa đủ ba mẫu thì lấy quãng dài nhất làm
  // mốc chứ không lấy trung vị — với một hai mẫu, trung vị dễ khiến người chơi
  // vốn thong thả bị khen oan ngay nước thứ hai.
  if (gap < floor || gap > HARD_CEIL_MS) return false;
  const usual = recent.length >= 3 ? median(recent) : Math.max(...recent);
  const hard = gap >= usual * ratio;
  if (hard) state.sinceHard = 0;
  return hard;
}

/** Ăn mừng lớn: chữ to, pháo giấy bung từ ô vừa đặt, hợp âm dài, kiến vui lâu. */
function eureka() {
  const words = T.eureka;
  const cell = shout(words[Math.floor(Math.random() * words.length)], "eureka");
  if (!cell) return;
  sparkle(cell);
  sound.eureka();
  const [r, c] = state.lastPlaced;
  view.holdHappy(r, c, EUREKA_HAPPY_MS);
}

/** Chùm pháo giấy bung ra từ ô vừa đặt, chạy một lần rồi tự dọn. */
function sparkle(cell) {
  const board = view.el.getBoundingClientRect();
  const box = cell.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "sparks";
  layer.style.left = `${box.left - board.left + box.width / 2}px`;
  layer.style.top = `${box.top - board.top + box.height / 2}px`;
  let longest = 0;
  for (let i = 0; i < SPARK_PIECES; i++) {
    // Rải đều quanh vòng tròn rồi xô lệch mỗi mảnh một chút — ngẫu nhiên thuần
    // thì có lúc dồn cả chùm về một phía, nhìn như lỗi vẽ chứ không như pháo.
    const angle = ((i + Math.random() * 0.7) / SPARK_PIECES) * Math.PI * 2;
    const reach = box.width * (1.3 + Math.random() * 1.9);
    const life = 0.7 + Math.random() * 0.5;
    longest = Math.max(longest, life);
    const piece = document.createElement("i");
    piece.style.cssText = [
      `--dx:${Math.cos(angle) * reach}px`,
      `--dy:${Math.sin(angle) * reach}px`,
      `--spin:${Math.random() * 720 - 360}deg`,
      `--dur:${life}s`,
      `--tone:var(--g${Math.floor(Math.random() * 12)})`,
      `--w:${5 + Math.random() * 5}px`,
    ].join(";");
    layer.append(piece);
  }
  view.el.append(layer);
  setTimeout(() => layer.remove(), longest * 1000 + 100);
}

/** Đặt sai chỗ: ✕ đỏ vĩnh viễn trên ô đó, kiến ăn mất một viên kẹo, chuỗi điểm về 0. */
function onWrongPlacement(r, c) {
  sound.buzz();
  state.chain = 0;
  state.candy--;
  view.markWrong(r, c);
  refreshHud();
  // Viên vừa bị ăn giật nảy một cái rồi mới xám đi — gắn lớp SAU refreshHud,
  // vì chính nhịp đó mới đặt lớp `gone` lên nó.
  const eaten = ui.candies.children[state.candy];
  if (eaten) {
    eaten.classList.add("eaten");
    eaten.addEventListener("animationend", () => eaten.classList.remove("eaten"), { once: true });
  }
  if (state.candy <= 0) gameOver();
}

// ------------------------------------------------------------ hướng dẫn

function renderCoach() {
  const tutorial = state.tutorial;
  view.clearHighlights();
  view.setFocus(null);
  view.hideHand();

  if (tutorial.done) {
    ui.coachTop.hidden = true;
    ui.coachBottom.hidden = true;
    ui.apply.hidden = true;
    view.locked = true;
    // Quà nhập môn, nhưng chỉ LẦN ĐẦU: không thì người mới vào đêm 1 với kho
    // rỗng, mà mở lại từ Cài đặt thì lại thành máy in kẹo.
    const firstTime = !state.progress.tutorialDone;
    state.progress = markCleared({ ...state.progress, tutorialDone: true }, 0, 0);
    if (firstTime) state.progress = bankSpoils(state.progress, { candy: WELCOME_CANDY });
    refreshBank();
    cheer();
    ui.winTitle.textContent = T.tut.mastered;
    ui.winBadge.hidden = true;
    ui.winReward.hidden = !firstTime;
    ui.winCandy.textContent = `+${WELCOME_CANDY}`;
    ui.winNote.textContent = "";
    ui.next.textContent = T.tut.startGame;
    ui.replay.hidden = true;
    ui.win.hidden = false;
    return;
  }

  const step = tutorial.step;
  const pending = tutorial.pending();

  ui.coachTop.hidden = false;
  ui.coachTitle.hidden = !step.title;
  ui.coachTitle.textContent = step.title || "";
  ui.coachText.innerHTML = step.top;
  ui.coachNext.hidden = !step.button;
  if (step.button) ui.coachNext.textContent = step.button;

  ui.coachBottom.hidden = !step.bottom;
  ui.coachBottom.classList.toggle("tappable", Boolean(step.free));
  ui.coachHint.innerHTML = step.bottom || "";

  // Đổi bước thì cho hai thẻ hiện lại từ đầu; trong cùng một bước (đánh dở vài
  // ô) thì để yên, nếu không mỗi cú bấm lại thấy thẻ nháy một cái.
  if (state.shownStep !== step.id) {
    state.shownStep = step.id;
    replay(ui.coachTop, "enter");
    if (step.bottom) replay(ui.coachBottom, "enter");
    if (step.focus) replay(view.handEl, "enter");
  }

  view.render(); // con vật đặt sẵn được ghi thẳng vào bàn cờ, cần vẽ lại
  if (step.highlight) view.highlight(step.highlight, "hint");
  // Ô còn phải bấm được khoanh vòng; bấm xong thì vòng biến mất theo.
  if (step.focus) view.setFocus(step.focus, pending.length ? step.ring : null);

  // Bàn tay minh hoạ: nhấn nhịp ở ô cần bấm đúp, hoặc trượt qua dãy ô cần vuốt.
  if (!pending.length) view.hideHand();
  else if (step.ring) view.showHand([step.ring], "tap");
  else if (step.gesture === "swipe") view.showHand(pending, "swipe");
  else view.hideHand();

  refreshHud();
}

function onTutorialChange() {
  refreshHud();
  if (!state.tutorial.checkProgress()) return renderCoach();

  // Xong một bước: bỏ lớp tối cho người chơi nhìn thấy toàn bàn cờ một nhịp,
  // rồi mới sang bước kế.
  state.flashing = true;
  view.clearHighlights();
  view.setFocus(null);
  view.hideHand();
  $("board").classList.add("flash");
  setTimeout(() => {
    $("board").classList.remove("flash");
    state.flashing = false;
    state.tutorial.advance();
    renderCoach();
  }, FLASH_MS);
}

ui.coachNext.addEventListener("click", () => {
  // Nút này dùng chung với Apply của gợi ý: chỉ là "Got it!" khi bước hiện tại
  // thật sự có nút, và không có gợi ý nào đang chờ.
  if (!state.tutorial?.step.button || state.offer) return;
  state.tutorial.advance();
  renderCoach();
});

// ------------------------------------------------------------ nút trợ giúp

/**
 * Thẻ gợi ý kiểu Meowdoku: phủ tối màn hình, sáng đúng những ô liên quan và vẽ
 * sẵn ✕ mờ lên chúng để thấy trước kết quả, rồi chờ bấm Apply.
 */
function offerMove(move, text) {
  state.offer = move;
  screens.play.classList.add("offering");
  ui.coachTitle.hidden = true;
  ui.coachText.innerHTML = text;
  ui.coachTop.classList.add("tip");
  ui.coachTop.hidden = false;
  // Thẻ nhắc dưới bàn cờ nhường chỗ cho nút Apply; renderCoach sẽ trả nó lại.
  ui.coachBottom.hidden = true;
  ui.apply.textContent = T.apply;
  ui.apply.hidden = false;
  view.clearHighlights();
  // Sáng cả ô bị ảnh hưởng lẫn ô gây ra suy luận; ô gây ra có viền riêng để
  // người chơi thấy "vì mấy ô này" chứ không chỉ thấy kết quả.
  view.setFocus([...move.cells, ...(move.cause || [])]);
  if (move.cause) view.highlight(move.cause, "cause");
  if (move.action === "eliminate") view.highlight(move.cells, "preview");
  refreshHud();
}

// Apply nằm đè lên hai nút trợ giúp, nên cú thứ hai của một lần bấm đúp rơi
// trúng nút 💡 và mở ngay gợi ý mới. Chặn bằng hai lớp:
//   1. Đang chìa gợi ý  → cả màn chơi tắt tương tác, chỉ Apply bấm được (CSS).
//   2. Vừa bấm Apply xong → khoá thêm một nhịp ngắn, đủ nuốt cú bấm thứ hai.
const BOOSTER_COOLDOWN_MS = 450;
let boosterLockedUntil = 0;
const boostersLocked = () => performance.now() < boosterLockedUntil;

function closeOffer() {
  state.offer = null;
  screens.play.classList.remove("offering");
  state.scored = state.board ? state.board.cats().length : 0;
  ui.coachTop.hidden = true;
  ui.coachTop.classList.remove("tip");
  ui.apply.hidden = true;
  view.setFocus(null);
  view.clearHighlights();
}

/**
 * Gợi ý mà bản gốc đưa ra trước tiên: chọn một con vật đã đặt rồi loại nốt các
 * ô còn trống trong hàng, cột, vùng và các ô kề nó. Hết chỗ loại mới nhờ bộ giải.
 */
function eliminationAroundAnt() {
  const board = state.board;
  const puzzle = state.puzzle;
  for (const [r, c] of board.cats()) {
    const region = puzzle.regionAt(r, c);
    const cells = [];
    for (let i = 0; i < board.size; i++)
      for (let j = 0; j < board.size; j++) {
        if (board.get(i, j) !== EMPTY) continue;
        const blocked = i === r || j === c || puzzle.regionAt(i, j) === region ||
          (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1);
        if (blocked) cells.push([i, j]);
      }
    if (cells.length) return { action: "eliminate", cells, text: T.hintAroundAnt };
  }
  return null;
}

/** Tìm và chìa ra một gợi ý; trả về false nếu không còn gì để gợi. */
function offerHint() {
  const move = eliminationAroundAnt() ||
    nextDeduction(stateFromBoard(state.puzzle, state.board.cells));
  if (!move) {
    ui.hintText.textContent = state.board.isSolved() ? T.solved : T.noHint;
    return false;
  }
  state.hintsUsed++;
  if (!state.tutorial) state.progress = markDirty(state.progress);
  offerMove(
    move,
    move.text || `${move.action === "place" ? T.hintPlace : T.hintExclude} — ${explain(move.reason, state.puzzle)}`,
  );
  return true;
}

ui.hint.addEventListener("click", () => {
  if (state.offer || boostersLocked()) return;
  if (!canUse("hint")) return void spend("hint");
  // Chỉ tính lượt khi thật sự suy ra được nước đi để chỉ.
  if (offerHint()) spend("hint");
  refreshHud();
});

// Thẻ "Tap here for a hint" ở bước tự chơi của tutorial: bấm vào là ra gợi ý,
// không tốn lượt — bản gốc dạy nút gợi ý bằng chính thẻ này.
ui.coachBottom.addEventListener("click", () => {
  // Thẻ này hiện lại ở đúng chỗ nút Apply vừa biến mất, nên cũng phải chịu khoá
  // nguội sau Apply — không thì bấm đúp Apply là mở gợi ý mới ngay.
  if (!state.tutorial?.step.free || state.offer || boostersLocked()) return;
  offerHint();
});

// Nút con kiến: đặt hộ một con đúng chỗ.
ui.reveal.addEventListener("click", () => {
  if (state.offer || boostersLocked()) return;
  if (!canUse("reveal")) return void spend("reveal");
  const row = state.puzzle.solution.findIndex((col, r) => state.board.get(r, col) !== CAT);
  if (row === -1) {
    ui.hintText.textContent = T.solved;
    return;
  }
  if (!spend("reveal")) return;
  state.hintsUsed++;
  state.progress = markDirty(state.progress);
  offerMove({ action: "place", cells: [[row, state.puzzle.solution[row]]] }, T.hintReveal);
});

ui.apply.addEventListener("click", () => {
  const move = state.offer;
  if (!move) return;
  closeOffer();
  boosterLockedUntil = performance.now() + BOOSTER_COOLDOWN_MS;
  if (move.action === "place") {
    const [r, c] = move.cells[0];
    // Ô đang mang ✕ thì gỡ ra trước, nếu không con vật sẽ không đặt được.
    if (state.board.get(r, c) !== EMPTY) state.board.apply([[r, c, EMPTY]]);
    view.placeCat(r, c);
  } else {
    view.commit(move.cells.map(([r, c]) => [r, c, MARK]));
  }
});

// ---------------------------------------------------------------- kết màn

function finishLevel() {
  view.locked = true;
  const earned = Math.max(0, state.candy); // kẹo chưa bị kiến ăn — cái mang về được
  const ants = state.board.size;
  const stars = starsFor(state.hintsUsed);
  state.progress = touchStreak(
    onLevelWon(markCleared(state.progress, state.level, stars), state.level),
  );
  refreshHud(); // chuỗi thắng vừa +1, đừng để HUD sau lưng hộp thoại còn số cũ

  // Kẹo bay vào kho TRƯỚC khi hộp thoại mở ra. Mở hộp thoại trước là nó che
  // mất cả chip lẫn kho — hai đầu của đường bay đều nằm dưới lớp phủ.
  flyCandy(earned).then(() => {
    state.progress = bankSpoils(state.progress, { ants, candy: earned });
    // Chỉ cập nhật con số trong kho, KHÔNG gọi refreshHud: nó vẽ lại chip theo
    // state.candy nên ba viên vừa bay đi lại hiện về chỗ cũ. Mà state.candy thì
    // phải giữ nguyên — nút "Đêm tiếp theo" đọc nó để biết vừa thắng hay thua.
    refreshBank();
    showWin(earned);
  });
}

// Một viên bay mất ngần này, viên sau cất cánh sau viên trước ngần này.
const CANDY_FLY_MS = 640;
const CANDY_FLY_GAP = 150;

/**
 * Kẹo còn dư bay từ chip lên kho trên HUD, con số trong kho nhích lên đúng lúc
 * từng viên chạm đích. Trả về lời hứa hoàn tất, để bên gọi biết lúc nào mở
 * hộp thoại thắng.
 *
 * Toạ độ đo tại chỗ chứ không tính sẵn: cỡ bàn cờ đổi theo màn hình nên chip
 * và kho không đứng cố định ở đâu cả.
 */
function flyCandy(count) {
  const target = ui.bank.parentElement;
  if (!count || !target || ui.chips.hidden) return Promise.resolve();

  const nest = target.getBoundingClientRect();
  const layer = ui.candyFly;
  layer.innerHTML = "";
  const base = state.progress.candy || 0;
  let flying = 0;

  for (let i = 0; i < count; i++) {
    const box = ui.candies.children[i]?.getBoundingClientRect();
    if (!box) continue;
    const piece = document.createElement("i");
    piece.style.cssText = [
      `--size:${box.width}px`,
      `--x0:${box.left}px`,
      `--y0:${box.top}px`,
      `--x1:${nest.left + nest.width / 2 - box.width / 2}px`,
      `--y1:${nest.top + nest.height / 2 - box.height / 2}px`,
      `--dur:${CANDY_FLY_MS}ms`,
      `--delay:${i * CANDY_FLY_GAP}ms`,
    ].join(";");
    // Viên nào bay đi thì chỗ cũ trên chip trống ngay, không để hai viên cùng hiện.
    ui.candies.children[i].classList.add("gone");
    layer.append(piece);
    flying++;
    const landed = i;
    setTimeout(() => {
      ui.bank.textContent = base + landed + 1;
      replay(target, "bump");
      sound.candy(landed);
    }, i * CANDY_FLY_GAP + CANDY_FLY_MS);
  }

  if (!flying) return Promise.resolve();
  return new Promise((done) =>
    setTimeout(() => {
      layer.innerHTML = "";
      done();
    }, (flying - 1) * CANDY_FLY_GAP + CANDY_FLY_MS + 220),
  );
}

/**
 * Hộp thoại thắng. Câu khen đổi theo việc người chơi vừa làm được, chứ không
 * phải một câu "Well Played" lặp lại mãi:
 *
 *   master  — mốc đáng nhớ (màn 5, màn 10, và mọi màn khó): cả đàn kiến cúi
 *             chào, có huy hiệu, có kèn, và đếm luôn tổng kiến + kẹo đã gom
 *   flawless— giữ trọn ba viên kẹo, không xin gợi ý lần nào
 *   streak  — đang thắng liền từ ba ván trở lên
 *   còn lại — một câu trong sáu câu, bốc ngẫu nhiên
 */
function isMasterWin() {
  return endsChapter(state.level) || Boolean(state.spec?.hard);
}

function showWin(earned) {
  const master = isMasterWin();
  const flawless = earned === CANDY_PER_LEVEL && state.hintsUsed === 0;
  const streak = state.progress.winStreak || 0;

  state.chapterOver = endsChapter(state.level);
  if (master) {
    // Đêm cuối chương: nói rõ buồng nào vừa được giữ, rồi nút Tiếp đưa về tổ.
    ui.winTitle.textContent = state.chapterOver
      ? T.chapterDone(T.rooms[roomNameIndex(chapterOf(state.level))])
      : T.masterTitle;
    ui.winNote.textContent = T.masterNote(state.progress.ants || 0, state.progress.candy || 0);
  } else {
    ui.winTitle.textContent = flawless
      ? T.winFlawless
      : streak >= 3
        ? T.winStreakTitle(streak)
        : T.winTitles[Math.floor(Math.random() * T.winTitles.length)];
    ui.winNote.textContent = flawless
      ? T.winFlawlessNote
      : earned
        ? T.candySaved(earned)
        : T.candyNone;
  }

  ui.winBadge.hidden = !master;
  if (master) ui.winBadge.textContent = T.masterBadge;
  ui.next.textContent = state.chapterOver ? T.backToNest : T.nextLevel;
  ui.replay.hidden = false;
  ui.win.hidden = false;
  celebrate(earned, master);
}

// ------------------------------------------------------------- ăn mừng

const CONFETTI_PIECES = 26;

/**
 * Kiến reo mừng bung vào, rồi tới dòng tiền thưởng, pháo giấy rơi suốt phía sau.
 * Nhịp lấy theo màn thắng của Marble Sort.
 */
function celebrate(candy = 0, master = false) {
  if (master) {
    parade();
    sound.fanfare();
  } else {
    cheer();
  }
  ui.winReward.hidden = !candy;
  ui.winCandy.textContent = `+${candy}`;

  // Mốc đáng nhớ thì pháo giấy dày gấp đôi — cùng một hộp thoại, nhưng nhìn là
  // biết lần này khác mọi lần.
  const pieces = master ? CONFETTI_PIECES * 2 : CONFETTI_PIECES;
  ui.confetti.innerHTML = Array.from({ length: pieces }, () => {
    // Mỗi mảnh một màu trong bảng màu vùng, rơi lệch và xoay ngẫu nhiên.
    const style = [
      `--x:${Math.random() * 100}%`,
      `--drift:${(Math.random() - 0.5) * 120}px`,
      `--spin:${Math.random() * 720 - 360}deg`,
      `--dur:${2.6 + Math.random() * 2.2}s`,
      `--delay:${Math.random() * 0.9}s`,
      `--tone:var(--g${Math.floor(Math.random() * 12)})`,
      `--w:${6 + Math.random() * 6}px`,
    ].join(";");
    return `<i style="${style}"></i>`;
  }).join("");
}

function cheer() {
  showArt("ant-happy");
}

/**
 * Ba con kiến cúi chào — hình ảnh "cả đàn cảm ơn bạn". Dựng bằng ba lần cùng
 * một ảnh kiến vui, con giữa to hơn và hai con bên vào lệch nhịp, nên không
 * cần thêm ảnh nào mà vẫn ra đám đông.
 */
function parade() {
  ui.winArt.hidden = false;
  ui.winArt.innerHTML =
    `<div class="parade">` +
    [0.35, 0, 0.55]
      .map((delay, i) => `<i class="ant-happy${i === 1 ? " lead" : ""}" style="--delay:${delay}s"></i>`)
      .join("") +
    `</div>`;
}

/**
 * Đặt hình vào hộp thoại. Gán lại innerHTML mỗi lần để animation chạy từ đầu —
 * thắng màn thứ hai mà kiến đứng im thì mất nửa cái hay.
 */
function showArt(kind) {
  ui.winArt.hidden = false;
  ui.winArt.innerHTML = `<i class="${kind}"></i>`;
}

/** Dẹp pháo giấy khi đóng hộp thoại — không thì 26 animation cứ chạy mãi. */
function stopCelebration() {
  ui.confetti.innerHTML = "";
  ui.winReward.hidden = true;
  ui.winBadge.hidden = true;
}

function gameOver() {
  view.locked = true;
  state.progress = onLevelFailed(state.progress, state.level);
  closeOffer();
  stopCelebration();
  state.chapterOver = false;
  // Hết mạng: kiến bối rối, không phải kiến reo mừng.
  showArt("ant-sad");
  ui.winBadge.hidden = true;
  ui.winTitle.textContent = T.outOfLives;
  ui.winReward.hidden = true;
  ui.winNote.textContent = T.outOfLivesNote;
  ui.next.textContent = T.tryAgain;
  ui.replay.hidden = true;
  ui.win.hidden = false;
}

ui.next.addEventListener("click", () => {
  ui.win.hidden = true;
  stopCelebration();
  // Hướng dẫn mở lại từ Cài đặt thì về đúng đêm đang gác; người mới thì đêm 1.
  if (state.tutorial) return startLevel(currentLevel(state.progress));
  if (state.candy <= 0) return startLevel(state.level); // hết kẹo, gác lại đêm cũ
  // Xong một chương thì về tổ xem buồng vừa giữ được sáng đèn; nút Play ở đó
  // đã trỏ sẵn sang đêm kế.
  if (state.chapterOver) return show("home");
  startLevel(state.level + 1);
});

ui.replay.addEventListener("click", () => {
  ui.win.hidden = true;
  stopCelebration();
  startLevel(state.level);
});

// ------------------------------------------- chốt chặn phóng to khi bấm đúp
//
// `touch-action: manipulation` trong CSS lo được phần lớn, nhưng Safari trên
// iOS vẫn lọt ở những cú chạm không ai gọi preventDefault. Chốt cuối, đặt ở
// mức cả trang: hai cú chạm liên tiếp vừa nhanh vừa gần nhau thì huỷ hành vi
// mặc định của cú thứ hai.
//
// Ngoài bàn cờ thì phải xét **khoảng cách**, không chỉ thời gian: chạm nhanh
// vào hai nút khác nhau là thao tác hợp lệ, huỷ mất thì nút thứ hai coi như
// hỏng. Hai nút gần nhau nhất trên màn hình cách nhau ~150px nên 90px vẫn an
// toàn; ngưỡng cũ 48px hụt hẳn so với một cú bấm đúp lệch tay trên ô cỡ lớn.
//
// Trong bàn cờ thì bỏ hẳn phép đo khoảng cách: ở đó bấm đúp là thao tác đặt
// kiến, chạy bằng pointerdown chứ không cần click, nên huỷ mặc định bao nhiêu
// cũng không mất gì.
const TAP_GUARD_MS = 500;
const TAP_GUARD_PX = 90;
let lastTapAt = 0;
let lastTapX = 0;
let lastTapY = 0;

document.addEventListener(
  "touchend",
  (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const now = performance.now();
    const near = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY) < TAP_GUARD_PX;
    const onBoard = event.target instanceof Element && event.target.closest("#board");
    if ((onBoard || near) && now - lastTapAt < TAP_GUARD_MS) event.preventDefault();
    lastTapAt = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  },
  { passive: false }, // không có dòng này thì preventDefault bị bỏ qua
);

// ------------------------------------------------------------------ cài đặt

ui.soundToggle.addEventListener("change", () => {
  sound.enabled = ui.soundToggle.checked;
  if (sound.enabled) sound.pop(); // nghe thử ngay
});

function refreshSettings() {
  ui.soundToggle.checked = sound.enabled;
  ui.settingsNote.textContent = T.settingsNote(state.progress.streak || 0, state.progress.best || 0);
  // Chỉ chơi lại được khi đang ở trong một màn thật — không phải trang chủ, không phải hướng dẫn.
  ui.restart.hidden = screens.play.hidden || Boolean(state.tutorial);
  ui.language.value = getLocale();
}

for (const button of document.querySelectorAll("[data-settings]"))
  button.addEventListener("click", () => {
    refreshSettings();
    ui.settings.hidden = false;
  });

$("btn-close-settings").addEventListener("click", () => (ui.settings.hidden = true));

ui.howto.addEventListener("click", () => {
  ui.settings.hidden = true;
  startTutorial();
});

ui.restart.addEventListener("click", () => {
  ui.settings.hidden = true;
  // Chơi lại giữa chừng: màn này không còn tính là thắng sạch, và chuỗi thắng đứt.
  state.progress = onLevelRestarted(state.progress);
  startLevel(state.level);
});

// Ô chọn ngôn ngữ: 17 thứ tiếng Meowdoku phát hành, tên viết bằng chính nó.
ui.language.innerHTML = LANGUAGES
  .map((language) => `<option value="${language.code}">${language.name}</option>`)
  .join("");

ui.language.addEventListener("change", async () => {
  // Nạp hỏng thì trả ô chọn về thứ tiếng đang chạy, không để chữ nửa nạc nửa mỡ.
  if (!(await setLocale(ui.language.value))) {
    ui.language.value = getLocale();
    return;
  }
  relocalize();
});

/** Vẽ lại toàn bộ chữ sau khi đổi ngôn ngữ, giữ nguyên chỗ đang chơi. */
function relocalize() {
  applyStatic();
  refreshSettings();
  refreshHome();
  if (screens.play.hidden) return;

  // Thẻ gợi ý đang mở còn giữ câu tiếng cũ — đóng lại cho gọn, lượt gợi ý vẫn đã trừ.
  closeOffer();
  if (state.tutorial) {
    ui.title.textContent = T.tutorialTitle;
    state.tutorial.relocalize();
    renderCoach();
  } else {
    ui.kicker.textContent = T.level;
    refreshHud();
  }
}

// Xoá dữ liệu là việc không lùi được, nên hỏi lại bằng một hộp thoại riêng có
// nói rõ mất những gì — thay cho confirm() của trình duyệt.
$("btn-wipe").addEventListener("click", () => {
  const p = state.progress;
  ui.wipeLosing.textContent = T.wipeLosing(p.cleared || 0, p.candy || 0, p.streak || 0);
  ui.confirm.hidden = false;
});

$("btn-wipe-no").addEventListener("click", () => (ui.confirm.hidden = true));

$("btn-wipe-yes").addEventListener("click", () => {
  state.progress = clearProgress();
  ui.confirm.hidden = true;
  ui.settings.hidden = true;
  show("home");
});

// ------------------------------------------------------------------ khởi động

$("btn-play").addEventListener("click", () => {
  if (!state.progress.tutorialDone && state.progress.cleared === 0) return startTutorial();
  startLevel(currentLevel(state.progress));
});
$("btn-tutorial").addEventListener("click", startTutorial);

/**
 * Đường tắt để thử một màn bất kỳ: mở `index.html?level=12`.
 *
 * Không nhảy cóc suông mà **dựng lại đúng trạng thái** của người đã thắng sạch
 * liên tiếp tới trước màn đó — chạy thật `onLevelWon` từng màn một, nên chiến
 * lược, con trỏ kho bàn và ví tiền đều khớp y như chơi tay. Có thế mới thử
 * đúng cái bàn mà người chơi thật sẽ gặp.
 *
 * Chỉ mở khi trang chạy từ máy mình; bản phát hành không có đường tắt này.
 * Trả về true nếu đã tự mở một màn — lúc đó khỏi chạy nhịp vào game thường.
 */
function devJump() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return false;
  const params = new URLSearchParams(location.search);
  // `?reset=1`: xoá sạch tiến trình rồi về trang chủ như người mới — nhanh hơn
  // mở Cài đặt → Xoá tiến trình mỗi lần muốn chơi lại từ đầu.
  if (params.has("reset")) {
    state.progress = clearProgress();
    show("home");
  }
  const wanted = Number(params.get("level"));
  if (!Number.isInteger(wanted) || wanted < 1) return false;

  let progress = { ...clearProgress(), tutorialDone: true };
  for (let n = 1; n < wanted; n++) progress = onLevelWon(markCleared(progress, n, 3), n);
  state.progress = bankSpoils(progress, { candy: CANDY_PER_LEVEL * wanted });
  startLevel(wanted);
  return true;
}

applyStatic();
show("home");
// Người mới vào thẳng bài hướng dẫn, không dừng ở trang chủ: lúc đó tổ chưa có
// buồng nào sáng đèn nên trang chủ chẳng có gì để xem. Họ gặp nó lần đầu sau
// đêm thứ 5, khi nút "Về tổ" đưa sang — và buồng đầu tiên đã an toàn.
if (!devJump() && !state.progress.tutorialDone && !state.progress.cleared) startTutorial();
