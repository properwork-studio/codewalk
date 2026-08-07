import type { HighlightToken } from '../highlight';

/**
 * 本目錄的共用 DOM 工具。整個 render 層一律用 `createElement` + `textContent`
 * 組樹,**不做任何字串樣板拼接**——導讀 JSON 可能來自別人的產生器,把它的字串
 * 直接當 HTML 塞進去就是一個現成的注入漏洞。這條紀律在 `ui/markdown.ts`
 * (只取 marked 的 token,不取 HTML)與下方的 `appendTokens` 都是同一套。
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(name: string, extraClass?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `codicon codicon-${name}${extraClass ? ` ${extraClass}` : ''}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/**
 * 用 textContent(非 innerHTML)逐一附加 token,不需要跳脫 HTML——Shiki 回傳
 * 結構化 token 而非 HTML 字串,天然沒有注入疑慮。空行(無 token 或內容全空)
 * 補一個 NBSP(U+00A0),維持行高與可選取性——刻意不是全形空白(U+3000),
 * 那會把空行撐成一個中文字寬。
 */
export function appendTokens(container: HTMLElement, tokens: HighlightToken[]): void {
  const hasVisibleContent = tokens.some((token) => token.content.length > 0);
  if (!hasVisibleContent) {
    container.appendChild(document.createTextNode(' '));
    return;
  }
  for (const token of tokens) {
    if (token.content.length === 0) continue;
    const span = document.createElement('span');
    span.textContent = token.content;
    if (token.color) span.style.color = token.color;
    if (token.italic) span.style.fontStyle = 'italic';
    if (token.bold) span.style.fontWeight = 'bold';
    container.appendChild(span);
  }
}
