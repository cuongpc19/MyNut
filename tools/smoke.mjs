// Kiểm tra nhanh phần logic bàn cờ mà không cần trình duyệt.

import { readFileSync } from "node:fs";
import { Board, Puzzle, CAT } from "../src/puzzle.js";
import { nextDeduction, stateFromBoard } from "../src/solver.js";

// Lấy bàn 9×9 từ kho tự sinh (data/pools.json, khoá "cỡxbậc"), không dùng bank nào khác.
const pools = JSON.parse(readFileSync(new URL("../data/pools.json", import.meta.url), "utf8"));
const bank = { size: 9, tiers: Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, pools[`9x${r}`] || []]).filter(([, l]) => l.length)) };
let checked = 0;
let failures = 0;

const fail = (msg) => { console.error("FAIL " + msg); failures++; };

for (const [tier, list] of Object.entries(bank.tiers)) {
  for (const record of list.slice(0, 40)) {
    const puzzle = new Puzzle(record, bank.size);
    const board = new Board(puzzle);

    // Đặt đúng lời giải thì bàn cờ phải báo thắng và không xung đột.
    board.apply(puzzle.solution.map((c, r) => [r, c, CAT]));
    if (!board.isSolved()) fail(`tier ${tier}: lời giải chính thức không được chấp nhận`);
    if (board.conflicts().length) fail(`tier ${tier}: lời giải chính thức bị báo xung đột`);

    // Undo phải trả bàn cờ về đúng trạng thái trống.
    board.undo();
    if (board.cats().length !== 0) fail(`tier ${tier}: undo không gỡ hết mèo`);

    // Gợi ý trên bàn cờ trống phải luôn tìm ra được một bước.
    if (!nextDeduction(stateFromBoard(puzzle, board.cells))) fail(`tier ${tier}: không gợi ý được bước đầu`);

    // Đặt hai mèo cạnh nhau phải bị bắt lỗi kề chéo.
    const clash = new Board(puzzle);
    clash.apply([[0, 0, CAT], [1, 1, CAT]]);
    if (!clash.conflicts().some((c) => c.kind === "adjacent")) fail(`tier ${tier}: không bắt được lỗi mèo kề chéo`);

    checked++;
  }
}

console.log(`${checked} puzzle đã kiểm tra, ${failures} lỗi`);
process.exit(failures ? 1 : 0);
