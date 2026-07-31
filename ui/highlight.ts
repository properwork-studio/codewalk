import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml); // 也註冊 'html' 別名
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 未註冊的語言(如 host 判斷不出副檔名對應語言時回傳的 'plaintext')不呼叫
 * highlightAuto 猜語言——猜錯顏色比不上色更容易誤導讀者,直接顯示逃脫過的純文字。
 */
export function highlightSnippet(content: string, language: string): string {
  if (hljs.getLanguage(language)) {
    return hljs.highlight(content, { language }).value;
  }
  return escapeHtml(content);
}

const TOKEN_PATTERN = /<span[^>]*>|<\/span>|[^<]+/g;

/**
 * highlight.js 對整段程式碼輸出一整塊 HTML,多行的 <span>(如跨行註解/字串)
 * 沒辦法直接用 '\n' 切開——會留下沒有配對的開始或結束標籤。這裡逐一掃描
 * token,追蹤目前開著的 <span> 堆疊:換行時先補上對應數量的 </span> 結束
 * 這一行,下一行開頭再重新打開同樣的標籤,確保每一行回傳的 HTML 都是
 * 標籤配對完整、可以獨立塞進一個 DOM 節點。
 */
function splitHighlightedLines(html: string): string[] {
  const openTags: string[] = [];
  const lines: string[] = [];
  let currentLine = '';

  const tokens = html.match(TOKEN_PATTERN) ?? [];
  for (const token of tokens) {
    if (token === '</span>') {
      currentLine += token;
      openTags.pop();
      continue;
    }
    if (token.startsWith('<span')) {
      currentLine += token;
      openTags.push(token);
      continue;
    }
    const parts = token.split('\n');
    parts.forEach((part, i) => {
      currentLine += part;
      if (i < parts.length - 1) {
        currentLine += '</span>'.repeat(openTags.length);
        lines.push(currentLine);
        currentLine = openTags.join('');
      }
    });
  }
  lines.push(currentLine);
  return lines;
}

/**
 * 逐行版本的 highlightSnippet(),給需要顯示行號的 snippet 預覽使用。
 */
export function highlightSnippetLines(content: string, language: string): string[] {
  return splitHighlightedLines(highlightSnippet(content, language));
}
