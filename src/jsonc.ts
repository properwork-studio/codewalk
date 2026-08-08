/**
 * VS Code 主題檔是 JSONC(允許 // 與 /* 註解、trailing comma),`JSON.parse`
 * 直接讀會失敗。用狀態機逐字掃描剝除註解——只在字串外才視為註解起點,避免
 * 誤判字串內容裡的 "//"(例如色碼註解或 URL)。
 */
function stripJsonComments(text: string): string {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += char;
      if (char === '\\') {
        result += next ?? '';
        i++;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    result += char;
  }
  return result;
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * 解析 JSONC(允許註解與 trailing comma 的 JSON),用於讀取 VS Code 主題定義檔。
 *
 * @throws 剝除註解與 trailing comma 後仍不是合法 JSON 時,由 `JSON.parse` 拋出
 */
export function parseJsonc(text: string): unknown {
  return JSON.parse(stripTrailingCommas(stripJsonComments(text)));
}
