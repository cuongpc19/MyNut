// Đo luật "kiến gác kẹo" trên lưới vùng lấy từ kho bàn thật, trước khi vẽ.
//
//   node tools/probe_candy.mjs [số bàn mỗi cỡ]
//
// Nhìn: tỉ lệ mẻ thành, số kẹo phải rải (nhiều quá thì bàn rối, ít quá thì
// không duy nhất), phân bố độ khó, và vét cạn lại để chắc lời giải duy nhất.
import { readFileSync } from "node:fs";
import { makePuzzle, makeBoard, search, regionsFromRecord } from "../src/candy.js";

const pools = JSON.parse(readFileSync(new URL("../data/pools.json", import.meta.url), "utf8"));
const batch = Number(process.argv[2]) || 40;

const RUNS = [
  ["atLeast", false, false, "=== Kẹo có ÍT NHẤT một kiến gác · kiến không cần kẹo ==="],
  ["atLeast", false, true, "=== Ít nhất một · KIẾN NÀO CŨNG PHẢI CÓ KẸO ==="],
  ["exact", false, true, "=== Đúng một · kiến nào cũng phải có kẹo ==="],
];
for (const [mode, mixed, needy, title] of RUNS) {
  console.log(title);
  for (const size of [6, 7, 8, 9]) {
    const records = [1, 2, 3].flatMap((r) => pools[`${size}x${r}`] || []).slice(0, batch);
    const started = Date.now();
    const rating = [0, 0, 0];
    let made = 0, candies = 0, steps = 0, notUnique = 0, checked = 0;
    records.forEach((rec, k) => {
      const level = makePuzzle(regionsFromRecord(rec, size), 1000 + k, { mixed, mode, needy });
      if (!level) return;
      made++;
      candies += level.candies.length;
      steps += level.steps;
      rating[level.rating - 1]++;
      if (checked < 15) {
        checked++;
        const B = makeBoard(level.regions, level.types);
        if (search(B, level.candies, 2, null, mode, needy).length !== 1) notUnique++;
      }
    });
    const ms = Date.now() - started;
    if (!made) {
      console.log(`  ${size}×${size}: KHÔNG sinh nổi màn nào từ ${records.length} lưới (${ms}ms)`);
      continue;
    }
    console.log(
      `  ${size}×${size}: thành ${made}/${records.length} · kẹo ${(candies / made).toFixed(1)}/bàn` +
        ` (${(candies / made / size).toFixed(2)}/vùng) · độ khó R1..R3 = ${rating.join(" / ")}` +
        ` · ${(steps / made).toFixed(0)} bước · vét cạn ${checked} bàn: ${notUnique} không duy nhất · ${Math.round(ms / records.length)}ms/bàn`,
    );
  }
}
