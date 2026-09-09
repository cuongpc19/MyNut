// Mặt cắt tổ kiến trên trang chủ: năm buồng của tầng đang đào, buồng nào đã
// gác đủ năm đêm thì treo đèn, buồng đang gác có kiến đứng, buồng chưa tới thì
// tối và đánh dấu hỏi. Vẽ bằng SVG dựng tại chỗ — không có ảnh nào ngoài kiến.
//
// Câu chuyện: mỗi màn là một ĐÊM GÁC, năm đêm là một CHƯƠNG, mỗi chương giữ
// an toàn cho một BUỒNG. Hết năm buồng là xong một TẦNG, tổ đào xuống tầng mới
// — và tầng mới có năm buồng KHÁC, không lặp lại tên cũ.
//
// Ba tầng đầu có tên và hình riêng; từ tầng 4 thì quay vòng lại, nhưng số tầng
// vẫn tăng nên vẫn phân biệt được. Muốn thêm tầng thì nối một mảng khoá vào
// FLOORS và năm tên vào `rooms` trong data/i18n/*.json, đúng thứ tự.

export const CHAPTER_LEN = 5;

/** Khoá buồng theo tầng. Mỗi tầng đúng CHAPTER_LEN buồng. */
export const FLOORS = [
  ["gate", "eggs", "fungus", "candy", "queen"],
  ["nursery", "well", "granary", "aphids", "winter"],
  ["roots", "spring", "crystal", "vault", "heart"],
];

/** Chương chứa màn n (từ 1). */
export const chapterOf = (n) => Math.ceil(n / CHAPTER_LEN);
/** Đêm thứ mấy trong chương (1..CHAPTER_LEN). */
export const nightOf = (n) => ((n - 1) % CHAPTER_LEN) + 1;
/** Tầng chứa chương (từ 1). */
export const floorOf = (chapter) => Math.ceil(chapter / CHAPTER_LEN);
/** Màn n có phải đêm cuối của chương không. */
export const endsChapter = (n) => n % CHAPTER_LEN === 0;

/** Buồng thứ mấy trong tầng (0..CHAPTER_LEN-1). */
const slotOf = (chapter) => (chapter - 1) % CHAPTER_LEN;
/** Mảng khoá buồng của tầng đó — quay vòng khi hết FLOORS. */
const keysOfFloor = (floor) => FLOORS[(floor - 1) % FLOORS.length];

/**
 * Chỗ của tên buồng trong mảng `rooms` của bảng chữ: mảng đó phẳng, xếp theo
 * tầng rồi tới buồng, nên tầng 2 buồng 1 nằm ở vị trí 5.
 */
export function roomNameIndex(chapter) {
  return (((floorOf(chapter) - 1) % FLOORS.length) * CHAPTER_LEN) + slotOf(chapter);
}

/**
 * Trạng thái năm buồng của tầng chứa màn `current` (màn sắp chơi):
 *   done   — chương đã xong
 *   now    — chương đang gác
 *   locked — chưa tới
 */
export function floorRooms(current) {
  const chapter = chapterOf(current);
  const floor = floorOf(chapter);
  const first = (floor - 1) * CHAPTER_LEN + 1;
  return keysOfFloor(floor).map((key, i) => {
    const c = first + i;
    return {
      key,
      chapter: c,
      nameIndex: roomNameIndex(c),
      state: c < chapter ? "done" : c === chapter ? "now" : "locked",
    };
  });
}

// --------------------------------------------------------------- vẽ

/* Hình từng buồng — tranh vẽ, cắt từ một tấm 4x4 bằng tools/slice_rooms.py.
   Đường dẫn viết thẳng từng cái chứ KHÔNG ghép tên file lúc
   chạy: tools/build_single.mjs nhúng ảnh bằng cách dò chuỗi trong mã nguồn,
   mà chuỗi ghép thì nó không thấy — bản một file sẽ mất sạch hình. */
const ICON_URL = {
  gate: "assets/room-gate.png",
  eggs: "assets/room-eggs.png",
  fungus: "assets/room-fungus.png",
  candy: "assets/room-candy.png",
  queen: "assets/room-queen.png",
  nursery: "assets/room-nursery.png",
  well: "assets/room-well.png",
  granary: "assets/room-granary.png",
  aphids: "assets/room-aphids.png",
  winter: "assets/room-winter.png",
  roots: "assets/room-roots.png",
  spring: "assets/room-spring.png",
  crystal: "assets/room-crystal.png",
  vault: "assets/room-vault.png",
  heart: "assets/room-heart.png",
};

/* Tâm năm hốc buồng, đo trên chính ảnh nền bằng tools/measure_nest.py và ghi
   theo hệ toạ độ của viewBox (360x480, đúng tỉ lệ 3:4 của ảnh). Đổi ảnh nền
   thì phải đo lại và sửa bảng này. */
const ROOM_AT = [
  [89, 71],
  [273, 157],
  [93, 237],
  [273, 306],
  [179, 401],
];
const ICON = 52; // hốc hẹp nhất cao ~57 đơn vị, nên hình phải nhỏ hơn thế

/** Đèn treo ở buồng đã gác xong — dấu hiệu buồng an toàn. */
function lantern(x, y) {
  return (
    `<circle cx="${x}" cy="${y}" r="26" fill="url(#lampglow)"/>` +
    `<image href="assets/room-lantern.png" x="${x - 13}" y="${y - 16}" width="26" height="32"/>`
  );
}

/**
 * Vẽ mặt cắt tổ vào `container`. `names` là tên năm buồng theo ngôn ngữ đang
 * chọn, cùng thứ tự `rooms`.
 */
export function renderNest(container, rooms, names) {
  const out = [];
  rooms.forEach((room, i) => {
    const [cx, cy] = ROOM_AT[i];
    // Buồng đang gác có quầng ấm hắt ra sau hình, buồng chưa tới thì hình mờ
    // đi. Không vẽ thêm viền nào — hốc buồng đã có sẵn trong ảnh nền.
    if (room.state === "now") out.push(`<circle cx="${cx}" cy="${cy}" r="46" fill="url(#roomglow)"/>`);
    out.push(
      `<image href="${ICON_URL[room.key]}" x="${cx - ICON / 2}" y="${cy - ICON / 2}"` +
        ` width="${ICON}" height="${ICON}"${room.state === "locked" ? ' opacity="0.32"' : ""}/>`,
    );
    if (room.state === "done") out.push(lantern(cx + 40, cy - 22));
    out.push(
      `<text x="${cx}" y="${cy + 44}" text-anchor="middle" font-size="13" font-weight="700"` +
        ` fill="${room.state === "locked" ? "#b3a288" : "#fff6e6"}">${names[i]}</text>`,
    );
  });
  container.innerHTML = `<svg viewBox="0 0 360 480" aria-hidden="true">
<defs>
 <radialGradient id="lampglow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".6"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/></radialGradient>
 <radialGradient id="roomglow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".5"/><stop offset=".55" stop-color="#ffa63c" stop-opacity=".2"/><stop offset="1" stop-color="#ffa63c" stop-opacity="0"/></radialGradient>
 <filter id="labelshadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-color="#100a06" flood-opacity="0.95"/></filter>
</defs>
<image href="assets/nest-bg.png" x="0" y="0" width="360" height="480"/>
<g filter="url(#labelshadow)">${out.join("")}</g></svg>`;
}
