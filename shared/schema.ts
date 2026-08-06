export interface CodewalkTerm {
  /** 短欄位,markdown 子集僅行內三種——見 CodewalkStep.narration 的說明。 */
  term: string;
  /** 長文欄位,markdown 子集完整六種——見 CodewalkStep.narration 的說明。 */
  explanation: string;
}

export type CodewalkItem =
  // tip/todo.text、pitfall.misconception/reality 為長文欄位;reference/snippet/diff.label 為短欄位——見 CodewalkStep.narration 的說明。
  | { kind: 'tip'; text: string }
  | { kind: 'pitfall'; misconception: string; reality: string }
  | { kind: 'todo'; text: string }
  | { kind: 'reference'; label: string; url: string }
  | { kind: 'snippet'; label: string; file: string; startLine: number; endLine: number; anchor?: string }
  | {
      kind: 'diff';
      label: string;
      file: string;
      startLine: number;
      endLine: number;
      oldStartLine: number;
      diffText: string;
    };

export interface CodewalkStep {
  /** 短欄位,markdown 子集僅行內三種——見下方 narration 的說明。 */
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  /**
   * 播放器將此欄位依封閉的 markdown 子集渲染(markdown-rendering capability),
   * 而非顯示原始標記字元。**長文欄位**(narration、term.explanation、tip/todo.text、
   * pitfall.misconception/reality、quiz.optionExplanations)支援全部六種語法:
   *
   * - 行內程式碼:`` `code` ``
   * - 粗體:`**text**`
   * - 連結:`[文字](https://...)`——僅 http/https 生效,其餘網址原樣顯示、不可點擊
   * - 無序清單:`- 項目`(支援縮排巢狀)
   * - 有序清單:`1. 項目`
   * - 二級小標:`## 標題`(僅 depth 2;`#`、`###` 以下不支援)
   *
   * **短欄位**(walk.title、step.title、term.term、quiz.question、quiz.options、
   * item.label)只支援行內三種(程式碼/粗體/連結),清單與小標不生效、原樣顯示為
   * 純文字(在按鈕、`<summary>` 這類元件裡放區塊語法本來就會破壞版面)。
   *
   * **降級規則統一**:表格、圖片、引用區塊、程式碼區塊(```)、`#`/`###` 以下標題、
   * 原始 HTML、格式錯誤的語法——一律原樣顯示為純文字,不影響同一份導讀其餘部分
   * 的載入與播放。單一換行維持斷行(不會被合併成一行),空行才分段落。
   */
  narration: string;
  /** 產出當下該行段的程式碼原文,用於失準偵測(見 stale-step-detection capability)。 */
  anchor?: string;
  terms?: CodewalkTerm[];
  items?: CodewalkItem[];
}

export interface CodewalkQuizQuestion {
  /** 短欄位,markdown 子集僅行內三種——見 CodewalkStep.narration 的說明。 */
  question: string;
  /** 短欄位,markdown 子集僅行內三種——見 CodewalkStep.narration 的說明。 */
  options: string[];
  correctIndex: number;
  /** 長文欄位,markdown 子集完整六種——見 CodewalkStep.narration 的說明。 */
  optionExplanations?: string[];
}

export interface CodewalkFile {
  /** 短欄位,markdown 子集僅行內三種——見 CodewalkStep.narration 的說明。 */
  title: string;
  ref: string;
  steps: CodewalkStep[];
  quiz: CodewalkQuizQuestion[];
  /** 過關門檻(答對題數)。省略時預設為簡單多數(ceil(題數/2))。 */
  passThreshold?: number;
  /** 重新產生本導讀的方式,由產生器自述;播放器只顯示與複製,不解讀內容。 */
  regenerateHint?: string;
}

/**
 * 沒有指定 passThreshold 時的預設過關門檻:簡單多數。
 * 5 題時等於 3 題,與 MVP 最初決策的固定門檻一致。
 */
export function resolvePassThreshold(walk: CodewalkFile): number {
  return walk.passThreshold ?? Math.ceil(walk.quiz.length / 2);
}

export interface QuizScore {
  score: number;
  total: number;
  passed: boolean;
}

/**
 * 未作答的題目以 -1(或任何非法選項索引)表示,天然不會等於任一題的
 * correctIndex,不需要另外特判「未作答」。
 */
export function scoreQuiz(walk: CodewalkFile, answers: readonly number[]): QuizScore {
  const total = walk.quiz.length;
  const score = walk.quiz.reduce((count, question, i) => {
    return count + (answers[i] === question.correctIndex ? 1 : 0);
  }, 0);
  return { score, total, passed: score >= resolvePassThreshold(walk) };
}

export type ValidationResult = { valid: true; value: CodewalkFile } | { valid: false; errors: string[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/** 判定是否為合法 http/https 網址;`reference.url` 驗證與 ui/markdown.ts 的內嵌連結降級共用同一判定。 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * diffText 只存 hunk 本體(不含 diff --git/---/+++/@@ @@ 檔頭),依 '\n' 切行
 * 後捨棄結尾換行產生的尾端空字串元素,要求至少一行以 '+' 或 '-' 開頭——否則
 * 這段內容沒有任何改動,語意上該用 snippet 表達,不算 diff(見 design.md 決策 1)。
 */
function hasAtLeastOneChangedLine(diffText: string): boolean {
  const lines = diffText.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.some((line) => line.startsWith('+') || line.startsWith('-'));
}

function validateLineRange(obj: Record<string, unknown>, path: string, errors: string[]): void {
  if (!isPositiveInteger(obj.startLine)) {
    errors.push(`${path}.startLine 必須是正整數`);
  }
  if (!isPositiveInteger(obj.endLine)) {
    errors.push(`${path}.endLine 必須是正整數`);
  } else if (isPositiveInteger(obj.startLine) && (obj.endLine as number) < (obj.startLine as number)) {
    errors.push(`${path}.endLine 不可小於 startLine`);
  }
}

function validateTerm(term: unknown, path: string, errors: string[]): void {
  if (typeof term !== 'object' || term === null) {
    errors.push(`${path} 必須是物件`);
    return;
  }
  const t = term as Record<string, unknown>;
  if (!isNonEmptyString(t.term)) {
    errors.push(`${path}.term 必須是非空字串`);
  }
  if (!isNonEmptyString(t.explanation)) {
    errors.push(`${path}.explanation 必須是非空字串`);
  }
}

function validateStep(step: unknown, path: string, errors: string[]): void {
  if (typeof step !== 'object' || step === null) {
    errors.push(`${path} 必須是物件`);
    return;
  }
  const s = step as Record<string, unknown>;
  if (!isNonEmptyString(s.title)) {
    errors.push(`${path}.title 必須是非空字串`);
  }
  if (!isNonEmptyString(s.file)) {
    errors.push(`${path}.file 必須是非空字串`);
  }
  validateLineRange(s, path, errors);
  if (!isNonEmptyString(s.narration)) {
    errors.push(`${path}.narration 必須是非空字串`);
  }
  if (!isOptionalString(s.anchor)) {
    errors.push(`${path}.anchor 必須是字串`);
  }
  if (s.terms !== undefined) {
    if (!Array.isArray(s.terms)) {
      errors.push(`${path}.terms 必須是陣列`);
    } else {
      s.terms.forEach((term, i) => validateTerm(term, `${path}.terms[${i}]`, errors));
    }
  }
  if (s.items !== undefined) {
    if (!Array.isArray(s.items)) {
      errors.push(`${path}.items 必須是陣列`);
    } else {
      s.items.forEach((item, i) => validateItem(item, `${path}.items[${i}]`, errors));
    }
  }
}

function validateItem(item: unknown, path: string, errors: string[]): void {
  if (typeof item !== 'object' || item === null) {
    errors.push(`${path} 必須是物件`);
    return;
  }
  const it = item as Record<string, unknown>;
  switch (it.kind) {
    case 'tip':
    case 'todo':
      if (!isNonEmptyString(it.text)) {
        errors.push(`${path}.text 必須是非空字串`);
      }
      break;
    case 'pitfall':
      if (!isNonEmptyString(it.misconception)) {
        errors.push(`${path}.misconception 必須是非空字串`);
      }
      if (!isNonEmptyString(it.reality)) {
        errors.push(`${path}.reality 必須是非空字串`);
      }
      break;
    case 'reference':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label 必須是非空字串`);
      }
      if (!isHttpUrl(it.url)) {
        errors.push(`${path}.url 必須是合法的 http/https 網址`);
      }
      break;
    case 'snippet':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label 必須是非空字串`);
      }
      if (!isNonEmptyString(it.file)) {
        errors.push(`${path}.file 必須是非空字串`);
      }
      validateLineRange(it, path, errors);
      if (!isOptionalString(it.anchor)) {
        errors.push(`${path}.anchor 必須是字串`);
      }
      break;
    case 'diff':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label 必須是非空字串`);
      }
      if (!isNonEmptyString(it.file)) {
        errors.push(`${path}.file 必須是非空字串`);
      }
      validateLineRange(it, path, errors);
      if (!isPositiveInteger(it.oldStartLine)) {
        errors.push(`${path}.oldStartLine 必須是正整數`);
      }
      if (!isNonEmptyString(it.diffText)) {
        errors.push(`${path}.diffText 必須是非空字串`);
      } else if (!hasAtLeastOneChangedLine(it.diffText)) {
        errors.push(`${path}.diffText 至少要有一行新增(+)或刪除(-)`);
      }
      break;
    default:
      errors.push(`${path}.kind 必須是 tip/pitfall/todo/reference/snippet/diff 其中之一`);
  }
}

function validateQuizQuestion(question: unknown, path: string, errors: string[]): void {
  if (typeof question !== 'object' || question === null) {
    errors.push(`${path} 必須是物件`);
    return;
  }
  const q = question as Record<string, unknown>;
  if (!isNonEmptyString(q.question)) {
    errors.push(`${path}.question 必須是非空字串`);
  }
  if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isNonEmptyString)) {
    errors.push(`${path}.options 必須是至少 2 個非空字串的陣列`);
  }
  if (
    typeof q.correctIndex !== 'number' ||
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    (Array.isArray(q.options) && q.correctIndex >= q.options.length)
  ) {
    errors.push(`${path}.correctIndex 必須是 options 範圍內的整數`);
  }
  if (q.optionExplanations !== undefined) {
    if (!Array.isArray(q.optionExplanations)) {
      errors.push(`${path}.optionExplanations 必須是陣列`);
    } else {
      q.optionExplanations.forEach((explanation, i) => {
        if (!isNonEmptyString(explanation)) {
          errors.push(`${path}.optionExplanations[${i}] 必須是非空字串`);
        }
      });
      if (Array.isArray(q.options) && q.optionExplanations.length !== q.options.length) {
        errors.push(`${path}.optionExplanations 的長度必須與 options 相同`);
      }
    }
  }
}

export function validateCodewalk(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['導讀檔案必須是 JSON 物件'] };
  }
  const d = data as Record<string, unknown>;

  if (!isNonEmptyString(d.title)) {
    errors.push('title 必須是非空字串');
  }
  if (!isNonEmptyString(d.ref)) {
    errors.push('ref 必須是非空字串');
  }
  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    errors.push('steps 必須是至少含 1 個元素的陣列');
  } else {
    d.steps.forEach((step, i) => validateStep(step, `steps[${i}]`, errors));
  }
  if (!Array.isArray(d.quiz) || d.quiz.length === 0) {
    errors.push('quiz 必須是至少含 1 題的陣列');
  } else {
    d.quiz.forEach((q, i) => validateQuizQuestion(q, `quiz[${i}]`, errors));
  }

  if (d.passThreshold !== undefined) {
    const quizLength = Array.isArray(d.quiz) ? d.quiz.length : undefined;
    if (
      typeof d.passThreshold !== 'number' ||
      !Number.isInteger(d.passThreshold) ||
      d.passThreshold < 1 ||
      (quizLength !== undefined && d.passThreshold > quizLength)
    ) {
      errors.push('passThreshold 必須是 1 到 quiz 題數之間的整數');
    }
  }

  if (d.regenerateHint !== undefined && !isNonEmptyString(d.regenerateHint)) {
    errors.push('regenerateHint 必須是非空字串');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, value: data as CodewalkFile };
}
