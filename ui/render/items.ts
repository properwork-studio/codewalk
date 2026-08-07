import { detectLanguage } from '../../shared/language';
import {
  effectiveLineRange,
  type AnchorStatus,
  type AnchorStepReport,
  type SnippetPreviewResult,
} from '../../shared/protocol';
import type { CodewalkItem } from '../../shared/schema';
import { highlightSnippetLines } from '../highlight';
import { renderMarkdownBlock, renderMarkdownInline, type OpenLinkHandler } from '../markdown';
import { appendTokens, el, icon } from './dom';

/**
 * `step.items` 的六種說明元件(tip / pitfall / todo / reference / snippet / diff),
 * 加上 snippet 與 diff 各自的程式碼區塊渲染。
 *
 * handler 型別刻意獨立於 `WalkingHandlers`(走讀畫面的完整 handler 集合),
 * 只宣告本模組真正會呼叫的兩個——否則 walking 需要 renderItems、items 需要
 * WalkingHandlers,兩個模組會互相依賴。
 */
export interface ItemHandlers {
  onOpenReference: (url: string) => void;
  onJumpToSnippet: (itemIndex: number) => void;
}

function renderAnnotation(
  kind: 'tip' | 'todo',
  iconName: string,
  text: string,
  onOpenLink: OpenLinkHandler,
): HTMLElement {
  const box = el('div', `codewalk-annotation codewalk-annotation-${kind}`);
  box.appendChild(icon(iconName, 'codewalk-annotation-icon'));
  const textBox = el('div', 'codewalk-annotation-text');
  textBox.appendChild(renderMarkdownBlock(text, onOpenLink));
  box.appendChild(textBox);
  return box;
}

/**
 * 標籤(「誤解:」/「其實:」)插進 markdown 內容的第一個段落內部,維持與內容
 * 首行同行顯示——renderMarkdownBlock 回傳的是獨立區塊元素,標籤若當成單純的
 * 前置 sibling 會被推到自己一行,跟改動前「同一個 <p>」的排版不一致。內容以
 * 清單或小標開頭(無起始段落)時,退回標籤獨立一行。
 */
function appendLabeledMarkdown(
  container: HTMLElement,
  labelText: string,
  source: string,
  onOpenLink: OpenLinkHandler,
): void {
  const label = el('span', 'codewalk-pitfall-label', labelText);
  const content = renderMarkdownBlock(source, onOpenLink);
  const firstParagraph = content.firstElementChild;
  if (firstParagraph instanceof HTMLParagraphElement) {
    firstParagraph.prepend(label);
  } else {
    container.appendChild(label);
  }
  container.appendChild(content);
}

function renderPitfall(misconception: string, reality: string, onOpenLink: OpenLinkHandler): HTMLElement {
  const box = el('div', 'codewalk-annotation codewalk-annotation-pitfall');
  const header = el('div', 'codewalk-annotation-header');
  header.appendChild(icon('alert', 'codewalk-annotation-icon'));
  header.appendChild(el('span', undefined, '容易誤解的地方'));
  box.appendChild(header);
  const misconceptionRow = el('div', 'codewalk-pitfall-line');
  appendLabeledMarkdown(misconceptionRow, '誤解:', misconception, onOpenLink);
  const realityRow = el('div', 'codewalk-pitfall-line');
  appendLabeledMarkdown(realityRow, '其實:', reality, onOpenLink);
  box.appendChild(misconceptionRow);
  box.appendChild(realityRow);
  return box;
}

/**
 * label 顯示在 <button> 內部——渲染時 onOpenLink 傳 null,連結降級為原始文字
 * (見 ui/markdown.ts 的 MaybeOpenLinkHandler),避免巢狀 <button>。
 */
function renderReference(label: string, url: string, onOpenReference: (url: string) => void): HTMLElement {
  const button = el('button', 'codewalk-reference');
  button.appendChild(icon('link-external'));
  const labelSpan = el('span', 'codewalk-reference-label');
  labelSpan.appendChild(renderMarkdownInline(label, null));
  button.appendChild(labelSpan);
  button.addEventListener('click', () => onOpenReference(url));
  return button;
}

export function renderSnippetCode(content: string, language: string, startLine: number): HTMLElement {
  const code = el('div', 'codewalk-snippet-code');
  const lines = highlightSnippetLines(content, language);
  lines.forEach((lineTokens, i) => {
    const row = el('div', 'codewalk-snippet-line');
    row.appendChild(el('span', 'codewalk-snippet-line-number', String(startLine + i)));
    const lineCode = document.createElement('span');
    lineCode.className = 'codewalk-snippet-line-code';
    appendTokens(lineCode, lineTokens);
    row.appendChild(lineCode);
    code.appendChild(row);
  });
  return code;
}

/** 產出當時內容的說明標籤——不與系統層級警告(.codewalk-warning)共用樣式,
 * 避免讀者把「這是舊內容」跟「系統錯誤」搞混,但沿用同一套告警色階(design.md 決策 8)。 */
export function renderStaleLabel(): HTMLElement {
  const label = el('div', 'codewalk-stale-label');
  label.appendChild(icon('history'));
  label.appendChild(el('span', undefined, '以下為產出當時的內容,現行版本已不同'));
  return label;
}

function renderSnippet(
  item: Extract<CodewalkItem, { kind: 'snippet' }>,
  itemIndex: number,
  snippetPreviews: SnippetPreviewResult[],
  status: AnchorStatus,
  onJumpToSnippet: (itemIndex: number) => void,
): HTMLElement {
  const isStale = status.kind === 'stale';
  const container = el('div', `codewalk-snippet${isStale ? ' codewalk-snippet--stale' : ''}`);
  const { startLine, endLine } = effectiveLineRange(item, status);
  const preview = snippetPreviews.find((p) => p.itemIndex === itemIndex);

  // 檔案不存在時不提供「開啟現行檔案」動作——沒有東西可開(stale-step-detection
  // capability「目標檔案不存在時的開啟動作」scenario)。
  const canOpen = !(preview && !preview.ok && preview.anchorContent !== undefined);
  const header = el(canOpen ? 'button' : 'div', 'codewalk-snippet-header');
  header.appendChild(icon(isStale ? 'warning' : 'code'));
  const headerText = el('span', 'codewalk-snippet-header-text');
  const labelSpan = el('span', 'codewalk-snippet-label');
  if (isStale && canOpen) {
    labelSpan.textContent = '開啟現行檔案';
  } else {
    // label 顯示在 <button> 內部,onOpenLink 傳 null 避免巢狀 <button>(見 renderReference 的說明)。
    labelSpan.appendChild(renderMarkdownInline(item.label, null));
  }
  headerText.appendChild(labelSpan);
  headerText.appendChild(el('span', 'codewalk-snippet-file-ref', `${item.file}:${startLine}-${endLine}`));
  header.appendChild(headerText);
  if (canOpen && header instanceof HTMLButtonElement) {
    header.addEventListener('click', () => onJumpToSnippet(itemIndex));
  }
  container.appendChild(header);

  if (isStale) {
    container.appendChild(renderStaleLabel());
  }

  if (preview && preview.ok) {
    container.appendChild(renderSnippetCode(preview.content, preview.language, startLine));
  } else if (preview && !preview.ok) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, preview.message));
    container.appendChild(warning);
    if (preview.anchorContent !== undefined && preview.language) {
      container.appendChild(renderSnippetCode(preview.anchorContent, preview.language, startLine));
    }
  }
  return container;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

const DIFF_MARKER: Record<DiffLine['type'], string> = { added: '+', removed: '-', context: '' };

/**
 * diffText 只存 hunk 本體,逐行依開頭字元判斷型態並剝除該字元;不明開頭字元
 * (含空字串行)一律視同 context、內容原樣保留、不強制剝除——見 design.md 決策 4
 * 與 Risks 段落的取捨(作者忘記幫 context 行補開頭空白時,最差只是縮排多一格)。
 * 舊版/新版行號各自獨立遞增:context 行兩者都進、added 只進新版、removed 只進舊版
 * ——跟 git diff/GitHub PR diff 算雙欄行號的邏輯相同(見 design.md 決策 4 修訂)。
 */
export function classifyDiffLines(diffText: string, oldStartLine: number, newStartLine: number): DiffLine[] {
  const rawLines = diffText.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }
  let oldLine = oldStartLine;
  let newLine = newStartLine;
  return rawLines.map((line) => {
    if (line.startsWith('+')) {
      return { type: 'added', content: line.slice(1), oldLineNumber: null, newLineNumber: newLine++ };
    }
    if (line.startsWith('-')) {
      return { type: 'removed', content: line.slice(1), oldLineNumber: oldLine++, newLineNumber: null };
    }
    return { type: 'context', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ };
  });
}

function renderDiffCode(diffLines: DiffLine[], language: string): HTMLElement {
  const code = el('div', 'codewalk-diff-code');
  const highlighted = highlightSnippetLines(diffLines.map((l) => l.content).join('\n'), language);
  diffLines.forEach((diffLine, i) => {
    const row = el('div', `codewalk-diff-line codewalk-diff-line-${diffLine.type}`);
    row.appendChild(el('span', 'codewalk-diff-line-marker', DIFF_MARKER[diffLine.type]));
    row.appendChild(
      el(
        'span',
        'codewalk-diff-line-number',
        diffLine.oldLineNumber === null ? '' : String(diffLine.oldLineNumber),
      ),
    );
    row.appendChild(
      el(
        'span',
        'codewalk-diff-line-number',
        diffLine.newLineNumber === null ? '' : String(diffLine.newLineNumber),
      ),
    );
    const lineCode = document.createElement('span');
    lineCode.className = 'codewalk-diff-line-code';
    appendTokens(lineCode, highlighted[i] ?? []);
    row.appendChild(lineCode);
    code.appendChild(row);
  });
  return code;
}

function renderDiff(
  item: Extract<CodewalkItem, { kind: 'diff' }>,
  itemIndex: number,
  onJumpToSnippet: (itemIndex: number) => void,
): HTMLElement {
  const container = el('div', 'codewalk-diff');
  const header = el('button', 'codewalk-diff-header');
  header.appendChild(icon('diff'));
  const headerText = el('span', 'codewalk-diff-header-text');
  const labelSpan = el('span', 'codewalk-diff-label');
  // label 顯示在 <button> 內部,onOpenLink 傳 null 避免巢狀 <button>(見 renderReference 的說明)。
  labelSpan.appendChild(renderMarkdownInline(item.label, null));
  headerText.appendChild(labelSpan);
  headerText.appendChild(
    el('span', 'codewalk-diff-file-ref', `${item.file}:${item.startLine}-${item.endLine}`),
  );
  header.appendChild(headerText);
  header.addEventListener('click', () => onJumpToSnippet(itemIndex));
  container.appendChild(header);

  const diffLines = classifyDiffLines(item.diffText, item.oldStartLine, item.startLine);
  container.appendChild(renderDiffCode(diffLines, detectLanguage(item.file)));
  return container;
}

export function renderItems(
  items: CodewalkItem[],
  snippetPreviews: SnippetPreviewResult[],
  itemAnchorStatuses: AnchorStepReport['items'],
  handlers: ItemHandlers,
): HTMLElement {
  const container = el('div', 'codewalk-items');
  items.forEach((item, itemIndex) => {
    switch (item.kind) {
      case 'tip':
        container.appendChild(renderAnnotation('tip', 'lightbulb', item.text, handlers.onOpenReference));
        break;
      case 'todo':
        container.appendChild(
          renderAnnotation('todo', 'circle-large-outline', item.text, handlers.onOpenReference),
        );
        break;
      case 'pitfall':
        container.appendChild(renderPitfall(item.misconception, item.reality, handlers.onOpenReference));
        break;
      case 'reference':
        container.appendChild(renderReference(item.label, item.url, handlers.onOpenReference));
        break;
      case 'snippet': {
        const status = itemAnchorStatuses.find((s) => s.itemIndex === itemIndex)?.status ?? {
          kind: 'unanchored',
        };
        container.appendChild(
          renderSnippet(item, itemIndex, snippetPreviews, status, handlers.onJumpToSnippet),
        );
        break;
      }
      case 'diff':
        container.appendChild(renderDiff(item, itemIndex, handlers.onJumpToSnippet));
        break;
    }
  });
  return container;
}
