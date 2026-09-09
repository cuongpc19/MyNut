// Âm thanh: tổng hợp bằng Web Audio ngay lúc phát, không có file — nên không
// mang theo byte nào của Meowdoku và không phải tải gì thêm.
//
//   tick  — đánh / gỡ ✕: một cái gõ khô, rất ngắn
//   pop   — đặt đúng kiến: hai nốt đi lên, tròn tiếng
//   buzz  — đặt sai: tiếng rè trầm
//
// Trình duyệt chỉ cho mở AudioContext sau một cử chỉ của người dùng, nên
// context được tạo lười ở lần phát đầu tiên (luôn nằm trong một sự kiện bấm).

const SOUND_KEY = "colodoku.sound.v1";

let context = null;
let enabled = true;
try {
  enabled = localStorage.getItem(SOUND_KEY) !== "off";
} catch {
  /* không đọc được thì cứ bật */
}

function ctx() {
  if (!context) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    context = new AC();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

/** Một nốt: dạng sóng, tần số đầu → cuối, dài bao lâu, to bao nhiêu. */
function tone({ type = "sine", from, to = from, duration, gain = 0.2, at = 0 }) {
  const ac = ctx();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Tiếng chạm khi đánh / gỡ ✕.
 *
 * Không dùng nhiễu nữa: đo lại thì nhiễu qua bandpass 600 Hz vẫn còn 14% năng
 * lượng trên 2 kHz — bộ lọc chỉ dốc 12 dB mỗi quãng tám nên không cắt nổi đuôi
 * cao, và chính đuôi đó nghe chói. Sine thì không có hoạ âm nào, nên không thể
 * chói: một nốt trầm tụt xuống, tắt rất nhanh, nghe như ngón tay chạm mặt trống.
 */
function click() {
  // Đừng hạ xuống dưới ~350 Hz: loa laptop và loa điện thoại cắt gần hết dải
  // trầm, để 190 Hz thì tiếng biến mất hẳn (đúng lỗi đã gặp) — trong khi tiếng
  // đặt kiến ở 520-880 Hz vẫn nghe rõ. Nốt chính đặt quanh 500 Hz là chỗ loa
  // nhỏ kêu tốt nhất, mà sine thì không có hoạ âm nên vẫn không thể chói.
  tone({ from: 500, to: 380, duration: 0.07, gain: 0.2 });
  tone({ from: 250, duration: 0.05, gain: 0.07 }); // thân tiếng, nghe được trên loa rời
}

export const sound = {
  get enabled() {
    return enabled;
  },
  set enabled(value) {
    enabled = Boolean(value);
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    } catch {
      /* không nhớ được thì thôi */
    }
  },
  tick() {
    if (enabled) click();
  },
  pop() {
    if (!enabled) return;
    tone({ from: 520, to: 660, duration: 0.09, gain: 0.18 });
    tone({ from: 780, to: 880, duration: 0.14, gain: 0.16, at: 0.07 });
  },
  buzz() {
    if (!enabled) return;
    tone({ type: "sawtooth", from: 170, to: 120, duration: 0.2, gain: 0.12 });
  },
  /** Chuỗi đặt đúng: rải hợp âm đi lên, bậc càng cao càng nhiều nốt. */
  combo(tier) {
    if (!enabled) return;
    const notes = [523, 659, 784, 1047, 1319, 1568]; // C5 E5 G5 C6 E6 G6
    const count = Math.min(notes.length, tier + 1);
    for (let i = 0; i < count; i++)
      tone({ type: "triangle", from: notes[i], duration: 0.16, gain: 0.14, at: i * 0.055 });
  },
  /**
   * Gỡ được một ngách khó: cùng hợp âm đi lên nhưng rải chậm hơn cho nghe ra
   * từng nốt, rồi đọng lại ở quãng tám trên — nghe như một câu kết chứ không
   * phải một tiếng "tinh" như combo.
   */
  eureka() {
    if (!enabled) return;
    const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
    for (let i = 0; i < notes.length; i++)
      tone({ type: "triangle", from: notes[i], duration: 0.22, gain: 0.15, at: i * 0.075 });
    tone({ type: "triangle", from: 1568, duration: 0.55, gain: 0.13, at: 0.36 }); // G6 ngân
    tone({ type: "sine", from: 2093, duration: 0.45, gain: 0.06, at: 0.39 });     // C7 lấp lánh, rất nhẹ
  },
  /**
   * Một viên kẹo rơi vào kho: tiếng "tinh" rất ngắn, cao dần theo viên thứ mấy
   * nên ba viên liên tiếp nghe thành một câu đi lên chứ không phải ba tiếng
   * giống hệt nhau.
   */
  candy(index = 0) {
    if (!enabled) return;
    const notes = [988, 1175, 1397, 1568]; // B5 D6 F6 G6
    tone({ type: "triangle", from: notes[Math.min(index, notes.length - 1)], duration: 0.16, gain: 0.12 });
  },
  /**
   * Khoảnh khắc cả đàn kiến cảm ơn: một câu kèn ngắn — ba nốt nảy rồi mở ra
   * hợp âm trưởng ngân dài. Dài hơn eureka vì nó đóng lại cả một chặng, không
   * phải một nước đi.
   */
  fanfare() {
    if (!enabled) return;
    const lead = [784, 784, 1047]; // G5 G5 C6, nhịp kèn hiệu
    lead.forEach((hz, i) =>
      tone({ type: "triangle", from: hz, duration: 0.14, gain: 0.16, at: i * 0.13 }));
    // Hợp âm Đô trưởng đọng lại, mỗi nốt vào lệch một chút cho nghe ra bề dày.
    [1047, 1319, 1568].forEach((hz, i) =>
      tone({ type: "triangle", from: hz, duration: 0.9, gain: 0.11, at: 0.42 + i * 0.04 }));
    tone({ type: "sine", from: 523, duration: 0.95, gain: 0.09, at: 0.42 }); // C5 làm nền
  },
};
