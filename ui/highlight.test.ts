import hljs from 'highlight.js/lib/core';
import { describe, expect, it } from 'vitest';
import { EXTENSION_LANGUAGE } from '../shared/language';
import { highlightSnippet, highlightSnippetLines } from './highlight';

describe('語言註冊', () => {
  // 副檔名對應表與 highlight.js 註冊清單分屬兩個檔案,漏註冊時 snippet 會安靜地
  // 退回純文字而不報錯——這個測試把兩邊綁在一起,少一個就紅。
  it('registers every language detectLanguage can return', () => {
    for (const language of new Set(Object.values(EXTENSION_LANGUAGE))) {
      expect(hljs.getLanguage(language), `'${language}' 未在 ui/highlight.ts 註冊`).toBeTruthy();
    }
  });
});

describe('highlightSnippet', () => {
  it('wraps recognized tokens in hljs spans for a registered language', () => {
    const html = highlightSnippet('const x = 1;', 'typescript');
    expect(html).toContain('hljs-');
  });

  it('highlights the newly added JVM, mobile and C-family languages', () => {
    expect(highlightSnippet('public class App {}', 'java')).toContain('hljs-');
    expect(highlightSnippet("def greet(String n) { println 'hi' }", 'groovy')).toContain('hljs-');
    expect(highlightSnippet('void main() { print("hi"); }', 'dart')).toContain('hljs-');
    expect(highlightSnippet('fun main() = println("hi")', 'kotlin')).toContain('hljs-');
    expect(highlightSnippet('let x: Int = 1', 'swift')).toContain('hljs-');
    expect(highlightSnippet('public class App { }', 'csharp')).toContain('hljs-');
    expect(highlightSnippet('int main(void) { return 0; }', 'c')).toContain('hljs-');
    expect(highlightSnippet('#include <vector>', 'cpp')).toContain('hljs-');
    expect(highlightSnippet('<?php echo "hi";', 'php')).toContain('hljs-');
    expect(highlightSnippet('def greet(name)\nend', 'ruby')).toContain('hljs-');
    expect(highlightSnippet('SELECT * FROM users;', 'sql')).toContain('hljs-');
    expect(highlightSnippet('object App extends App {}', 'scala')).toContain('hljs-');
  });

  it('resolves the html alias to the xml grammar', () => {
    const html = highlightSnippet('<div></div>', 'html');
    expect(html).toContain('hljs-');
  });

  it('escapes HTML and skips highlighting for an unregistered language', () => {
    const html = highlightSnippet('<b>plain</b>', 'plaintext');
    expect(html).toBe('&lt;b&gt;plain&lt;/b&gt;');
  });
});

describe('highlightSnippetLines', () => {
  it('returns one entry per source line', () => {
    const lines = highlightSnippetLines('const a = 1;\nconst b = 2;\nconst c = 3;', 'typescript');
    expect(lines).toHaveLength(3);
  });

  it('produces tag-balanced HTML per line even when a highlighted span spans multiple lines', () => {
    const content = '/*\n multi-line comment\n*/\nconst x = 1;';
    const lines = highlightSnippetLines(content, 'typescript');
    expect(lines).toHaveLength(4);
    // 每一行的 <span> 開始/結束標籤數量必須相等,否則後面行的樣式會被前面行「洩漏」進來
    for (const line of lines) {
      const opens = (line.match(/<span/g) ?? []).length;
      const closes = (line.match(/<\/span>/g) ?? []).length;
      expect(opens).toBe(closes);
    }
  });

  it('keeps tags balanced when a sub-language span is nested inside a comment', () => {
    // highlight.js 對 Dart 的 /// 文件註解會再跑一次 markdown 子語言,產生巢狀且
    // 沒有 hljs- 前綴的 <span class="language-markdown">——切行時這種 span 也要一起
    // 進出堆疊,否則註解色會從文件註解一路洩漏到後面的程式碼。
    const content = "/// 說明 `code`\n/// 第二行\nvoid main() {}";
    const lines = highlightSnippetLines(content, 'dart');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      const opens = (line.match(/<span/g) ?? []).length;
      const closes = (line.match(/<\/span>/g) ?? []).length;
      expect(opens).toBe(closes);
    }
    // 最後一行是程式碼而非註解的延續:應該拿到 keyword 而不是 comment
    expect(lines[2]).toContain('hljs-keyword');
    expect(lines[2]).not.toContain('hljs-comment');
  });

  it('preserves plain text as-is when the language is unregistered', () => {
    const lines = highlightSnippetLines('line one\nline two', 'plaintext');
    expect(lines).toEqual(['line one', 'line two']);
  });
});
