// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderMarkdownBlock, renderMarkdownInline } from './markdown';

/**
 * appendChild 對 DocumentFragment 是搬移(move)而非複製——掛載後原 fragment
 * 會被清空。每個 fragment 只掛載一次,html/text 都從掛載後的容器取得。
 */
function mount(fragment: DocumentFragment): HTMLDivElement {
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div;
}

describe('renderMarkdownBlock', () => {
  it('呈現行內程式碼與粗體', () => {
    const div = mount(renderMarkdownBlock('這是 `identifier` 與 **重點**', vi.fn()));
    expect(div.innerHTML).toContain('<code class="codewalk-md-code">identifier</code>');
    expect(div.innerHTML).toContain('<strong>重點</strong>');
    expect(div.innerHTML).not.toContain('`identifier`');
    expect(div.innerHTML).not.toContain('**重點**');
  });

  it('表格與引用區塊原樣顯示為純文字', () => {
    const source = '| a | b |\n|---|---|\n| 1 | 2 |\n\n> 引用文字';
    const div = mount(renderMarkdownBlock(source, vi.fn()));
    expect(div.innerHTML).not.toContain('<table');
    expect(div.innerHTML).not.toContain('<blockquote');
    expect(div.textContent).toContain('| a | b |');
    expect(div.textContent).toContain('> 引用文字');
  });

  it('原始 HTML 不被當作標記解讀,不執行也不載入資源', () => {
    const source = '<img src=x onerror=alert(1)>';
    const div = mount(renderMarkdownBlock(source, vi.fn()));
    expect(div.querySelector('img')).toBeNull();
    expect(div.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('gfm 關閉:裸網址與刪除線不成 token,原樣顯示', () => {
    const div = mount(renderMarkdownBlock('裸網址 https://example.com 與 ~~刪除線~~', vi.fn()));
    expect(div.innerHTML).not.toContain('<a');
    expect(div.innerHTML).not.toContain('<del');
    expect(div.textContent).toContain('https://example.com');
    expect(div.textContent).toContain('~~刪除線~~');
  });

  it('未閉合的粗體標記原樣顯示,不拋例外', () => {
    expect(() => renderMarkdownBlock('這是 **未閉合', vi.fn())).not.toThrow();
    const div = mount(renderMarkdownBlock('這是 **未閉合', vi.fn()));
    expect(div.textContent).toContain('**未閉合');
  });

  it('段落間以空行分隔為獨立區塊,且不隨連續空行數量累加', () => {
    const two = mount(renderMarkdownBlock('第一段\n\n第二段', vi.fn()));
    const three = mount(renderMarkdownBlock('第一段\n\n\n第二段', vi.fn()));
    expect(two.querySelectorAll('p').length).toBe(2);
    expect(three.querySelectorAll('p').length).toBe(2);
  });

  it('同一段落內單一換行維持斷行(textContent 保留原始 \\n)', () => {
    const div = mount(renderMarkdownBlock('第一行\n第二行', vi.fn()));
    const p = div.querySelector('p.codewalk-md-p');
    expect(p?.textContent).toBe('第一行\n第二行');
  });

  it('呈現粗體與二級小標,且不支援的標題階層原樣顯示', () => {
    const div = mount(renderMarkdownBlock('# 一級標題\n\n## 二級標題', vi.fn()));
    expect(div.querySelector('h3.codewalk-md-h')?.textContent).toBe('二級標題');
    expect(div.querySelector('h1')).toBeNull();
    expect(div.querySelector('h2')).toBeNull();
    expect(div.textContent).toContain('# 一級標題');
  });

  it('呈現無序與有序清單', () => {
    const div = mount(renderMarkdownBlock('- 項一\n- 項二\n- 項三', vi.fn()));
    expect(div.querySelector('ul.codewalk-md-list')).not.toBeNull();
    expect(div.querySelectorAll('li').length).toBe(3);

    const ordered = mount(renderMarkdownBlock('1. 一\n2. 二\n3. 三', vi.fn()));
    expect(ordered.querySelector('ol.codewalk-md-list')).not.toBeNull();
    expect(ordered.querySelectorAll('li').length).toBe(3);
  });

  it('呈現巢狀清單', () => {
    const div = mount(renderMarkdownBlock('- 項一\n  - 子項\n- 項二', vi.fn()));
    const topLevelItems = div.querySelectorAll(':scope > ul > li');
    expect(topLevelItems.length).toBe(2);
    expect(topLevelItems[0]?.querySelector('ul > li')?.textContent).toBe('子項');
  });

  it('點擊內嵌連結呼叫 onOpenLink,面板不離開目前畫面', () => {
    const onOpenLink = vi.fn();
    const div = mount(renderMarkdownBlock('[VS Code 文件](https://code.visualstudio.com)', onOpenLink));
    const button = div.querySelector('button.codewalk-md-link');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    button?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onOpenLink).toHaveBeenCalledWith('https://code.visualstudio.com');
  });

  it('非 http/https 的內嵌連結不可點擊,原樣顯示', () => {
    const onOpenLink = vi.fn();
    const div = mount(renderMarkdownBlock('[點我](command:workbench.action.terminal.new)', onOpenLink));
    expect(div.querySelector('button')).toBeNull();
    expect(div.textContent).toContain('[點我](command:workbench.action.terminal.new)');

    const jsDiv = mount(renderMarkdownBlock('[點我](javascript:alert(1))', vi.fn()));
    expect(jsDiv.querySelector('button')).toBeNull();
  });

  it('onOpenLink 為 null 時,合法連結也降級為原樣文字(用於已在其他可點擊元素內的短欄位)', () => {
    const div = mount(renderMarkdownBlock('[VS Code 文件](https://code.visualstudio.com)', null));
    expect(div.querySelector('button')).toBeNull();
    expect(div.textContent).toContain('[VS Code 文件](https://code.visualstudio.com)');
  });
});

describe('renderMarkdownInline', () => {
  it('短欄位呈現行內程式碼,但區塊語法不生效', () => {
    const div = mount(renderMarkdownInline('下列哪個描述 `resolvePassThreshold` 的行為?', vi.fn()));
    expect(div.innerHTML).toContain('<code class="codewalk-md-code">resolvePassThreshold</code>');
  });

  it('短欄位中的 "- " 與 "## " 不成清單或小標,原樣顯示', () => {
    const div = mount(renderMarkdownInline('- 項目', vi.fn()));
    expect(div.querySelector('ul')).toBeNull();
    expect(div.textContent).toBe('- 項目');

    const heading = mount(renderMarkdownInline('## 標題', vi.fn()));
    expect(heading.querySelector('h3')).toBeNull();
    expect(heading.textContent).toBe('## 標題');
  });

  it('短欄位仍支援行內連結', () => {
    const onOpenLink = vi.fn();
    const div = mount(renderMarkdownInline('見 [文件](https://example.com)', onOpenLink));
    const button = div.querySelector('button.codewalk-md-link');
    expect(button).not.toBeNull();
  });
});
