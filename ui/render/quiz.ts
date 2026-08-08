import { t } from '../../shared/i18n';
import type { CodewalkQuizQuestion } from '../../shared/schema';
import { renderMarkdownBlock, renderMarkdownInline, type OpenLinkHandler } from '../markdown';
import type { QuizResult, QuizState } from '../state';
import { el, icon } from './dom';

/** 走完導讀之後的兩個畫面:作答與結果。 */

export interface QuizHandlers {
  onSelectAnswer: (questionIndex: number, optionIndex: number) => void;
  onSubmitQuiz: () => void;
  onCancelQuiz: () => void;
  onOpenReference: OpenLinkHandler;
}

export function renderQuiz(state: QuizState, handlers: QuizHandlers): HTMLElement {
  const container = el('div', 'codewalk-quiz');
  container.appendChild(el('h2', undefined, t('quiz.title')));

  const answeredCount = state.answers.filter((a) => a !== null).length;
  const answeredProgress = t('quiz.answeredProgress', {
    answered: answeredCount,
    total: state.walk.quiz.length,
  });
  container.appendChild(el('p', 'codewalk-quiz-progress', answeredProgress));
  const progressDots = el('div', 'codewalk-step-dots');
  progressDots.setAttribute('role', 'img');
  progressDots.setAttribute('aria-label', answeredProgress);
  state.answers.forEach((answer, i) => {
    const dot = el('span', `codewalk-step-dot${answer !== null ? ' is-done' : ''}`);
    dot.title = t(answer !== null ? 'quiz.questionDotTitleAnswered' : 'quiz.questionDotTitle', { n: i + 1 });
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
  cancelButton.appendChild(el('span', undefined, t('quiz.cancel')));
  cancelButton.addEventListener('click', handlers.onCancelQuiz);

  const allAnswered = state.answers.every((a) => a !== null);
  const submitButton = el('button', 'codewalk-quiz-submit');
  submitButton.appendChild(icon('check'));
  submitButton.appendChild(el('span', undefined, t('quiz.submit')));
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
  wrapper.setAttribute(
    'aria-label',
    t('quiz.scoreLabel', { score, total, status: t(passed ? 'quiz.passed' : 'quiz.failed') }),
  );

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
    yourAnswerRow.appendChild(document.createTextNode(t('quiz.yourAnswer')));
    if (userAnswer !== null) {
      yourAnswerRow.appendChild(renderMarkdownInline(question.options[userAnswer], onOpenLink));
    } else {
      yourAnswerRow.appendChild(document.createTextNode(t('quiz.notAnswered')));
    }
    item.appendChild(yourAnswerRow);
    if (!isCorrect) {
      const correctAnswerRow = el('p', 'codewalk-quiz-breakdown-correct-answer');
      correctAnswerRow.appendChild(document.createTextNode(t('quiz.correctAnswer')));
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
  container.appendChild(el('h2', undefined, t('quiz.resultTitle')));
  container.appendChild(createScoreRing(state.score, state.walk.quiz.length, state.passed));
  const status = el('p', `codewalk-score-status ${state.passed ? 'is-passed' : 'is-failed'}`);
  status.appendChild(icon(state.passed ? 'pass' : 'error'));
  status.appendChild(document.createTextNode(t(state.passed ? 'quiz.passed' : 'quiz.failed')));
  container.appendChild(status);
  if (!state.passed) {
    container.appendChild(el('p', 'codewalk-suggestion', t('quiz.suggestion')));
  }
  container.appendChild(createQuizBreakdown(state, handlers.onOpenReference));

  const actions = el('div', 'codewalk-quiz-result-actions');
  const retryButton = el('button');
  retryButton.appendChild(icon('refresh'));
  retryButton.appendChild(el('span', undefined, t('quiz.retry')));
  retryButton.addEventListener('click', handlers.onRetryQuiz);
  const restartButton = el('button');
  restartButton.appendChild(icon('history'));
  restartButton.appendChild(el('span', undefined, t('quiz.restartWalk')));
  restartButton.addEventListener('click', handlers.onRestartWalk);
  const backButton = el('button');
  backButton.appendChild(icon('list-unordered'));
  backButton.appendChild(el('span', undefined, t('quiz.backToList')));
  backButton.addEventListener('click', handlers.onBackToList);
  actions.appendChild(retryButton);
  actions.appendChild(restartButton);
  actions.appendChild(backButton);
  container.appendChild(actions);

  return container;
}
