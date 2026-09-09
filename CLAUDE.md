# My Nut — ghi chú bàn giao cho phiên Claude

Đọc hết file này trước khi sửa gì. Nó ghi lại luật đã chốt, mã nào thuộc luật
cũ, mã nào thuộc luật mới, và quy trình dựng lại kho level. Số liệu trong đây
đo được thật, không phải ước lượng.

## 1. Bối cảnh

Kho này chép từ dự án `C:\CuongPC\Game\Colodoku` (game Ant Guard, luật kiểu
Star Battle / LinkedIn Queens) ngày 2026-09-09. Chủ dự án quyết định làm
**một game mới** với luật lõi khác hẳn, giữ lại phần vỏ: trang chủ tổ kiến,
chương 5 đêm, kẹo làm tiền tệ, âm thanh, hai ngôn ngữ, cách thao tác trên bàn.

Luật mới được chọn sau khi thử và bỏ ba hướng khác (bàn 3D, mặt tiền gấp, số
đếm kiểu dò mìn). Lý do bỏ: hai hướng đầu chỉ đổi cách nhìn mà làm khó đọc
hơn; hướng số đếm thì xấu. Đừng đề xuất lại ba hướng đó.

## 2. Luật đã chốt — "kiến gác kẹo"

> Mỗi màu một kiến. Kẹo nào cũng phải có kiến đứng cạnh. Hai kiến không đứng cạnh nhau.

- "Đứng cạnh" = 8 ô quanh (kể cả chéo). Kiến không đứng lên ô kẹo.
- **Không** luật hàng, **không** luật cột, **không** con số trên ô. Kẹo là manh mối duy nhất.
- Kiến **không** bắt buộc phải có kẹo bên cạnh. Chủ dự án chọn thế vì bàn khó
  hơn và không bị ràng thêm — đã đo, xem §4.
- Bàn không cần vuông, số vùng không cần bằng cạnh bàn (hiện tại vẫn dùng
  lưới vuông n×n với n vùng vì lấy lưới từ kho cũ).

Trong `src/candy.js` còn hai biến thể **chưa dùng**, giữ làm nấc khó về sau:
`mode: "exact"` (mỗi viên kẹo có ĐÚNG một kiến — thêm một phép suy luận) và
`needy: true` (kiến nào cũng phải có kẹo — bàn dễ đi). `mixed: true` (ba loại
kiến với tầm gác khác nhau) cũng có, nhưng hình dấu loại kiến hiện xấu, chưa
duyệt.

Thao tác trên bàn giữ nguyên game cũ: bấm một lần = loại ô (ô "tắt đèn",
`opacity .28`, không vẽ ✕), bấm đúp = đặt kiến (tự tắt đèn các ô bị loại theo),
vuốt qua nhiều ô = loại hàng loạt. Chủ dự án đặc biệt muốn giữ cảm giác vuốt.

## 3. Bản đồ mã nguồn

| File | Thuộc | Ghi chú |
|---|---|---|
| `candy.html` | **luật mới** | Bản chơi thử hoàn chỉnh: sinh bàn tại chỗ từ `pools.json`, gợi ý, đáp án, các nút bật biến thể. Chưa có tutorial, chưa nối tiến trình. |
| `src/candy.js` | **luật mới** | Luật, bộ sinh, vá cho duy nhất, vét cạn kiểm, bộ giải 3 bậc. Không phụ thuộc gì ngoài `unpackRegions` của `puzzle.js`. |
| `src/candyboard.js` | **luật mới** | Mô hình bàn thay `puzzle.js`: `CandyPuzzle` + `CandyBoard`, giữ nguyên bề mặt cũ (`regionAt`, `conflicts`, `isSolved`…) nên `BoardView` dùng lại được. `blockedCells()` là chỗ duy nhất biết luật tắt đèn. |
| `src/candytutorial.js` | **luật mới** | Bài hướng dẫn 9 bước, suy kịch bản từ luật chứ không ghi cứng toạ độ. Cùng API với `tutorial.js` cũ. |
| `src/candylevels.js` | **luật mới** | Bàn hướng dẫn đã chọn + bảng màu. |
| `candy-tutorial.html` | **luật mới** | Chơi thử bài hướng dẫn bằng đúng `BoardView` và `style.css` thật. `?step=n` nhảy tới bước n, `?lang=en\|vi` đổi tiếng. |
| `candy-course.html` | **luật mới** | Chơi thử hai bộ level: chọn bộ, chọn đêm, gợi ý, đáp án. |
| `data/candy-pools.json` | **dữ liệu mới** | Hai bộ 60 màn (xem §4). |
| `tools/build_candy_pools.mjs` | luật mới | Dựng `candy-pools.json`. |
| `tools/pick_candy_tutorial.mjs` | luật mới | Chọn bàn hướng dẫn. |
| `tools/candy_flow_test.mjs` | kiểm luật mới | Bàn dạy, kịch bản dạy, chơi giả trọn bài, và toàn bộ kho màn. |
| `tools/probe_candy.mjs` | luật mới | Đo tỉ lệ sinh, số kẹo, độ khó, kiểm duy nhất trên lưới thật. |
| `index.html`, `src/game.js` | luật cũ + vỏ | Vòng chơi chính. Lõi bàn cờ vẫn là luật hàng/cột — **phải thay**. |
| `src/puzzle.js`, `src/solver.js` | luật cũ | Mô hình bàn và bộ giải 5 bậc của luật cũ. Giữ `unpackRegions`/`packRegions`; phần còn lại thay bằng `candy.js`. |
| `src/boardview.js` | dùng chung | Vẽ lưới DOM, thao tác tay, hiệu ứng. Đã biết vẽ kẹo (`.cell.has-candy`, thêm `.guarded` khi có kiến cạnh) và hỏi `board.blockedCells()` trước khi tự tắt đèn; bàn cũ không có hàm đó nên rơi về `legacyBlocked()`. Nhờ vậy hai lõi luật chạy chung một file. |
| `src/tutorial.js`, `src/levels.js` | luật cũ | 9 bước hướng dẫn và hai màn mở đầu của luật cũ. Bản mới nằm ở `candytutorial.js`/`candylevels.js`; hai file này còn sống chỉ vì `index.html` chưa chuyển. |
| `src/progression.js` | luật cũ + vỏ | Chọn màn theo số màn (cỡ, bậc), lưu tiến trình, kẹo, booster. Giữ khung; đổi nguồn bàn và cách chọn. |
| `src/nest.js` | vỏ | Trang chủ mặt cắt tổ: 3 tầng × 5 buồng, `CHAPTER_LEN = 5`. Giữ nguyên. |
| `src/strings.js`, `data/i18n/*.json` | vỏ | Bảng chữ Anh/Việt, **viết mới, không phái sinh từ Meowdoku** — phải giữ như vậy. Câu giải thích gợi ý (`explain()`) gắn với bộ giải cũ, cần viết lại. |
| `src/sound.js` | vỏ | Web Audio, không file. Giữ. |
| `src/style.css` | vỏ | Bảng màu tối, 12 màu vùng `--g0..--g11`, cỡ bàn theo `--board`. Giữ. |
| `data/pools.json` | dữ liệu | Kho lưới vùng tự sinh (xem §4). |
| `data/specials.json` | dữ liệu | 14 màn đặc biệt vẽ hình (thiếu màn 456). |
| `assets/` | hình | Kiến (`ant-256`, `ant-happy-512`, `ant-sad-512`), kẹo (`candy-192`, `candy-spark-192`, `candy-gone-192`), 16 hình buồng, nền tổ, logo. |
| `tools/build_single.mjs` | build | Gói thành một file, nhúng ảnh và dữ liệu. Chỉ dò chuỗi `assets/x.png` viết THẲNG trong mã — đừng ghép đường dẫn bằng template. |
| `tools/flow_test.mjs`, `tools/smoke.mjs` | kiểm luật cũ | Chạy được, nhưng kiểm luật cũ. Viết lại khi thay lõi. |
| `tools/*.py` | hình | Cắt tấm sprite, chuẩn bị nền tổ, đo tâm buồng. |

## 4. Dựng lại level — quy trình

### Nguồn lưới vùng

`data/pools.json`: object khoá `"{cỡ}x{bậc cũ}"`, mỗi khoá là mảng bản ghi
`{ m, s, r, st, rk, ch }`. Chỉ cần `m` — lưới vùng nén base36, bung bằng
`unpackRegions(m, size)` (hoặc `regionsFromRecord(record, size)` trong
`candy.js`). `s`, `r`, `st`, `rk` là lời giải và độ khó **theo luật cũ**, bỏ qua.

| Cỡ | Số lưới (theo bậc cũ 1 / 2 / 3 / 4 / 5) |
|---|---|
| 4×4 | 16 / 12 |
| 5×5 | 20 / 16 / 12 |
| 6×6 | 30 / 30 / 24 / 16 |
| 7×7 | 30 / 30 / 30 / 24 |
| 8×8 | 24 / 30 / 30 / 30 |
| 9×9 | 16 / 30 / 30 / 24 |
| 10×10 | 15 / 40 / 40 / 30 / 16 |

`data/specials.json`: object khoá số màn → `{ size, record, pic }`; `record.m`
là lưới vùng vẽ hình, `record.cm` gán màu riêng từng vùng, `pic` là danh sách
vùng tạo nên hình. Dùng được làm lưới cho luật mới y như pools.

Lưới trong hai file này do bộ sinh của dự án cũ tạo ra (có tham chiếu thống
kê hình dạng của game gốc, nhưng bản thân lưới là của mình). Nếu cần thêm lưới
mới thì phải viết bộ nuôi vùng riêng — `growRegions` cũ không được chép sang
vì nó cần `data/reference/shape-profile.json` (không chép, xem §6).

### Sinh một màn

```js
import { makePuzzle, makeBoard, search, regionsFromRecord } from "./src/candy.js";
const regions = regionsFromRecord(record, size);
const level = makePuzzle(regions, seed, { mode: "atLeast", needy: false });
// null = mẻ hỏng, đổi seed thử lại. Thành công thì:
// { h, w, regions, types, ants, candies, mode, needy, rating, steps, counts }
//   ants[g]  = chỉ số ô (r*w + c) của kiến vùng g — lời giải
//   candies  = mảng chỉ số ô có kẹo
//   rating   = 1..3, steps = số bước suy luận, counts = [số bước bậc 1, 2, 3]
```

Bên trong `makePuzzle`: `placeAnts` rải kiến hợp luật 1 và 3 → `addCandies`
rải kẹo từng viên, mỗi viên phá đúng lời giải đối thủ đang tìm được, cho tới
khi `search` không còn đối thủ (tối đa 40 viên, quá thì bỏ mẻ) → `rate` chấm
bằng bộ giải 3 bậc; bí thì bỏ mẻ (bàn duy nhất nhưng vượt thang).

Ba bậc của bộ giải (`Solve`, `nextDeduction`):
1. Kẹo chỉ còn một vùng với tới → kiến vùng đó phải đứng trong tầm kẹo.
2. Kiến đã chắc chỗ → vùng khác không được đứng cạnh nó (và ở `exact`: vùng
   đã chắc chắn gác kẹo nào thì vùng khác phải tránh viên đó).
3. Đặt thử một ô, lan truyền bậc 1–2 thấy bế tắc thì loại.

Thang này thô hơn thang 5 bậc cũ. Nếu cần chia độ khó mịn hơn cho 5 đêm một
chương, mở rộng ở đây (khoá tập hợp, chuỗi giả định) — giữ nguyên tắc **mọi
bước đều là suy luận đúng**, vì `makePuzzle` dựa vào đó: giải trọn bằng suy
luận nghĩa là duy nhất.

### Kiểm duy nhất độc lập

```js
const B = makeBoard(level.regions, level.types);
search(B, level.candies, 2, null, level.mode, level.needy).length === 1
```

Luôn chạy bước này trước khi ghi vào kho. Ở dự án cũ từng có một quy tắc suy
luận sai làm bộ sinh phát ra bàn hai lời giải, và chỉ vét cạn mới bắt được.

### Số liệu đo được (40 lưới mỗi cỡ, luật chốt)

| Cỡ | Sinh được | Kẹo / vùng | Độ khó R1 / R2 / R3 | Vét cạn |
|---|---|---|---|---|
| 6×6 | 19/40 | 1,42 | 0 / 16 / 3 | 15/15 duy nhất |
| 7×7 | 22/40 | 1,64 | 3 / 14 / 5 | 15/15 |
| 8×8 | 23/40 | 1,86 | 1 / 16 / 6 | 15/15 |
| 9×9 | 31/40 | 2,01 | 7 / 21 / 3 | 15/15 |

Mỗi mẻ 1–30 ms. Vì một lưới có thể sinh nhiều màn khác nhau bằng nhiều seed,
kho không bị giới hạn bởi số lưới: muốn 200 màn 7×7 thì chạy 200 seed trên 30
lưới. Lệnh đo: `node tools/probe_candy.mjs 40`.

### Kho level — ĐÃ DỰNG

`data/candy-pools.json`, dựng bằng `node tools/build_candy_pools.mjs` (khoảng
bốn phút). Hai bộ 60 màn chạy song song, **ba màn đầu giống hệt nhau**:

```json
{ "sharedLevels": 3,
  "sets": { "easy": [ { "n": 1, "size": 4, "m": "…", "k": [3,11], "a": [5,14],
                        "r": 1, "st": 4, "counts": [4,0,0], "seed": 360939 } ], "hard": [ … ] } }
```

Hai bộ KHÔNG dùng hai bảng nấc khó riêng. Chỉ có một đường cong, bộ `hard` chạy
nhanh hơn trên chính đường ấy: màn thứ n của nó lấy nấc của màn n×1,4 bên bộ
`easy`. "Khó hơn" vì thế là một con số đo được (sớm hơn bao nhiêu màn) chứ không
phải hai bảng phải cân bằng bằng tay. Trong cùng một nấc, `hard` rút bàn ở phân
vị sức nghĩ cao, `easy` rút ở phân vị thấp; phân vị trôi dần lên theo số màn để
đoạn đuôi (đã kịch cỡ 10×10, hết chỗ tăng cỡ) không đi ngang.

"Sức nghĩ" = `số bước bậc 1 + 2×bậc 2 + 6×bậc 3`. Bước bậc 3 là "đặt thử rồi
thấy bế tắc", nặng hơn hẳn. Bộ sinh bỏ bàn có quá 5 bước bậc 3: không chặn thì
bộ `hard` nhặt phải bàn 35 bước bậc 3 — khó vì phải mò, không phải vì suy luận.

Đo được trên bộ đã dựng:

| Bộ | Cỡ bàn | R1 / R2 / R3 | Bước suy luận | Kẹo | Sức nghĩ |
|---|---|---|---|---|---|
| easy | 4→10 | 6 / 40 / 14 | 10,9 | 14,7 | 14,3 |
| hard | 4→10 | 4 / 39 / 17 | 13,7 | 16,0 | 21,5 |

Cả hai đường cong lên đơn điệu (trung bình trượt 5 màn không tụt quá 1 điểm).
Từng màn đã vét cạn kiểm duy nhất hai lần: một lần trong bộ sinh trước khi ghi,
một lần nữa trong `tools/candy_flow_test.mjs`.

Còn thiếu: màn đặc biệt vẽ hình (sinh kẹo trên lưới `specials.json`, giữ `cm`
và `pic`) chưa dựng cho luật mới.

## 5. Nối luật mới vào game chính — thứ tự nên làm

Bước 1, 2, 3, 5 đã xong (xem §3). Còn lại: 4 (gợi ý trong màn chơi), 6
(`progression.js`), 7 (phần còn lại), 8 (chữ ở vỏ).

1. ~~Kho `candy-pools.json` + script dựng (§4).~~ **Xong.**
2. ~~Mô hình bàn mới thay `puzzle.js`/`Board`~~ — **xong**, ở `src/candyboard.js`: trạng thái ô (trống / tắt / kiến), xung đột (hai kiến cùng vùng, hai kiến cạnh nhau), điều kiện thắng (đủ kiến, không xung đột, kẹo nào cũng có kiến cạnh).
3. ~~`boardview.js`~~ — **xong**: vẽ kẹo (`candy-192` → `candy-spark-192` khi có kiến cạnh), kiến; tự tắt đèn khi đặt kiến = cùng vùng + 8 ô quanh (không còn hàng/cột). Giữ hiệu ứng và bàn tay hướng dẫn.
4. Gợi ý: nối `nextDeduction` của `candy.js`; viết câu giải thích mới trong `en.json`/`vi.json` (giọng "lính gác", như tutorial hiện có).
5. ~~Tutorial: viết lại 9 bước theo ba luật mới.~~ **Xong** — `src/candytutorial.js`, bàn 5×5 do `tools/pick_candy_tutorial.mjs` chọn. Nhịp mới: đặt con đầu ở màu một ô → vuốt quanh nó → thẻ luật kẹo → một viên kẹo chỉ còn một chỗ gác → nhấn nốt màu đó → vuốt lần hai → con thứ ba → tự giải. Chữ nằm ở nhóm khoá `guard.*` trong `data/i18n/`.
6. `progression.js`: đọc `candy-pools.json` thay `pools.json`, chọn bộ `easy`/`hard` và ghi lựa chọn đó vào tiến trình, giữ chương/đêm/kẹo/booster. **Chưa làm** — đây là việc kế tiếp.
7. `tools/candy_flow_test.mjs` đã thay `flow_test.mjs` cho luật mới. Còn: bản smoke cho luật mới, và `build_single.mjs` nhúng thêm `candy-pools.json`.
8. Đổi chữ ở trang chủ, cách chơi, manifest, tên game khi đã chọn tên.

Kiểm mỗi bước bằng lệnh ở §7. Chủ dự án muốn xem ảnh chụp trước khi coi một
thay đổi giao diện là xong.

## 6. Ràng buộc bản quyền — không thương lượng

- Kho này **cố ý không chứa** bộ level giải mã từ APK của Meowdoku, `data/raw/`,
  `data/reference/`, file `.xapk`. Đừng chép chúng sang, đừng tham chiếu đường
  dẫn sang thư mục Colodoku trong mã hay tool.
- Chữ trong `data/i18n/` là viết mới. Không "sửa nhẹ" bản dịch của họ — bản
  sửa nhẹ vẫn là bản phái sinh.
- `Manythings/` (ảnh gốc AI vẽ) và `dist/` nằm ngoài git (`.gitignore`).
- Kho đã ở GitHub: `cuongpc19/MyNut`, nhánh `main`. Chủ dự án tự quyết công khai hay riêng tư.

## 7. Cách làm việc trong kho này

- Chú thích mã, thông điệp commit, README: tiếng Việt, không emoji, giải thích *vì sao* chứ không kể lại *cái gì*.
- Server: `python -m http.server 8124` (cổng 8123 là của Colodoku). Trang nạp module ES nên mở bằng `file://` sẽ hỏng.
- Kiểm luật MỚI: `node tools/candy_flow_test.mjs` (mong "tuyến chơi: 0 lỗi"; kiểm cả bàn dạy lẫn 120 màn trong kho). Chơi thử: `candy-tutorial.html`, `candy-course.html`, `candy.html`.
- Kiểm luật cũ, không cần trình duyệt: `node tools/flow_test.mjs` (mong "tuyến chơi: 0 lỗi"; dòng "màn đặc biệt chưa dựng: 456" là bình thường), `node tools/smoke.mjs`, `node tools/probe_candy.mjs 40`, `node tools/build_single.mjs`.
- Chụp màn hình / bắt lỗi JS: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=4000 --window-size=600,860 --screenshot=out.png URL`; `--dump-dom` để đọc trạng thái. Headless không thu nhỏ dưới ~500 px bề ngang — muốn kiểm cỡ điện thoại thì nhúng trang vào `<iframe>` 390–461 px trong một trang thử. Thao tác thử bằng `PointerEvent` bắn vào phần tử, nhớ bắn vào phần tử **đang có trong trang** vì vẽ lại là thay phần tử.
- Patch Python dài: ghi ra file rồi chạy bằng đường dẫn; heredoc lớn trong Bash từng đứt giữa chừng. In tiếng Việt từ Python cần `PYTHONIOENCODING=utf-8`.
- Thay đổi giao diện: đo trên ảnh chụp thật ở vài cỡ cửa sổ, không suy công thức bằng tay — cỡ chữ và lề đều lấy từ cùng biến `--board`/`--home`.

## 8. Quyết định còn mở

- Tên game (thư mục là "My Nut", chưa phải tên).
- Cỡ bàn theo chương, số bậc khó cần thiết, có dùng `exact` làm nấc khó về sau không.
- Màn đặc biệt 456 chưa dựng (14/15); màn đặc biệt cho luật mới cũng chưa dựng.
- Chọn bộ level nào: `easy` hay `hard`, hay cho người chơi tự chọn, hay dò theo
  cách họ chơi. Hai bộ dựng sẵn chính là để trả lời câu này bằng người thật.
- Ba loại kiến: giữ hay bỏ. Nếu giữ thì cần ba hình kiến riêng, không dùng dấu ký tự.
