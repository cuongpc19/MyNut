// Bàn hướng dẫn của luật "kiến gác kẹo", do tools/pick_candy_tutorial.mjs chọn.
//
// Điều kiện chọn nằm trong chính bộ chọn; tóm tắt: bàn phải dạy được trọn nhịp
// chín bước của src/candytutorial.js, đủ ba luật, hai lượt vuốt dài vừa tay, và
// giải trọn bằng suy luận bậc thấp.

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
 * Bàn hướng dẫn — 5×5, năm màu, bảy viên kẹo, bậc 2, sáu bước suy luận.
 * Hạt giống 5283996 trên lưới vùng của data/pools.json; dựng lại được bằng
 * `node tools/pick_candy_tutorial.mjs 300`.
 *
 *     A o 0 0 0      A = chỗ kiến, o = kẹo, số = màu vùng
 *     0 0 o A 1
 *     A 4 o o 1
 *     4 4 o o 3
 *     A o 1 A 3
 *
 * Vì sao bàn này: màu 2 chỉ có đúng một ô ở (2,0) nên nước mở màn không thể
 * nhầm; vuốt năm ô quanh nó xong thì viên kẹo giữa bàn (2,2) chỉ còn đúng một
 * chỗ gác được — đó là lần đầu người chơi dùng luật kẹo, và nó nằm ngay giữa
 * bàn nên nhìn là thấy. Màu 1 nằm rải rác nên bước nhấn lẻ dạy được rằng "một
 * kiến mỗi màu" tính theo màu chứ không theo cụm. Cuối bài còn đúng hai con
 * cho người chơi tự tìm: một con thì hết bài quá sớm, ba con thì thành ván chơi.
 */
export const CANDY_TUTORIAL = {
  size: 5,
  record: {
    m: "00000" +
       "00011" +
       "24111" +
       "44133" +
       "44133",
    k: [1, 7, 12, 13, 17, 18, 21],
    a: [0, 8, 10, 23, 20],
    r: 2, st: 6,
  },
};
