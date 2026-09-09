// Bàn hướng dẫn và năm màn mở đầu — do tools/pick_opening.mjs sinh và chọn. Chữ số trong `m` là chỉ số màu, trỏ vào --g0..--g11 trong
// style.css; tên màu nằm ở khoá `colors` trong data/i18n/.
//
// Điều kiện chọn: bàn hướng dẫn phải dạy trọn ba luật và đã được chạy thử qua
// chính lớp Tutorial; năm màn đầu giải trọn bằng cấp 1 và luôn có một màu chỉ
// một ô để bắt đầu.

export const PALETTE = [
  { key: "cyan", name: "Cyan" },
  { key: "coral", name: "Coral" },
  { key: "lime", name: "Lime" },
  { key: "pink", name: "Pink" },
  { key: "amber", name: "Amber" },
  { key: "yellow", name: "Yellow" },
  { key: "violet", name: "Violet" },
  { key: "mint", name: "Mint" },
  { key: "blue", name: "Blue" },
  { key: "orange", name: "Orange" },
  { key: "lavender", name: "Lavender" },
  { key: "tan", name: "Tan" },
];

export const colourName = (region) => PALETTE[region % PALETTE.length].name;

/**
 * Bàn hướng dẫn — do tools/pick_tutorial.mjs chọn từ bộ sinh của mình, khác
 * hẳn bàn của Meowdoku (kể cả sau tám phép xoay/lật) nhưng dạy đúng ngần ấy
 * thứ và cũng chỉ cần kỹ thuật cấp 1.
 *
 * Đúng một vùng một ô — xanh lá(2) ở (2,3) — nên nước mở màn không thể nhầm.
 * Cam(1) là dải dọc 3 ô, hồng đậm(3) là đôi ô dọc, xanh(0) là nền 10 ô.
 * Nhịp dạy: đặt con đầu → nhấn 6 ô hàng+cột → hồng đậm còn một ô → vuốt 2 ô
 * dọc hàng cuối → cam còn một ô → vuốt 3 ô nữa → tự tìm con cuối trong 2 ô.
 */
export const TUTORIAL = {
  size: 4,
  record: {
    m: "0000" +
       "1000" +
       "1302" +
       "1300",
    s: [2, 0, 3, 1],
    r: 1, st: 4, rk: [4, 0, 0, 0, 0], ch: 0,
  },
};

/**
 * Hai màn mở đầu, do tools/pick_opening.mjs chọn từ bộ sinh của mình: 4×4 cả
 * hai (Meowdoku là 4×4 rồi 5×5), mỗi màn 1-2 màu chỉ có một ô và vùng nền to
 * để người mới nhìn là hiểu. Từ màn 3 cỡ lưới và độ khó y hệt Meowdoku.
 *
 * `given` là con game đặt sẵn khi vào màn, theo đúng luật của Meowdoku cho màn
 * 1-6: con nằm trong vùng nhiều ô, để nước đầu của người chơi là "màu chỉ có
 * một ô". Từ màn 6 trở đi con tặng sẵn do progression.js tính.
 */
export const SCRIPTED = [
  {
    // Màn 1 — 4×4, 2 vùng 1 ô, nền 69%. Bỏ con tặng thì cấp 1.
    size: 4,
    given: [[1,0]],
    record: {
      m: "1101" +
         "1111" +
         "1112" +
         "1322",
      s: [2,0,3,1],
      r: 1, st: 4, rk: [4,0,0,0,0], ch: 0,
    },
  },
  {
    // Màn 2 — 4×4, 1 vùng 1 ô, nền 63%. Bỏ con tặng thì cấp 1.
    size: 4,
    given: [[0,1]],
    record: {
      m: "0031" +
         "0331" +
         "2333" +
         "3333",
      s: [1,3,0,2],
      r: 1, st: 4, rk: [4,0,0,0,0], ch: 0,
    },
  },
];
