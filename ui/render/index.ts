import { detectLanguage } from '../../shared/language';
import {
  effectiveLineRange,
  type AnchorStatus,
  type AttemptSummary,
  type SnippetPreviewResult,
  type WalkFileSummary,
} from '../../shared/protocol';
import type { CodewalkQuizQuestion, CodewalkStep } from '../../shared/schema';
import { renderMarkdownBlock, renderMarkdownInline, type OpenLinkHandler } from '../markdown';
import { formatAbsoluteDateTime, formatRelativeTime } from '../relativeTime';
import { isAtLastStep, type QuizResult, type QuizState, type WalkingState } from '../state';
import { el, icon } from './dom';
import { renderItems, renderSnippetCode, renderStaleLabel } from './items';

export interface FileListHandlers {
  onSelect: (path: string) => void;
  onToggleMenu: (path: string) => void;
  onTriggerClear: (path: string) => void;
  onResume: (path: string) => void;
}

/**
 * 跨重啟的接續入口——併入既有的作答紀錄版位,沒有進度時不顯示、不保留
 * 空白版位(reading-progress capability「導讀列表顯示接續入口」,design.md
 * 決策 10)。只顯示圖示+步數(不帶「接續上次」文字),避免跟標題按鈕搶
 * 寬度、把中文標題擠成逐字換行;完整說明改放 title/aria-label。
 */
function renderContinueButton(
  path: string,
  stepIndex: number,
  onResume: (path: string) => void,
): HTMLElement {
  const label = `接續上次(第 ${stepIndex + 1} 步)`;
  const button = el('button', 'codewalk-continue-button');
  button.appendChild(icon('debug-continue'));
  button.appendChild(el('span', undefined, String(stepIndex + 1)));
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => onResume(path));
  return button;
}

/**
 * 只留一顆通過/未通過的小圖示,分數與時間收進 hover/focus 才顯示的自製
 * tooltip——原本常駐顯示的「3/5 5小時前」文字讓整列右側視覺過重,列表
 * 項目一多就很擁擠(人工回饋)。原生 title 屬性在 webview 裡實測不會顯示,
 * 所以沿用既有的純 CSS tooltip 機制,只是把「一直看得到」改成「需要才看」。
 */
function renderAttemptSummary(attempt: AttemptSummary): HTMLElement {
  const row = el('div', `codewalk-attempt-summary ${attempt.passed ? 'is-passed' : 'is-failed'}`);
  row.tabIndex = 0;
  // 原生 title:webview 內不會顯示(已知限制),留給其他環境(如瀏覽器獨立
  // 開啟)與輔助工具用,不是本體。
  row.title = formatAbsoluteDateTime(attempt.at);
  row.appendChild(icon(attempt.passed ? 'pass' : 'error'));
  const tooltip = el(
    'span',
    'codewalk-attempt-tooltip',
    `${attempt.score}/${attempt.total} · ${formatRelativeTime(attempt.at, Date.now())}`,
  );
  tooltip.setAttribute('role', 'tooltip');
  row.appendChild(tooltip);
  return row;
}

/**
 * 常駐 trash 圖示容易被誤讀成「刪除這份導讀檔案」——改成揭露式選單,展開後
 * 才看到文字明確的「清除 Quiz 紀錄」。選單永遠只有這一個動作,不做成完整
 * ARIA menu widget(方向鍵環狀導覽等),用一般 <button> 天然滿足 Tab 順序
 * 即可(design.md 決策 6)。
 */
function renderAttemptMenu(
  path: string,
  isOpen: boolean,
  isPending: boolean,
  handlers: Pick<FileListHandlers, 'onToggleMenu' | 'onTriggerClear'>,
): HTMLElement {
  const wrapper = el('div', 'codewalk-attempt-menu');

  const trigger = el('button', 'codewalk-attempt-menu-trigger');
  trigger.appendChild(icon('kebab-vertical'));
  trigger.title = '更多動作';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', String(isOpen));
  trigger.addEventListener('click', () => handlers.onToggleMenu(path));
  wrapper.appendChild(trigger);

  if (isOpen) {
    const popover = el('div', 'codewalk-attempt-menu-popover');
    const clearItem = el(
      'button',
      `codewalk-attempt-menu-item${isPending ? ' is-pending' : ''}`,
      isPending ? '確定清除?' : '清除 Quiz 紀錄',
    );
    clearItem.addEventListener('click', () => handlers.onTriggerClear(path));
    popover.appendChild(clearItem);
    wrapper.appendChild(popover);
  }

  return wrapper;
}

export function renderFileList(
  files: WalkFileSummary[],
  state: { openMenuPath: string | null; pendingClearPath: string | null },
  handlers: FileListHandlers,
): HTMLElement {
  const container = el('div', 'codewalk-file-list');
  container.appendChild(el('h2', undefined, '選擇導讀'));
  if (files.length === 0) {
    container.appendChild(
      el('p', 'codewalk-empty', '找不到導讀檔案(workspace 內沒有 .codewalk/*.codewalk.json)'),
    );
    return container;
  }
  const list = el('ul');
  for (const file of files) {
    // 展開中的選單用 position:absolute 溢出到下一列的視覺範圍——row 本身若
    // 沒有明確的 z-index,DOM 順序在後的下一列會蓋過它(row 沒有自己的堆疊
    // 層級,絕對定位子元素只能在 row 內部比較 z-index,贏不了「後面的整列」)。
    // 這顆 class 讓目前開著選單的那一列明確拿到較高的堆疊層級。
    const isMenuOpen = state.openMenuPath === file.path;
    const item = el('li', `codewalk-file-item-row${isMenuOpen ? ' has-open-menu' : ''}`);
    item.dataset.walkPath = file.path;

    const button = el('button', 'codewalk-file-item');
    button.appendChild(icon('book'));
    const titleSpan = el('span', 'codewalk-file-item-title');
    // 顯示在 <button> 內部,onOpenLink 傳 null 避免巢狀 <button>(見 renderReference 的說明)。
    titleSpan.appendChild(renderMarkdownInline(file.title, null));
    button.appendChild(titleSpan);
    button.addEventListener('click', () => handlers.onSelect(file.path));
    item.appendChild(button);

    // 順序:通過/未通過狀態 → 接續(可直接點擊觸發,常用動作不藏進選單)
    // → 更多動作選單(分數細節、清除紀錄收在裡面,次要/破壞性操作才需要
    // 多一步)。三者都是無底色純圖示,人工回饋:原本的色塊徽章太搶標題版面。
    if (file.lastAttempt) {
      item.appendChild(renderAttemptSummary(file.lastAttempt));
    }

    if (file.progress) {
      item.appendChild(renderContinueButton(file.path, file.progress.stepIndex, handlers.onResume));
    }

    if (file.lastAttempt) {
      item.appendChild(
        renderAttemptMenu(file.path, state.openMenuPath === file.path, state.pendingClearPath === file.path, {
          onToggleMenu: handlers.onToggleMenu,
          onTriggerClear: handlers.onTriggerClear,
        }),
      );
    }

    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}

export function renderError(message: string): HTMLElement {
  const container = el('div', 'codewalk-error');
  container.appendChild(icon('error'));
  container.appendChild(el('p', undefined, message));
  return container;
}

export interface WalkingHandlers {
  onNext: () => void;
  onPrev: () => void;
  onToggleTerm: (term: string) => void;
  onEnterQuiz: () => void;
  onOpenReference: (url: string) => void;
  onJumpToSnippet: (itemIndex: number) => void;
  onBackToList: () => void;
  onOpenStaleFile: () => void;
  onCopyRegenerateHint: () => void;
  onRevealCurrentStep: () => void;
}

/** 導讀含任一失準目標時顯示,提示與 refDrifted 使用同一套系統層級警告樣式
 * (stale-step-detection capability「重生引導」)。 */
function renderRegeneratePrompt(
  regenerateHint: string | undefined,
  onCopyRegenerateHint: () => void,
): HTMLElement {
  const warning = el('div', 'codewalk-warning codewalk-regenerate-prompt');
  warning.appendChild(icon('warning'));
  const text = el('div', 'codewalk-regenerate-prompt-text');
  text.appendChild(el('span', undefined, '這份導讀有步驟已與現行程式碼不符,建議重新產生'));
  warning.appendChild(text);
  if (regenerateHint) {
    const copyButton = el('button', 'codewalk-regenerate-copy');
    copyButton.appendChild(icon('copy'));
    copyButton.appendChild(el('span', undefined, '複製重生指令'));
    copyButton.addEventListener('click', onCopyRegenerateHint);
    warning.appendChild(copyButton);
  }
  return warning;
}

/** step 本身沒有既有的預覽 UI,只在失準時插入(design.md 決策 4)。 */
function renderStepStaleBlock(
  step: CodewalkStep,
  status: Extract<AnchorStatus, { kind: 'stale' }>,
  onOpenStaleFile: () => void,
): HTMLElement {
  const container = el('div', 'codewalk-snippet codewalk-snippet--stale');
  const canOpen = status.reason !== 'fileMissing';
  const header = el(canOpen ? 'button' : 'div', 'codewalk-snippet-header');
  header.appendChild(icon('warning'));
  const headerText = el('span', 'codewalk-snippet-header-text');
  headerText.appendChild(el('span', 'codewalk-snippet-label', canOpen ? '開啟現行檔案' : '找不到檔案'));
  headerText.appendChild(el('span', 'codewalk-snippet-file-ref', step.file));
  header.appendChild(headerText);
  if (canOpen && header instanceof HTMLButtonElement) {
    header.addEventListener('click', onOpenStaleFile);
  }
  container.appendChild(header);
  container.appendChild(renderStaleLabel());
  if (step.anchor && step.anchor.trim().length > 0) {
    container.appendChild(renderSnippetCode(step.anchor, detectLanguage(step.file), step.startLine));
  }
  return container;
}

function createStepDots(current: number, total: number): HTMLElement {
  const dots = el('div', 'codewalk-step-dots');
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', `第 ${current + 1} / ${total} 步`);
  for (let i = 0; i < total; i++) {
    const classes = ['codewalk-step-dot'];
    if (i === current) classes.push('is-current');
    else if (i < current) classes.push('is-done');
    const dot = el('span', classes.join(' '));
    dot.title = `第 ${i + 1} 步`;
    dots.appendChild(dot);
  }
  return dots;
}

export function renderWalking(
  state: WalkingState,
  handlers: WalkingHandlers,
  jumpError: string | null = null,
  animateStepChange = true,
  snippetPreviews: SnippetPreviewResult[] = [],
): HTMLElement {
  const step = state.walk.steps[state.stepIndex];
  const stepReport = state.anchorReport.steps[state.stepIndex] ?? {
    step: { kind: 'unanchored' as const },
    items: [],
  };
  const container = el('div', `codewalk-walking${animateStepChange ? ' is-step-transition' : ''}`);

  const backButton = el('button', 'codewalk-back-to-list');
  backButton.appendChild(icon('list-unordered'));
  backButton.appendChild(el('span', undefined, '返回列表'));
  backButton.addEventListener('click', handlers.onBackToList);
  container.appendChild(backButton);

  // 導讀含任一具備有效 anchor 的目標時,改以逐步失準狀態取代整份漂移警告
  // (walk-player capability「ref 漂移偵測」MODIFIED requirement)。
  if (state.refDrifted && !state.anchorReport.anyAnchored) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, '目前 commit 與導讀釘住的版本不同,行號可能漂移'));
    container.appendChild(warning);
  }

  if (state.anchorReport.anyStale) {
    container.appendChild(renderRegeneratePrompt(state.walk.regenerateHint, handlers.onCopyRegenerateHint));
  }

  if (jumpError) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, jumpError));
    container.appendChild(warning);
  }

  const walkTitle = document.createElement('h2');
  walkTitle.appendChild(renderMarkdownInline(state.walk.title, handlers.onOpenReference));
  container.appendChild(walkTitle);
  container.appendChild(
    el('p', 'codewalk-progress', `第 ${state.stepIndex + 1} / ${state.walk.steps.length} 步`),
  );
  container.appendChild(createStepDots(state.stepIndex, state.walk.steps.length));
  const stepTitle = document.createElement('h3');
  stepTitle.appendChild(renderMarkdownInline(step.title, handlers.onOpenReference));
  container.appendChild(stepTitle);
  const { startLine: stepStartLine, endLine: stepEndLine } = effectiveLineRange(step, stepReport.step);
  container.appendChild(el('p', 'codewalk-file-ref', `${step.file}:${stepStartLine}-${stepEndLine}`));

  // 每個 step 都必定有對應的程式碼位置(schema 的 file/startLine/endLine 為必填),
  // 所以這顆按鈕一律顯示——恢復閱讀進度後,把編輯器帶回目前步驟的顯式入口
  // (walk-player capability「回到本步專案位置」,design.md 決策 8)。
  const revealButton = el('button', 'codewalk-reveal-step');
  revealButton.appendChild(icon('go-to-file'));
  revealButton.appendChild(el('span', undefined, '回到本步專案位置'));
  // 快捷鍵主鍵是 Home,不是字母鍵——中文輸入法作用中時字母鍵的 keydown 可能
  // 被攔截去組字(實測結果),Home 不受影響;英文鍵盤環境另外保留 R 當備用鍵。
  revealButton.title = '回到本步專案位置(Home)';
  revealButton.addEventListener('click', handlers.onRevealCurrentStep);
  container.appendChild(revealButton);

  if (stepReport.step.kind === 'stale') {
    container.appendChild(renderStepStaleBlock(step, stepReport.step, handlers.onOpenStaleFile));
  }

  const narration = el('div', 'codewalk-narration');
  narration.appendChild(renderMarkdownBlock(step.narration, handlers.onOpenReference));
  container.appendChild(narration);

  if (step.items && step.items.length > 0) {
    container.appendChild(
      renderItems(step.items, snippetPreviews, stepReport.items, {
        onOpenReference: handlers.onOpenReference,
        onJumpToSnippet: handlers.onJumpToSnippet,
      }),
    );
  }

  if (step.terms && step.terms.length > 0) {
    const termsContainer = el('div', 'codewalk-terms');
    for (const term of step.terms) {
      const details = document.createElement('details');
      details.className = 'codewalk-term';
      details.open = state.expandedTerms.has(term.term);
      const summary = document.createElement('summary');
      summary.appendChild(icon('symbol-keyword', 'codewalk-term-icon'));
      const termLabel = el('span', 'codewalk-term-label');
      // term.term 顯示在有 click handler 的 <summary> 內,onOpenLink 傳 null
      // 避免巢狀可點擊元素(見 renderReference 的說明)。
      termLabel.appendChild(renderMarkdownInline(term.term, null));
      summary.appendChild(termLabel);
      summary.appendChild(icon('chevron-right', 'codewalk-term-chevron'));
      // 用 click + preventDefault 取代監聽 'toggle':設定 details.open 本身就會非同步觸發
      // 'toggle' 事件,若同時監聽 'toggle' 會在下一輪重繪時被自己觸發的事件二次呼叫,
      // 造成「點開又立刻收合」的無窮迴圈。
      summary.addEventListener('click', (event) => {
        event.preventDefault();
        handlers.onToggleTerm(term.term);
      });
      details.appendChild(summary);
      const explanation = el('div');
      explanation.appendChild(renderMarkdownBlock(term.explanation, handlers.onOpenReference));
      details.appendChild(explanation);
      termsContainer.appendChild(details);
    }
    container.appendChild(termsContainer);
  }

  const nav = el('div', 'codewalk-nav');
  const prevButton = el('button', 'codewalk-nav-prev');
  prevButton.appendChild(icon('chevron-left'));
  prevButton.appendChild(el('span', undefined, '上一步'));
  prevButton.disabled = state.stepIndex === 0;
  prevButton.addEventListener('click', handlers.onPrev);
  const nextButton = el('button', 'codewalk-nav-next');
  nextButton.appendChild(el('span', undefined, '下一步'));
  nextButton.appendChild(icon('chevron-right'));
  nextButton.disabled = isAtLastStep(state);
  nextButton.addEventListener('click', handlers.onNext);
  nav.appendChild(prevButton);
  nav.appendChild(nextButton);
  container.appendChild(nav);

  if (isAtLastStep(state)) {
    const completeBanner = el('div', 'codewalk-walk-complete');
    completeBanner.appendChild(icon('rocket'));
    completeBanner.appendChild(el('p', 'codewalk-hint', '已到達最後一步,可以開始自測'));
    const quizButton = el('button', 'codewalk-enter-quiz', '開始 Quiz 自測');
    quizButton.addEventListener('click', handlers.onEnterQuiz);
    completeBanner.appendChild(quizButton);
    container.appendChild(completeBanner);
  }

  return container;
}

export interface QuizHandlers {
  onSelectAnswer: (questionIndex: number, optionIndex: number) => void;
  onSubmitQuiz: () => void;
  onCancelQuiz: () => void;
  onOpenReference: OpenLinkHandler;
}

export function renderQuiz(state: QuizState, handlers: QuizHandlers): HTMLElement {
  const container = el('div', 'codewalk-quiz');
  container.appendChild(el('h2', undefined, 'Quiz 自測'));

  const answeredCount = state.answers.filter((a) => a !== null).length;
  container.appendChild(
    el('p', 'codewalk-quiz-progress', `已作答 ${answeredCount} / ${state.walk.quiz.length} 題`),
  );
  const progressDots = el('div', 'codewalk-step-dots');
  progressDots.setAttribute('role', 'img');
  progressDots.setAttribute('aria-label', `已作答 ${answeredCount} / ${state.walk.quiz.length} 題`);
  state.answers.forEach((answer, i) => {
    const dot = el('span', `codewalk-step-dot${answer !== null ? ' is-done' : ''}`);
    dot.title = `第 ${i + 1} 題${answer !== null ? '(已作答)' : ''}`;
    progressDots.appendChild(dot);
  });
  container.appendChild(progressDots);

  state.walk.quiz.forEach((question, qIndex) => {
    const block = el('div', 'codewalk-quiz-question');
    const header = el('div', 'codewalk-quiz-question-header');
    header.appendChild(el('span', 'codewalk-quiz-question-number', String(qIndex + 1)));
    const questionTitle = el('p', 'codewalk-quiz-question-title');
    questionTitle.appendChild(renderMarkdownInline(question.question, handlers.onOpenReference));
    header.appendChild(questionTitle);
    block.appendChild(header);
    const optionsList = el('ul', 'codewalk-quiz-options');
    question.options.forEach((option, optIndex) => {
      const item = el('li');
      const isSelected = state.answers[qIndex] === optIndex;
      const label = el('label', `codewalk-quiz-option${isSelected ? ' is-selected' : ''}`);
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'codewalk-quiz-option-input';
      radio.name = `codewalk-quiz-q${qIndex}`;
      radio.checked = isSelected;
      radio.addEventListener('change', () => handlers.onSelectAnswer(qIndex, optIndex));
      const indicator = el('span', 'codewalk-quiz-option-indicator');
      indicator.appendChild(icon('check'));
      const text = el('span', 'codewalk-quiz-option-text');
      // 顯示在包著 radio 的 <label> 內部,onOpenLink 傳 null(見 renderReference 的說明)。
      text.appendChild(renderMarkdownInline(option, null));
      label.appendChild(radio);
      label.appendChild(indicator);
      label.appendChild(text);
      item.appendChild(label);
      optionsList.appendChild(item);
    });
    block.appendChild(optionsList);
    container.appendChild(block);
  });

  const actions = el('div', 'codewalk-quiz-actions');
  const cancelButton = el('button', 'codewalk-quiz-cancel');
  cancelButton.appendChild(icon('chevron-left'));
  cancelButton.appendChild(el('span', undefined, '取消,回到最後一步'));
  cancelButton.addEventListener('click', handlers.onCancelQuiz);

  const allAnswered = state.answers.every((a) => a !== null);
  const submitButton = el('button', 'codewalk-quiz-submit');
  submitButton.appendChild(icon('check'));
  submitButton.appendChild(el('span', undefined, '送出答案'));
  submitButton.disabled = !allAnswered;
  submitButton.addEventListener('click', handlers.onSubmitQuiz);

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  container.appendChild(actions);

  return container;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createScoreRing(score: number, total: number, passed: boolean): HTMLElement {
  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : score / total;
  const offset = circumference * (1 - ratio);

  const wrapper = el('div', 'codewalk-score-ring');
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', `得分 ${score} / ${total} 題,${passed ? '通過' : '未通過'}`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('codewalk-score-ring-svg');

  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(radius));
  track.setAttribute('stroke-width', String(strokeWidth));
  track.classList.add('codewalk-score-ring-track');

  const progress = document.createElementNS(SVG_NS, 'circle');
  progress.setAttribute('cx', String(size / 2));
  progress.setAttribute('cy', String(size / 2));
  progress.setAttribute('r', String(radius));
  progress.setAttribute('stroke-width', String(strokeWidth));
  progress.setAttribute('stroke-dasharray', String(circumference));
  progress.setAttribute('stroke-dashoffset', String(offset));
  progress.classList.add('codewalk-score-ring-progress', passed ? 'is-passed' : 'is-failed');

  svg.appendChild(track);
  svg.appendChild(progress);
  wrapper.appendChild(svg);
  wrapper.appendChild(el('span', 'codewalk-score-ring-label', `${score}/${total}`));

  return wrapper;
}

function createOptionExplanations(
  question: CodewalkQuizQuestion,
  optionExplanations: string[],
  userAnswer: number | null,
  onOpenLink: OpenLinkHandler,
): HTMLElement {
  const list = el('div', 'codewalk-quiz-breakdown-explanations');
  question.options.forEach((optionText, optIndex) => {
    const isCorrectOption = optIndex === question.correctIndex;
    const isYourAnswer = optIndex === userAnswer;
    const classes = ['codewalk-quiz-breakdown-explanation'];
    if (isCorrectOption) classes.push('is-correct-option');
    if (isYourAnswer) classes.push('is-your-answer');
    const row = el('div', classes.join(' '));
    row.appendChild(icon(isCorrectOption ? 'pass' : 'close', 'codewalk-quiz-breakdown-explanation-icon'));
    const text = el('div', 'codewalk-quiz-breakdown-explanation-text');
    const optionSpan = el('span', 'codewalk-quiz-breakdown-explanation-option');
    optionSpan.appendChild(renderMarkdownInline(optionText, onOpenLink));
    const bodyDiv = el('div', 'codewalk-quiz-breakdown-explanation-body');
    bodyDiv.appendChild(renderMarkdownBlock(optionExplanations[optIndex], onOpenLink));
    text.appendChild(optionSpan);
    text.appendChild(bodyDiv);
    row.appendChild(text);
    list.appendChild(row);
  });
  return list;
}

function createQuizBreakdown(state: QuizResult, onOpenLink: OpenLinkHandler): HTMLElement {
  const breakdown = el('div', 'codewalk-quiz-breakdown');
  state.walk.quiz.forEach((question, qIndex) => {
    const userAnswer = state.answers[qIndex];
    const isCorrect = userAnswer === question.correctIndex;
    const item = el('div', `codewalk-quiz-breakdown-item ${isCorrect ? 'is-correct' : 'is-incorrect'}`);
    const questionRow = el('p', 'codewalk-quiz-breakdown-question');
    questionRow.appendChild(icon(isCorrect ? 'pass' : 'error', 'codewalk-quiz-breakdown-icon'));
    questionRow.appendChild(document.createTextNode(`${qIndex + 1}. `));
    questionRow.appendChild(renderMarkdownInline(question.question, onOpenLink));
    item.appendChild(questionRow);
    const yourAnswerRow = el('p', 'codewalk-quiz-breakdown-your-answer');
    yourAnswerRow.appendChild(document.createTextNode('你的答案:'));
    if (userAnswer !== null) {
      yourAnswerRow.appendChild(renderMarkdownInline(question.options[userAnswer], onOpenLink));
    } else {
      yourAnswerRow.appendChild(document.createTextNode('(未作答)'));
    }
    item.appendChild(yourAnswerRow);
    if (!isCorrect) {
      const correctAnswerRow = el('p', 'codewalk-quiz-breakdown-correct-answer');
      correctAnswerRow.appendChild(document.createTextNode('正確答案:'));
      correctAnswerRow.appendChild(renderMarkdownInline(question.options[question.correctIndex], onOpenLink));
      item.appendChild(correctAnswerRow);
    }
    const optionExplanations = question.optionExplanations;
    if (optionExplanations) {
      item.appendChild(createOptionExplanations(question, optionExplanations, userAnswer, onOpenLink));
    }
    breakdown.appendChild(item);
  });
  return breakdown;
}

export interface QuizResultHandlers {
  onRetryQuiz: () => void;
  onRestartWalk: () => void;
  onBackToList: () => void;
  onOpenReference: OpenLinkHandler;
}

export function renderQuizResult(state: QuizResult, handlers: QuizResultHandlers): HTMLElement {
  const container = el('div', 'codewalk-quiz-result');
  container.appendChild(el('h2', undefined, 'Quiz 結果'));
  container.appendChild(createScoreRing(state.score, state.walk.quiz.length, state.passed));
  const status = el('p', `codewalk-score-status ${state.passed ? 'is-passed' : 'is-failed'}`);
  status.appendChild(icon(state.passed ? 'pass' : 'error'));
  status.appendChild(document.createTextNode(state.passed ? '通過' : '未通過'));
  container.appendChild(status);
  if (!state.passed) {
    container.appendChild(el('p', 'codewalk-suggestion', '建議重走本導讀,或選擇更詳細版本的導讀再試一次'));
  }
  container.appendChild(createQuizBreakdown(state, handlers.onOpenReference));

  const actions = el('div', 'codewalk-quiz-result-actions');
  const retryButton = el('button');
  retryButton.appendChild(icon('refresh'));
  retryButton.appendChild(el('span', undefined, '重新挑戰 Quiz'));
  retryButton.addEventListener('click', handlers.onRetryQuiz);
  const restartButton = el('button');
  restartButton.appendChild(icon('history'));
  restartButton.appendChild(el('span', undefined, '重新走一次導讀'));
  restartButton.addEventListener('click', handlers.onRestartWalk);
  const backButton = el('button');
  backButton.appendChild(icon('list-unordered'));
  backButton.appendChild(el('span', undefined, '回到導讀列表'));
  backButton.addEventListener('click', handlers.onBackToList);
  actions.appendChild(retryButton);
  actions.appendChild(restartButton);
  actions.appendChild(backButton);
  container.appendChild(actions);

  return container;
}
