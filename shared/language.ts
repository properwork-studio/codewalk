/**
 * 這裡的值必須是 `ui/highlight.ts` 有註冊的 Shiki 語言 id,否則
 * `isLanguageSupported()` 會判定為不支援、`highlightSnippetLines()` 退回
 * 純文字——新增副檔名時兩邊要一起改。
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

export function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_LANGUAGE[ext] ?? 'plaintext';
}
