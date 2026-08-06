import { Lexer, type MarkedToken, type Tokens } from 'marked';
import { isHttpUrl } from '../shared/schema';

/**
 * 只用 marked 的 Lexer 取 token,永不呼叫 marked() 或 Renderer——token 皆帶 `raw`
 * 欄位(產生該 token 的原始字元),不支援的語法直接輸出 raw 即是「原樣呈現」,
 * 而輸出一律經 textContent/createTextNode,天然沒有注入疑慮(見 design.md D1)。
 * gfm: false 讓表格、裸網址 autolink、刪除線在 lexer 這層就不成 token。
 *
 * 型別一律用 MarkedToken(而非 marked 匯出的 Token),因為 Token = MarkedToken |
 * Tokens.Generic,而 Generic.type 是寬鬆的 string——switch (token.type) 在每個
 * case 裡都窄不掉 Generic,連帶讓 `.tokens` 被推成 `Token[] | undefined`。專案
 * 不使用任何自訂 tokenizer 擴充,Generic 不會真的出現,MarkedToken 排除它後
 * 窄化才會正確運作,不需要到處補 `?? []`。
 */
const LEXER_OPTIONS = { gfm: false } as const;

export type OpenLinkHandler = (url: string) => void;

/**
 * `null` 表示「此處連結不可點擊」:呼叫端若把渲染結果放進另一個已有點擊行為
 * 的元素(`<button>`、有 click handler 的 `<summary>`、包著 radio 的 `<label>`),
 * 傳 null 讓 link token 一律降級為原始文字——巢狀互動元素既是無效 HTML,點擊
 * 語意也會打架(例如 <label> 內的巢狀按鈕仍可能觸發外層 radio 切換)。程式碼與
 * 粗體不受影響,一律照常渲染。
 */
export type MaybeOpenLinkHandler = OpenLinkHandler | null;

export function renderMarkdownBlock(source: string, onOpenLink: MaybeOpenLinkHandler): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tokens = new Lexer(LEXER_OPTIONS).lex(source) as MarkedToken[];
  for (const token of tokens) {
    appendBlockToken(fragment, token, onOpenLink);
  }
  return fragment;
}

export function renderMarkdownInline(source: string, onOpenLink: MaybeOpenLinkHandler): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tokens = Lexer.lexInline(source, LEXER_OPTIONS) as MarkedToken[];
  appendInlineTokens(fragment, tokens, onOpenLink);
  return fragment;
}

function appendBlockToken(
  parent: DocumentFragment | HTMLElement,
  token: MarkedToken,
  onOpenLink: MaybeOpenLinkHandler,
): void {
  switch (token.type) {
    case 'space':
      return;
    case 'paragraph': {
      const p = document.createElement('p');
      p.className = 'codewalk-md-p';
      appendInlineTokens(p, token.tokens as MarkedToken[], onOpenLink);
      parent.appendChild(p);
      return;
    }
    case 'heading': {
      if (token.depth !== 2) {
        appendBlockFallback(parent, token.raw);
        return;
      }
      const heading = document.createElement('h3');
      heading.className = 'codewalk-md-h';
      appendInlineTokens(heading, token.tokens as MarkedToken[], onOpenLink);
      parent.appendChild(heading);
      return;
    }
    case 'list':
      parent.appendChild(renderList(token, onOpenLink));
      return;
    default:
      appendBlockFallback(parent, token.raw);
  }
}

function renderList(
  token: Tokens.List,
  onOpenLink: MaybeOpenLinkHandler,
): HTMLUListElement | HTMLOListElement {
  const listEl = document.createElement(token.ordered ? 'ol' : 'ul');
  listEl.className = 'codewalk-md-list';
  for (const item of token.items) {
    const li = document.createElement('li');
    for (const itemToken of item.tokens as MarkedToken[]) {
      appendListItemToken(li, itemToken, onOpenLink);
    }
    listEl.appendChild(li);
  }
  return listEl;
}

/**
 * 清單項目內的 block token 只會是 'text'(緊湊清單,含 inline tokens)、
 * 'paragraph'(寬鬆清單,項目間有空行)或 'list'(巢狀清單)——皆實測確認。
 */
function appendListItemToken(li: HTMLLIElement, token: MarkedToken, onOpenLink: MaybeOpenLinkHandler): void {
  switch (token.type) {
    case 'text':
      appendInlineTokens(li, (token.tokens ?? []) as MarkedToken[], onOpenLink);
      return;
    case 'paragraph': {
      const p = document.createElement('p');
      p.className = 'codewalk-md-p';
      appendInlineTokens(p, token.tokens as MarkedToken[], onOpenLink);
      li.appendChild(p);
      return;
    }
    case 'list':
      li.appendChild(renderList(token, onOpenLink));
      return;
    default:
      appendBlockFallback(li, token.raw);
  }
}

function appendInlineTokens(
  parent: DocumentFragment | HTMLElement,
  tokens: MarkedToken[],
  onOpenLink: MaybeOpenLinkHandler,
): void {
  for (const token of tokens) {
    appendInlineToken(parent, token, onOpenLink);
  }
}

function appendInlineToken(
  parent: DocumentFragment | HTMLElement,
  token: MarkedToken,
  onOpenLink: MaybeOpenLinkHandler,
): void {
  switch (token.type) {
    case 'text':
      parent.appendChild(document.createTextNode(token.raw));
      return;
    case 'codespan': {
      const code = document.createElement('code');
      code.className = 'codewalk-md-code';
      code.textContent = token.text;
      parent.appendChild(code);
      return;
    }
    case 'strong': {
      const strong = document.createElement('strong');
      appendInlineTokens(strong, token.tokens as MarkedToken[], onOpenLink);
      parent.appendChild(strong);
      return;
    }
    case 'link': {
      if (onOpenLink === null || !isHttpUrl(token.href)) {
        parent.appendChild(document.createTextNode(token.raw));
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'codewalk-md-link';
      appendInlineTokens(button, token.tokens as MarkedToken[], onOpenLink);
      button.addEventListener('click', () => onOpenLink(token.href));
      parent.appendChild(button);
      return;
    }
    default:
      parent.appendChild(document.createTextNode(token.raw));
  }
}

/**
 * 區塊層級的降級輸出包成 <p class="codewalk-md-p">,沿用該類別的
 * white-space: pre-line,讓不支援語法(表格、引用區塊等)裡的原始換行
 * 仍可視覺呈現,而不是被瀏覽器預設的空白收縮吃掉。
 */
function appendBlockFallback(parent: DocumentFragment | HTMLElement, raw: string): void {
  const p = document.createElement('p');
  p.className = 'codewalk-md-p';
  p.appendChild(document.createTextNode(raw));
  parent.appendChild(p);
}
