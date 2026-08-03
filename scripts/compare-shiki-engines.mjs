#!/usr/bin/env node
// 比對 Shiki 的 JS regex 引擎(createJavaScriptRegexEngine)與 oniguruma WASM 引擎
// 對 ui/highlight.ts 目前註冊的每種語言,token 輸出是否一致。
//
// 背景:JS 引擎不支援部分 oniguruma 特有的 regex 語法,理論上可能對某些
// grammar 靜默降級(不拋錯,但 token 分類跟真正的 oniguruma 不同)。選用
// JS 引擎前必須實測驗證,不能只憑「兩者都不拋錯」就判斷相容
// (見 openspec/changes/switch-to-shiki-highlighter/design.md 決策 1)。
//
// 用法:node scripts/compare-shiki-engines.mjs
// 新增語言到 ui/highlight.ts 的 LANGS 清單時,把對應的 lang id 加進下面的
// LANGS,重跑這支腳本確認差異仍為 0。

import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import darkPlus from '@shikijs/themes/dark-plus';

// 需與 ui/highlight.ts 的 LANGS 保持一致。
const LANGS = [
  'bash', 'c', 'cpp', 'csharp', 'css', 'dart', 'go', 'groovy', 'html', 'java', 'javascript', 'json', 'kotlin',
  'markdown', 'php', 'python', 'ruby', 'rust', 'scala', 'sql', 'swift', 'typescript', 'yaml',
];

// 每種語言的代表性片段,涵蓋容易踩雷的語法(跨行字串、內插、泛型、閉包等)。
const SAMPLES = {
  java: 'public class A { String s = """\n  x\n  """; }',
  groovy: 'def m = """a ${b} c""".stripIndent()\ntasks.register("x") { doLast { println 1 } }',
  dart: "class A { String g(String n) => 'hi $n'; }",
  php: '<?php echo "hi"; ?><div>x</div>',
  html: '<div class="a">x<script>var a=1</script></div>',
  markdown: '# t\n\n```js\nconst a=1\n```\n\n- x',
  ruby: 'def g(n)\n  "hi #{n}"\nend',
  sql: 'SELECT a, COUNT(*) FROM t WHERE b > 1 GROUP BY a;',
  swift: 'let x: Int = 1\nfunc f() -> String { return "\\(x)" }',
  csharp: 'public class A { public string S => $"x{1}"; }',
  cpp: '#include <vector>\ntemplate<class T> T f(T a){return a;}',
  scala: 'object A { def f(x: Int): String = s"v$x" }',
  yaml: 'a: 1\nb:\n  - c\n  - "d"',
  kotlin: 'fun main() = println("hi")',
};

async function buildHighlighter(engine) {
  const langs = await Promise.all(LANGS.map((l) => import(`@shikijs/langs/${l}`).then((m) => m.default)));
  return createHighlighterCore({ langs, themes: [darkPlus], engine });
}

function tokensOf(hl, lang) {
  const code = SAMPLES[lang] ?? 'const a = 1;';
  return hl.codeToTokens(code, { lang, theme: 'dark-plus' }).tokens.flat();
}

const js = await buildHighlighter(createJavaScriptRegexEngine());
const oniguruma = await buildHighlighter(await createOnigurumaEngine(import('shiki/wasm')));

let totalTokens = 0;
let totalDiff = 0;
const mismatches = [];

for (const lang of LANGS) {
  const a = tokensOf(js, lang);
  const b = tokensOf(oniguruma, lang);
  const n = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < n; i++) {
    if (!a[i] || !b[i] || a[i].content !== b[i].content || a[i].color !== b[i].color) diff++;
  }
  totalTokens += n;
  totalDiff += diff;
  if (diff > 0) mismatches.push({ lang, diff, tokens: n });
}

console.log(`比對 ${LANGS.length} 種語言,共 ${totalTokens} 個 token`);
if (mismatches.length === 0) {
  console.log('差異:0——JS 引擎與 oniguruma WASM 輸出完全一致,可安全使用 JS 引擎。');
} else {
  console.log(`發現差異,建議改用 oniguruma WASM 引擎:`);
  for (const m of mismatches) console.log(`  ${m.lang}: ${m.diff}/${m.tokens} token 不同`);
  process.exitCode = 1;
}
