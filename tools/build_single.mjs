// Gói cả game vào một file HTML chạy được không cần server.
//
// Nhúng sẵn kho bàn (data/pools.json), màn đặc biệt (data/specials.json), hai
// bảng chữ (data/i18n/en.json, vi.json), ảnh con kiến và CSS. Không mang theo
// một byte nào từ bank giải mã của Meowdoku.
//
//   node tools/build_single.mjs        →  dist/ant-guard.html

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const readJson = (path, fallback) => (existsSync(new URL(path, root)) ? JSON.parse(read(path)) : fallback);

// Thứ tự phụ thuộc — nối tay thay vì gọi bundler, dự án không có bước build nào khác.
const MODULES = [
  "src/puzzle.js", "src/solver.js", "src/levels.js", "src/strings.js", "src/sound.js",
  "src/boardview.js", "src/tutorial.js", "src/progression.js", "src/nest.js", "src/game.js",
];

/** Gỡ import/export để các module ghép lại thành một khối script chạy được. */
function flatten(source) {
  return source
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^export\s+(?=(const|let|function|class|async)\b)/gm, "")
    .trim();
}

// --- dữ liệu ---------------------------------------------------------------

const pools = readJson("data/pools.json", null);
if (!pools) throw new Error("chưa có data/pools.json — chạy tools/build_pools.mjs trước");
const specials = readJson("data/specials.json", {});
const i18n = { en: readJson("data/i18n/en.json"), vi: readJson("data/i18n/vi.json") };

// --- nhúng tài nguyên ----------------------------------------------------

// Nhúng MỌI ảnh, không chỉ một cái tên viết cứng: bản một file mà còn đường
// dẫn `assets/...` thì mở lên chẳng thấy con kiến nào — mà tên file thì đổi
// theo thời gian, nên dò thẳng trong mã nguồn mới chắc.
//
// Hai chỗ trỏ tới ảnh, hai cú pháp khác nhau: CSS viết `url("../assets/x.png")`,
// còn src/nest.js dựng thẻ <image> nên viết `assets/x.png` trong chuỗi JS.
let embedded = 0;
const inline = (file) => {
  const data = readFileSync(new URL(`assets/${file}`, root)).toString("base64");
  embedded += data.length;
  return `data:image/png;base64,${data}`;
};

const css = read("src/style.css").replace(
  /url\("\.\.\/assets\/([\w.-]+\.png)"\)/g,
  (_, file) => `url("${inline(file)}")`,
);
if (!embedded) throw new Error("không nhúng được ảnh nào — kiểm lại đường dẫn trong style.css");

/** Đổi mọi chuỗi `assets/<tên>.png` trong mã JS thành data URI. */
const inlineJsAssets = (source) =>
  source.replace(/assets\/([\w.-]+\.png)/g, (_, file) => inline(file));

const script = [
  `globalThis.__COLODOKU_POOLS = ${JSON.stringify(pools)};`,
  `globalThis.__COLODOKU_SPECIALS = ${JSON.stringify(specials)};`,
  `globalThis.__COLODOKU_I18N = ${JSON.stringify(i18n)};`,
  ...MODULES.map((path) => `// ---- ${path} ----\n${inlineJsAssets(flatten(read(path)))}`),
].join("\n\n");

// --- ghép vào index.html -------------------------------------------------

const html = read("index.html")
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="src\/game\.js"><\/script>/, `<script type="module">\n${script}\n</script>`)
  // Bản một file không kèm trang phân tích.
  .replace(/\s*<a class="linkish" href="lab\.html">[^<]*<\/a>/, "");

mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/ant-guard.html", root), html);

// Bản cho Artifact: nơi đó tự bọc <html>/<head>/<body> nên chỉ nộp phần ruột,
// và class "app" trên <body> phải gắn bằng script vì thẻ body không phải của mình.
const artifact = html
  .replace(/^[\s\S]*?<title>/, "<title>")
  .replace(/<\/head>\s*<body class="app">/, '<script>document.body.classList.add("app");</script>')
  .replace(/\s*<\/body>\s*<\/html>\s*$/, "");
writeFileSync(new URL("dist/ant-guard-artifact.html", root), artifact);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const poolCount = Object.values(pools).reduce((a, list) => a + list.length, 0);
console.log(`dist/ant-guard.html · ${kb(html.length)} (ảnh ${kb(embedded)}, ${poolCount} bàn trong ${Object.keys(pools).length} kho, ${Object.keys(specials).length} màn đặc biệt)`);
console.log(`dist/ant-guard-artifact.html · ${kb(artifact.length)}`);
