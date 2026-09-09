// Chữ hiện trên màn hình.
//
// Bản dịch nằm ở `data/i18n/<mã>.json`, mỗi ngôn ngữ một file, nạp theo yêu cầu
// — vào game chỉ tải đúng thứ tiếng đang chọn. Mặc định là tiếng Anh.
//
// Phần lớn câu chữ lấy nguyên bản địa hoá của Meowdoku 1.15.0, trích từ APK
// bằng `tools/extract_translations.py` (xem `data/reference/meowdoku-i18n.json`).
// Chỗ nào Colodoku tự thêm, hoặc phải đổi "mèo" thành "kiến", thì dịch tay.
//
// Khoá trong file JSON viết phẳng theo kiểu `tut.gotIt`; ở đây nó được bung
// thành object lồng nhau, còn câu nào có chỗ trống `{0}` thì thành hàm — nhờ
// vậy phía dùng cứ viết `T.play`, `T.playOn(3)`, `T.tut.gotIt` như bình thường.

export const DEFAULT_LOCALE = "en";

// Chỉ hai thứ tiếng tự viết. 15 bản dịch còn lại phái sinh từ bản địa hoá của
// Meowdoku nên đã chuyển sang data/reference/i18n-derived/ — muốn phát hành
// thêm ngôn ngữ thì dịch mới từ data/i18n/en.json.
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "vi", name: "Tiếng Việt" },
];

const STORE_KEY = "colodoku.locale.v1";

/**
 * Bảng chữ đang dùng. Luôn là **cùng một object** từ đầu đến cuối phiên chơi —
 * đổi ngôn ngữ chỉ thay ruột nó — nên các module khác cứ `import { T }` một lần
 * rồi đọc thẳng, không cần nạp lại.
 */
export const T = {};

let current = DEFAULT_LOCALE;

/** Câu có `{0}` thì thành hàm; số thứ tự lặp lại được ("{0} vùng trên {0} hàng"). */
function compile(text) {
  if (!/\{\d\}/.test(text)) return text;
  return (...args) => text.replace(/\{(\d)\}/g, (_, index) => args[Number(index)]);
}

/** Bung khoá phẳng `a.b` thành object lồng nhau, mảng thì giữ nguyên mảng. */
function expand(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let node = out;
    while (parts.length > 1) node = node[parts.shift()] ??= {};
    node[parts[0]] = Array.isArray(value) ? value.map(compile) : compile(value);
  }
  return out;
}

// Địa chỉ tính theo chính file này chứ không theo trang đang mở, để index.html,
// lab.html hay một trang nằm thư mục khác đều trỏ đúng chỗ.
const localeURL = (code) => new URL(`../data/i18n/${code}.json`, import.meta.url);

/** Đọc file ngôn ngữ ở dạng khoá phẳng, chưa bung. */
async function fetchLocale(code) {
  // Bản một file (tools/build_single.mjs) nhúng sẵn bảng chữ vào global.
  if (globalThis.__COLODOKU_I18N?.[code]) return globalThis.__COLODOKU_I18N[code];
  // Chạy bằng Node (tools/flow_test.mjs chẳng hạn) thì không có fetch cho file://,
  // đọc thẳng đĩa. Nhánh này không bao giờ chạy trên trình duyệt.
  if (typeof document === "undefined") {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(localeURL(code), "utf8"));
  }
  const response = await fetch(localeURL(code));
  if (!response.ok) throw new Error(`${code}: HTTP ${response.status}`);
  return response.json();
}

// Bảng tiếng Anh giữ lại làm lưới đỡ: khoá nào thứ tiếng kia chưa dịch thì lấy
// tạm câu tiếng Anh. Thà lộ một dòng chưa dịch còn hơn hiện ô trống — hoặc vỡ,
// vì có khoá là hàm và phía dùng sẽ gọi `T.wipeLosing(...)`.
let fallback = null;

async function loadTable(code) {
  const flat = await fetchLocale(code);
  if (code === DEFAULT_LOCALE) fallback = flat;
  else if (!fallback) fallback = await fetchLocale(DEFAULT_LOCALE).catch(() => null);
  return expand(fallback ? { ...fallback, ...flat } : flat);
}

export function getLocale() {
  return current;
}

/**
 * Đổi ngôn ngữ: nạp file, thay ruột `T`, nhớ lựa chọn lại. Nạp hỏng thì giữ
 * nguyên thứ tiếng đang chạy — thà chữ cũ còn hơn màn hình trống.
 */
export async function setLocale(code, { remember = true } = {}) {
  const info = LANGUAGES.find((language) => language.code === code);
  if (!info) return false;

  let table;
  try {
    table = await loadTable(code);
  } catch (error) {
    console.warn("Không nạp được ngôn ngữ", code, error);
    return false;
  }

  for (const key of Object.keys(T)) delete T[key];
  Object.assign(T, table);
  current = code;

  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
    document.documentElement.dir = info.dir || "ltr";
  }
  if (remember) {
    try {
      globalThis.localStorage?.setItem(STORE_KEY, code);
    } catch {
      /* chế độ riêng tư chặn localStorage — vẫn đổi được, chỉ là không nhớ. */
    }
  }
  return true;
}

/** Mã ngôn ngữ mình có, suy từ thẻ BCP-47 kiểu "pt-BR", "zh-CN", "en_US". */
function toSupported(tag) {
  if (typeof tag !== "string" || !tag) return null;
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  // "in" là mã cũ của tiếng Indonesia, vài trình duyệt vẫn trả về nó.
  const code = primary === "in" ? "id" : primary;
  return LANGUAGES.some((language) => language.code === code) ? code : null;
}

/**
 * `locale` do CrazyGames đưa sang ("en-US", "pt-BR"…). Tài liệu của họ bảo dùng
 * đúng field này để tự đặt ngôn ngữ, và yêu cầu duyệt game cũng bắt như vậy.
 *
 * Chỉ có khi trang nhúng đã nạp SDK và gọi `SDK.init()` **trước** khi game chạy
 * — đúng thứ tự họ hướng dẫn. Không có thì rơi xuống ngôn ngữ trình duyệt.
 * SDK v2 không có `locale`, chỉ có `countryCode` — nhánh này sẽ trả null.
 */
function platformLocale() {
  try {
    return globalThis.CrazyGames?.SDK?.user?.systemInfo?.locale ?? null;
  } catch {
    return null; // SDK có mặt nhưng chưa init() thì đọc systemInfo có thể ném
  }
}

/** Ngôn ngữ trình duyệt, theo đúng thứ tự ưu tiên người dùng đặt trong hệ điều hành. */
function browserLocales() {
  const nav = globalThis.navigator;
  if (!nav) return [];
  if (nav.languages?.length) return [...nav.languages];
  return nav.language ? [nav.language] : [];
}

/**
 * Ngôn ngữ mở màn, theo thứ tự ưu tiên:
 *
 *   1. thứ tiếng người chơi **tự chọn** — đã chọn rồi thì không bao giờ đè lên
 *   2. `locale` của CrazyGames SDK
 *   3. ngôn ngữ trình duyệt
 *   4. tiếng Anh
 *
 * `localStorage` vì vậy chỉ giữ lựa chọn của người chơi, không giữ kết quả dò —
 * dò lại mỗi lần vào, nên đổi ngôn ngữ máy là game đổi theo.
 */
function preferredLocale() {
  try {
    const saved = globalThis.localStorage?.getItem(STORE_KEY);
    if (saved && LANGUAGES.some((language) => language.code === saved)) return saved;
  } catch {
    /* không đọc được thì coi như chưa chọn bao giờ */
  }
  for (const tag of [platformLocale(), ...browserLocales()]) {
    const code = toSupported(tag);
    if (code) return code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Diễn giải một nước đi của bộ giải ra câu chữ. Bộ giải chỉ trả về `{ id, ... }`
 * chứ không trả câu tiếng Anh, để chỉ có một chỗ duy nhất giữ câu chữ.
 *
 * Lý do nào có nhắc tới hàng/cột/màu thì viết sẵn thành ba câu riêng chứ không
 * thay danh từ vào một chỗ trống: tiếng Tây Ban Nha, Ý, Nga… đổi giống là đổi
 * cả mạo từ lẫn đuôi tính từ, ghép máy móc kiểu đó là sai ngữ pháp.
 */
/**
 * Dựng câu giải thích từ `reason` của bộ giải. Tên màu được gọi thẳng và tô đúng
 * màu đó (Meowdoku cũng viết "Ứng viên [màu] đều ở cột 6"), hàng/cột đánh số
 * từ 1. Cần `puzzle` để biết vùng nào mang màu nào; thiếu thì gọi chung chung.
 */
export function explain(reason, puzzle = null) {
  const entry = T.reasons[reason.id];
  const template = reason.kind ? entry[reason.kind] : entry;
  if (typeof template !== "function") return template;

  const colour = (region) => {
    if (puzzle == null || region == null) return T.thisColour;
    const index = puzzle.colourOf(region);
    return `<b class="key" style="color: var(--k${index})">${T.colors[index]}</b>`;
  };
  const line = (n) => n + 1;
  switch (reason.id) {
    case "onlyCell": return template(reason.kind === "region" ? colour(reason.key) : line(reason.key));
    case "regionInLine":
    case "lineInRegion": return template(colour(reason.region), line(reason.line));
    case "crossing": return template(colour(reason.region), line(reason.row), line(reason.col));
    case "setLock": return template(reason.k, (reason.regions || []).map(colour).join(", "));
    case "chain": return template(reason.depth);
    default: return template(reason.k);
  }
}

/**
 * Đổ chữ vào các thẻ HTML tĩnh. Thẻ nào có `data-i18n="khoá"` thì lấy đúng câu
 * đó; thêm `data-i18n-attr="title"` nếu muốn đổ vào thuộc tính thay vì nội dung.
 */
export function applyStatic(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    const value = node.dataset.i18n.split(".").reduce((acc, key) => acc?.[key], T);
    if (typeof value !== "string") continue;
    const attribute = node.dataset.i18nAttr;
    if (attribute) node.setAttribute(attribute, value);
    else node.innerHTML = value;
  }
}

// Nạp ngay lúc import: các module khác `import { T }` là đã có chữ sẵn.
// Tiếng Anh luôn là lưới an toàn nếu file của ngôn ngữ kia hỏng.
const start = preferredLocale();
if (!(await setLocale(start, { remember: false })) && start !== DEFAULT_LOCALE)
  await setLocale(DEFAULT_LOCALE, { remember: false });
