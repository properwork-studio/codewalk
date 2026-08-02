import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import go from 'highlight.js/lib/languages/go';
import groovy from 'highlight.js/lib/languages/groovy';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('groovy', groovy);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('sql', sql);
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
