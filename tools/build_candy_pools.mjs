// Dựng kho màn cho luật "kiến gác kẹo" — HAI bộ chạy song song.
//
//   node tools/build_candy_pools.mjs                  → dựng đủ 60 màn mỗi bộ
//   node tools/build_candy_pools.mjs --levels 20      → dựng thử phần đầu
//   node tools/build_candy_pools.mjs --slack 4        → mỗi nấc nuôi ít ứng viên hơn
//
// Vì sao hai bộ: chưa biết người chơi chịu được đường cong nào, nên dựng sẵn
// hai đường rồi đo trên người thật. Ba màn đầu CỐ Ý giống hệt nhau ở cả hai bộ
// — ai vào cũng học cùng một thứ, và nếu có ai bỏ ngay từ màn 2 thì đó không
// phải lỗi của đường cong.
//
// Hai bộ không dùng hai bảng nấc khó riêng. Chỉ có MỘT đường cong, và bộ "nặng"
// chạy nhanh hơn trên chính đường ấy: màn thứ n của nó lấy nấc của màn n×1,4 bên
// bộ "nhẹ". Nhờ vậy "khó hơn" có nghĩa đo được (sớm hơn bao nhiêu màn) chứ không
// phải hai bảng số rời rạc phải cân bằng bằng tay. Trong cùng một nấc, bộ nặng
// còn chọn bàn tốn sức nghĩ hơn (xem `effort`), bộ nhẹ chọn bàn nhẹ tay hơn.
//
// Kiểm duy nhất từng màn bằng vét cạn TRƯỚC khi ghi. Ở dự án cũ từng có một quy
// tắc suy luận sai làm bộ sinh phát ra bàn hai lời giải, và chỉ vét cạn mới bắt
// được — nên bước này không được bỏ dù chậm.

import { readFileSync, writeFileSync } from "node:fs";
import { makePuzzle, makeBoard, search, rate, rng, regionsFromRecord } from "../src/candy.js";
import { packRegions } from "../src/candyboard.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const LEVELS = arg("levels", 60);
const SLACK = arg("slack", 12);

const pools = JSON.parse(readFileSync(new URL("../data/pools.json", import.meta.url), "utf8"));

// ------------------------------------------------------------ đường cong

/**
 * Ba màn đầu, chung cho cả hai bộ: nhỏ và chỉ cần suy luận bậc 1. Bậc phải là 1
 * cả ba màn, không phải để cho dễ mà để đường cong không bị lõm — màn 4 của bộ
 * nhẹ vẫn còn nằm ở bậc 1, nên màn 3 mà bậc 2 thì người chơi tụt bậc lúc sang
 * màn 4 và cảm giác "game nhạt dần" đúng ở chỗ dễ bỏ nhất.
 */
const SHARED = [
  { size: 4, rank: 1 },
  { size: 4, rank: 1 },
  { size: 5, rank: 1 },
];

/** Bộ nào chạy nhanh bao nhiêu trên cùng một đường cong. */
const PACE = { easy: 1, hard: 1.4 };

/** Cỡ bàn theo đồng hồ khó `t`. Mỗi nấc rộng hơn nấc trước — càng về sau càng lâu mới đổi cỡ. */
const sizeAt = (t) => (t <= 4 ? 5 : t <= 11 ? 6 : t <= 20 ? 7 : t <= 32 ? 8 : t <= 46 ? 9 : 10);

/**
 * Bậc khó theo đồng hồ `t` và đêm thứ mấy trong chương (`n`). Đêm cuối chương
 * là nấc khó, đúng như nhịp mà trang chủ tổ kiến đã bày sẵn: năm đêm một chương,
 * đêm thứ năm là đêm đáng nhớ.
 */
function rankAt(t, n) {
  if (t <= 6) return 1;
  if (t >= 20 && n % 5 === 0) return 3;
  if (t >= 35 && n % 5 === 4) return 3;
  return 2;
}

function target(course, n) {
  if (n <= SHARED.length) return SHARED[n - 1];
  const t = Math.round(n * PACE[course]);
  return { size: sizeAt(t), rank: rankAt(t, n) };
}

// --------------------------------------------------------- nuôi ứng viên

/**
 * Sức nghĩ một bàn đòi: bước bậc 3 (đặt thử rồi loại) nặng hơn hẳn bước bậc 1.
 * Dùng để chia bàn trong cùng một nấc thành "nhẹ tay" và "hóc" — đây là chỗ hai
 * bộ khác nhau ngay cả khi cùng cỡ, cùng bậc.
 */
const effort = (counts) => counts[0] + 2 * counts[1] + 6 * counts[2];

/** Số vùng chỉ có một ô: mỗi vùng như thế là một con kiến cho không. */
const singleRegions = (m) => {
  const n = {};
  for (const ch of m) n[ch] = (n[ch] || 0) + 1;
  return Object.values(n).filter((k) => k === 1).length;
};

const grids = new Map();
function gridsFor(size) {
  if (!grids.has(size)) {
    const all = [1, 2, 3, 4, 5].flatMap((r) => pools[`${size}x${r}`] || []);
    grids.set(size, all);
  }
  return grids.get(size);
}

/**
 * Nuôi `want` bàn khác nhau cho nấc (cỡ, bậc). Hạt giống gắn với chính nấc ấy
 * nên chạy lại ra đúng bộ cũ.
 */
function grow(size, rank, want, seen) {
  const list = gridsFor(size);
  if (!list.length) return [];
  const rand = rng(size * 1_000_003 + rank * 7919);
  const order = [...list.keys()].sort(() => rand() - 0.5);
  const out = [];
  const started = Date.now();
  let seed = size * 90_001 + rank * 131;
  for (let pass = 0; out.length < want && pass < 40; pass++) {
    for (const gi of order) {
      if (out.length >= want) break;
      if (Date.now() - started > 8 * 60_000) break; // chốt chặn, đừng treo cả buổi
      const grid = list[gi];
      seed += 7919;
      const level = makePuzzle(regionsFromRecord(grid, size), seed, { mode: "atLeast", needy: false });
      if (!level) continue;
      const m = packRegions(level.regions);
      const k = [...level.candies].sort((a, b) => a - b);
      const id = `${m}|${k.join(",")}`;
      if (seen.has(id)) continue;
      // Kẹo phủ quá dày thì bàn thành bức tường hình, không còn chỗ đọc lưới màu.
      if (k.length > Math.round(size * 2.2)) continue;
      const B = makeBoard(level.regions, level.types);
      // Chấm lại trên danh sách kẹo ĐÃ SẮP. Bản ghi lưu danh sách sắp, mà thứ tự
      // kẹo quyết định bộ giải gặp suy luận nào trước, tức là đổi cả số bước —
      // không chấm lại thì con số ghi trong kho lệch với chính bàn ấy khi đọc ra.
      const scored = rate(B, k, "atLeast", false);
      if (!scored || scored.rating !== rank) continue;
      // Bước bậc 3 là "đặt thử rồi thấy bế tắc" — vài lần thì hay, ba chục lần
      // thì bàn không còn khó vì suy luận mà khó vì phải mò. Đo được: không chặn
      // thì bộ nặng nhặt phải bàn 35 bước bậc 3, gấp đôi mọi bàn quanh nó.
      if (scored.counts[2] > 5) continue;
      // Vét cạn: bàn hai lời giải là hỏng, và chỉ chỗ này bắt được.
      if (search(B, k, 2, null, "atLeast", false).length !== 1) continue;
      seen.add(id);
      out.push({
        size, m, k,
        a: [...level.ants],
        r: scored.rating,
        st: scored.steps,
        counts: scored.counts,
        effort: effort(scored.counts),
        singles: singleRegions(m),
        seed,
      });
    }
  }
  out.sort((a, b) => a.effort - b.effort || a.k.length - b.k.length);
  return out;
}

// -------------------------------------------------------------- lắp bộ

const courses = ["easy", "hard"];
const plans = {};
for (const course of courses)
  plans[course] = Array.from({ length: LEVELS }, (_, i) => target(course, i + 1));

// Bao nhiêu bàn cho mỗi nấc. Ba màn đầu dùng chung nên chỉ tính một lần.
const demand = new Map();
const bump = (size, rank, by = 1) => {
  const key = `${size}x${rank}`;
  demand.set(key, (demand.get(key) || 0) + by);
};
for (let n = 1; n <= Math.min(SHARED.length, LEVELS); n++) bump(SHARED[n - 1].size, SHARED[n - 1].rank);
for (const course of courses)
  for (let n = SHARED.length + 1; n <= LEVELS; n++) bump(plans[course][n - 1].size, plans[course][n - 1].rank);

console.log("nấc cần dựng:");
for (const [key, n] of [...demand].sort()) console.log(`  ${key.padEnd(5)} ${n} bàn`);
console.log("");

const seen = new Set();
const bank = new Map();
for (const [key, need] of [...demand].sort()) {
  const [size, rank] = key.split("x").map(Number);
  const started = Date.now();
  // Nuôi gấp đôi nhu cầu chứ không chỉ nhu cầu + dư: bộ nặng rút ở phân vị cao
  // nên nó ăn dần từ đỉnh nấc xuống. Nấc mỏng thì tới màn thứ mười nó đã chạm
  // đáy và đường cong tụt hẳn — đo được ở đuôi 10×10 trước khi nới con số này.
  const got = grow(size, rank, need * 2 + SLACK, seen);
  bank.set(key, got);
  const short = got.length < need ? "  THIẾU" : "";
  console.log(`  ${key.padEnd(5)} nuôi ${String(got.length).padStart(3)}/${need * 2 + SLACK}` +
    ` · sức nghĩ ${got.length ? `${got[0].effort}..${got[got.length - 1].effort}` : "-"}` +
    ` · ${((Date.now() - started) / 1000).toFixed(1)}s${short}`);
}
console.log("");

/**
 * Rút một bàn ở phân vị `q` của nấc: bộ nặng lấy phía tốn sức, bộ nhẹ lấy phía
 * nhẹ tay. Bàn đã dùng thì bỏ qua và trượt sang bàn kế bên, nên hai bộ không
 * bao giờ trùng bàn nhau.
 */
function draw(key, q, limitSingles) {
  const list = bank.get(key) || [];
  // Hạn mức vùng-một-ô là mong muốn chứ không phải luật: quét hết nấc mà không
  // còn bàn nào đạt thì nới ra chứ đừng bỏ trống một màn.
  let free = list.filter((x) => !x.used && x.singles <= limitSingles);
  if (!free.length) free = list.filter((x) => !x.used);
  if (!free.length) return null;
  const pick = free[Math.min(free.length - 1, Math.floor(free.length * q))];
  pick.used = true;
  return pick;
}

/**
 * Phân vị rút bàn trong một nấc, trôi dần lên theo số màn.
 *
 * Cần trôi vì bàn đã kịch cỡ 10×10 rồi thì cỡ và bậc hết chỗ tăng, mà kho còn
 * hai chục màn nữa. Giữ phân vị cố định thì hai chục màn cuối cùng nhấp nhô
 * quanh một mức — đo được: bộ nặng tụt hơn 2 điểm sức nghĩ ở bốn chỗ. Trôi lên
 * thì trong cùng một nấc, màn sau vẫn hóc hơn màn trước.
 */
const QUANTILE = { easy: [0.1, 0.45], hard: [0.55, 0.95] };
const quantileAt = (course, n) => {
  const [lo, hi] = QUANTILE[course];
  return lo + (hi - lo) * ((n - 1) / Math.max(1, LEVELS - 1));
};
const sets = {};
const sharedPicks = [];
for (let n = 1; n <= Math.min(SHARED.length, LEVELS); n++) {
  const { size, rank } = SHARED[n - 1];
  // Ba màn chung lấy ở phía nhẹ tay nhất: đây là chỗ người mới rời bài hướng dẫn.
  const pick = draw(`${size}x${rank}`, 0, 2);
  if (!pick) throw new Error(`không đủ bàn cho màn chung ${n} (${size}x${rank})`);
  sharedPicks.push({ n, ...strip(pick) });
}

for (const course of courses) {
  const rows = sharedPicks.map((row) => ({ ...row }));
  for (let n = SHARED.length + 1; n <= LEVELS; n++) {
    const { size, rank } = plans[course][n - 1];
    // Từ màn 21 chỉ cho tối đa một vùng một ô: quá số đó thì bàn tự mở hộ.
    const pick = draw(`${size}x${rank}`, quantileAt(course, n), n >= 21 ? 1 : 2);
    if (!pick) throw new Error(`hết bàn cho ${course} màn ${n} (${size}x${rank})`);
    rows.push({ n, ...strip(pick) });
  }
  sets[course] = rows;
}

function strip(pick) {
  return {
    size: pick.size, m: pick.m, k: pick.k, a: pick.a,
    r: pick.r, st: pick.st, counts: pick.counts, seed: pick.seed,
  };
}

const out = {
  note: "Kho màn luật kiến gác kẹo. Dựng bằng tools/build_candy_pools.mjs; " +
    "sharedLevels màn đầu giống hệt nhau ở mọi bộ.",
  built: new Date().toISOString().slice(0, 10),
  sharedLevels: Math.min(SHARED.length, LEVELS),
  pace: PACE,
  sets,
};
writeFileSync(new URL("../data/candy-pools.json", import.meta.url), JSON.stringify(out));

// ------------------------------------------------------------- báo cáo

const cell = (row) => `${row.size}×${row.r}`;
console.log("màn   nhẹ            nặng");
for (let n = 1; n <= LEVELS; n++) {
  const a = sets.easy[n - 1], b = sets.hard[n - 1];
  const same = a.m === b.m && a.k.join() === b.k.join() ? "  (chung)" : "";
  console.log(`${String(n).padStart(3)}   ${cell(a)} ${String(a.st).padStart(2)} bước ${String(a.k.length).padStart(2)} kẹo` +
    `   ${cell(b)} ${String(b.st).padStart(2)} bước ${String(b.k.length).padStart(2)} kẹo${same}`);
}
console.log("");
for (const course of courses) {
  const rows = sets[course];
  const avg = (f) => (rows.reduce((s, r) => s + f(r), 0) / rows.length).toFixed(1);
  const byRank = [1, 2, 3].map((r) => rows.filter((x) => x.r === r).length).join(" / ");
  console.log(`${course.padEnd(5)}: ${rows.length} màn · cỡ ${Math.min(...rows.map((r) => r.size))}..${Math.max(...rows.map((r) => r.size))}` +
    ` · bậc R1/R2/R3 = ${byRank} · trung bình ${avg((r) => r.st)} bước, ${avg((r) => r.k.length)} kẹo` +
    ` · sức nghĩ ${avg((r) => effort(r.counts))}`);
}
console.log("xong: data/candy-pools.json");
