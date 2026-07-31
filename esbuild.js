const esbuild = require('esbuild');
const { mkdirSync, copyFileSync, watchFile } = require('node:fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyThemeCss() {
  mkdirSync('dist', { recursive: true });
  copyFileSync('ui/theme.css', 'dist/webview.css');
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
