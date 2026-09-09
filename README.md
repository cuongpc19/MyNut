# My Nut

Game giải đố mới, lớn lên từ mã nguồn Ant Guard (thư mục `Colodoku`) nhưng
với luật lõi khác hẳn — **kiến gác kẹo**:

> Mỗi màu một kiến. Kẹo nào cũng phải có kiến đứng cạnh. Hai kiến không đứng cạnh nhau.

Không luật hàng, không luật cột, không con số trên ô. Kẹo là toàn bộ manh mối.

**Ghi chú bàn giao đầy đủ ở [CLAUDE.md](CLAUDE.md)**: bản đồ mã nguồn, quy
trình dựng lại kho level, số liệu đã đo, việc cần làm theo thứ tự, và các ràng
buộc. Đọc nó trước.

## Trạng thái

Luật mới đã có đủ lõi, bài hướng dẫn và kho level; việc còn lại là nối vào vòng
chơi chính.

- `src/candy.js` — luật, bộ sinh, bộ giải 3 bậc. `src/candyboard.js` — mô hình
  bàn cho vòng chơi.
- `src/candytutorial.js` — bài hướng dẫn 9 bước, kịch bản suy từ chính luật
  chơi. Chơi thử ở `candy-tutorial.html`.
- `data/candy-pools.json` — **hai bộ 60 màn**, ba màn đầu giống hệt nhau, từ màn
  4 một bộ nặng tay hơn một bộ. Chơi thử ở `candy-course.html`, dựng lại bằng
  `node tools/build_candy_pools.mjs`.
- `candy.html` — bàn nháp để thử biến thể luật (`exact`, `needy`, ba loại kiến).
- `index.html` — vẫn là game cũ (luật hàng/cột) với phần vỏ sẽ giữ lại: trang
  chủ tổ kiến, chương năm đêm, kẹo làm tiền tệ, âm thanh, hai ngôn ngữ.
  `src/progression.js` chưa đọc kho mới — đó là việc kế tiếp.

## Chạy

Cần một server tĩnh vì trang nạp module ES:

```bash
python -m http.server 8124
# http://localhost:8124/index.html          — game cũ
# http://localhost:8124/candy-tutorial.html — bài hướng dẫn luật mới
# http://localhost:8124/candy-course.html   — hai bộ level, chọn bộ và đêm
# http://localhost:8124/candy.html          — bàn nháp thử biến thể luật
```

Kiểm tra không cần trình duyệt:

```bash
node tools/candy_flow_test.mjs   # LUẬT MỚI: bàn dạy, nhịp dạy, và cả 120 màn trong kho
node tools/build_candy_pools.mjs # dựng lại data/candy-pools.json (~4 phút)
node tools/probe_candy.mjs       # luật mới: tỉ lệ sinh, số kẹo, độ khó, kiểm duy nhất
node tools/flow_test.mjs         # luật cũ: tutorial, bộ chọn màn, kho bàn, màn đặc biệt
node tools/smoke.mjs             # luật cũ: logic bàn cờ trên 100 bàn 9×9
node tools/build_single.mjs      # gói thành một file dist/ant-guard.html
```

## Chép từ Colodoku những gì, và cố ý bỏ những gì

Chép: `index.html`, `manifest.webmanifest`, `candy.html`, toàn bộ `src/`
(trừ thử nghiệm 3D), `assets/`, `data/pools.json`, `data/specials.json`,
`data/i18n/`, các tool còn dùng được, và `Manythings/` (ảnh gốc AI vẽ, không
vào git).

**Cố ý không chép**, để kho này sạch ngay từ commit đầu:

- Bộ level giải mã từ APK của Meowdoku (`data/classic-*.json`, `gc-*`,
  `lkstyle-*`, `onefish-*`, `sp*.json`, `data/raw/`, `data/index.json`) — dữ
  liệu có bản quyền, mỗi puzzle còn mang hash nhận diện. Game không đọc chúng;
  chỉ `lab.html` (trang phân tích, cũng không chép) cần tới.
- `data/reference/` — bản địa hoá gốc và hồ sơ hình dạng rút từ bank của họ.
  Vì thế `tools/generate_levels.mjs`, `build_pools.mjs`, `build_specials.mjs`,
  `pick_opening.mjs`, `pick_tutorial.mjs` cũng không chép — chúng cần hồ sơ
  ấy. Bộ sinh cho luật mới không cần: nó lấy lưới vùng có sẵn trong
  `data/pools.json`.
- File `.xapk`, bản ghi màn hình, `dist/`, lịch sử git.

`tools/smoke.mjs` đã sửa để lấy bàn từ `data/pools.json` thay vì bank cũ.
