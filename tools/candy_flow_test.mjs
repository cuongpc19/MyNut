// Kiểm tuyến chơi của luật "kiến gác kẹo" mà không cần trình duyệt.
//
//   node tools/candy_flow_test.mjs
//
// Kiểm bốn thứ, mỗi thứ là một chỗ đã từng hỏng ở dự án cũ:
//   1. Bàn hướng dẫn: lời giải duy nhất, kịch bản chín bước dựng được, và mỗi
//      nước dạy thật sự bị LUẬT ép ra chứ không phải chép từ đáp án.
//   2. Chơi giả bài hướng dẫn từ đầu tới cuối qua đúng lớp Tutorial và CandyBoard.
//   3. Bảng chữ: mọi khoá guard.* mà kịch bản gọi tới đều có ở cả hai thứ tiếng.
//   4. Kho màn: mọi màn trong data/candy-pools.json giải được, duy nhất, và
//      bậc khó ghi trong bản ghi đúng với bộ giải.

import { existsSync, readFileSync } from "node:fs";
import { CandyPuzzle, CandyBoard, CAT, MARK, around } from "../src/candyboard.js";
import { makeBoard, search, rate, Solve, nextDeduction } from "../src/candy.js";
import { CANDY_TUTORIAL } from "../src/candylevels.js";
import { planTutorial, buildSteps, Tutorial } from "../src/candytutorial.js";
import { T, setLocale } from "../src/strings.js";

let failed = 0;
const ok = (cond, what) => {
  if (!cond) { failed++; console.log(`  LỖI  ${what}`); }
  return cond;
};

/** Bàn theo mô hình của candy.js, để mượn bộ giải và phép vét cạn. */
const solverBoard = (puzzle) =>
  makeBoard(puzzle.regions, new Array(puzzle.regionCount).fill("ring"));

// ---------------------------------------------------------- 1. bàn hướng dẫn

console.log("bàn hướng dẫn");
const puzzle = new CandyPuzzle(CANDY_TUTORIAL.record, CANDY_TUTORIAL.size);
{
  const B = solverBoard(puzzle);
  const found = search(B, puzzle.candies, 2, null, "atLeast", false);
  ok(found.length === 1, `phải có đúng một lời giải, đang có ${found.length}`);
  ok(found[0]?.join() === puzzle.ants.join(), "lời giải ghi trong bản ghi phải trùng lời giải vét cạn được");

  const scored = rate(B, puzzle.candies, "atLeast", false);
  ok(scored !== null, "bộ giải phải giải trọn bàn hướng dẫn bằng suy luận");
  ok(scored?.rating === puzzle.rating, `bậc ghi ${puzzle.rating}, bộ giải chấm ${scored?.rating}`);

  // Luật chơi phải đúng trên chính lời giải: một kiến mỗi màu, kiến không kề
  // nhau, kẹo nào cũng có người gác.
  const seen = new Set(puzzle.ants.map((i) => puzzle.regions.flat()[i]));
  ok(seen.size === puzzle.regionCount, "mỗi màu đúng một kiến");
  const cells = puzzle.solution;
  const clash = cells.some(([ar, ac], i) =>
    cells.some(([br, bc], j) => i !== j && Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1));
  ok(!clash, "không hai kiến nào đứng cạnh nhau");
  const bare = puzzle.candyCells().filter(([r, c]) =>
    !around(r, c, puzzle.size).some(([y, x]) => puzzle.antSet.has(y * puzzle.size + x)));
  ok(bare.length === 0, `còn ${bare.length} viên kẹo không ai gác`);
}

// ------------------------------------------- 2. kịch bản dạy có bị luật ép ra

console.log("kịch bản dạy");
const plan = planTutorial(puzzle);
ok(plan !== null, "planTutorial phải dựng được kịch bản");
if (plan) {
  const size = puzzle.size;
  const at = ([r, c]) => r * size + c;
  ok(puzzle.cellsOf(puzzle.regionAt(...plan.first)).length === 1,
    "con đầu phải nằm ở màu chỉ có một ô, nếu không thì nước mở màn không tự hiểu được");

  // Con thứ hai: viên kẹo ép nó ra phải thật sự chỉ còn đúng một ô sáng, tính
  // theo đúng những ô mà người chơi đã tắt đèn trước đó.
  const off = new Set([at(plan.first), ...plan.swipeOne.map(at)]);
  const [cr, cc] = plan.secondCandy;
  const reach = around(cr, cc, size)
    .filter(([r, c]) => !puzzle.isCandy(r, c) && !off.has(at([r, c])));
  ok(reach.length === 1 && at(reach[0]) === at(plan.second),
    `kẹo ở (${cr},${cc}) phải chỉ còn đúng một ô gác được, đang còn ${reach.length}`);

  // Con thứ ba: sau khi tắt hết những ô hai bước trước đã tắt, màu của nó chỉ
  // còn một ô (hoặc một viên kẹo khác dồn nó vào thế).
  for (const cell of [plan.second, ...plan.tapRegion, ...plan.swipeTwo]) off.add(at(cell));
  const openThird = puzzle.cellsOf(puzzle.regionAt(...plan.third))
    .filter(([r, c]) => !puzzle.isCandy(r, c) && !off.has(at([r, c])));
  if (plan.thirdBy === "region")
    ok(openThird.length === 1 && at(openThird[0]) === at(plan.third),
      `màu của con thứ ba phải chỉ còn một ô, đang còn ${openThird.length}`);

  ok(plan.swipeOne.length >= 3 && plan.swipeTwo.length >= 3,
    "hai lượt vuốt phải đủ dài để thành cử chỉ vuốt");
  // Đường vuốt phải đi được bằng một ngón: hai ô liền nhau trong đường không
  // được rời nhau quá một ô.
  for (const [name, path] of [["một", plan.swipeOne], ["hai", plan.swipeTwo]])
    for (let i = 1; i < path.length; i++) {
      const gap = Math.max(Math.abs(path[i][0] - path[i - 1][0]), Math.abs(path[i][1] - path[i - 1][1]));
      ok(gap <= 1, `đường vuốt ${name} nhảy cóc ${gap} ô ở đoạn ${i}`);
    }

  // Bước tự chơi: những con còn lại phải suy ra được, không phải đoán.
  const B = solverBoard(puzzle);
  const S = new Solve(B, puzzle.candies, "atLeast", false);
  for (const cell of [plan.first, plan.second, plan.third])
    S.cand[puzzle.regionAt(...cell)] = [at(cell)];
  let guard = 0;
  while (!S.complete() && guard++ < 200) {
    const move = nextDeduction(S);
    if (!move) break;
    S.cand[move.region] = move.cells;
  }
  ok(S.complete(), "sau ba con đầu, phần còn lại phải suy luận ra được");
}

// -------------------------------------------------- 3. chơi giả trọn bài dạy

console.log("chơi thử trọn bài");
for (const code of ["en", "vi"]) {
  await setLocale(code, { remember: false });
  const board = new CandyBoard(puzzle);
  const tutorial = new Tutorial(puzzle, board);
  let moves = 0;
  const ids = [];
  while (!tutorial.done && moves < 400) {
    const step = tutorial.step;
    ids.push(step.id);
    if (step.button) { tutorial.advance(); continue; }
    if (step.needs) {
      for (const [r, c] of step.needs.cells) {
        // Chỉ đi những nước mà chính lớp Tutorial cho phép — đây là chỗ bắt
        // được lệch giữa kịch bản và bộ lọc thao tác.
        const kind = step.needs.value === CAT ? "cat" : "mark";
        if (!ok(tutorial.allows(r, c, kind), `${step.id}: không cho đánh ô (${r},${c}) kiểu ${kind}`)) break;
        board.apply([[r, c, step.needs.value]]);
        moves++;
      }
    } else if (step.free) {
      for (let r = 0; r < puzzle.size; r++)
        for (let c = 0; c < puzzle.size; c++) {
          if (puzzle.isCandy(r, c) || board.get(r, c) !== 0) continue;
          board.apply([[r, c, puzzle.antSet.has(r * puzzle.size + c) ? CAT : MARK]]);
          moves++;
        }
    }
    ok(tutorial.checkProgress(), `${step.id}: làm đúng yêu cầu rồi mà bước vẫn chưa xong`);
    tutorial.advance();
  }
  ok(tutorial.done, `${code}: bài dạy phải kết thúc`);
  ok(ids.length === 8, `${code}: phải đi qua 8 bước có việc, đang ${ids.length} (${ids.join(", ")})`);
  ok(board.isSolved(), `${code}: cuối bài bàn phải giải xong`);

  // Chữ: không bước nào được lòi ra "undefined" vì thiếu khoá trong bảng chữ.
  const steps = buildSteps(puzzle);
  for (const step of steps) {
    const text = [step.top, step.bottom, step.title, step.button].filter(Boolean).join(" ");
    ok(!text.includes("undefined"), `${code}/${step.id}: thiếu khoá trong bảng chữ — "${text}"`);
  }
}
await setLocale("en", { remember: false });
ok(typeof T.guard?.candyRule === "string", "bảng chữ phải có nhóm guard.*");

// ------------------------------------------------------------ 4. kho màn

const poolFile = new URL("../data/candy-pools.json", import.meta.url);
if (!existsSync(poolFile)) {
  console.log("kho màn: chưa dựng data/candy-pools.json — bỏ qua");
} else {
  console.log("kho màn");
  const pools = JSON.parse(readFileSync(poolFile, "utf8"));
  let checked = 0;
  for (const [setName, levels] of Object.entries(pools.sets)) {
    for (const entry of levels) {
      const p = new CandyPuzzle(entry, entry.size);
      const B = solverBoard(p);
      const found = search(B, p.candies, 2, null, "atLeast", false);
      if (!ok(found.length === 1, `${setName} màn ${entry.n}: có ${found.length} lời giải`)) break;
      if (!ok(found[0].join() === p.ants.join(), `${setName} màn ${entry.n}: lời giải ghi sai`)) break;
      const scored = rate(B, p.candies, "atLeast", false);
      if (!ok(scored && scored.rating === entry.r && scored.steps === entry.st,
        `${setName} màn ${entry.n}: bậc/bước ghi ${entry.r}/${entry.st}, chấm lại ${scored?.rating}/${scored?.steps}`)) break;
      checked++;
    }
  }
  console.log(`  ${checked} màn kiểm xong`);

  // Ba màn đầu phải giống hệt nhau ở cả hai bộ — đó là cả điểm của việc chia bộ.
  const names = Object.keys(pools.sets);
  for (let n = 1; n <= (pools.sharedLevels || 0); n++) {
    const first = JSON.stringify(pools.sets[names[0]][n - 1]);
    for (const other of names.slice(1))
      ok(JSON.stringify(pools.sets[other][n - 1]) === first, `màn ${n} phải giống nhau ở mọi bộ`);
  }
}

console.log(failed ? `\ntuyến chơi: ${failed} lỗi` : "\ntuyến chơi: 0 lỗi");
process.exit(failed ? 1 : 0);
