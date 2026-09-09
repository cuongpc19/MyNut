# Đo tâm năm hốc buồng trên tranh nền mặt cắt tổ, in ra đúng dạng bảng ROOM_AT
# trong src/nest.js. Chạy lại mỗi khi đổi tranh nền.
#
#   python tools/measure_nest.py "Manythings/<tên tranh>.png"
#
# Cách dò: hốc buồng vừa TỐI vừa MỊN, còn đất thì lấm tấm sỏi nên độ lệch chuẩn
# cục bộ cao — lọc theo màu thôi không tách được, vì đất ở đáy tranh cũng tối
# ngang hốc. Mỗi hốc dò trong một cửa sổ riêng cho khỏi dính vào nhau.
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

os.chdir(os.path.join(os.path.dirname(__file__), ".."))
src = sys.argv[1] if len(sys.argv) > 1 else "assets/nest-bg.png"

# Cửa sổ dò cho từng buồng, theo tỉ lệ (x0, x1, y0, y1). Chỉ cần bao trọn hốc
# và không chạm hốc bên cạnh; bố cục tranh có sai lệch ít nhiều vẫn chạy được.
WINDOWS = [
    (0.04, 0.46, 0.09, 0.26),
    (0.55, 0.98, 0.25, 0.40),
    (0.04, 0.46, 0.38, 0.58),
    (0.55, 0.98, 0.56, 0.72),
    (0.28, 0.72, 0.755, 0.925),
]
VIEW_W, VIEW_H = 360, 480  # hệ toạ độ trong src/nest.js


def box_mean(x, k):
    p = np.pad(x, k, mode="edge")
    c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    s = 2 * k + 1
    return (c[s:, s:] - c[:-s, s:] - c[s:, :-s] + c[:-s, :-s]) / (s * s)


def largest_blob(mask):
    h, w = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    best = None
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            pts = []
            while q:
                y, x = q.popleft()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            ys = [p[0] for p in pts]
            xs = [p[1] for p in pts]
            cand = (len(pts), min(xs), max(xs), min(ys), max(ys))
            if best is None or cand[0] > best[0]:
                best = cand
    return best


image = Image.open(src).convert("RGB")
grey = np.asarray(image).astype(float).mean(2)
H, W = grey.shape
mean = box_mean(grey, 9)
std = np.sqrt(np.maximum(box_mean(grey ** 2, 9) - mean ** 2, 0))
smooth_dark = (mean < 62) & (std < 5.5)
smooth_dark = np.asarray(
    Image.fromarray((smooth_dark * 255).astype(np.uint8))
    .filter(ImageFilter.MinFilter(9))
    .filter(ImageFilter.MaxFilter(9))
) > 127

print(f"{src}  {W}x{H}  (ti le {W / H:.3f}, can 0.750)")
print("const ROOM_AT = [")
for fx0, fx1, fy0, fy1 in WINDOWS:
    x0, x1, y0, y1 = int(W * fx0), int(W * fx1), int(H * fy0), int(H * fy1)
    blob = largest_blob(smooth_dark[y0:y1, x0:x1])
    if not blob:
        sys.exit("khong tim thay hoc buong trong mot cua so — kiem lai WINDOWS")
    _, bx0, bx1, by0, by1 = blob
    cx = (x0 + (bx0 + bx1) / 2) / W * VIEW_W
    cy = (y0 + (by0 + by1) / 2) / H * VIEW_H
    print(f"  [{round(cx)}, {round(cy)}],"
          f"  // hoc rong {(bx1 - bx0) / W * VIEW_W:.0f}, cao {(by1 - by0) / H * VIEW_H:.0f}")
print("];")
