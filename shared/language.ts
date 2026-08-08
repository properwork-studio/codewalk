/*
 * 副檔名到語法高亮語言的對應。host(讀 snippet 內容時判定語言)與 webview
 * (實際上色)共用同一份,避免兩邊對同一個檔案得出不同語言。
 */

/**
 * 副檔名(不含點、全小寫)到 Shiki 語言 id 的對應表。
 *
 * @remarks
 * 這裡的值必須是 `ui/highlight.ts` 有註冊的語言 id,否則 `isLanguageSupported()`
 * 會判定為不支援、`highlightSnippetLines()` 安靜退回純文字——**新增副檔名時兩邊
 * 要一起改**。`ui/highlight.test.ts` 有測試把兩份清單綁在一起,漏改會被測到。
 */
export const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin', // build.gradle.kts 也走這裡
  groovy: 'groovy',
  gradle: 'groovy',
  scala: 'scala',
  dart: 'dart',
  swift: 'swift',
  cs: 'csharp',
  c: 'c',
  h: 'c', // C++ header 也常用 .h,兩者文法差異不影響上色結果
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  php: 'php',
  rb: 'ruby',
  sql: 'sql',
  css: 'css',
  html: 'html',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
};

/**
 * 由檔名副檔名判定語法高亮語言。
 *
 * @returns 對應表中沒有的副檔名回傳 `'plaintext'`,上色時等同不上色——猜錯顏色
 * 比不上色更容易誤導讀者(syntax-highlighting capability 的語言判定 requirement)
 */
export function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_LANGUAGE[ext] ?? 'plaintext';
}
