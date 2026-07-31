import type { HostToWebviewMessage, WebviewToHostMessage } from '../shared/protocol';
import {
  cancelQuiz,
  createWalkingState,
  enterQuiz,
  nextStep,
  prevStep,
  restartWalk,
  retryQuiz,
  selectQuizAnswer,
  submitQuiz,
  toggleTerm,
  type QuizResult,
  type QuizState,
  type WalkingState,
} from './state';
import { renderError, renderFileList, renderQuiz, renderQuizResult, renderWalking } from './render';
import type { WalkFileSummary } from '../shared/protocol';

declare function acquireVsCodeApi(): { postMessage: (message: WebviewToHostMessage) => void };
const vscode = acquireVsCodeApi();

type Screen =
  | { screen: 'fileList'; files: WalkFileSummary[] }
  | { screen: 'error'; message: string }
  | WalkingState
  | QuizState
  | QuizResult;

let current: Screen = { screen: 'fileList', files: [] };
// 檔案跳轉失敗(如檔案不存在)是「這一步的暫時性警告」,不屬於導覽狀態機的一部分,
// 所以獨立用一個變數保管,切換 step 時清空。
let stepJumpError: string | null = null;
// renderWalking() 每次都是整棵樹重繪(見下方 root.innerHTML = ''),若進場動畫直接
// 掛在容器上,連展開/收合術語這種跟「換步驟」無關的重繪也會整頁重播動畫、造成閃爍。
// 記住上次繪製的 stepIndex,只有真的換步驟(或剛進入 walking 畫面)才觸發動畫。
let lastWalkingStepIndex: number | null = null;

function render(): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';

  if (current.screen === 'fileList') {
    lastWalkingStepIndex = null;
    root.appendChild(renderFileList(current.files, onSelectFile));
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
        },
        stepJumpError,
        isStepTransition,
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

function onNextStep(): void {
  if (current.screen === 'walking') {
    current = nextStep(current);
    stepJumpError = null;
    render();
  }
  vscode.postMessage({ type: 'nextStep' });
}

function onPrevStep(): void {
  if (current.screen === 'walking') {
    current = prevStep(current);
    stepJumpError = null;
    render();
  }
  vscode.postMessage({ type: 'prevStep' });
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
  if (current.screen === 'quizResult') {
    current = { screen: 'fileList', files: [] };
    render();
    vscode.postMessage({ type: 'webviewReady' });
  }
}

window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'walkFileList':
      current = { screen: 'fileList', files: msg.files };
      break;
    case 'walkLoaded':
      current = createWalkingState(msg.walk, msg.refDrifted);
      stepJumpError = null;
      break;
    case 'stepChanged':
      if (current.screen === 'walking') {
        current = { ...current, stepIndex: msg.stepIndex };
        stepJumpError = null;
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
  if (current.screen !== 'walking') return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    onNextStep();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    onPrevStep();
  }
});

render();
document.getElementById('app')?.focus();
vscode.postMessage({ type: 'webviewReady' });
