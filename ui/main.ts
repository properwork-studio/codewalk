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

function render(): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';

  if (current.screen === 'fileList') {
    root.appendChild(renderFileList(current.files, onSelectFile));
  } else if (current.screen === 'error') {
    root.appendChild(renderError(current.message));
  } else if (current.screen === 'walking') {
    root.appendChild(
      renderWalking(current, {
        onNext: onNextStep,
        onPrev: onPrevStep,
        onToggleTerm: onToggleTerm,
        onEnterQuiz: onEnterQuiz,
      }),
    );
  } else if (current.screen === 'quiz') {
    root.appendChild(renderQuiz(current, { onSelectAnswer, onSubmitQuiz, onCancelQuiz }));
  } else if (current.screen === 'quizResult') {
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
    render();
  }
  vscode.postMessage({ type: 'nextStep' });
}

function onPrevStep(): void {
  if (current.screen === 'walking') {
    current = prevStep(current);
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
      break;
    case 'stepChanged':
      if (current.screen === 'walking') {
        current = { ...current, stepIndex: msg.stepIndex };
      }
      break;
    case 'loadError':
      current = { screen: 'error', message: msg.message };
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
