export interface CodewalkTerm {
  term: string;
  explanation: string;
}

export interface CodewalkStep {
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  narration: string;
  terms?: CodewalkTerm[];
}

export interface CodewalkQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CodewalkFile {
  title: string;
  ref: string;
  steps: CodewalkStep[];
  quiz: CodewalkQuizQuestion[];
  /** 過關門檻(答對題數)。省略時預設為簡單多數(ceil(題數/2))。 */
  passThreshold?: number;
}

/**
 * 沒有指定 passThreshold 時的預設過關門檻:簡單多數。
 * 5 題時等於 3 題,與 MVP 最初決策的固定門檻一致。
 */
export function resolvePassThreshold(walk: CodewalkFile): number {
  return walk.passThreshold ?? Math.ceil(walk.quiz.length / 2);
}

export type ValidationResult =
  | { valid: true; value: CodewalkFile }
  | { valid: false; errors: string[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
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
  if (!isPositiveInteger(s.startLine)) {
    errors.push(`${path}.startLine 必須是正整數`);
  }
  if (!isPositiveInteger(s.endLine)) {
    errors.push(`${path}.endLine 必須是正整數`);
  } else if (isPositiveInteger(s.startLine) && (s.endLine as number) < (s.startLine as number)) {
    errors.push(`${path}.endLine 不可小於 startLine`);
  }
  if (!isNonEmptyString(s.narration)) {
    errors.push(`${path}.narration 必須是非空字串`);
  }
  if (s.terms !== undefined) {
    if (!Array.isArray(s.terms)) {
      errors.push(`${path}.terms 必須是陣列`);
    } else {
      s.terms.forEach((term, i) => validateTerm(term, `${path}.terms[${i}]`, errors));
    }
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

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, value: data as CodewalkFile };
}
