// Chọn bàn hướng dẫn cho luật "kiến gác kẹo".
//
//   node tools/pick_candy_tutorial.mjs [số hạt giống mỗi lưới] [--size 4|5]
//
// Quét lưới vùng 4×4 và 5×5 trong data/pools.json, sinh màn bằng src/candy.js,
// rồi thử dạy bằng chính planTutorial() của src/candytutorial.js. Bàn nào dạy
// trọn nhịp chín bước thì đem chấm điểm và giữ bàn tốt nhất.
//
// Chấm theo mấy thứ đo được trên chính bàn, không theo cảm tính:
//   - bậc khó phải thấp: hướng dẫn không phải chỗ ra đề;
//   - hai đường vuốt dài 3-5 ô: ngắn hơn thì không thành cử chỉ vuốt, dài hơn
//     thì ngón tay phải bò qua nửa bàn;
//   - ít ô phải nhấn lẻ: mỗi lần nhấn là một nhịp chờ;
//   - ít kẹo: bàn dạy phải đọc được trong một cái liếc;
//   - bước tự chơi còn đúng hai con kiến: một con thì hết là xong ngay, ba con
//     thì bài dạy biến thành ván chơi.
//
// In ra bản ghi dán thẳng vào src/candylevels.js.

import { readFileSync } from "node:fs";
import { makePuzzle, makeBoard, search, regionsFromRecord } from "../src/candy.js";
import { CandyPuzzle, packRegions } from "../src/candyboard.js";
import { planTutorial } from "../src/candytutorial.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const seedsPerGrid = Number(process.argv[2]) || 60;
const onlySize = arg("size", 0);

const pools = JSON.parse(readFileSync(new URL("../data/pools.json", import.meta.url), "utf8"));

/** Ô của vùng lớn nhất chiếm bao nhiêu phần bàn. */
const biggestShare = (puzzle) => {
  const area = new Array(puzzle.regionCount).fill(0);
  for (const g of puzzle.regions.flat()) area[g]++;
  return Math.max(...area) / (puzzle.size * puzzle.size);
};

/** Điểm càng cao càng hợp làm bàn dạy; null nghĩa là loại. */
function score(puzzle, plan, level) {
  const swipe = [plan.swipeOne.length, plan.swipeTwo.length];
  if (swipe.some((n) => n < 3 || n > 5)) return null;
  if (plan.tapRegion.length < 1 || plan.tapRegion.length > 3) return null;
  if (level.rating > 2) return null;
  // Số con còn lại cho bước tự chơi.
  const left = puzzle.regionCount - 3;
  if (left < 1 || left > 3) return null;
  // Một vùng nuốt quá nửa bàn thì lưới nhìn như nền trơn có vài mảnh vá, người
  // mới không đọc ra "mỗi màu một kiến" từ hình đó.
  const share = biggestShare(puzzle);
  if (share > 0.46) return null;
  // Kẹo phủ quá dày thì bàn dạy rối; đây là ngưỡng nhìn được trong một cái liếc.
  if (puzzle.candies.length > puzzle.size + 2) return null;

  let points = 0;
  points += level.rating === 1 ? 30 : 12;
  points += left === 2 ? 25 : 5;
  points -= Math.abs(swipe[0] - 4) * 5 + Math.abs(swipe[1] - 4) * 5;
  points -= plan.tapRegion.length * 3;
  points -= puzzle.candies.length * 2;
  points -= Math.round(share * 60);
  points -= level.steps;
  // Con thứ ba ép bằng luật màu đọc gọn hơn ép bằng luật kẹo.
  if (plan.thirdBy === "region") points += 8;
  return points;
}

const sizes = onlySize ? [onlySize] : [4, 5];
const shortlist = [];
let tried = 0, planned = 0;

for (const size of sizes) {
  const grids = [1, 2, 3, 4, 5].flatMap((r) => pools[`${size}x${r}`] || []);
  for (const grid of grids) {
    const regions = regionsFromRecord(grid, size);
    for (let s = 0; s < seedsPerGrid; s++) {
      tried++;
      const seed = 4_000_000 + size * 100_003 + s * 7919;
      const level = makePuzzle(regions, seed, { mode: "atLeast", needy: false });
      if (!level) continue;
      const record = {
        m: packRegions(level.regions),
        k: [...level.candies].sort((a, b) => a - b),
        a: [...level.ants],
        r: level.rating,
        st: level.steps,
      };
      const puzzle = new CandyPuzzle(record, size);
      let plan = null;
      try {
        plan = planTutorial(puzzle);
      } catch {
        plan = null;
      }
      if (!plan) continue;
      planned++;
      const points = score(puzzle, plan, level);
      if (points === null) continue;
      shortlist.push({ points, size, seed, record, plan, level, puzzle });
    }
  }
}

shortlist.sort((a, b) => b.points - a.points || a.record.k.length - b.record.k.length);
const best = shortlist[0];
if (!best) {
  console.log(`không tìm được bàn dạy được (${tried} mẻ, ${planned} bàn dạy trọn nhịp)`);
  process.exit(1);
}
console.log(`ứng viên qua sàng: ${shortlist.length} — mười bàn đầu bảng:`);
for (const row of shortlist.slice(0, 10))
  console.log(`  ${String(row.points).padStart(4)} · ${row.size}×${row.size} · ${row.record.k.length} kẹo` +
    ` · bậc ${row.record.r} · ${row.record.st} bước · vuốt ${row.plan.swipeOne.length}+${row.plan.swipeTwo.length}` +
    ` · nhấn ${row.plan.tapRegion.length} · vùng lớn nhất ${(biggestShare(row.puzzle) * 100).toFixed(0)}%` +
    ` · ${row.record.m}`);
console.log("");

// Vét cạn lại: bàn dạy mà hai lời giải thì bài dạy nói dối ngay từ câu đầu.
const B = makeBoard(best.level.regions, best.level.types);
const solutions = search(B, best.level.candies, 2, null, "atLeast", false);
if (solutions.length !== 1) {
  console.log(`bàn chọn được có ${solutions.length} lời giải — bỏ`);
  process.exit(1);
}

const { size, record, plan, puzzle } = best;
const cell = ([r, c]) => `(${r},${c})`;
console.log(`quét ${tried} mẻ · ${planned} bàn dạy trọn nhịp · điểm bàn chọn ${best.points}`);
console.log(`cỡ ${size}×${size} · ${puzzle.regionCount} màu · ${record.k.length} kẹo · bậc ${record.r} · ${record.st} bước · hạt ${best.seed}`);
console.log(`  con đầu ${cell(plan.first)} — màu ${puzzle.regionAt(...plan.first)} chỉ có một ô`);
console.log(`  vuốt 1: ${plan.swipeOne.map(cell).join(" ")}`);
console.log(`  con hai ${cell(plan.second)} vì kẹo ${cell(plan.secondCandy)} chỉ còn một chỗ gác`);
console.log(`  nhấn lẻ: ${plan.tapRegion.map(cell).join(" ")}`);
console.log(`  vuốt 2: ${plan.swipeTwo.map(cell).join(" ")}`);
console.log(`  con ba ${cell(plan.third)} ép bằng luật ${plan.thirdBy === "region" ? "màu" : "kẹo"}`);
console.log(`  còn lại cho bước tự chơi: ${puzzle.regionCount - 3} con`);
console.log("");
for (let r = 0; r < size; r++) {
  let line = "  ";
  for (let c = 0; c < size; c++) {
    const i = r * size + c;
    line += record.k.includes(i) ? " o" : record.a.includes(i) ? " A" : ` ${record.m[i]}`;
  }
  console.log(line);
}
console.log("");
console.log("export const CANDY_TUTORIAL = {");
console.log(`  size: ${size},`);
console.log("  record: {");
for (let r = 0; r < size; r++)
  console.log(`    ${r === 0 ? "m: " : "   "}"${record.m.slice(r * size, (r + 1) * size)}"${r === size - 1 ? "," : " +"}`);
console.log(`    k: [${record.k.join(", ")}],`);
console.log(`    a: [${record.a.join(", ")}],`);
console.log(`    r: ${record.r}, st: ${record.st},`);
console.log("  },");
console.log("};");
