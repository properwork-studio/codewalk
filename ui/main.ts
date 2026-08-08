import { resolveLocale, setLocale } from '../shared/i18n';
import type { HostToWebviewMessage, SnippetPreviewResult, WebviewToHostMessage } from '../shared/protocol';
import { applyEditorTheme, onHighlightReady } from './highlight';
import {
  applyPersistedUiState,
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
  type PersistedUiState,
  type QuizResult,
  type QuizState,
  type WalkingState,
} from './state';
import { renderError, renderFileList, renderQuiz, renderQuizResult, renderWalking } from './render';

declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewToHostMessage) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};
const vscode = acquireVsCodeApi();

// src/ 與 ui/ 是兩份獨立 bundle,各自持有 shared/i18n.ts 的模組狀態——這裡
// 的 setLocale() 只影響 webview 這一份,host 側在 extension.ts 的 activate()
// 已各自設定過(design.md 決策 2、5)。document.documentElement.lang 由
// viewProvider.ts 的 getHtml() 依 host locale 寫入,所以兩邊算出的 locale
// 相同。
setLocale(resolveLocale(document.documentElement.lang));

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
// walkRestored 到達時若要還原捲動位置,得等 render() 把新畫面畫出來後才能設定
// window.scrollTo——用這個變數把「該還原到哪」從訊息處理帶到 render() 之後。
let pendingScrollRestore: number | null = null;

function isPersistedUiState(value: unknown): value is PersistedUiState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ref === 'string' &&
    (v.screen === 'walking' || v.screen === 'quiz' || v.screen === 'quizResult') &&
    typeof v.stepIndex === 'number' &&
    Array.isArray(v.expandedTerms) &&
    Array.isArray(v.answers) &&
    typeof v.scrollTop === 'number'
  );
}

function readPersistedUiState(): PersistedUiState | null {
  const raw = vscode.getState();
  return isPersistedUiState(raw) ? raw : null;
}

/**
 * 每次 render() 後把目前畫面存進 vscode.setState()——webview 真的被重建時,
 * VS Code 會把這份 state 原樣還給重建後的 script(design.md 決策 4)。
 */
function persistUiState(): void {
  if (current.screen !== 'walking' && current.screen !== 'quiz' && current.screen !== 'quizResult') return;
  const state: PersistedUiState = {
    ref: current.walk.ref,
    screen: current.screen,
    stepIndex: current.screen === 'walking' ? current.stepIndex : 0,
    expandedTerms: current.screen === 'walking' ? Array.from(current.expandedTerms) : [],
    answers: current.screen === 'quiz' || current.screen === 'quizResult' ? current.answers : [],
    scrollTop: window.scrollY,
  };
  vscode.setState(state);
}

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

/**
 * event.composedPath() 在事件派發當下就固定路徑,不受後續 render() 整棵樹
 * 重建、把原始 target 逐出 DOM 影響——用它判斷「這次點擊是否發生在選單內」
 * 才不會撞上時序問題(design.md 決策 6)。
 */
function isInsideAttemptMenu(event: MouseEvent): boolean {
  return event
    .composedPath()
    .some((node) => node instanceof Element && node.classList.contains('codewalk-attempt-menu'));
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
          onResume: onResumeWalk,
        },
      ),
    );
    restoreFileListFocus(root, current);
  } else if (current.screen === 'error') {
    lastWalkingStepIndex = null;
    root.appendChild(renderError(current.message, onBackToList));
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
          onOpenStaleFile: onOpenStaleFile,
          onCopyRegenerateHint: onCopyRegenerateHint,
          onRevealCurrentStep: onRevealCurrentStep,
        },
        stepJumpError,
        isStepTransition,
        snippetPreviews,
      ),
    );
  } else if (current.screen === 'quiz') {
    lastWalkingStepIndex = null;
    root.appendChild(renderQuiz(current, { onSelectAnswer, onSubmitQuiz, onCancelQuiz, onOpenReference }));
  } else if (current.screen === 'quizResult') {
    lastWalkingStepIndex = null;
    root.appendChild(
      renderQuizResult(current, {
        onRetryQuiz: onRetryQuiz,
        onRestartWalk: onRestartWalk,
        onBackToList: onBackToList,
        onOpenReference: onOpenReference,
      }),
    );
  }
  persistUiState();
}

function onSelectFile(path: string): void {
  vscode.postMessage({ type: 'selectWalkFile', path });
}

function onResumeWalk(path: string): void {
  vscode.postMessage({ type: 'resumeWalk', path });
}

function onRevealCurrentStep(): void {
  vscode.postMessage({ type: 'revealCurrentStep' });
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

/**
 * 失準的主 step 沒有既有的點擊跳轉(只有 snippet 項目有),重用既有的
 * jumpToStep 訊息重新觸發 host 端的自動跳轉——host 會依失準狀態走開檔不選取模式。
 */
function onOpenStaleFile(): void {
  if (current.screen === 'walking') {
    vscode.postMessage({ type: 'jumpToStep', stepIndex: current.stepIndex });
  }
}

function onCopyRegenerateHint(): void {
  vscode.postMessage({ type: 'copyRegenerateHint' });
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
  if (current.screen === 'quizResult' || current.screen === 'walking' || current.screen === 'error') {
    current = createFileListState([]);
    render();
    // 不能重用 webviewReady——host 用 currentWalk 是否存在判斷「該不該回灌
    // walkRestored」,若沿用 webviewReady 會讓 host 誤以為仍在同一份導讀,
    // 剛回到列表就被 walkRestored 立刻拉回去(shared/protocol.ts 的說明)。
    vscode.postMessage({ type: 'backToList' });
  }
}

window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'walkFileList':
      current = createFileListState(msg.files);
      break;
    case 'walkLoaded':
      // createWalkingState() 固定從 stepIndex 0 起始(既有函式,原本只給「一律從
      // 頭開始」的載入路徑用)——「接續上次」會讓 host 送非 0 的 stepIndex,這裡
      // 要覆寫回去,否則永遠卡在第一步(reading-progress capability「接續上次的
      // 閱讀進度」)。
      current = {
        ...createWalkingState(msg.walk, msg.refDrifted, msg.anchorReport),
        stepIndex: msg.stepIndex,
      };
      stepJumpError = null;
      snippetPreviews = msg.snippetPreviews;
      break;
    case 'walkRestored': {
      const persisted = readPersistedUiState();
      const restored = applyPersistedUiState(
        msg.walk,
        msg.stepIndex,
        msg.refDrifted,
        msg.anchorReport,
        persisted,
      );
      current = restored;
      stepJumpError = null;
      // snippetPreviews 是 host 依 msg.stepIndex 讀出的內容——只有還原結果
      // 剛好落在同一步時才能沿用,否則寧可先留白,等讀者切步驟時自然補上。
      snippetPreviews =
        restored.screen === 'walking' && restored.stepIndex === msg.stepIndex ? msg.snippetPreviews : [];
      pendingScrollRestore = persisted && persisted.ref === msg.walk.ref ? persisted.scrollTop : null;
      break;
    }
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
    case 'themeChanged':
      // applyEditorTheme() 是非同步(loadTheme 要等 Shiki 內部處理完成),下面的
      // render() 這時多半還在用舊主題;等套用完成後再補一次 render() 才會真的
      // 換色。目前畫面若剛好不是 walking(沒有 snippet/diff 要重繪)就不必補繪。
      void applyEditorTheme(msg.theme, msg.kind).then(() => {
        if (current.screen === 'walking') render();
      });
      break;
  }
  render();
  if (pendingScrollRestore !== null) {
    const target = pendingScrollRestore;
    pendingScrollRestore = null;
    requestAnimationFrame(() => window.scrollTo({ top: target }));
  }
});

// 高亮引擎初始化是非同步的(見 ui/highlight.ts);就緒前 snippet/diff 已經以
// 純文字先顯示(design.md 決策 6),這裡在就緒後補一次重繪讓它們換上顏色。
onHighlightReady(() => {
  if (current.screen === 'walking') render();
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
    } else if (event.key === 'Home' || event.key === 'r' || event.key === 'R') {
      // 主鍵是 Home,不是字母鍵——中文輸入法作用中時,字母鍵的 keydown 可能被
      // 輸入法攔截去組字,事件到不了這裡(實測 R 在中文輸入法環境下完全無反應,
      // 方向鍵/Escape 因為不是字母鍵而不受影響)。保留 r/R 給英文鍵盤環境當備用鍵。
      event.preventDefault();
      onRevealCurrentStep();
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

// 捲動位置屬於「webview 自行保留的細節狀態」(design.md 決策 4),沒有對應的
// 互動事件可以掛,所以用節流過的 scroll 監聽補齊——rAF旗標避免同一畫面每個
// scroll 事件都重新寫入 setState。
let scrollPersistScheduled = false;
window.addEventListener(
  'scroll',
  () => {
    if (scrollPersistScheduled) return;
    scrollPersistScheduled = true;
    requestAnimationFrame(() => {
      scrollPersistScheduled = false;
      persistUiState();
    });
  },
  { passive: true },
);

render();
document.getElementById('app')?.focus();
vscode.postMessage({ type: 'webviewReady' });
