import type { WalkFileSummary } from '../shared/protocol';
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
    const button = el('button', 'codewalk-file-item', file.title);
    button.addEventListener('click', () => onSelect(file.path));
    item.appendChild(button);
    list.appendChild(item);
  }
  container.appendChild(list);
  return container;
}

export function renderError(message: string): HTMLElement {
  const container = el('div', 'codewalk-error');
  container.appendChild(el('p', undefined, message));
  return container;
}

export interface WalkingHandlers {
  onNext: () => void;
  onPrev: () => void;
  onToggleTerm: (term: string) => void;
  onEnterQuiz: () => void;
}

export function renderWalking(state: WalkingState, handlers: WalkingHandlers): HTMLElement {
  const step = state.walk.steps[state.stepIndex];
  const container = el('div', 'codewalk-walking');

  if (state.refDrifted) {
    container.appendChild(
      el('div', 'codewalk-warning', '⚠ 目前 commit 與導讀釘住的版本不同,行號可能漂移'),
    );
  }

  container.appendChild(el('h2', undefined, state.walk.title));
  container.appendChild(
    el('p', 'codewalk-progress', `第 ${state.stepIndex + 1} / ${state.walk.steps.length} 步`),
  );
  container.appendChild(el('h3', undefined, step.title));
  container.appendChild(el('p', 'codewalk-file-ref', `${step.file}:${step.startLine}-${step.endLine}`));
  container.appendChild(el('p', 'codewalk-narration', step.narration));

  if (step.terms && step.terms.length > 0) {
    const termsContainer = el('div', 'codewalk-terms');
    for (const term of step.terms) {
      const details = document.createElement('details');
      details.open = state.expandedTerms.has(term.term);
      const summary = el('summary', undefined, term.term);
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
  const prevButton = el('button', 'codewalk-nav-prev', '← 上一步');
  prevButton.disabled = state.stepIndex === 0;
  prevButton.addEventListener('click', handlers.onPrev);
  const nextButton = el('button', 'codewalk-nav-next', '下一步 →');
  nextButton.disabled = isAtLastStep(state);
  nextButton.addEventListener('click', handlers.onNext);
  nav.appendChild(prevButton);
  nav.appendChild(nextButton);
  container.appendChild(nav);

  if (isAtLastStep(state)) {
    container.appendChild(el('p', 'codewalk-hint', '已到達最後一步,可以開始自測'));
    const quizButton = el('button', 'codewalk-enter-quiz', '開始 Quiz 自測');
    quizButton.addEventListener('click', handlers.onEnterQuiz);
    container.appendChild(quizButton);
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

  state.walk.quiz.forEach((question, qIndex) => {
    const block = el('div', 'codewalk-quiz-question');
    block.appendChild(el('p', undefined, `${qIndex + 1}. ${question.question}`));
    const optionsList = el('ul');
    question.options.forEach((option, optIndex) => {
      const item = el('li');
      const label = el('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `codewalk-quiz-q${qIndex}`;
      radio.checked = state.answers[qIndex] === optIndex;
      radio.addEventListener('change', () => handlers.onSelectAnswer(qIndex, optIndex));
      label.appendChild(radio);
      label.appendChild(document.createTextNode(option));
      item.appendChild(label);
      optionsList.appendChild(item);
    });
    block.appendChild(optionsList);
    container.appendChild(block);
  });

  const actions = el('div', 'codewalk-quiz-actions');
  const cancelButton = el('button', 'codewalk-quiz-cancel', '← 取消,回到最後一步');
  cancelButton.addEventListener('click', handlers.onCancelQuiz);

  const allAnswered = state.answers.every((a) => a !== null);
  const submitButton = el('button', 'codewalk-quiz-submit', '送出答案');
  submitButton.disabled = !allAnswered;
  submitButton.addEventListener('click', handlers.onSubmitQuiz);

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  container.appendChild(actions);

  return container;
}

export interface QuizResultHandlers {
  onRetryQuiz: () => void;
  onRestartWalk: () => void;
  onBackToList: () => void;
}

export function renderQuizResult(state: QuizResult, handlers: QuizResultHandlers): HTMLElement {
  const container = el('div', 'codewalk-quiz-result');
  container.appendChild(el('h2', undefined, 'Quiz 結果'));
  container.appendChild(
    el('p', 'codewalk-score', `答對 ${state.score} / ${state.walk.quiz.length} 題`),
  );
  if (!state.passed) {
    container.appendChild(
      el('p', 'codewalk-suggestion', '建議重走本導讀,或選擇更詳細版本的導讀再試一次'),
    );
  }

  const actions = el('div', 'codewalk-quiz-result-actions');
  const retryButton = el('button', undefined, '重新挑戰 Quiz');
  retryButton.addEventListener('click', handlers.onRetryQuiz);
  const restartButton = el('button', undefined, '重新走一次導讀');
  restartButton.addEventListener('click', handlers.onRestartWalk);
  const backButton = el('button', undefined, '回到導讀列表');
  backButton.addEventListener('click', handlers.onBackToList);
  actions.appendChild(retryButton);
  actions.appendChild(restartButton);
  actions.appendChild(backButton);
  container.appendChild(actions);

  return container;
}
