/*
 * Type definitions and validation for the `.codewalk.json` open format.
 *
 * This file is the contract: the extension is a pure player and accepts any
 * file matching this schema, no matter who produced it (an AI generator, a
 * script, or a human writing JSON by hand).
 *
 * Every validation message emitted by validateCodewalk() is deliberately
 * hard-coded in English and never goes through t() in `shared/i18n.ts`. These
 * are diagnostics for the format contract, read by people authoring walks or
 * building generators, and they are routinely pasted into issues and CI logs
 * where a fixed language is more useful than one that follows the reader's
 * editor locale (interface-localization capability, "format validation errors
 * stay in English"; design.md decision 7).
 *
 * Keep that exception when changing any message here — do not "tidy them up"
 * by routing them through t().
 */

/** A glossary entry shown as a collapsible card during a walk: one term, one explanation. */
export interface CodewalkTerm {
  /** Short field — inline markdown only (code, bold, links). See {@link CodewalkStep.narration}. */
  term: string;
  /** Long-form field — the full markdown subset. See {@link CodewalkStep.narration}. */
  explanation: string;
}

/**
 * An explanatory element attached to a step, rendered below the narration in
 * the order given. A step may carry any number of items, in any combination.
 *
 * `text`, `misconception` and `reality` are long-form fields; every `label` is
 * a short field. See {@link CodewalkStep.narration} for what each supports.
 */
export type CodewalkItem =
  /** A side note worth knowing but not essential to the step. */
  | { kind: 'tip'; text: string }
  /**
   * A belief readers commonly hold that is wrong, paired with what is actually
   * true. Rendered as a two-line "Misconception / Reality" block.
   */
  | { kind: 'pitfall'; misconception: string; reality: string }
  /** Known work left undone in the code being walked through — not a task for the reader. */
  | { kind: 'todo'; text: string }
  /** An external link. Only http/https URLs are accepted; anything else fails validation. */
  | { kind: 'reference'; label: string; url: string }
  /**
   * A quotable region of a file, shown inline with syntax highlighting and
   * clickable to jump to. Content is read live from the workspace, so it stays
   * current; `anchor` (the code as it was when generated) lets the player
   * detect drift and fall back to the original when the file has changed.
   */
  | { kind: 'snippet'; label: string; file: string; startLine: number; endLine: number; anchor?: string }
  /**
   * A change, rendered as a two-column diff. `diffText` holds the hunk body
   * only — no `diff --git`, `---`/`+++` or `@@` headers — with each line
   * prefixed `+`, `-`, or a space for context. `oldStartLine` is where the hunk
   * starts in the pre-change file; `startLine` is where it starts in the
   * post-change file. At least one `+` or `-` line is required (otherwise
   * nothing changed and the content should be a `snippet` instead).
   */
  | {
      kind: 'diff';
      label: string;
      file: string;
      startLine: number;
      endLine: number;
      oldStartLine: number;
      diffText: string;
    };

/**
 * One stop on the walk. Selecting a step opens `file` in the editor and
 * highlights lines `startLine` through `endLine` (both 1-based and inclusive).
 */
export interface CodewalkStep {
  /** Short field — inline markdown only. See {@link CodewalkStep.narration}. */
  title: string;
  /** Path relative to the workspace root, using forward slashes. */
  file: string;
  /** First line of the region, 1-based and inclusive. */
  startLine: number;
  /** Last line of the region, 1-based and inclusive; must be >= `startLine`. */
  endLine: number;
  /**
   * The prose explaining this step. The player renders it as a closed markdown
   * subset (markdown-rendering capability) rather than showing raw markup.
   *
   * **Long-form fields** (`narration`, `term.explanation`, `tip`/`todo.text`,
   * `pitfall.misconception`/`reality`, `quiz.optionExplanations`) support all
   * six constructs:
   *
   * - inline code: `` `code` ``
   * - bold: `**text**`
   * - links: `[text](https://...)` — http/https only; other URLs render as
   *   plain text and are not clickable
   * - unordered lists: `- item` (nesting by indentation is supported)
   * - ordered lists: `1. item`
   * - level-2 headings: `## Heading` (depth 2 only; `#` and `###` or deeper
   *   are not supported)
   *
   * **Short fields** (`walk.title`, `step.title`, `term.term`, `quiz.question`,
   * `quiz.options`, any `item.label`) support only the three inline constructs
   * (code, bold, links). Lists and headings render as literal text, since block
   * markup inside a button or `<summary>` would break the layout anyway.
   *
   * **One degradation rule for everything else**: tables, images, blockquotes,
   * fenced code blocks, headings other than depth 2, raw HTML, and malformed
   * markup all render as literal text. A walk never fails to load because of
   * unsupported markup — the rest of it plays normally.
   *
   * A single newline is preserved as a line break; a blank line starts a new
   * paragraph.
   */
  narration: string;
  /**
   * The source text of lines `startLine`–`endLine` exactly as it was when this
   * walk was generated. Optional, but supplying it is what lets the player tell
   * the reader that a step no longer matches the code, and follow the region if
   * it merely moved (stale-step-detection capability).
   */
  anchor?: string;
  /** Glossary entries offered alongside this step, each collapsed until opened. */
  terms?: CodewalkTerm[];
  /** Explanatory elements rendered below the narration, in the order given. */
  items?: CodewalkItem[];
}

/** A single-answer multiple-choice question in the closing self-check quiz. */
export interface CodewalkQuizQuestion {
  /** Short field — inline markdown only. See {@link CodewalkStep.narration}. */
  question: string;
  /** At least two options, each a non-empty short field. */
  options: string[];
  /** Index into `options` of the correct answer, 0-based. */
  correctIndex: number;
  /**
   * Why each option is right or wrong, shown on the results screen. Long-form
   * fields — see {@link CodewalkStep.narration}. When present, must have exactly
   * one entry per option, aligned by index.
   */
  optionExplanations?: string[];
}

/**
 * A complete walk — the root object of a `.codewalk.json` file.
 *
 * Files are discovered in the `.codewalk/` directory at the workspace root and
 * must be named `*.codewalk.json`.
 *
 * @example A minimal valid walk (every required field, nothing optional):
 * ```json
 * {
 *   "title": "How requests get routed",
 *   "ref": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
 *   "steps": [
 *     {
 *       "title": "The entry point",
 *       "file": "src/server.ts",
 *       "startLine": 12,
 *       "endLine": 20,
 *       "narration": "Every request lands here first."
 *     }
 *   ],
 *   "quiz": [
 *     {
 *       "question": "Where does a request arrive first?",
 *       "options": ["The router", "The entry point in server.ts"],
 *       "correctIndex": 1
 *     }
 *   ]
 * }
 * ```
 */
export interface CodewalkFile {
  /** Short field — inline markdown only. See {@link CodewalkStep.narration}. */
  title: string;
  /**
   * The commit SHA this walk was generated against. The player compares it with
   * the workspace HEAD and warns the reader when they differ, since line numbers
   * may have drifted. Steps carrying an `anchor` get per-step detection instead,
   * which is more precise.
   */
  ref: string;
  /** The walk itself, played in order. At least one step is required. */
  steps: CodewalkStep[];
  /** Self-check questions shown after the last step. At least one is required. */
  quiz: CodewalkQuizQuestion[];
  /**
   * How many correct answers count as a pass. Defaults to a simple majority,
   * `ceil(quiz.length / 2)`. Must be between 1 and the number of questions.
   */
  passThreshold?: number;
  /**
   * How to regenerate this walk, described by whatever produced it — typically a
   * command line. The player only displays it and copies it to the clipboard; it
   * never parses or executes it.
   */
  regenerateHint?: string;
}

/**
 * The number of correct answers needed to pass this walk's quiz: the walk's own
 * `passThreshold` when set, otherwise a simple majority.
 *
 * @remarks
 * A simple majority works out to 3 of 5 questions, matching the fixed threshold
 * the MVP originally shipped with.
 */
export function resolvePassThreshold(walk: CodewalkFile): number {
  return walk.passThreshold ?? Math.ceil(walk.quiz.length / 2);
}

/** The outcome of a graded quiz attempt. */
export interface QuizScore {
  /** How many questions were answered correctly. */
  score: number;
  /** How many questions the quiz had. */
  total: number;
  /** Whether `score` reached {@link resolvePassThreshold}. */
  passed: boolean;
}

/**
 * Grades a set of answers against a walk's quiz.
 *
 * @param answers - The chosen option index per question, aligned by index with
 * `walk.quiz`. Use `-1` for an unanswered question.
 *
 * @remarks
 * Any invalid option index works for "unanswered", not just `-1`: it can never
 * equal a question's `correctIndex`, so no special case is needed.
 */
export function scoreQuiz(walk: CodewalkFile, answers: readonly number[]): QuizScore {
  const total = walk.quiz.length;
  const score = walk.quiz.reduce((count, question, i) => {
    return count + (answers[i] === question.correctIndex ? 1 : 0);
  }, 0);
  return { score, total, passed: score >= resolvePassThreshold(walk) };
}

/**
 * The result of validating an unknown value against the walk schema. On success
 * `value` is the same object, narrowed to {@link CodewalkFile}; on failure
 * `errors` lists every problem found, each prefixed with the JSON path it
 * occurred at (for example `steps[2].narration must be a non-empty string`).
 */
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

/**
 * Whether a value is a well-formed http or https URL.
 *
 * @remarks
 * Shared deliberately: `reference.url` validation and the inline-link
 * degradation in `ui/markdown.ts` must agree on what counts as a usable link,
 * or a URL could pass validation and then render as unclickable text.
 */
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
 * Whether a value is a non-empty path that stays inside the workspace.
 *
 * @remarks
 * Security boundary, not a style rule. Every `file` field ends up in a
 * `readFile`/`openTextDocument` call on the host, so a walk shipped in an
 * untrusted repo could otherwise name `../../../.ssh/id_rsa` and have the
 * player read it and print it into the panel. Rejecting the path here — the
 * one gate every walk passes through — stops that before any file is touched.
 *
 * Both separators are treated as such regardless of the current platform: a
 * walk written on Windows may use `\`, and a walk read on Linux must not have
 * `..\..\etc` slip through as a single innocent-looking segment.
 *
 * The host still re-checks containment when resolving the path, because this
 * function only sees the string, never the resolved location (a symlink inside
 * the workspace can point outside it).
 */
export function isWorkspaceRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  // POSIX absolute (/etc), Windows UNC (\\host\share) and drive-letter (C:\)
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  return !value.split(/[/\\]/).includes('..');
}

/**
 * Whether a hunk body contains at least one added (`+`) or removed (`-`) line.
 *
 * @remarks
 * A trailing newline produces an empty final element when splitting on `\n`,
 * which is dropped before checking. Content with no changed line isn't a diff —
 * semantically it should be a `snippet` (design.md decision 1).
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
    errors.push(`${path}.startLine must be a positive integer`);
  }
  if (!isPositiveInteger(obj.endLine)) {
    errors.push(`${path}.endLine must be a positive integer`);
  } else if (isPositiveInteger(obj.startLine) && (obj.endLine as number) < (obj.startLine as number)) {
    errors.push(`${path}.endLine must not be less than startLine`);
  }
}

function validateTerm(term: unknown, path: string, errors: string[]): void {
  if (typeof term !== 'object' || term === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const t = term as Record<string, unknown>;
  if (!isNonEmptyString(t.term)) {
    errors.push(`${path}.term must be a non-empty string`);
  }
  if (!isNonEmptyString(t.explanation)) {
    errors.push(`${path}.explanation must be a non-empty string`);
  }
}

function validateStep(step: unknown, path: string, errors: string[]): void {
  if (typeof step !== 'object' || step === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const s = step as Record<string, unknown>;
  if (!isNonEmptyString(s.title)) {
    errors.push(`${path}.title must be a non-empty string`);
  }
  if (!isWorkspaceRelativePath(s.file)) {
    errors.push(`${path}.file must be a workspace-relative path (no leading "/" and no ".." segment)`);
  }
  validateLineRange(s, path, errors);
  if (!isNonEmptyString(s.narration)) {
    errors.push(`${path}.narration must be a non-empty string`);
  }
  if (!isOptionalString(s.anchor)) {
    errors.push(`${path}.anchor must be a string`);
  }
  if (s.terms !== undefined) {
    if (!Array.isArray(s.terms)) {
      errors.push(`${path}.terms must be an array`);
    } else {
      s.terms.forEach((term, i) => validateTerm(term, `${path}.terms[${i}]`, errors));
    }
  }
  if (s.items !== undefined) {
    if (!Array.isArray(s.items)) {
      errors.push(`${path}.items must be an array`);
    } else {
      s.items.forEach((item, i) => validateItem(item, `${path}.items[${i}]`, errors));
    }
  }
}

function validateItem(item: unknown, path: string, errors: string[]): void {
  if (typeof item !== 'object' || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const it = item as Record<string, unknown>;
  switch (it.kind) {
    case 'tip':
    case 'todo':
      if (!isNonEmptyString(it.text)) {
        errors.push(`${path}.text must be a non-empty string`);
      }
      break;
    case 'pitfall':
      if (!isNonEmptyString(it.misconception)) {
        errors.push(`${path}.misconception must be a non-empty string`);
      }
      if (!isNonEmptyString(it.reality)) {
        errors.push(`${path}.reality must be a non-empty string`);
      }
      break;
    case 'reference':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label must be a non-empty string`);
      }
      if (!isHttpUrl(it.url)) {
        errors.push(`${path}.url must be a valid http/https URL`);
      }
      break;
    case 'snippet':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label must be a non-empty string`);
      }
      if (!isWorkspaceRelativePath(it.file)) {
        errors.push(`${path}.file must be a workspace-relative path (no leading "/" and no ".." segment)`);
      }
      validateLineRange(it, path, errors);
      if (!isOptionalString(it.anchor)) {
        errors.push(`${path}.anchor must be a string`);
      }
      break;
    case 'diff':
      if (!isNonEmptyString(it.label)) {
        errors.push(`${path}.label must be a non-empty string`);
      }
      if (!isWorkspaceRelativePath(it.file)) {
        errors.push(`${path}.file must be a workspace-relative path (no leading "/" and no ".." segment)`);
      }
      validateLineRange(it, path, errors);
      if (!isPositiveInteger(it.oldStartLine)) {
        errors.push(`${path}.oldStartLine must be a positive integer`);
      }
      if (!isNonEmptyString(it.diffText)) {
        errors.push(`${path}.diffText must be a non-empty string`);
      } else if (!hasAtLeastOneChangedLine(it.diffText)) {
        errors.push(`${path}.diffText must contain at least one added (+) or removed (-) line`);
      }
      break;
    default:
      errors.push(`${path}.kind must be one of tip/pitfall/todo/reference/snippet/diff`);
  }
}

function validateQuizQuestion(question: unknown, path: string, errors: string[]): void {
  if (typeof question !== 'object' || question === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const q = question as Record<string, unknown>;
  if (!isNonEmptyString(q.question)) {
    errors.push(`${path}.question must be a non-empty string`);
  }
  if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isNonEmptyString)) {
    errors.push(`${path}.options must be an array of at least 2 non-empty strings`);
  }
  if (
    typeof q.correctIndex !== 'number' ||
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    (Array.isArray(q.options) && q.correctIndex >= q.options.length)
  ) {
    errors.push(`${path}.correctIndex must be an integer within the range of options`);
  }
  if (q.optionExplanations !== undefined) {
    if (!Array.isArray(q.optionExplanations)) {
      errors.push(`${path}.optionExplanations must be an array`);
    } else {
      q.optionExplanations.forEach((explanation, i) => {
        if (!isNonEmptyString(explanation)) {
          errors.push(`${path}.optionExplanations[${i}] must be a non-empty string`);
        }
      });
      if (Array.isArray(q.options) && q.optionExplanations.length !== q.options.length) {
        errors.push(`${path}.optionExplanations must have the same length as options`);
      }
    }
  }
}

/**
 * Validates parsed JSON against the walk schema. This is the only gate between
 * a `.codewalk.json` file and the player — anything it accepts must be safe to
 * play, so it checks structure exhaustively rather than stopping at the first
 * problem.
 *
 * @param data - Already-parsed JSON. Parsing is the caller's job, so that
 * syntax errors and schema errors can be reported differently.
 * @returns Every problem found, not just the first, so an author can fix a file
 * in one pass instead of one error per run.
 */
export function validateCodewalk(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['The walk file must be a JSON object'] };
  }
  const d = data as Record<string, unknown>;

  if (!isNonEmptyString(d.title)) {
    errors.push('title must be a non-empty string');
  }
  if (!isNonEmptyString(d.ref)) {
    errors.push('ref must be a non-empty string');
  }
  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    errors.push('steps must be an array with at least 1 element');
  } else {
    d.steps.forEach((step, i) => validateStep(step, `steps[${i}]`, errors));
  }
  if (!Array.isArray(d.quiz) || d.quiz.length === 0) {
    errors.push('quiz must be an array with at least 1 question');
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
      errors.push('passThreshold must be an integer between 1 and the number of quiz questions');
    }
  }

  if (d.regenerateHint !== undefined && !isNonEmptyString(d.regenerateHint)) {
    errors.push('regenerateHint must be a non-empty string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, value: data as CodewalkFile };
}
