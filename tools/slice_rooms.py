# Cắt tấm 4x4 thành 16 ảnh rời cho mặt cắt tổ: xén sát viền theo alpha, đệm
# thành hình vuông, hạ về 192px, ép bảng màu cho nhẹ.
import os
from PIL import Image

os.chdir(r"C:\CuongPC\Game\Colodoku")
SRC = "Manythings/ChatGPT Image 15_51_37 9 thg 9, 2026.png"
SIZE = 192
MARGIN = 0.05
COLORS = 128

# Thứ tự đọc trái sang phải, trên xuống dưới — khớp đúng prompt đã đặt.
NAMES = [
    "gate", "eggs", "fungus", "candy",
    "queen", "nursery", "well", "granary",
    "aphids", "winter", "roots", "spring",
    "crystal", "vault", "lantern", "heart",
]

sheet = Image.open(SRC).convert("RGBA")
cw, ch = sheet.width // 4, sheet.height // 4
total = 0
for i, name in enumerate(NAMES):
    r, c = divmod(i, 4)
    cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    # Cắt alpha rất nhạt: viền mờ còn sót làm bbox rộng ra và ảnh bị thu nhỏ.
    a = cell.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    box = a.getbbox()
    if not box:
        print("bỏ qua ô rỗng:", name)
        continue
    cell = cell.crop(box)
    side = int(max(cell.size) * (1 + 2 * MARGIN))
    pad = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    pad.alpha_composite(cell, ((side - cell.width) // 2, (side - cell.height) // 2))
    out = pad.resize((SIZE, SIZE), Image.LANCZOS).quantize(colors=COLORS, method=Image.FASTOCTREE)
    path = f"assets/room-{name}.png"
    out.save(path, optimize=True)
    kb = os.path.getsize(path) / 1024
    total += kb
    print(f"{path:32} {cell.size[0]:4}x{cell.size[1]:<4} -> {kb:5.1f} KB")
print(f"tổng {total:.1f} KB")
