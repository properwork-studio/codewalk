import { detectLanguage } from '../../shared/language';
import { effectiveLineRange, type AnchorStatus, type SnippetPreviewResult } from '../../shared/protocol';
import type { CodewalkStep } from '../../shared/schema';
import { renderMarkdownBlock, renderMarkdownInline } from '../markdown';
import { isAtLastStep, type WalkingState } from '../state';
import { el, icon } from './dom';
import { renderItems, renderSnippetCode, renderStaleLabel } from './items';

/** 走讀畫面:步驟敘述、術語卡、說明元件,以及失準時的重生引導。 */

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
