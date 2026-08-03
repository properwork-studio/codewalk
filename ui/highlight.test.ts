import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EXTENSION_LANGUAGE } from '../shared/language';
import { highlightSnippetLines, isLanguageSupported, onHighlightReady, type HighlightToken } from './highlight';

function waitForHighlightReady(): Promise<void> {
  return new Promise((resolve) => onHighlightReady(resolve));
}

function flatten(lines: HighlightToken[][]): HighlightToken[] {
  return lines.flat();
}

beforeAll(async () => {
  await waitForHighlightReady();
});

describe('語言註冊', () => {
  // 副檔名對應表(shared/language.ts)與這裡的語言註冊清單分屬兩個檔案,漏
  // 註冊時 snippet 會安靜地退回純文字而不報錯——這個測試把兩邊綁在一起,
  // 少一個就紅。
  it('registers every language detectLanguage can return', () => {
    for (const language of new Set(Object.values(EXTENSION_LANGUAGE))) {
      expect(isLanguageSupported(language), `'${language}' 未在 ui/highlight.ts 註冊`).toBe(true);
    }
  });
});

describe('highlightSnippetLines', () => {
  it('assigns a color to at least one token for a registered language', () => {
    const tokens = flatten(highlightSnippetLines('const x = 1;', 'typescript'));
    expect(tokens.some((t) => t.color !== undefined)).toBe(true);
  });

  it('highlights the JVM, mobile and C-family languages added for broader coverage', () => {
    const cases: Array<[string, string]> = [
      ['public class App {}', 'java'],
      ["def greet(String n) { println 'hi' }", 'groovy'],
      ['void main() { print("hi"); }', 'dart'],
      ['fun main() = println("hi")', 'kotlin'],
      ['let x: Int = 1', 'swift'],
      ['public class App { }', 'csharp'],
      ['int main(void) { return 0; }', 'c'],
      ['#include <vector>', 'cpp'],
      ['<?php echo "hi";', 'php'],
      ['def greet(name)\nend', 'ruby'],
      ['SELECT * FROM users;', 'sql'],
      ['object App extends App {}', 'scala'],
    ];
    for (const [content, language] of cases) {
      const tokens = flatten(highlightSnippetLines(content, language));
      expect(tokens.some((t) => t.color !== undefined), `${language} 沒有任何 token 上色`).toBe(true);
    }
  });

  it('highlights html directly (no xml aliasing needed, unlike highlight.js)', () => {
    const tokens = flatten(highlightSnippetLines('<div></div>', 'html'));
    expect(tokens.some((t) => t.color !== undefined)).toBe(true);
  });

  it('returns uncolored plain-text tokens for an unregistered language, preserving content as-is', () => {
    const lines = highlightSnippetLines('<b>plain</b>', 'plaintext');
    expect(lines).toEqual([[{ content: '<b>plain</b>' }]]);
  });

  it('returns one entry per source line', () => {
    const lines = highlightSnippetLines('const a = 1;\nconst b = 2;\nconst c = 3;', 'typescript');
    expect(lines).toHaveLength(3);
  });

  it('keeps a multi-line comment token scoped to its own lines without leaking into the next', () => {
    const content = '/*\n multi-line comment\n*/\nconst x = 1;';
    const lines = highlightSnippetLines(content, 'typescript');
    expect(lines).toHaveLength(4);
    // Shiki 原生依行輸出 token(不像 highlight.js 需要手動切行),第 4 行
    // 理應拿到程式碼的顏色而非延續第 1-3 行的註解顏色。
    const commentColor = lines[0][0]?.color;
    const codeColors = new Set(lines[3].map((t) => t.color));
    expect(codeColors.has(commentColor)).toBe(false);
  });

  it('preserves plain text as-is when the language is unregistered', () => {
    const lines = highlightSnippetLines('line one\nline two', 'plaintext');
    expect(lines).toEqual([[{ content: 'line one' }], [{ content: 'line two' }]]);
  });
});

describe('高亮引擎就緒前後的行為(design.md 決策 6)', () => {
  it('falls back to plain text before the engine has finished initializing, then colors once ready', async () => {
    // 用 resetModules() + 動態 import 取得一份全新的模組實例:它的頂層
    // 初始化(createHighlighterCore)剛啟動、還沒 await 完成,此時模組內部
    // 的 highlighter 必然還是 null——藉此重現「面板剛開啟、高亮尚未就緒」
    // 這個沒辦法用既有(已 await 過 ready 的)模組實例測到的狀態。
    vi.resetModules();
    const fresh = await import('./highlight');

    expect(fresh.isLanguageSupported('typescript')).toBe(false);
    const beforeReady = fresh.highlightSnippetLines('const a = 1;', 'typescript');
    expect(beforeReady).toEqual([[{ content: 'const a = 1;' }]]);

    await new Promise<void>((resolve) => fresh.onHighlightReady(resolve));

    expect(fresh.isLanguageSupported('typescript')).toBe(true);
    const afterReady = fresh.highlightSnippetLines('const a = 1;', 'typescript');
    expect(afterReady.flat().some((t) => t.color !== undefined)).toBe(true);
  });
});
