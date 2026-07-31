const esbuild = require('esbuild');
const { mkdirSync, copyFileSync, readFileSync, writeFileSync, watchFile } = require('node:fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyThemeCss() {
  mkdirSync('dist', { recursive: true });
  copyFileSync('ui/theme.css', 'dist/webview.css');
}

function copyCodicons() {
  mkdirSync('dist', { recursive: true });
  copyFileSync('node_modules/@vscode/codicons/dist/codicon.css', 'dist/codicon.css');
  copyFileSync('node_modules/@vscode/codicons/dist/codicon.ttf', 'dist/codicon.ttf');
}

const HLJS_STYLES_DIR = 'node_modules/highlight.js/styles';

// codewalk.snippetTheme 設定值 → highlight.js 官方 styles/ 目錄裡的來源檔名(不含副檔名,
// 直接用官方主題檔案,不自己維護色票)。dracula/material-palenight 不在 styles/ 外層,
// 是在 styles/base16/ 子目錄下(2026-08-01 修正:先前誤判成沒有官方版本)。
const NAMED_HLJS_THEMES = {
  'github-dark': 'github-dark',
  'github-light': 'github',
  monokai: 'monokai',
  'atom-one-dark': 'atom-one-dark',
  'night-owl': 'night-owl',
  dracula: 'base16/dracula',
  'material-palenight': 'base16/material-palenight',
  'rose-pine-moon': 'rose-pine-moon',
  'tokyo-night-dark': 'tokyo-night-dark',
};

// auto(預設)依 VS Code 目前深/淺色動態套用對應官方主題,而非固定一個。
const AUTO_HLJS_THEMES = { dark: 'github-dark', light: 'github' };

function readHljsStyle(name) {
  return readFileSync(`${HLJS_STYLES_DIR}/${name}.css`, 'utf8');
}

// 用 CSS @scope 直接包住官方主題檔案原文,不逐條改寫 selector——官方檔案的
// .hljs / .hljs-keyword 等 class 名稱維持原樣,靠 @scope 的 scope-start 限制
// 生效範圍,同時借到比 .vscode-dark/.vscode-light 這類 class 選擇器更高的
// specificity(不需要 !important)。ui/render.ts 會把 hljs class 加在
// .codewalk-snippet-code 容器上,對應這裡的 .hljs 規則。
function scoped(selector, css) {
  return `@scope (${selector}) {\n${css}\n}\n`;
}

function buildHljsThemesCss() {
  const parts = [
    '/* 自動產生,勿手動編輯——來源:node_modules/highlight.js/styles/*.css。',
    '   由 esbuild.js 的 buildHljsThemesCss() 產生,見 ui/theme.css 的說明註解。 */',
    '',
    scoped(
      "#app[data-codewalk-theme='auto'].vscode-dark, #app[data-codewalk-theme='auto'].vscode-high-contrast",
      readHljsStyle(AUTO_HLJS_THEMES.dark),
    ),
    scoped(
      "#app[data-codewalk-theme='auto'].vscode-light, #app[data-codewalk-theme='auto'].vscode-high-contrast-light",
      readHljsStyle(AUTO_HLJS_THEMES.light),
    ),
    ...Object.entries(NAMED_HLJS_THEMES).map(([settingValue, sourceName]) =>
      scoped(`#app[data-codewalk-theme='${settingValue}']`, readHljsStyle(sourceName)),
    ),
  ];

  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/hljs-themes.css', parts.join('\n'));
}

async function buildExtension() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['vscode'],
    sourcemap: !production,
    minify: production,
  });
  return ctx;
}

async function buildWebview() {
  const ctx = await esbuild.context({
    entryPoints: ['ui/main.ts'],
    bundle: true,
    outfile: 'dist/webview.js',
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    sourcemap: !production,
    minify: production,
  });
  return ctx;
}

async function main() {
  copyThemeCss();
  copyCodicons();
  buildHljsThemesCss();
  const [extensionCtx, webviewCtx] = await Promise.all([buildExtension(), buildWebview()]);

  if (watch) {
    watchFile('ui/theme.css', copyThemeCss);
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
