# Chuẩn bị ảnh nền mặt cắt tổ cho trang chủ.
#
# Nguồn là một tranh 3:4 do AI vẽ (xem README), trong đó năm hốc buồng để trống
# và một trục hầm chạy dọc giữa. Ở đây chỉ hạ kích thước và ép bảng màu; toạ độ
# năm hốc thì đo bằng tools/measure_nest.py rồi ghi thẳng vào src/nest.js.
import os
import sys
from PIL import Image

os.chdir(os.path.join(os.path.dirname(__file__), ".."))

SRC = sys.argv[1] if len(sys.argv) > 1 else "Manythings/ChatGPT Image 16_01_27 9 thg 9, 2026.png"
OUT = "assets/nest-bg.png"
WIDTH = 720          # chỗ vẽ to nhất ~546px CSS, nên 720 là đủ cho màn hình 1.3x
COLORS = 96          # tranh đất nâu ít màu, 96 đã không thấy dải màu

src = Image.open(SRC).convert("RGB")
if abs(src.width / src.height - 0.75) > 0.01:
    sys.exit(f"ảnh phải đúng tỉ lệ 3:4, đang là {src.width}x{src.height}")

out = src.resize((WIDTH, WIDTH * 4 // 3), Image.LANCZOS)
out = out.quantize(colors=COLORS, method=Image.FASTOCTREE)
out.save(OUT, optimize=True)
print(f"{OUT}  {out.size[0]}x{out.size[1]}  {os.path.getsize(OUT) / 1024:.0f} KB")

# Màu mép dưới — style.css lấy đúng màu này làm nền khối đất, để phần đất kéo
# dài dưới ảnh không lộ ra một đường cắt ngang.
bottom = src.crop((0, src.height - 12, src.width, src.height)).resize((1, 1), Image.LANCZOS)
print("màu mép dưới: #%02x%02x%02x" % bottom.getpixel((0, 0)))
