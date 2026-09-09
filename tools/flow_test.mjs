// Chạy thử tutorial và tuyến chơi mà không cần trình duyệt.
//
// Khoá lại: sáu bàn mở đầu (hướng dẫn + màn 1-5) có lời giải duy nhất và đúng
// vai trò; từng bước hướng dẫn bắt bấm đúng ô; bộ máy chọn màn chạy đúng luật
// đã chép từ Meowdoku (cỡ lưới, chiến lược lên xuống, phép xoay/lật, con tặng
// sẵn, lọc vùng 1 ô); kho bàn và màn đặc biệt đúng cỡ, đúng bậc, giải được.

import { readFileSync, existsSync } from "node:fs";
import { Board, Puzzle, CAT, MARK, unpackRegions } from "../src/puzzle.js";
import { Tutorial, buildSteps, tutorialPuzzle, planTutorial } from "../src/tutorial.js";
import { nextDeduction, stateFromBoard, State } from "../src/solver.js";
import {
  sizeFor, isHardLevel, planLevel, onLevelWon, onLevelFailed, markDirty,
  transformRecord, prefillFor, singleRegions, singleLimit, SPECIAL_LEVELS, AS_HARD_FROM,
} from "../src/progression.js";
import { SCRIPTED, TUTORIAL } from "../src/levels.js";

// progression.js ghi localStorage; trong Node thì giả một cái.
globalThis.localStorage ??= { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } };

let failures = 0;
const check = (ok, msg) => { if (!ok) { console.error("FAIL " + msg); failures++; } };

const asSet = (cells) => new Set(cells.map(([r, c]) => `${r},${c}`));
const sameCells = (a, b) => a.length === b.length && a.every(([r, c]) => asSet(b).has(`${r},${c}`));

/** Mọi lời giải hợp lệ, tìm bằng vét cạn — dùng để chắc màn chỉ có một đáp án. */
function allSolutions(puzzle) {
  const n = puzzle.size, out = [], cols = [], regions = new Set();
  const walk = (r) => {
    if (r === n) return out.push([...cols]);
    for (let c = 0; c < n; c++) {
      const region = puzzle.regions[r][c];
      if (cols.includes(c) || regions.has(region)) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols.push(c); regions.add(region); walk(r + 1); cols.pop(); regions.delete(region);
    }
  };
  walk(0);
  return out;
}

/** Cấp kỹ thuật cao nhất phải dùng, tính từ thế cờ đã có sẵn `given`. */
function hardestRank(puzzle, given) {
  const state = new State(puzzle.size, puzzle.regions);
  for (const [r, c] of given) state.place(r, c);
  let max = 0;
  for (let guard = 0; !state.isComplete() && guard < 400; guard++) {
    const move = nextDeduction(state);
    if (!move) return Infinity;
    max = Math.max(max, move.rank);
    if (move.action === "place") state.place(move.cells[0][0], move.cells[0][1]);
    else for (const [r, c] of move.cells) state.cand[r][c] = false;
  }
  return state.isComplete() ? max : Infinity;
}

/** Lời giải có hợp luật với bàn này không (mỗi vùng/hàng/cột một con, không chạm). */
function validSolution(record, size) {
  const regions = unpackRegions(record.m, size);
  const seen = new Set();
  for (let r = 0; r < size; r++) {
    const c = record.s[r];
    if (c < 0 || c >= size) return false;
    if (r > 0 && Math.abs(record.s[r - 1] - c) <= 1) return false;
    if (seen.has(`c${c}`) || seen.has(`g${regions[r][c]}`)) return false;
    seen.add(`c${c}`); seen.add(`g${regions[r][c]}`);
  }
  return true;
}

// --- sáu bàn mở đầu: giải được, chỉ có đúng một đáp án, đúng vai trò -----------
check(SCRIPTED.length === 2, `cần đúng 2 màn mở đầu chọn tay, có ${SCRIPTED.length}`);
check(SCRIPTED.map((s) => s.size).join() === "4,4", "hai màn đầu phải là 4×4");
for (const [name, def] of [["tutorial", TUTORIAL], ...SCRIPTED.map((s, i) => [`màn ${i + 1}`, s])]) {
  const puzzle = new Puzzle(def.record, def.size);
  const solutions = allSolutions(puzzle);
  check(solutions.length === 1, `${name}: có ${solutions.length} lời giải, cần đúng 1`);
  check(
    JSON.stringify(solutions[0]) === JSON.stringify(def.record.s),
    `${name}: lời giải ghi trong levels.js lệch với lời giải thật`,
  );
  const rank = hardestRank(puzzle, def.given || []);
  check(rank === 1, `${name}: cần tới kỹ thuật cấp ${rank}, quá khó cho màn mở đầu`);
  if (def.given) {
    const singles = singleRegions(def.record.m);
    check(singles >= 1 && singles <= 2, `${name}: có ${singles} vùng 1 ô, cần 1-2`);
    const [gr, gc] = def.given[0];
    check(puzzle.solution[gr] === gc, `${name}: con tặng sẵn không nằm trong lời giải`);
    const area = puzzle.regions.flat().filter((v) => v === puzzle.regionAt(gr, gc)).length;
    check(area > 1, `${name}: con tặng sẵn phải nằm trong vùng nhiều ô, để người chơi tự tìm vùng 1 ô`);
    check(sameCells(def.given, prefillFor(SCRIPTED.indexOf(def) + 1, def.record, def.size)), `${name}: con tặng sẵn không theo đúng luật prefill`);
  }
}

// --- tutorial: đi hết các bước như người chơi thật ---------------------------
const puzzle = tutorialPuzzle();
const board = new Board(puzzle);
const tutorial = new Tutorial(puzzle, board);

check(
  tutorial.steps.map((s) => s.id).join(" → ") ===
    "place-first → rule-colour → exclude-lines → place-second → exclude-touching → place-third → exclude-touching-2 → find-last → done",
  "thứ tự các bước hướng dẫn bị đổi",
);

const stepById = Object.fromEntries(tutorial.steps.map((s) => [s.id, s]));

// Bàn hướng dẫn phải khác bàn của Meowdoku, kể cả sau tám phép xoay/lật.
const THEIR_TUTORIAL = { m: "1102" + "1112" + "1112" + "1332", s: [2, 0, 3, 1] };
const shapeOf = (m) => {
  const map = new Map();
  return [...m].map((ch) => { if (!map.has(ch)) map.set(ch, map.size); return map.get(ch); }).join("");
};
for (let t = 0; t < 8; t++)
  check(
    shapeOf(transformRecord(THEIR_TUTORIAL, 4, t).m) !== shapeOf(TUTORIAL.record.m),
    `bàn hướng dẫn trùng bàn của Meowdoku (phép biến đổi ${t})`,
  );

// Đúng một vùng một ô: nước mở màn không được phép nhập nhằng.
check(singleRegions(TUTORIAL.record.m) === 1, "bàn hướng dẫn phải có đúng một vùng một ô");

// Hai lượt tập vuốt, mỗi lượt ít nhất 2 ô.
const swipes = tutorial.steps.filter((s) => s.gesture === "swipe");
check(swipes.length === 2, `cần 2 lượt tập vuốt, có ${swipes.length}`);
for (const [i, step] of swipes.entries())
  check(step.focus.length >= 2, `lượt vuốt ${i + 1} chỉ có ${step.focus.length} ô, không ra cử chỉ vuốt`);

// Từng ô của mỗi bước, suy từ luật chứ không ghi cứng — khớp bàn đang dùng.
const plan = planTutorial(puzzle);
check(sameCells(stepById["place-first"].focus, [plan.first]), "bước 1 không chỉ vào vùng một ô");
check(
  plan.lines.length === 6 && sameCells(stepById["exclude-lines"].focus, plan.lines),
  "bước loại theo hàng/cột không đúng 6 ô",
);
check(String(stepById["place-second"].ring) === String(plan.second), "con thứ hai không rơi đúng ô");
check(String(stepById["place-third"].ring) === String(plan.third), "con thứ ba không rơi đúng ô");

// Con thứ hai phải suy ra được: vùng của nó nhiều hơn một ô, chính mấy dấu ✕
// vừa đánh mới ép nó về một ô.
const secondColour = TUTORIAL.record.m[plan.second[0] * 4 + plan.second[1]];
check(
  [...TUTORIAL.record.m].filter((ch) => ch === secondColour).length > 1,
  "con thứ hai nằm trong vùng một ô — bước đó thành quà tặng, không dạy được gì",
);

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
// Màn chơi không nhắc luật nữa; bài hướng dẫn phải dạy đủ ba luật (vùng,
// hàng/cột, chạm nhau) và mở lại được từ Cài đặt.
const used = new Set(buildSteps(puzzle).map((step) => step.rule).filter(Boolean));
check(used.size === 3, `hướng dẫn chỉ nhắc ${used.size}/3 luật`);
check(html.includes('id="btn-howto"'), "Cài đặt thiếu nút Cách chơi");
check(!html.includes('id="screen-map"'), "màn chọn level cũ vẫn còn trong index.html");
check(board.cats().length === 0, "tutorial mở ra đã có con sẵn — phải để người chơi tự đặt con đầu");

let handMarks = 0, handCats = 0, guard = 0;
while (!tutorial.done && guard++ < 60) {
  const step = tutorial.step;
  if (step.needs) {
    const kind = step.needs.value === CAT ? "cat" : "mark";
    const other = kind === "cat" ? "mark" : "cat";
    const [r0, c0] = step.needs.cells[0];
    check(!tutorial.allows(r0, c0, other), `bước "${step.id}" cho bấm sai kiểu thao tác`);
    for (let r = 0; r < puzzle.size; r++)
      for (let c = 0; c < puzzle.size; c++)
        if (!step.needs.cells.some(([i, j]) => i === r && j === c))
          check(!tutorial.allows(r, c, kind), `bước "${step.id}" cho bấm ô ngoài yêu cầu`);
    const todo = tutorial.pending();
    todo.forEach(([r, c], i) => {
      check(tutorial.allows(r, c, kind), `bước "${step.id}" chặn nhầm ô nó yêu cầu`);
      board.apply([[r, c, step.needs.value]]);
      if (kind === "mark") handMarks++; else handCats++;
      check(tutorial.checkProgress() === (i === todo.length - 1), `bước "${step.id}" báo xong sai nhịp ở ô thứ ${i + 1}`);
    });
    tutorial.advance();
  } else if (step.free) {
    let solveGuard = 0;
    while (!board.isSolved() && solveGuard++ < 40) {
      const move = nextDeduction(stateFromBoard(puzzle, board.cells));
      if (!move) break;
      check(move.rank === 1, "phần tự giải nốt cần kỹ thuật cao hơn cấp 1");
      if (move.action === "place") board.apply([[move.cells[0][0], move.cells[0][1], CAT]]);
      else board.apply(move.cells.map(([r, c]) => [r, c, MARK]));
    }
    check(board.isSolved(), "không giải nốt được màn tutorial");
    check(tutorial.checkProgress(), "bước tự chơi không ghi nhận khi đã thắng");
    tutorial.advance();
  } else {
    check(Boolean(step.button), `bước "${step.id}" không chờ thao tác mà cũng không có nút`);
    tutorial.advance();
  }
}
check(tutorial.done, "tutorial không đi hết được các bước");
check(handMarks === 11, `người chơi tự đánh ${handMarks} dấu ✕, cần 11 (6 nhấn + 2 vuốt + 3 vuốt)`);
check(handCats === 3, `người chơi tự đặt ${handCats} con trong phần dẫn dắt, cần 3`);
console.log(`tutorial: ${tutorial.steps.length} bước · tự đánh ${handMarks} ✕ · tự đặt ${handCats} con`);

// --- bộ máy chọn màn: đúng luật Meowdoku, và nhỏ hơn họ trước màn 50 ------------
check([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sizeFor).join() === "4,4,6,6,8,6,7,8,9,7", "cỡ lưới 10 màn đầu: hai màn 4×4 rồi y Meowdoku");
check([11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(sizeFor).join() === "8,10,10,9,10,10,9,10,10,10", "cỡ lưới chu kỳ phải y hệt Meowdoku");
check(!isHardLevel(20) && isHardLevel(30) && isHardLevel(50) && isHardLevel(110) && !isHardLevel(111), "màn khó định kỳ: chẵn chục từ 30, y Meowdoku");
check(AS_HARD_FROM === 3, "từ màn 3 y hệt Meowdoku");

// Chiến lược: màn 1-5 ép bậc 1; thắng sạch 2 lần mới lên; trần theo mốc màn.
let p = { strategy: 1, cleanWins: 0, fails: 0, retryLevels: 0, retryStrategy: 0, dirty: false, retried: false, cleared: 0 };
for (let n = 1; n <= 5; n++) { check(planLevel(p, n).rank === 1, `màn ${n} phải bậc 1`); p = onLevelWon(p, n); }
check(p.strategy === 1, "5 màn đầu không được đẩy chiến lược lên");
check(planLevel(p, 5).rank === 1 && planLevel(p, 6).rank === 2, "màn 5 bậc 1, màn 6 đã rút bậc 2 (sàn 2 từ màn 6)");
p = onLevelWon(p, 6); check(p.strategy === 1 && p.cleanWins === 1, "màn 6 thắng sạch lần 1: chưa lên bậc");
p = onLevelWon(p, 7); check(p.strategy === 2 && p.cleanWins === 0, "thắng sạch 2 lần liên tiếp: lên bậc 2");
p = onLevelWon(p, 8); p = onLevelWon(p, 9); check(p.strategy === 2, "trước màn 21 trần là bậc 2");
p = markDirty(p); p = onLevelWon(p, 10); check(p.cleanWins === 0 && !p.dirty, "màn dùng trợ giúp không tính thắng sạch, và cờ bẩn phải được xoá");
p = onLevelFailed(p, 11); check(p.fails === 1 && p.retried && p.dirty, "thua: đếm một lần thua, đánh dấu chơi lại");
p = onLevelWon(p, 11); check(p.strategy === 1 && p.fails === 0, "trước màn 21 thua 1 lần là xuống bậc");
// Từ màn 21: cần 2 lần thua; rút ngẫu nhiên trong [2, bậc] khi bậc ≥ 3.
p = { ...p, strategy: 3, fails: 0, cleanWins: 0, dirty: false, retried: false };
const drawn = new Set();
for (let i = 0; i < 60; i++) drawn.add(planLevel(p, 25).rank);
check([...drawn].every((r) => r >= 2 && r <= 3) && drawn.size === 2, `bậc 3 phải rút trong {2,3}, thấy ${[...drawn]}`);
check(planLevel({ ...p, strategy: 1 }, 51).rank === 2, "từ màn 51 sàn là bậc 2");
check(planLevel({ ...p, strategy: 4 }, 31).rank <= 3, "màn 21-50 trần là bậc 3");
check(planLevel(p, 30).rank === 5 && planLevel(p, 30).hard, "màn 30 là màn khó bậc 5 (màn đặc biệt sẽ đè lên)");
p = onLevelFailed(p, 25); p = onLevelWon(p, 25); check(p.strategy === 3, "từ màn 21 thua 1 lần chưa xuống bậc");
p = onLevelFailed(p, 26); p = onLevelWon(p, 26); check(p.strategy === 2, "từ màn 21 thua 2 lần thì xuống bậc");
p = { ...p, strategy: 3 };
p = onLevelWon(p, 51); check(p.strategy === 4, "từ màn 51 thắng sạch 1 lần là lên bậc");
p = onLevelWon(p, 52); check(p.strategy === 4, "trần tuyến thường là bậc 4");

// Phép xoay/lật giữ lời giải hợp luật và không trùng bàn gốc (trừ t = 0).
const sample = { m: "001111" + "000111" + "021113" + "111113" + "114333" + "333355", s: [0, 3, 1, 5, 2, 4] };
for (let t = 0; t < 8; t++) {
  const turned = transformRecord(sample, 6, t);
  check(validSolution(turned, 6), `phép biến đổi ${t} làm hỏng lời giải`);
  check(new Puzzle(turned, 6).size === 6 && turned.m.length === 36, `phép biến đổi ${t} sai cỡ`);
  check(t === 0 ? turned.m === sample.m : turned.m !== sample.m, `phép biến đổi ${t} ${t ? "không đổi gì" : "làm đổi bàn gốc"}`);
}
check(JSON.stringify(transformRecord(transformRecord(sample, 6, 1), 6, 3).s) === JSON.stringify(sample.s), "xoay 4 lần 90° phải về chỗ cũ");

// Con tặng sẵn màn 6-10: màn 6 vùng nhiều ô, màn 7-10 vùng 1 ô; từ màn 11 không tặng.
const six = sample; // 6×6 có 2 vùng 1 ô
check(prefillFor(7, six, 6).length === 1 && singleRegions(six.m) >= 1, "màn 7 phải tặng con ở vùng 1 ô");
const [[r7, c7]] = prefillFor(7, six, 6);
check(six.m.split("").filter((ch) => ch === six.m[r7 * 6 + c7]).length === 1, "con tặng màn 7 không nằm trong vùng 1 ô");
check(prefillFor(11, six, 6).length === 0, "từ màn 11 không tặng con");
check(singleLimit(20) === 2 && singleLimit(21) === 1, "giới hạn vùng 1 ô: 2 trước màn 21, 1 từ màn 21");

// --- kho bàn: đúng cỡ, đúng bậc, giải được bằng suy luận, lời giải hợp luật ----
const poolsFile = new URL("../data/pools.json", import.meta.url);
if (!existsSync(poolsFile)) console.warn("bỏ qua kiểm kho bàn: chưa có data/pools.json (chạy tools/build_pools.mjs)");
else {
  const pools = JSON.parse(readFileSync(poolsFile, "utf8"));
  let bad = 0, total = 0;
  for (const [key, list] of Object.entries(pools)) {
    const [size, rank] = key.split("x").map(Number);
    for (const [i, rec] of list.entries()) {
      total++;
      if (rec.m.length !== size * size || rec.r !== rank || !validSolution(rec, size)) { bad++; continue; }
      if (i % 5 === 0 && hardestRank(new Puzzle(rec, size), []) !== rank) bad++;
    }
  }
  check(bad === 0, `${bad} bàn trong kho sai cỡ/bậc/lời giải`);
  for (const need of ["4x1", "5x1", "6x1", "6x2", "7x2", "8x3", "9x3", "9x4", "10x4", "10x5"])
    check((pools[need] || []).length >= 12, `kho ${need} có ${(pools[need] || []).length} bàn, cần ≥12`);
  console.log(`kho bàn: ${Object.keys(pools).length} kho · ${total} bàn`);
}

// --- màn đặc biệt: đúng số màn, cỡ, có bảng màu, giải được -----------------------
const specialsFile = new URL("../data/specials.json", import.meta.url);
if (!existsSync(specialsFile)) console.warn("bỏ qua kiểm màn đặc biệt: chưa có data/specials.json (chạy tools/build_specials.mjs)");
else {
  const specials = JSON.parse(readFileSync(specialsFile, "utf8"));
  for (const [level, entry] of Object.entries(specials)) {
    check(SPECIAL_LEVELS[level], `màn đặc biệt ${level} không có trong SPECIAL_LEVELS`);
    check(entry.record.m.length === entry.size * entry.size && validSolution(entry.record, entry.size), `màn đặc biệt ${level}: bàn hỏng`);
    check(Array.isArray(entry.record.cm) && entry.record.cm.length === entry.size, `màn đặc biệt ${level}: thiếu bảng màu`);
    check(hardestRank(new Puzzle(entry.record, entry.size), []) === entry.record.r, `màn đặc biệt ${level}: bậc ghi sai`);
  }
  const missing = Object.keys(SPECIAL_LEVELS).filter((k) => !specials[k]);
  if (missing.length) console.warn(`màn đặc biệt chưa dựng: ${missing.join(", ")} (sẽ dùng màn thường)`);
  console.log(`màn đặc biệt: ${Object.keys(specials).length}/${Object.keys(SPECIAL_LEVELS).length}`);
}

console.log(`tuyến chơi: ${failures} lỗi`);
process.exit(failures ? 1 : 0);
