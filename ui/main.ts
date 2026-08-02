import type { HostToWebviewMessage, SnippetPreviewResult, WebviewToHostMessage } from '../shared/protocol';
import {
  cancelQuiz,
  closeAttemptMenu,
  createFileListState,
  createWalkingState,
  enterQuiz,
  nextStep,
  prevStep,
  restartWalk,
  retryQuiz,
  selectQuizAnswer,
  setPendingClear,
  submitQuiz,
  toggleAttemptMenu,
  toggleTerm,
  type FileListState,
  type QuizResult,
  type QuizState,
  type WalkingState,
} from './state';
import { renderError, renderFileList, renderQuiz, renderQuizResult, renderWalking } from './render';

declare function acquireVsCodeApi(): { postMessage: (message: WebviewToHostMessage) => void };
const vscode = acquireVsCodeApi();

type Screen = FileListState | { screen: 'error'; message: string } | WalkingState | QuizState | QuizResult;

let current: Screen = createFileListState([]);
// 檔案跳轉失敗(如檔案不存在)是「這一步的暫時性警告」,不屬於導覽狀態機的一部分,
// 所以獨立用一個變數保管,切換 step 時清空。
let stepJumpError: string | null = null;
// snippet 預覽內容由 host 隨 walkLoaded/stepChanged 送達,是「目前 step 的暫時性資料」,
// 跟 stepJumpError 一樣不屬於狀態機本身,切換 step 時先清空、等新訊息到達再補上。
let snippetPreviews: SnippetPreviewResult[] = [];
// renderWalking() 每次都是整棵樹重繪(見下方 root.innerHTML = ''),若進場動畫直接
// 掛在容器上,連展開/收合術語這種跟「換步驟」無關的重繪也會整頁重播動畫、造成閃爍。
// 記住上次繪製的 stepIndex,只有真的換步驟(或剛進入 walking 畫面)才觸發動畫。
let lastWalkingStepIndex: number | null = null;
// 全樹重繪(root.innerHTML = '')會讓舊的選單控制項連同焦點一起被銷毀,鍵盤
// 操作者會被彈回文件最前面、得重新 Tab 一輪。記住最近一次互動過選單的導讀
// 路徑,重繪後把焦點還給同一列對應的控制項。
let menuFocusPath: string | null = null;

function restoreFileListFocus(root: HTMLElement, state: FileListState): void {
  if (state.openMenuPath !== null) {
    // 選單剛展開(或維持展開中的確認態):焦點直接落在選單項目上,不需要
    // 讀者再按一次 Tab 才碰得到它。
    root.querySelector<HTMLButtonElement>('.codewalk-attempt-menu-item')?.focus();
    return;
  }
  if (menuFocusPath === null) return;
  const path = menuFocusPath;
  menuFocusPath = null;
  const row = Array.from(root.querySelectorAll<HTMLElement>('.codewalk-file-item-row')).find(
    (r) => r.dataset.walkPath === path,
  );
  if (!row) return;
  const trigger = row.querySelector<HTMLButtonElement>('.codewalk-attempt-menu-trigger');
  (trigger ?? row.querySelector<HTMLButtonElement>('.codewalk-file-item'))?.focus();
}

/** event.composedPath() 在事件派發當下就固定路徑,不受後續 render() 整棵樹
 * 重建、把原始 target 逐出 DOM 影響——用它判斷「這次點擊是否發生在選單內」
 * 才不會撞上時序問題(design.md 決策 6)。 */
function isInsideAttemptMenu(event: MouseEvent): boolean {
  return event.composedPath().some((node) => node instanceof Element && node.classList.contains('codewalk-attempt-menu'));
}

function render(): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';

  if (current.screen === 'fileList') {
    lastWalkingStepIndex = null;
    root.appendChild(
      renderFileList(
        current.files,
        { openMenuPath: current.openMenuPath, pendingClearPath: current.pendingClearPath },
        {
          onSelect: onSelectFile,
          onToggleMenu: onToggleAttemptMenu,
          onTriggerClear: onTriggerClearAttempt,
        },
      ),
    );
    restoreFileListFocus(root, current);
  } else if (current.screen === 'error') {
    lastWalkingStepIndex = null;
    root.appendChild(renderError(current.message));
  } else if (current.screen === 'walking') {
    const isStepTransition = lastWalkingStepIndex !== current.stepIndex;
    lastWalkingStepIndex = current.stepIndex;
    root.appendChild(
      renderWalking(
        current,
        {
          onNext: onNextStep,
          onPrev: onPrevStep,
          onToggleTerm: onToggleTerm,
          onEnterQuiz: onEnterQuiz,
          onOpenReference: onOpenReference,
          onJumpToSnippet: onJumpToSnippet,
          onBackToList: onBackToList,
        },
        stepJumpError,
        isStepTransition,
        snippetPreviews,
      ),
    );
  } else if (current.screen === 'quiz') {
    lastWalkingStepIndex = null;
    root.appendChild(renderQuiz(current, { onSelectAnswer, onSubmitQuiz, onCancelQuiz }));
  } else if (current.screen === 'quizResult') {
    lastWalkingStepIndex = null;
    root.appendChild(
      renderQuizResult(current, {
        onRetryQuiz: onRetryQuiz,
        onRestartWalk: onRestartWalk,
        onBackToList: onBackToList,
      }),
    );
  }
}

function onSelectFile(path: string): void {
  vscode.postMessage({ type: 'selectWalkFile', path });
}

function onToggleAttemptMenu(path: string): void {
  if (current.screen !== 'fileList') return;
  menuFocusPath = path;
  current = toggleAttemptMenu(current, path);
  render();
}

function onTriggerClearAttempt(path: string): void {
  if (current.screen !== 'fileList') return;
  menuFocusPath = path;
  if (current.pendingClearPath === path) {
    vscode.postMessage({ type: 'clearAttempt', path });
    current = closeAttemptMenu(current);
  } else {
    current = setPendingClear(current, path);
  }
  render();
}

function onNextStep(): void {
  if (current.screen === 'walking') {
    current = nextStep(current);
    stepJumpError = null;
    snippetPreviews = [];
    render();
  }
  vscode.postMessage({ type: 'nextStep' });
}

function onPrevStep(): void {
  if (current.screen === 'walking') {
    current = prevStep(current);
    stepJumpError = null;
    snippetPreviews = [];
    render();
  }
  vscode.postMessage({ type: 'prevStep' });
}

function onOpenReference(url: string): void {
  vscode.postMessage({ type: 'openReference', url });
}

function onJumpToSnippet(itemIndex: number): void {
  if (current.screen === 'walking') {
    vscode.postMessage({ type: 'jumpToSnippet', stepIndex: current.stepIndex, itemIndex });
  }
}

function onToggleTerm(term: string): void {
  if (current.screen === 'walking') {
    current = toggleTerm(current, term);
    render();
  }
}

function onEnterQuiz(): void {
  if (current.screen === 'walking') {
    current = enterQuiz(current);
    render();
  }
}

function onSelectAnswer(questionIndex: number, optionIndex: number): void {
  if (current.screen === 'quiz') {
    current = selectQuizAnswer(current, questionIndex, optionIndex);
    render();
  }
}

function onSubmitQuiz(): void {
  if (current.screen === 'quiz') {
    const result = submitQuiz(current);
    vscode.postMessage({ type: 'quizSubmitted', answers: result.answers.map((a) => a ?? -1) });
    current = result;
    render();
  }
}

function onCancelQuiz(): void {
  if (current.screen === 'quiz') {
    const walking = cancelQuiz(current);
    current = walking;
    render();
    vscode.postMessage({ type: 'jumpToStep', stepIndex: walking.stepIndex });
  }
}

function onRetryQuiz(): void {
  if (current.screen === 'quizResult') {
    current = retryQuiz(current);
    render();
  }
}

function onRestartWalk(): void {
  if (current.screen === 'quizResult') {
    current = restartWalk(current);
    render();
    vscode.postMessage({ type: 'jumpToStep', stepIndex: 0 });
  }
}

function onBackToList(): void {
  if (current.screen === 'quizResult' || current.screen === 'walking') {
    current = createFileListState([]);
    render();
    vscode.postMessage({ type: 'webviewReady' });
  }
}

window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'walkFileList':
      current = createFileListState(msg.files);
      break;
    case 'walkLoaded':
      current = createWalkingState(msg.walk, msg.refDrifted);
      stepJumpError = null;
      snippetPreviews = msg.snippetPreviews;
      break;
    case 'stepChanged':
      if (current.screen === 'walking') {
        current = { ...current, stepIndex: msg.stepIndex };
        stepJumpError = null;
        snippetPreviews = msg.snippetPreviews;
      }
      break;
    case 'loadError':
      current = { screen: 'error', message: msg.message };
      break;
    case 'stepJumpError':
      stepJumpError = msg.message;
      break;
  }
  render();
});

// 不依賴 VS Code 指令系統的 keybinding when 條件比對——直接在 webview 內監聽鍵盤事件,
// 只要面板本身有 DOM focus(見下方 #app.focus())就會生效,行為更可預期。
window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (current.screen === 'fileList') {
    if (event.key === 'Escape' && current.openMenuPath !== null) {
      menuFocusPath = current.openMenuPath;
      current = closeAttemptMenu(current);
      render();
    }
    return;
  }
  if (current.screen === 'walking') {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onNextStep();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onPrevStep();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onBackToList();
    }
  }
});

// 選單收合的「點擊外部」判定——見上方 isInsideAttemptMenu 的時序陷阱說明。
window.addEventListener('click', (event: MouseEvent) => {
  if (current.screen !== 'fileList' || current.openMenuPath === null) return;
  if (isInsideAttemptMenu(event)) return;
  menuFocusPath = current.openMenuPath;
  current = closeAttemptMenu(current);
  render();
});

render();
document.getElementById('app')?.focus();
vscode.postMessage({ type: 'webviewReady' });
