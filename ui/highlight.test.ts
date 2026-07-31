import { describe, expect, it } from 'vitest';
import { highlightSnippet, highlightSnippetLines } from './highlight';

describe('highlightSnippet', () => {
  it('wraps recognized tokens in hljs spans for a registered language', () => {
    const html = highlightSnippet('const x = 1;', 'typescript');
    expect(html).toContain('hljs-');
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

  it('preserves plain text as-is when the language is unregistered', () => {
    const lines = highlightSnippetLines('line one\nline two', 'plaintext');
    expect(lines).toEqual(['line one', 'line two']);
  });
});
