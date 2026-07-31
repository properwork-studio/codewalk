import type { SnippetPreviewResult, WalkFileSummary } from '../shared/protocol';
import type { CodewalkItem } from '../shared/schema';
import { highlightSnippetLines } from './highlight';
import { isAtLastStep, type QuizResult, type QuizState, type WalkingState } from './state';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name: string, extraClass?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `codicon codicon-${name}${extraClass ? ` ${extraClass}` : ''}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

export function renderFileList(files: WalkFileSummary[], onSelect: (path: string) => void): HTMLElement {
  const container = el('div', 'codewalk-file-list');
  container.appendChild(el('h2', undefined, '選擇導讀'));
  if (files.length === 0) {
    container.appendChild(el('p', 'codewalk-empty', '找不到導讀檔案(workspace 內沒有 .codewalk/*.codewalk.json)'));
    return container;
  }
  const list = el('ul');
  for (const file of files) {
    const item = el('li');
    const button = el('button', 'codewalk-file-item');
    button.appendChild(icon('book'));
    button.appendChild(el('span', 'codewalk-file-item-title', file.title));
    button.addEventListener('click', () => onSelect(file.path));
    item.appendChild(button);
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
}

function renderAnnotation(kind: 'tip' | 'todo', iconName: string, text: string): HTMLElement {
  const box = el('div', `codewalk-annotation codewalk-annotation-${kind}`);
  box.appendChild(icon(iconName, 'codewalk-annotation-icon'));
  box.appendChild(el('p', 'codewalk-annotation-text', text));
  return box;
}

function renderPitfall(misconception: string, reality: string): HTMLElement {
  const box = el('div', 'codewalk-annotation codewalk-annotation-pitfall');
  const header = el('div', 'codewalk-annotation-header');
  header.appendChild(icon('alert', 'codewalk-annotation-icon'));
  header.appendChild(el('span', undefined, '容易誤解的地方'));
  box.appendChild(header);
  const misconceptionRow = el('p', 'codewalk-pitfall-line');
  misconceptionRow.appendChild(el('span', 'codewalk-pitfall-label', '誤解:'));
  misconceptionRow.appendChild(document.createTextNode(misconception));
  const realityRow = el('p', 'codewalk-pitfall-line');
  realityRow.appendChild(el('span', 'codewalk-pitfall-label', '其實:'));
  realityRow.appendChild(document.createTextNode(reality));
  box.appendChild(misconceptionRow);
  box.appendChild(realityRow);
  return box;
}

function renderReference(label: string, url: string, onOpenReference: (url: string) => void): HTMLElement {
  const button = el('button', 'codewalk-reference');
  button.appendChild(icon('link-external'));
  button.appendChild(el('span', undefined, label));
  button.addEventListener('click', () => onOpenReference(url));
  return button;
}

function renderSnippetCode(content: string, language: string, startLine: number): HTMLElement {
  // 'hljs' class 是給 dist/hljs-themes.css(esbuild.js 從官方 highlight.js 主題檔案
  // 產生,見該檔案註解)的 .hljs { background; color } 規則對應用的容器 class,
  // 不是純樣式命名。
  const code = el('div', 'codewalk-snippet-code hljs');
  const lines = highlightSnippetLines(content, language);
  lines.forEach((lineHtml, i) => {
    const row = el('div', 'codewalk-snippet-line');
    row.appendChild(el('span', 'codewalk-snippet-line-number', String(startLine + i)));
    const lineCode = document.createElement('span');
    lineCode.className = 'codewalk-snippet-line-code';
    lineCode.innerHTML = lineHtml.length > 0 ? lineHtml : '&nbsp;';
    row.appendChild(lineCode);
    code.appendChild(row);
  });
  return code;
}

function renderSnippet(
  item: Extract<CodewalkItem, { kind: 'snippet' }>,
  itemIndex: number,
  snippetPreviews: SnippetPreviewResult[],
  onJumpToSnippet: (itemIndex: number) => void,
): HTMLElement {
  const container = el('div', 'codewalk-snippet');
  const header = el('button', 'codewalk-snippet-header');
  header.appendChild(icon('code'));
  const headerText = el('span', 'codewalk-snippet-header-text');
  headerText.appendChild(el('span', 'codewalk-snippet-label', item.label));
  headerText.appendChild(
    el('span', 'codewalk-snippet-file-ref', `${item.file}:${item.startLine}-${item.endLine}`),
  );
  header.appendChild(headerText);
  header.addEventListener('click', () => onJumpToSnippet(itemIndex));
  container.appendChild(header);

  const preview = snippetPreviews.find((p) => p.itemIndex === itemIndex);
  if (preview && preview.ok) {
    container.appendChild(renderSnippetCode(preview.content, preview.language, item.startLine));
  } else if (preview && !preview.ok) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, preview.message));
    container.appendChild(warning);
  }
  return container;
}

function renderItems(
  items: CodewalkItem[],
  snippetPreviews: SnippetPreviewResult[],
  handlers: Pick<WalkingHandlers, 'onOpenReference' | 'onJumpToSnippet'>,
): HTMLElement {
  const container = el('div', 'codewalk-items');
  items.forEach((item, itemIndex) => {
    switch (item.kind) {
      case 'tip':
        container.appendChild(renderAnnotation('tip', 'lightbulb', item.text));
        break;
      case 'todo':
        container.appendChild(renderAnnotation('todo', 'circle-large-outline', item.text));
        break;
      case 'pitfall':
        container.appendChild(renderPitfall(item.misconception, item.reality));
        break;
      case 'reference':
        container.appendChild(renderReference(item.label, item.url, handlers.onOpenReference));
        break;
      case 'snippet':
        container.appendChild(renderSnippet(item, itemIndex, snippetPreviews, handlers.onJumpToSnippet));
        break;
    }
  });
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
  const container = el('div', `codewalk-walking${animateStepChange ? ' is-step-transition' : ''}`);

  if (state.refDrifted) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, '目前 commit 與導讀釘住的版本不同,行號可能漂移'));
    container.appendChild(warning);
  }

  if (jumpError) {
    const warning = el('div', 'codewalk-warning');
    warning.appendChild(icon('warning'));
    warning.appendChild(el('span', undefined, jumpError));
    container.appendChild(warning);
  }

  container.appendChild(el('h2', undefined, state.walk.title));
  container.appendChild(
    el('p', 'codewalk-progress', `第 ${state.stepIndex + 1} / ${state.walk.steps.length} 步`),
  );
  container.appendChild(createStepDots(state.stepIndex, state.walk.steps.length));
  container.appendChild(el('h3', undefined, step.title));
  container.appendChild(el('p', 'codewalk-file-ref', `${step.file}:${step.startLine}-${step.endLine}`));

  container.appendChild(el('p', 'codewalk-narration', step.narration));

  if (step.items && step.items.length > 0) {
    container.appendChild(
      renderItems(step.items, snippetPreviews, {
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
      summary.appendChild(el('span', 'codewalk-term-label', term.term));
      summary.appendChild(icon('chevron-right', 'codewalk-term-chevron'));
      // 用 click + preventDefault 取代監聽 'toggle':設定 details.open 本身就會非同步觸發
      // 'toggle' 事件,若同時監聽 'toggle' 會在下一輪重繪時被自己觸發的事件二次呼叫,
      // 造成「點開又立刻收合」的無窮迴圈。
      summary.addEventListener('click', (event) => {
        event.preventDefault();
        handlers.onToggleTerm(term.term);
      });
      details.appendChild(summary);
      details.appendChild(el('p', undefined, term.explanation));
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
    header.appendChild(el('p', 'codewalk-quiz-question-title', question.question));
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
      const text = el('span', 'codewalk-quiz-option-text', option);
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

function createQuizBreakdown(state: QuizResult): HTMLElement {
  const breakdown = el('div', 'codewalk-quiz-breakdown');
  state.walk.quiz.forEach((question, qIndex) => {
    const userAnswer = state.answers[qIndex];
    const isCorrect = userAnswer === question.correctIndex;
    const item = el('div', `codewalk-quiz-breakdown-item ${isCorrect ? 'is-correct' : 'is-incorrect'}`);
    const questionRow = el('p', 'codewalk-quiz-breakdown-question');
    questionRow.appendChild(icon(isCorrect ? 'pass' : 'error', 'codewalk-quiz-breakdown-icon'));
    questionRow.appendChild(document.createTextNode(`${qIndex + 1}. ${question.question}`));
    item.appendChild(questionRow);
    const yourAnswerText = userAnswer !== null ? question.options[userAnswer] : '(未作答)';
    item.appendChild(el('p', 'codewalk-quiz-breakdown-your-answer', `你的答案:${yourAnswerText}`));
    if (!isCorrect) {
      item.appendChild(
        el('p', 'codewalk-quiz-breakdown-correct-answer', `正確答案:${question.options[question.correctIndex]}`),
      );
    }
    breakdown.appendChild(item);
  });
  return breakdown;
}

export interface QuizResultHandlers {
  onRetryQuiz: () => void;
  onRestartWalk: () => void;
  onBackToList: () => void;
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
    container.appendChild(
      el('p', 'codewalk-suggestion', '建議重走本導讀,或選擇更詳細版本的導讀再試一次'),
    );
  }
  container.appendChild(createQuizBreakdown(state));

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
